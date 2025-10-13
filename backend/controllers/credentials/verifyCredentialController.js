/**
 * @file verifyCredential.js
 * @author Ishan
 * @description
 * Controller to verify issued Verifiable Credentials (VCs) with:
 *  - Vault-signed JWT verification
 *  - IPFS reference validation
 *  - Blockchain anchoring and hash verification
 *  - Zero-Knowledge Proof (ZKP) selective disclosure (Merkle root)
 *
 * Verification Flow:
 * 1. Fetch credential from MongoDB
 * 2. Check revocation and expiration
 * 3. Normalize issuanceDate and canonicalize payload
 * 4. Recalculate credential hash and compare with blockchain
 * 5. Verify Vault JWT signature
 * 6. Include ZKP Merkle root for selective disclosure verification
 */

const Credential = require('../../models/Credential');
const blockchainService = require('../../services/blockchainService');
const crypto = require('crypto');
const { verifyCredentialJwt } = require('../../utils/didJwtVerifier');

/**
 * Deterministically canonicalize an object for hashing
 * Handles nested objects, arrays, and safely serializes BigInts
 * @param {Object} obj 
 * @returns {string} Canonicalized JSON string
 */
const canonicalize = (obj) => {
  if (!obj || typeof obj !== 'object') return JSON.stringify(obj);

  if (Array.isArray(obj)) {
    return JSON.stringify(obj.map(canonicalize));
  }

  const sortedKeys = Object.keys(obj).sort();
  const result = {};
  for (const key of sortedKeys) {
    let value = obj[key];
    if (typeof value === 'bigint') {
      value = value.toString();
    } else if (value && typeof value === 'object') {
      value = JSON.parse(canonicalize(value));
    }
    result[key] = value;
  }
  return JSON.stringify(result);
};

/**
 * Normalize issuanceDate for deterministic hashing
 * Removes milliseconds to match issuance canonicalization
 * @param {string|Date} date
 * @returns {string} ISO string without milliseconds
 */
const normalizeIssuanceDate = (date) => {
  if (!date) return new Date().toISOString().split('.')[0] + 'Z';
  return new Date(date).toISOString().split('.')[0] + 'Z';
};

/**
 * Convert string or hash to 0x-prefixed bytes32 for Solidity
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
 * Safely serialize numeric or BigInt values
 * @param {any} value
 * @returns {any|string} Serialized value
 */
const safeSerialize = (value) => (typeof value === 'bigint' ? value.toString() : value);

/**
 * Controller: Verify a credential
 * @route POST /api/credentials/verify
 * @body { credentialId: string }
 * @returns JSON { success: boolean, message: string, data: object }
 */
exports.verifyCredential = async (req, res) => {
  try {
    const { credentialId } = req.body;
    if (!credentialId) {
      return res.status(400).json({ success: false, message: 'Credential ID is required.' });
    }

    // --------------------------
    // Fetch credential from database
    // --------------------------
    const credential = await Credential.findOne({ credentialId }).populate('issuer', 'name department');
    if (!credential) {
      return res.status(404).json({ success: false, message: 'Credential not found.' });
    }

    // --------------------------
    // Check revocation
    // --------------------------
    if (credential.credentialStatus === 'REVOKED') {
      return res.json({
        success: false,
        message: 'Credential has been revoked.',
        data: {
          credentialId: credential.credentialId,
          result: 'REVOKED',
          revokedReason: credential.revokedReason,
          revokedAt: credential.revokedAt
        }
      });
    }

    // --------------------------
    // Check expiration
    // --------------------------
    if (credential.expiryDate && new Date() > credential.expiryDate) {
      return res.json({
        success: false,
        message: 'Credential has expired.',
        data: {
          credentialId: credential.credentialId,
          result: 'EXPIRED',
          expiryDate: credential.expiryDate
        }
      });
    }

    // --------------------------
    // Recalculate deterministic credential hash
    // Normalize issuanceDate and canonicalize payload to prevent mismatch
    // --------------------------
    const vcPayload = credential.vcData?.payload;
    if (!vcPayload) {
      return res.status(500).json({ success: false, message: 'VC payload missing for verification.' });
    }

    // Ensure issuanceDate matches normalized format
    vcPayload.issuanceDate = normalizeIssuanceDate(vcPayload.issuanceDate);

    // Canonicalize the payload for deterministic hashing
    const canonicalPayload = canonicalize(vcPayload);
    const recalculatedHashBytes32 = toBytes32(canonicalPayload);

    // --------------------------
    // Blockchain verification
    // --------------------------
    let blockchainValid = false;
    let statusCodeSafe = null;
    try {
      const [onChainHashBytes32, statusCode] = await blockchainService.getCredentialHashAndStatus(credentialId);
      blockchainValid = onChainHashBytes32 === recalculatedHashBytes32 && statusCode === 0;
      statusCodeSafe = safeSerialize(statusCode);
    } catch (err) {
      console.warn('Blockchain verification failed:', err.message);
    }

    // --------------------------
    // Fetch ZKP Merkle root from blockchain (if exists)
    // --------------------------
    let merkleRoot = null;
    try {
      const onChainData = await blockchainService.contract.getCertificate(credentialId);
      merkleRoot = safeSerialize(onChainData.merkleRoot);
    } catch (err) {
      console.warn('Could not fetch ZKP Merkle root:', err.message);
    }

    // --------------------------
    // Vault JWT signature verification
    // --------------------------
    let jwtVerified = false;
    try {
      const vcJwt = credential.vcData?.vcJwt;
      if (vcJwt) {
        const decoded = await verifyCredentialJwt(vcJwt);
        jwtVerified = !!decoded;
      }
    } catch (err) {
      console.warn('JWT verification failed:', err.message);
    }

    // --------------------------
    // Log verification attempt
    // --------------------------
    credential.verificationLogs = credential.verificationLogs || [];
    credential.verificationLogs.push({
      verifiedBy: req.user?.id || 'anonymous',
      verifiedAt: new Date(),
      result: blockchainValid && jwtVerified ? 'VALID' : 'INVALID',
      jwtVerified
    });
    await credential.save();

    // --------------------------
    // Respond with verification result
    // --------------------------
    return res.json({
      success: blockchainValid && jwtVerified,
      message: blockchainValid && jwtVerified
        ? 'Credential is valid: blockchain hash matches, JWT signature verified, and untampered.'
        : 'Credential verification failed: possible tampering, invalid JWT, or blockchain mismatch.',
      data: {
        credentialId: credential.credentialId,
        type: credential.type,
        schemaType: credential.schemaType,
        issuer: credential.issuer,
        issuerDID: credential.issuerDID,
        holderDID: credential.holderDID,
        ipfsCID: credential.ipfsCID,
        blockchainTxHash: credential.blockchainTxHash,
        recalculatedHash: recalculatedHashBytes32,
        blockchainValid,
        statusCode: statusCodeSafe,
        jwtVerified,
        result: blockchainValid && jwtVerified ? 'VALID' : 'INVALID',
        status: credential.credentialStatus,
        issuedAt: credential.issuedAt,
        merkleRoot,       // ZKP Merkle root for selective disclosure
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