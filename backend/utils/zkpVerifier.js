/**
 * @file verifyCredential.js
 * @description
 * Controller for verifying issued Verifiable Credentials (VCs) with:
 *   - Vault-signed JWTs
 *   - IPFS storage
 *   - Blockchain anchoring
 *   - ZKP-based selective disclosure
 *
 * Verification Flow:
 *   1. Fetch credential from MongoDB by credentialId
 *   2. Validate revocation status and expiration
 *   3. Recalculate SHA-256 hash of the signed VC JWT and compare with on-chain hash
 *   4. Verify JWT signature using Vault/DID utilities
 *   5. Validate ZKP commitments if proof is provided
 *   6. Log verification attempt
 *   7. Return verification verdict: VALID / INVALID
 */

const crypto = require('crypto');
const Credential = require('../models/Credential');
const blockchainService = require('../services/blockchainService');
const { verifyCredentialJwt } = require('../utils/didJwtVerifier');
const { verifyZKCommitments } = require('../utils/zkpVerifier');

/**
 * Compute deterministic SHA-256 hash for blockchain anchoring
 * @param {string|object} data - Signed VC JWT or JSON payload
 * @returns {string} Hex-encoded hash string with '0x' prefix
 */
const computeHash = (data) => {
  const strData = typeof data === 'string' ? data : JSON.stringify(data);
  return `0x${crypto.createHash('sha256').update(strData).digest('hex')}`;
};

/**
 * Generate ZKP commitments for sensitive fields using SHA-256 hash
 * @param {object} sensitiveFields - key/value pairs of sensitive attributes
 * @param {object|null} blindingFactors - optional, key/value of pre-generated blinding factors
 * @returns {object} commitments - key/value hash commitments
 */
function generateCommitments(sensitiveFields, blindingFactors = null) {
  const commitments = {};

  for (const [key, value] of Object.entries(sensitiveFields)) {
    if (!value) continue;

    const bf = blindingFactors?.[key] || crypto.randomBytes(32).toString('hex');
    commitments[key] = crypto.createHash('sha256').update(`${JSON.stringify(value)}|${bf}`).digest('hex');
  }

  return commitments;
}

/**
 * @controller verifyCredential
 * @route POST /api/credentials/verify
 * @body { credentialId: string, proof?: object }
 * @returns {object} Verification result, metadata, and audit info
 */
exports.verifyCredential = async (req, res) => {
  try {
    const { credentialId, proof } = req.body;

    if (!credentialId) {
      return res.status(400).json({
        success: false,
        message: 'credentialId is required in request body.'
      });
    }

    // Step 1: Fetch credential
    const credential = await Credential.findOne({ credentialId }).populate('issuer', 'name department');
    if (!credential) {
      return res.status(404).json({ success: false, message: 'Credential not found in registry.' });
    }

    // Step 2: Check revocation
    if (credential.revocationStatus || credential.credentialStatus === 'REVOKED') {
      return res.json({
        success: false,
        message: 'Credential has been revoked.',
        data: {
          credentialId,
          status: 'REVOKED',
          revokedAt: credential.revokedAt,
          revokedReason: credential.revokedReason || 'Not specified'
        }
      });
    }

    // Step 3: Check expiration
    if (credential.expirationDate && new Date() > credential.expirationDate) {
      return res.json({
        success: false,
        message: 'Credential has expired.',
        data: {
          credentialId,
          status: 'EXPIRED',
          expirationDate: credential.expirationDate
        }
      });
    }

    // Step 4: Recalculate SHA-256 hash of stored VC JWT
    const vcJwt = credential.vcData?.vcJwt;
    if (!vcJwt) {
      return res.status(500).json({
        success: false,
        message: 'Stored credential is missing VC JWT data.'
      });
    }
    const recalculatedHash = computeHash(vcJwt);

    // Step 5: Compare hash with on-chain
    const onChainHash = await blockchainService.getCredentialHash(credentialId);
    const hashMatch = onChainHash?.toLowerCase() === recalculatedHash.toLowerCase();

    // Step 6: Verify VC JWT signature via Vault/DID
    let jwtVerified = false;
    try {
      jwtVerified = !!(await verifyCredentialJwt(vcJwt, credential.issuerDID));
    } catch (err) {
      console.warn(`[verifyCredential] JWT verification failed: ${err.message}`);
      jwtVerified = false;
    }

    // Step 7: ZKP verification if proof is provided
    let zkProofVerified = null;
    let proofUsed = false;

    if (proof && credential.vcData?.zkp) {
      proofUsed = true;
      zkProofVerified = await verifyZKCommitments(credential.vcData.zkp, proof);
    }

    // Step 8: Determine overall verification result
    const verificationResult = hashMatch && jwtVerified && (zkProofVerified !== false);

    // Step 9: Log verification attempt
    credential.verificationLogs = credential.verificationLogs || [];
    credential.verificationLogs.push({
      verifiedBy: req.user?.id || 'anonymous',
      verifiedAt: new Date(),
      hashMatch,
      jwtVerified,
      zkProofVerified,
      proofUsed,
      result: verificationResult ? 'VALID' : 'INVALID'
    });
    await credential.save();

    // Step 10: Respond
    return res.json({
      success: verificationResult,
      message: verificationResult
        ? 'Credential is authentic, untampered, and cryptographically verified.'
        : 'Credential verification failed (tampered, revoked, expired, or invalid proof).',
      data: {
        credentialId: credential.credentialId,
        type: credential.type,
        schemaType: credential.schemaType,
        issuer: credential.issuer,
        issuerDID: credential.issuerDID,
        holderDID: credential.holderDID,
        ipfsCID: credential.ipfsCID,
        blockchainTxHash: credential.blockchainTxHash,
        onChainHash,
        recalculatedHash,
        jwtVerified,
        zkProofVerified,
        proofUsed,
        revocationStatus: credential.revocationStatus,
        expirationDate: credential.expirationDate,
        issuedAt: credential.issuedAt,
        credentialStatus: credential.credentialStatus,
        verificationTimestamp: new Date(),
        result: verificationResult ? 'VALID' : 'INVALID'
      }
    });

  } catch (error) {
    console.error('Credential Verification Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during credential verification.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};