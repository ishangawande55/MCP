const { getPublicKey } = require('../services/vaultService');
const { jwtVerify } = require('jose');

/**
 * Verify a VC JWT signed via Vault
 * @param {string} vcJwt - JWT issued by commissioner
 * @param {string} keyName - Vault Transit key name used for signing
 * @returns {object} - Verified payload (VC)
 */
async function verifyVCWithVault(vcJwt, keyName = 'commissioner-key-u123') {
  // 1️⃣ Fetch public key from Vault
  const publicKeyPem = await getPublicKey(keyName);

  // Convert PEM to KeyObject
  const { createPublicKey } = require('crypto');
  const keyObj = createPublicKey(publicKeyPem);

  try {
    // 2️⃣ Verify JWT
    const { payload, protectedHeader } = await jwtVerify(vcJwt, keyObj, {
      algorithms: ['ES256']
    });

    return { valid: true, payload, header: protectedHeader };
  } catch (err) {
    console.error('VC verification failed:', err);
    return { valid: false, error: err.message };
  }
}

module.exports = { verifyVCWithVault };