const Credential = require('../../models/Credential');
const blockchainService = require('../../services/blockchainService');
const crypto = require('crypto');
const { verifyCredentialJwt } = require('../../utils/didJwtVerifier'); // optional JWT verification helper

/**
 * Helper: Deterministically canonicalize an object for consistent hashing
 * @param {Object} obj - The object to canonicalize
 * @returns {string} - Canonicalized JSON string
 */
function canonicalize(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

/**
 * Controller: Verify a credential's integrity and status
 * Performs the following checks:
 * 1. Credential existence in MongoDB
 * 2. Revocation status
 * 3. Expiration
 * 4. Blockchain hash integrity
 * 5. Optional JWT verification
 *
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

    // Fetch credential from MongoDB
    const credential = await Credential.findOne({ credentialId }).populate('issuer', 'name department');
    if (!credential) {
      return res.status(404).json({ success: false, message: 'Credential not found.' });
    }

    // Check revocation
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

    // Check expiration
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

    /** -----------------------------
     * Recalculate VC hash deterministically
     * For JWT-based VCs, hash the JWT string
     * ----------------------------- */
    const vcJwt = credential.vcData?.vcJwt;
    if (!vcJwt) {
      return res.status(500).json({ success: false, message: 'Credential JWT missing.' });
    }

    const recalculatedHashHex = crypto.createHash('sha256').update(vcJwt).digest('hex');
    const recalculatedHashBytes32 = '0x' + recalculatedHashHex;

    /** -----------------------------
     * Fetch hash from blockchain
     * ----------------------------- */
    const onChainHashBytes32 = await blockchainService.getCredentialHash(credential.credentialId);

    /** -----------------------------
     * Compare blockchain hash with recalculated hash
     * ----------------------------- */
    const isValid = recalculatedHashBytes32.toLowerCase() === onChainHashBytes32.toLowerCase();

    /** -----------------------------
     *  Verify JWT integrity and signature
     * ----------------------------- */
    let jwtVerified = false;
    try {
      const decoded = await verifyCredentialJwt(vcJwt);
      jwtVerified = !!decoded;
    } catch (err) {
      console.warn('JWT verification failed:', err.message);
    }

    /** -----------------------------
     * Log verification attempt
     * ----------------------------- */
    credential.verificationLogs.push({
      verifiedBy: req.user?.id || 'anonymous',
      verifiedAt: new Date(),
      result: isValid ? 'VALID' : 'HASH_MISMATCH',
      jwtVerified
    });
    await credential.save();

    /** -----------------------------
     * Respond with verification result
     * ----------------------------- */
    res.json({
      success: isValid && jwtVerified,
      message: isValid && jwtVerified
        ? 'Credential is valid, untampered, and JWT signature verified.'
        : 'Credential verification failed. Possible tampering or invalid JWT.',
      data: {
        credentialId: credential.credentialId,
        type: credential.type,
        schemaType: credential.schemaType,
        issuer: credential.issuer,
        issuerDID: credential.issuerDID,
        holderDID: credential.holderDID,
        ipfsCID: credential.ipfsCID,
        blockchainTxHash: credential.blockchainTxHash,
        onChainHash: onChainHashBytes32,
        recalculatedHash: recalculatedHashBytes32,
        jwtVerified,
        result: isValid && jwtVerified ? 'VALID' : 'INVALID',
        issuedAt: credential.issuedAt,
        status: credential.credentialStatus,
        vcJwt
      }
    });

  } catch (error) {
    console.error('Blockchain Verify Credential Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during credential verification.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};