/**
 * @file processApplication.js
 * @author Ishan Gawande
 * @description
 * Controller to handle approval/rejection of municipal applications.
 * Integrates:
 *  - Zero-Knowledge Proofs (ZKPs) for selective disclosure
 *  - Vault-signed Verifiable Credentials (VC)
 *  - IPFS storage of VC JWT
 *  - Blockchain anchoring of deterministic VC payload hash and Merkle root
 *
 * Responsibilities:
 *  - Validate commissioner authorization
 *  - Prevent duplicate credential issuance
 *  - Generate canonical VC payload for deterministic hashing
 *  - Generate ZKP proof and Merkle root for selective disclosure
 *  - Sign VC via Vault and upload JWT to IPFS
 *  - Anchor VC on blockchain and store transaction details
 *  - Maintain detailed audit trail for approvals/rejections
 */

const Application = require('../../models/Application');
const Credential = require('../../models/Credential');
const { APPLICATION_STATUS } = require('../../utils/constants');
const ipfsService = require('../../services/ipfsService');
const blockchainService = require('../../services/blockchainService');
const crypto = require('crypto');
const { signVCWithVault } = require('../../utils/vaultSigner');
const ZKPService = require('../../services/ZKPService');

const SUPPORTED_TYPES = ['BIRTH', 'DEATH', 'TRADE_LICENSE', 'NOC'];

/**
 * Deterministically canonicalize an object for hashing.
 * Ensures consistent key ordering for blockchain hashes.
 * @param {Object} obj 
 * @returns {string} Canonicalized JSON string
 */
const canonicalize = (obj) => {
  if (!obj || typeof obj !== 'object') return JSON.stringify(obj);
  const sortedKeys = Object.keys(obj).sort();
  const result = {};
  for (const key of sortedKeys) {
    result[key] = typeof obj[key] === 'object' && obj[key] !== null
      ? JSON.parse(canonicalize(obj[key]))
      : obj[key];
  }
  return JSON.stringify(result);
};

/**
 * Converts input string to 0x-prefixed bytes32 hex for Solidity compatibility.
 * @param {string} input 
 * @returns {string} 0x-prefixed 32-byte hex
 */
const toBytes32 = (input) => {
  if (!input) throw new Error('Cannot convert empty value to bytes32');
  let hex;
  if (/^0x[0-9a-fA-F]+$/.test(input)) {
    hex = input.slice(2);
  } else {
    hex = crypto.createHash('sha256').update(input.toString()).digest('hex');
  }
  hex = hex.padStart(64, '0').slice(0, 64);
  return '0x' + hex;
};

/**
 * Filters an object to include only fields allowed for selective disclosure.
 * @param {Object} details 
 * @param {Array} disclosedFields 
 * @returns {Object} Filtered object
 */
const filterDisclosedFields = (details, disclosedFields) => {
  if (!details || !disclosedFields) return {};
  return Object.keys(details)
    .filter((key) => disclosedFields.includes(key))
    .reduce((obj, key) => {
      obj[key] = details[key];
      return obj;
    }, {});
};

/**
 * Controller: Process application (APPROVE / REJECT)
 * @route POST /api/applications/:id/process
 */
