const { signData } = require('../services/vaultService');
const { SignJWT } = require('jose');

/**
 * Sign VC payload using Vault Transit engine
 * @param {object} vcPayload - Verifiable Credential payload
 * @param {string} keyName - Vault Transit key name
 * @returns {string} VC JWT signed via Vault
 */
async function signVCWithVault(vcPayload, keyName = 'commissioner-key-u123') {
  // 1️⃣ Convert payload to JSON string
  const payloadStr = JSON.stringify(vcPayload);

  // 2️⃣ Sign with Vault
  const vaultSignature = await signData(keyName, payloadStr);

  // 3️⃣ Convert Vault signature to DER/base64url format
  // Vault returns ecdsa-p256-sha256 signature like: vault:v1:BASE64
  const parts = vaultSignature.split(':');
  const sigBase64 = parts[2];

  // 4️⃣ Build JWT manually using jose (header + payload + signature)
  const header = {
    alg: 'ES256',
    typ: 'JWT',
    kid: keyName
  };

  const base64urlEncode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

  const encodedHeader = base64urlEncode(header);
  const encodedPayload = Buffer.from(payloadStr).toString('base64url');

  // Combine header.payload.signature
  const jwt = `${encodedHeader}.${encodedPayload}.${sigBase64.replace(/=/g, '')}`;

  return jwt;
}

module.exports = { signVCWithVault };