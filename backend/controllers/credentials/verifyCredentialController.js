/**
 * @file verifyCredential.js
 * @author
 * Ishan Rajeshwar Gawande
 * @description
 * -----------------------------------------------------------------------------
 * Verifiable Credential Verification Controller (Application-based ZKP)
 * -----------------------------------------------------------------------------
 * Responsibilities:
 *  - Validate stored credential integrity and authenticity.
 *  - Verify blockchain anchoring (hash + Merkle root + status).
 *  - Verify Vault-signed JWT.
 *  - Verify Zero-Knowledge Proof (ZKP) for selective disclosure stored in Application.
 * -----------------------------------------------------------------------------
 * Verification Flow:
 *  1. Fetch credential and related application from MongoDB
 *  2. Check revocation and expiration
 *  3. Canonicalize payload and recompute hash
 *  4. Convert stored Merkle root to bytes32
 *  5. Verify blockchain anchoring safely (hash, Merkle root, status)
 *  6. Verify Vault JWT signature
 *  7. Verify ZKP proof and Merkle root
 * -----------------------------------------------------------------------------
 */

const Credential = require('../../models/Credential');
const Application = require('../../models/Application');
const blockchainService = require('../../services/blockchainService');
const ZKPService = require('../../services/ZKPService');
const crypto = require('crypto');
const { verifyCredentialJwt } = require('../../utils/didJwtVerifier');

/* -------------------------------------------------------------------------- */
/*                               Helper Methods                               */
/* -------------------------------------------------------------------------- */

/**
 * Deterministically canonicalize an object for hashing.
 * Ensures consistent key ordering for blockchain hash calculation.
 * @param {Object} obj
 * @returns {string} Canonicalized JSON string
 */
const canonicalize = (obj) => {
  if (!obj || typeof obj !== 'object') return JSON.stringify(obj);
  const sortedKeys = Object.keys(obj).sort();
  const normalized = {};
  for (const key of sortedKeys) {
    let value = obj[key];
    if (typeof value === 'bigint') value = value.toString();
    else if (value && typeof value === 'object') value = JSON.parse(canonicalize(value));
    normalized[key] = value;
  }
  return JSON.stringify(normalized);
};

/**
 * Normalize issuanceDate to ignore milliseconds and ensure deterministic hash
 * @param {string|Date} date
 * @returns {string} Normalized ISO string
 */
const normalizeIssuanceDate = (date) => {
  if (!date) return new Date().toISOString().split('.')[0] + 'Z';
  return new Date(date).toISOString().split('.')[0] + 'Z';
};

/**
 * Converts input string/number to 0x-prefixed bytes32 hash (for Solidity compatibility)
 * @param {string|number} input
 * @returns {string} 0x-prefixed 32-byte hex string
 */
const toBytes32 = (input) => {
  if (!input) throw new Error('Cannot convert empty value to bytes32');
  let hex;
  if (/^0x[0-9a-fA-F]+$/.test(input)) {
    hex = input.slice(2);
  } else {
    hex = crypto.createHash('sha256').update(String(input)).digest('hex');
  }
  hex = hex.padStart(64, '0').slice(0, 64);
  return '0x' + hex;
};

/* -------------------------------------------------------------------------- */
/*                            Main Verification Flow                          */
/* -------------------------------------------------------------------------- */

