/**
 * Controller: processApplication
 * 
 * Description:
 * Handles the review and approval/rejection of applications by commissioners.
 * 
 * APPROVAL FLOW:
 *  1. Build Verifiable Credential (VC) payload
 *  2. Dynamically fetch the commissioner’s Vault key name from their user record
 *  3. Sign the VC payload using HashiCorp Vault Transit Engine (private key never leaves Vault)
 *  4. Upload signed VC JWT to IPFS
 *  5. Generate SHA-256 hash of VC JWT for immutability
 *  6. Issue credential on blockchain (anchored record)
 *  7. Save credential metadata in MongoDB
 *  8. Update application history and status
 * 
 * REJECTION FLOW:
 *  1. Update application status and log action in history
 * 
 * Security Notes:
 * - Each commissioner has their own Vault-managed signing key.
 * - Vault keys are dynamically created during registration.
 * - No private key or sensitive token is ever exposed or stored locally.
 */

const Application = require('../../models/Application');
const Credential = require('../../models/Credential');
const { APPLICATION_STATUS } = require('../../utils/constants');
const ipfsService = require('../../services/ipfsService');
const blockchainService = require('../../services/blockchainService');
const crypto = require('crypto');
const { signVCWithVault } = require('../../utils/vaultSigner');

const processApplication = async (req, res) => {
  try {
    const { action, reviewComments } = req.body;
    const applicationId = req.params.id;

    // Fetch application record
    const application = await Application.findOne({ applicationId });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const commissioner = req.user;

    // Verify that user is authorized to process applications
    if (commissioner.role !== 'COMMISSIONER') {
      return res.status(403).json({ success: false, message: 'Access denied: Only commissioners can process applications.' });
    }

    // Verify that the application has been forwarded to the current commissioner
    if (application.forwardedCommissioner?.toString() !== commissioner._id.toString()) {
      return res.status(403).json({ success: false, message: 'This application is not assigned to you.' });
    }

    // Ensure application is in the correct state before processing
    if (application.status !== APPLICATION_STATUS.FORWARDED_TO_COMMISSIONER) {
      return res.status(400).json({ success: false, message: 'Application not ready for commissioner action.' });
    }

    /**
     * ---------------------------------
     * Handle REJECTION ACTION
     * ---------------------------------
     */
    if (action === 'REJECT') {
      application.status = APPLICATION_STATUS.REJECTED;
      application.reviewComments = reviewComments || '';
      application.updatedAt = new Date();

      // Ensure application history array exists
      if (!Array.isArray(application.history)) application.history = [];

      // Log rejection in history
      application.history.push({
        action: 'REJECTED',
        by: { id: commissioner._id, name: commissioner.name, did: commissioner.did },
        at: new Date(),
        note: reviewComments || 'Application rejected'
      });

      await application.save();
      return res.json({ success: true, message: 'Application rejected successfully.', data: application });
    }

    /**
     * ---------------------------------
     * Handle APPROVAL ACTION
     * ---------------------------------
     */
    if (action === 'APPROVE') {
      // Ensure applicant DID is available
      if (!application.applicant?.did) {
        return res.status(400).json({ success: false, message: 'Applicant DID is missing. Cannot issue credential.' });
      }

      // Prevent re-issuance of credentials
      const existingCredential = await Credential.findOne({ applicationId });
      if (existingCredential) {
        return res.status(400).json({
          success: false,
          message: 'Credential already issued for this application.',
          credential: existingCredential
        });
      }

      /**
       * ---------------------------------
       * Build Verifiable Credential (VC)
       * ---------------------------------
       */
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

      /**
       * ---------------------------------
       * Determine Commissioner’s Vault Key
       * ---------------------------------
       * The commissioner record in MongoDB contains a reference
       * to their assigned Vault key (e.g., "commissioner-key-u123").
       * This ensures each commissioner signs with their own key.
       */
      const vaultKeyName = commissioner.vault?.keyName;
      const vaultToken = commissioner.vault?.token;

      if (!vaultKeyName || !vaultToken) {
        return res.status(400).json({ success: false, message: 'Vault key or token not configured for this commissioner.' });
      }

      /**
       * ---------------------------------
       * Sign the VC Payload using Vault
       * ---------------------------------
       * Vault’s Transit Engine signs the payload securely.
       * The private key remains inside Vault.
       */
      const vcJwt = await signVCWithVault(vcPayload, vaultKeyName, vaultToken);

      /**
       * ---------------------------------
       * Upload Signed VC to IPFS
       * ---------------------------------
       */
      const ipfsResult = await ipfsService.uploadJSON({ vcJwt });
      const ipfsCID = typeof ipfsResult === 'string' ? ipfsResult : ipfsResult.cid;

      /**
       * ---------------------------------
       * Generate Hash for Blockchain Record
       * ---------------------------------
       */
      const vcHash = crypto.createHash('sha256').update(vcJwt).digest('hex');

      /**
       * ---------------------------------
       * Generate Unique Credential ID
       * ---------------------------------
       */
      const credentialId = `cred-${application.applicationId}-${Date.now()}`;

      /**
       * ---------------------------------
       * Issue Credential on Blockchain
       * ---------------------------------
       */
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

      /**
       * ---------------------------------
       * Store Credential Metadata in MongoDB
       * ---------------------------------
       */
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

      /**
       * ---------------------------------
       * Update Application Record
       * ---------------------------------
       */
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
        note: 'VC issued via Vault, uploaded to IPFS, and anchored on blockchain.'
      });

      await application.save();

      /**
       * ---------------------------------
       * Send Success Response
       * ---------------------------------
       */
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

    // Handle invalid actions
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