const processApplication = async (req, res) => {
  try {
    const { action, reviewComments } = req.body;
    const applicationId = req.params.id;

    // Fetch application from database
    const application = await Application.findOne({ applicationId });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const commissioner = req.user;

    // Authorization check: Only commissioners can process applications
    if (commissioner.role !== 'COMMISSIONER') {
      return res.status(403).json({ success: false, message: 'Only commissioners can process applications.' });
    }
    if (application.forwardedCommissioner?.toString() !== commissioner._id.toString()) {
      return res.status(403).json({ success: false, message: 'Application not assigned to you.' });
    }
    if (application.status !== APPLICATION_STATUS.FORWARDED_TO_COMMISSIONER) {
      return res.status(400).json({ success: false, message: 'Application not ready for processing.' });
    }

    // --------------------------
    // Handle REJECTION
    // --------------------------
    if (action === 'REJECT') {
      application.status = APPLICATION_STATUS.REJECTED;
      application.reviewComments = reviewComments || 'Rejected by commissioner';
      application.updatedAt = new Date();
      application.history = application.history || [];
      application.history.push({
        action: 'REJECTED',
        by: { id: commissioner._id, name: commissioner.name, did: commissioner.did },
        at: new Date(),
        note: reviewComments || 'Application rejected'
      });

      await application.save();
      return res.json({ success: true, message: 'Application rejected successfully.', data: application });
    }

    // --------------------------
    // Handle APPROVAL
    // --------------------------
    if (action === 'APPROVE') {
      if (!SUPPORTED_TYPES.includes(application.type)) {
        return res.status(400).json({ success: false, message: `Unsupported application type for ZKP: ${application.type}` });
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

      // Flatten type-specific details for ZKP input
      let typeDetails;
      switch (application.type) {
        case 'BIRTH': typeDetails = application.birthDetails || {}; break;
        case 'DEATH': typeDetails = application.deathDetails || {}; break;
        case 'TRADE_LICENSE': typeDetails = application.tradeDetails || {}; break;
        case 'NOC': typeDetails = application.nocDetails || {}; break;
      }

      const zkpInput = { ...application.toObject(), disclosedFields: application.disclosedFields || [] };
      Object.assign(zkpInput, typeDetails);

      // Generate ZKP proof and Merkle root
      let zkpResult;
      try {
        zkpResult = await ZKPService.generateProofFromApplication(zkpInput);

        // Save final proof & signals according to new schema
        application.finalZkpProof = zkpResult.proof;
        application.finalPublicSignals = zkpResult.publicSignals;
        application.merkleRoot = zkpResult.merkleRoot;

      } catch (zkError) {
        console.error('ZKP Generation Error:', zkError);
        return res.status(400).json({ success: false, message: 'ZKP generation failed', error: zkError.message });
      }

      // --------------------------
      // Prepare selective disclosure details
      // --------------------------
      const disclosedDetails = filterDisclosedFields(typeDetails, application.disclosedFields);

      // Normalize issuanceDate for consistent hash
      const issuanceDate = new Date().toISOString().split('.')[0] + 'Z';

      // Build canonical VC payload according to W3C
      const vcPayload = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        id: `${application.applicationId}`,
        type: ["VerifiableCredential", `${application.type}Credential`],
        issuer: {
          id: commissioner.did,
          name: commissioner.name,
          department: commissioner.department
        },
        issuanceDate,
        credentialSubject: {
          id: application.applicant.did,
          applicant: application.applicant,
          applicationId: application.applicationId,
          type: application.type,
          department: application.department,
          details: disclosedDetails
        }
      };

      // --------------------------
      // Vault signing
      // --------------------------
      const vaultKeyName = commissioner.vault?.keyName;
      const vaultToken = commissioner.vault?.token;

      if (!vaultKeyName || !vaultToken) {
        return res.status(400).json({ success: false, message: 'Vault key/token missing for commissioner.' });
      }

      // Get signature only
      const vcJwt = await signVCWithVault(vaultToken, vaultKeyName, vcPayload, application.disclosedFields);
      if (!vcJwt) {
        throw new Error('Vault signing failed. Cannot proceed.');
      }

      // --------------------------
      // Prepare full VC object for IPFS
      // --------------------------
      const fullVCForIPFS = {
        payload: vcPayload,             // The complete credential payload
        signature: vcJwt,         // Vault signature
        zkpProof: application.finalZkpProof || {},  // ZKP proof (optional)
        disclosedFields: application.disclosedFields || [] // SD metadata
      };

      // --------------------------
      // Upload full VC object to IPFS
      // --------------------------
      const ipfsResult = await ipfsService.uploadJSON(fullVCForIPFS);
      const ipfsCID = typeof ipfsResult === 'string' ? ipfsResult : ipfsResult.cid;

      console.log('Full VC uploaded to IPFS:', ipfsCID);

      // Generate deterministic blockchain hash
      const canonicalPayload = canonicalize(vcPayload);
      const payloadHashBytes32 = toBytes32(canonicalPayload);
      const merkleRootBytes32 = toBytes32(application.merkleRoot);

      // Blockchain issuance
      const credentialId = `cred-${application.applicationId}-${Date.now()}`;
      const departmentRoleMap = {
        'HEALTHCARE': 'HEALTHCARE_COMMISSIONER',
        'LICENSE': 'LICENSES_COMMISSIONER',
        'NOC': 'NOC_COMMISSIONER'
      };
      const role = departmentRoleMap[application.department] || 'ADMIN';
      blockchainService.setSigner(role);

      const tx = await blockchainService.issueCredential(
        credentialId,
        payloadHashBytes32,
        ipfsCID,
        merkleRootBytes32,
        commissioner.did,
        application.applicant.did,
        0,
        `${application.type}_Credential`
      );

      // Save credential in database
      const newCredential = new Credential({
        applicationId,
        credentialId,
        type: application.type,
        vcData: { vcJwt, payload: vcPayload },
        canonicalPayload,
        vcSignature: 'VAULT_SIGNED',
        ipfsCID,
        credentialHash: payloadHashBytes32,
        merkleRoot: application.merkleRoot,
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

      // Update application with issuance details
      application.status = APPLICATION_STATUS.APPROVED;
      application.reviewComments = reviewComments || '';
      application.credential = newCredential._id;
      application.updatedAt = new Date();
      application.issuedAt = new Date();
      application.history = application.history || [];
      application.history.push({
        action: 'APPROVED_AND_ISSUED',
        by: { id: commissioner._id, name: commissioner.name, did: commissioner.did },
        at: application.issuedAt,
        note: 'VC issued with selective disclosure, uploaded to IPFS, and anchored on blockchain with Merkle root.'
      });
      await application.save();

      // Send success response
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
            issuedAt: newCredential.issuedAt,
            merkleRoot: newCredential.merkleRoot
          },
          ipfsCID,
          blockchainTx: newCredential.blockchainTxHash
        }
      });
    }

    // Invalid action
    return res.status(400).json({ success: false, message: 'Invalid action. Use APPROVE or REJECT.' });

  } catch (error) {
    console.error('Commissioner Process Application Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while processing application.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = { processApplication };