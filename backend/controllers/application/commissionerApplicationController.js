const Application = require('../../models/Application');
const Credential = require('../../models/Credential');
const { APPLICATION_STATUS } = require('../../utils/constants');
const ipfsService = require('../../services/ipfsService');
const blockchainService = require('../../services/blockchainService');
const crypto = require('crypto');

const { signVCWithVault } = require('../../utils/vaultSigner');

/**
 * Controller: Commissioner processes an application
 * Handles APPROVE or REJECT actions
 *
 * Flow for APPROVE:
 * 1. Build VC payload
 * 2. Sign VC using Vault Transit engine (private key never leaves Vault)
 * 3. Upload VC JWT to IPFS
 * 4. Compute SHA256 hash of VC JWT
 * 5. Issue credential on blockchain
 * 6. Save credential in MongoDB
 * 7. Update application history
 *
 * Flow for REJECT:
 * 1. Update application status and history
 *
 * @route POST /api/applications/:id/process
 * @body { action: 'APPROVE' | 'REJECT', reviewComments?: string }
 */
const processApplication = async (req, res) => {
  try {
    const { action, reviewComments } = req.body;
    const applicationId = req.params.id;

    // Fetch the application
    const application = await Application.findOne({ applicationId });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const commissioner = req.user;

    // Only commissioners can process applications
    if (commissioner.role !== 'COMMISSIONER') {
      return res.status(403).json({ success: false, message: 'Only commissioners can process applications.' });
    }

    // Ensure the application is forwarded to this commissioner
    if (application.forwardedCommissioner?.toString() !== commissioner._id.toString()) {
      return res.status(403).json({ success: false, message: 'Application not assigned to you.' });
    }

    // Ensure correct application status
    if (application.status !== APPLICATION_STATUS.FORWARDED_TO_COMMISSIONER) {
      return res.status(400).json({ success: false, message: 'Application not ready for commissioner action.' });
    }

    /** --------------------
     * Handle REJECTION
     * -------------------- */
    if (action === 'REJECT') {
      application.status = APPLICATION_STATUS.REJECTED;
      application.reviewComments = reviewComments || '';
      application.updatedAt = new Date();

      if (!Array.isArray(application.history)) application.history = [];
      application.history.push({
        action: 'REJECTED',
        by: { id: commissioner._id, name: commissioner.name, did: commissioner.did },
        at: new Date(),
        note: reviewComments || 'Application rejected'
      });

      await application.save();
      return res.json({ success: true, message: 'Application rejected successfully.', data: application });
    }

    /** --------------------
     * Handle APPROVAL
     * -------------------- */
    if (action === 'APPROVE') {

      // Ensure applicant DID exists
      if (!application.applicant?.did) {
        return res.status(400).json({ success: false, message: 'Applicant DID is missing. Cannot issue credential.' });
      }

      // Prevent duplicate issuance
      const existingCredential = await Credential.findOne({ applicationId });
      if (existingCredential) {
        return res.status(400).json({
          success: false,
          message: 'Credential already issued for this application.',
          credential: existingCredential
        });
      }

      /** --------------------
       * Build VC payload
       * -------------------- */
      const vcPayload = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        id: `vc-${application.applicationId}`,
        type: ["VerifiableCredential", `${application.type}_Credential`],
        issuer: {
          id: commissioner.did,
          name: commissioner.name,
          department: commissioner.department
        },
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: application.applicant.did,
          applicant: application.applicant,
          applicationId: application.applicationId,
          type: application.type,
          department: application.department,
          details: {
            birth: application.birthDetails,
            death: application.deathDetails,
            trade: application.tradeDetails,
            noc: application.nocDetails
          }
        }
      };

      /** --------------------
       * Sign VC using Vault
       * -------------------- */
     const vcJwt = await signVCWithVault(vcPayload, 'commissioner-key-u123');

      /** --------------------
       * Upload VC JWT to IPFS
       * -------------------- */
      const ipfsResult = await ipfsService.uploadJSON({ vcJwt });
      const ipfsCID = typeof ipfsResult === 'string' ? ipfsResult : ipfsResult.cid;

      /** --------------------
       * Compute SHA256 hash for blockchain
       * -------------------- */
      const vcHash = crypto.createHash('sha256').update(vcJwt).digest('hex');

      /** --------------------
       * Generate unique credential ID
       * -------------------- */
      const credentialId = `cred-${application.applicationId}-${Date.now()}`;

      /** --------------------
       * Issue credential on blockchain
       * -------------------- */
      const departmentRoleMap = {
        'HEALTHCARE': 'HEALTHCARE_COMMISSIONER',
        'LICENSE': 'LICENSE_COMMISSIONER',
        'NOC': 'NOC_COMMISSIONER'
      };
      const role = departmentRoleMap[application.department] || 'ADMIN';
      blockchainService.setSigner(role);

      const tx = await blockchainService.issueCredential(
        credentialId,
        vcHash,
        ipfsCID,
        commissioner.did,
        application.applicant.did,
        0,
        `${application.type}_Credential`
      );

      /** --------------------
       * Save credential in MongoDB
       * -------------------- */
      const newCredential = new Credential({
        applicationId,
        credentialId,
        type: application.type,
        vcData: { vcJwt },
        vcSignature: 'VAULT_SIGNED',
        ipfsCID,
        credentialHash: vcHash,
        issuerDID: commissioner.did,
        holderDID: application.applicant.did,
        issuerAddress: commissioner.blockchainAddress,
        registryContract: process.env.CONTRACT_ADDRESS,
        blockchainTxHash: tx.transactionHash,
        schemaType: `${application.type}_Credential`,
        issuedAt: new Date(),
        credentialStatus: 'ISSUED'
      });
      await newCredential.save();

      /** --------------------
       * Update application
       * -------------------- */
      application.status = APPLICATION_STATUS.APPROVED;
      application.reviewComments = reviewComments || '';
      application.credential = newCredential._id;
      application.updatedAt = new Date();
      application.issuedAt = new Date();

      if (!Array.isArray(application.history)) application.history = [];
      application.history.push({
        action: 'APPROVED_AND_ISSUED',
        by: { id: commissioner._id, name: commissioner.name, did: commissioner.did },
        at: application.issuedAt,
        note: 'VC issued via Vault, uploaded to IPFS, anchored on blockchain'
      });

      await application.save();

      return res.json({
        success: true,
        message: 'Application approved and credential issued successfully.',
        data: {
          application: {
            applicationId: application.applicationId,
            status: application.status,
            type: application.type
          },
          credential: {
            credentialId: newCredential.credentialId,
            schemaType: newCredential.schemaType,
            issuedAt: newCredential.issuedAt
          },
          ipfsCID,
          blockchainTx: newCredential.blockchainTxHash
        }
      });
    }

    return res.status(400).json({ success: false, message: 'Invalid action. Use APPROVE or REJECT.' });

  } catch (error) {
    console.error('Commissioner Process Application Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing application.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = { processApplication };