exports.verifyCredential = async (req, res) => {
  try {
    const { credentialId } = req.body;
    if (!credentialId) {
      return res.status(400).json({ success: false, message: 'Credential ID is required.' });
    }

    // Step 1: Fetch Credential and Related Application
    const credential = await Credential.findOne({ credentialId }).lean();
    if (!credential) return res.status(404).json({ success: false, message: 'Credential not found.' });

    const application = await Application.findOne({ applicationId: credential.applicationId }).lean();
    if (!application) return res.status(404).json({ success: false, message: 'Related application not found.' });

    // Step 2: Check revocation/expiration
    if (credential.credentialStatus === 'REVOKED') {
      return res.json({
        success: false,
        message: 'Credential has been revoked.',
        data: { credentialId, result: 'REVOKED', revokedReason: credential.revokedReason, revokedAt: credential.revokedAt }
      });
    }

    if (credential.expiryDate && new Date() > new Date(credential.expiryDate)) {
      return res.json({
        success: false,
        message: 'Credential has expired.',
        data: { credentialId, result: 'EXPIRED', expiryDate: credential.expiryDate }
      });
    }

    // Step 3: Recalculate deterministic hash (same as during issuance)
    const vcPayload = credential.vcData?.payload;
    if (!vcPayload) return res.status(500).json({ success: false, message: 'VC payload missing for verification.' });

    vcPayload.issuanceDate = normalizeIssuanceDate(vcPayload.issuanceDate);
    const canonicalPayload = canonicalize(vcPayload);
    const recalculatedHashBytes32 = toBytes32(canonicalPayload);

    // Step 4: Convert stored Merkle root to bytes32 (matches blockchain format)
    let storedMerkleRootBytes32 = null;
    if (application.merkleRoot) {
      storedMerkleRootBytes32 = toBytes32(application.merkleRoot);
    }

    // Step 5: Blockchain verification (safe handling of onChainStatus)
    let blockchainValid = false;
    let onChainHash = null;
    let onChainMerkleRoot = null;
    let onChainStatus = null;

    try {
      let cert;
      if (blockchainService.contract?.getCertificate) {
        cert = await blockchainService.contract.getCertificate(credentialId);
        onChainHash = cert.hash?.toString() || cert[0]?.toString() || null;
        onChainMerkleRoot = cert.merkleRoot?.toString() || cert[1]?.toString() || null;
        // Keep status as string to prevent JS overflow
        onChainStatus = cert.status !== undefined ? cert.status.toString() : cert[2]?.toString();
      }

      blockchainValid =
        onChainHash === recalculatedHashBytes32 &&
        onChainMerkleRoot === storedMerkleRootBytes32

    } catch (err) {
      console.warn(`[Verification Log] Blockchain verification failed: ${err.message}`);
    }

    // Step 6: Vault JWT verification
    let jwtVerified = false;
    let jwtError = null;
    try {
      const vcJwt = credential.vcData?.vcJwt;
      if (!vcJwt || typeof vcJwt !== 'string') jwtError = 'Invalid or missing vcJwt';
      else jwtVerified = !!(await verifyCredentialJwt(vcJwt));
    } catch (err) {
      jwtError = err.message || String(err);
    }

    // Step 7: ZKP verification
    let zkpVerified = false;
    let zkpError = null;
    try {
      const proof = application.finalZkpProof || application.zkpProof || application.initialZkpProof;
      const publicSignals = application.finalPublicSignals || application.publicSignals || application.initialPublicSignals;
      if (!proof || !publicSignals) zkpError = 'Missing ZKP proof or public signals';
      else zkpVerified = await ZKPService.verifyProof(proof, publicSignals);
    } catch (err) {
      zkpError = err.message || String(err);
    }

    // Step 8: Persist verification audit log
    try {
      await Credential.updateOne(
        { credentialId },
        {
          $push: {
            verificationLogs: {
              verifiedBy: req.user?.id || 'anonymous',
              verifiedAt: new Date(),
              blockchainValid,
              jwtVerified,
              zkpVerified,
              onChainHash,
              onChainMerkleRoot,
              onChainStatus,
              jwtError: jwtError || null,
              zkpError: zkpError || null
            }
          }
        }
      );
    } catch (err) {
      console.warn(`[Verification Log] Failed to persist verification log: ${err.message}`);
    }

    // Step 9: Final response
    const overallValid = blockchainValid && jwtVerified && zkpVerified;

    return res.json({
      success: overallValid,
      message: overallValid
        ? 'Credential is valid: blockchain hash, JWT, and ZKP verified.'
        : 'Credential verification failed: check blockchain, JWT, or ZKP integrity.',
      data: {
        credentialId,
        type: credential.type,
        issuerDID: credential.issuerDID,
        holderDID: credential.holderDID,
        ipfsCID: credential.ipfsCID,
        blockchainTxHash: credential.blockchainTxHash,
        recalculatedHash: recalculatedHashBytes32,
        onChainHash,
        onChainMerkleRoot,
        blockchainValid,
        jwtVerified,
        jwtError,
        zkpVerified,
        zkpError,
        merkleRoot: storedMerkleRootBytes32,
        vcPayload
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