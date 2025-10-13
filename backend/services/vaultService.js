/**
 * @file vaultService.js
 * @description
 * Provides utilities for interacting with HashiCorp Vault to:
 *  - Sign data using the Transit Engine
 *  - Store and retrieve sensitive blinding factors securely
 *  - Support Zero-Knowledge Proof (ZKP) commitments for Verifiable Credentials
 *
 * Core responsibilities:
 * 1. Create Vault client instances with scoped tokens
 * 2. Hash sensitive fields for selective disclosure
 * 3. Sign payloads via Vault Transit Engine
 * 4. Store blinding factors securely in Vault KV
 * 5. Fetch public keys for verification
 */

const Vault = require('node-vault');
const crypto = require('crypto');

const VAULT_ADDR = process.env.VAULT_ADDR || 'http://127.0.0.1:8200';

/**
 * Creates a Vault client with the provided token
 * @param {string} token - Vault token scoped for a commissioner
 * @returns {Vault} Vault client instance
 */
function getVaultClient(token) {
  return Vault({
    apiVersion: 'v1',
    endpoint: VAULT_ADDR,
    token,
  });
}

/**
 * Hash a field for selective disclosure
 * @param {string|object} value
 * @returns {string} SHA-256 hex digest
 */
function hashField(value) {
  const normalized = typeof value === 'string' ? value : JSON.stringify(value);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Prepares payload for selective disclosure and mock ZKP
 * @param {object} vcPayload
 * @param {Array<string>} discloseFields - Optional fields to expose
 * @returns {object} sanitized payload and mock ZKP proof
 */
function prepareZKPAndSelectiveDisclosure(vcPayload, discloseFields = []) {
  const publicPayload = {};
  const privateProofs = {};

  for (const [key, value] of Object.entries(vcPayload)) {
    if (discloseFields.includes(key)) {
      publicPayload[key] = value;
    } else {
      publicPayload[key] = `HASH::${hashField(value)}`;
      privateProofs[key] = {
        originalHash: hashField(value),
        note: 'Hidden field, can be revealed via ZKP later'
      };
    }
  }

  const zkpProof = {
    proofId: crypto.randomUUID(),
    verified: true,
    createdAt: new Date().toISOString()
  };

  return { sanitizedPayload: publicPayload, zkpProof };
}

/**
 * Sign data via Vault Transit engine
 * @param {string} token - Vault token
 * @param {string} keyName - Vault key name
 * @param {object} payload - Data to sign
 * @param {Array<string>} discloseFields - Optional fields to disclose
 * @returns {Promise<object>} { signature, payload, zkpProof, disclosurePolicy }
 */
async function signDataWithZKP(token, keyName, payload, discloseFields = []) {
  const vault = getVaultClient(token);
  const { sanitizedPayload, zkpProof } = prepareZKPAndSelectiveDisclosure(payload, discloseFields);

  const payloadStr = JSON.stringify(sanitizedPayload);

  const result = await vault.write(`transit/sign/${keyName}`, {
    input: Buffer.from(payloadStr).toString('base64'),
    algorithm: 'ecdsa-p256-sha256',
  });

  return {
    signature: result.data.signature,
    payload: sanitizedPayload,
    zkpProof,
    disclosurePolicy: discloseFields
  };
}

/**
 * Store blinding factors securely in Vault KV engine (v2)
 * @param {string} refId - Reference ID for the credential
 * @param {object} blindingFactors - key -> BigInt mapping of sensitive fields
 */
async function storeBlindingFactor(refId, blindingFactors) {
  if (!process.env.VAULT_ROOT_TOKEN) {
    throw new Error('Vault root token not set in environment variables');
  }
  const vault = getVaultClient(process.env.VAULT_ROOT_TOKEN);

  // Convert all BigInt values to string before storing
  const stringifiedFactors = {};
  for (const [key, value] of Object.entries(blindingFactors)) {
    stringifiedFactors[key] = value.toString(); // BigInt -> string
  }

  await vault.write(`kv/data/${refId}`, { data: stringifiedFactors }, { mount_point: 'kv' });
  console.log(`Blinding factors stored at Vault KV path: kv/data/${refId}`);
}

/**
 * Retrieve commissioner’s public key from Vault Transit engine
 * @param {string} token
 * @param {string} keyName
 * @returns {Promise<string>} PEM public key
 */
async function getPublicKey(token, keyName) {
  const vault = getVaultClient(token);
  const result = await vault.read(`transit/keys/${keyName}`);
  return result.data.keys['1'].public_key;
}

/**
 * Retrieve blinding factors from Vault KV and convert to BigInt
 * @param {string} refId
 * @returns {object} key -> BigInt mapping
 */
async function getBlindingFactor(refId) {
  if (!process.env.VAULT_ROOT_TOKEN) {
    throw new Error('Vault root token not set in environment variables');
  }
  const vault = getVaultClient(process.env.VAULT_ROOT_TOKEN);

  const res = await vault.read(`kv/data/${refId}`, { mount_point: 'kv' });
  const stored = res.data?.data || {};

  // Convert strings back to BigInt
  const factors = {};
  for (const [key, value] of Object.entries(stored)) {
    factors[key] = BigInt(value);
  }
  return factors;
}

/**
 * Initialize Vault and check if default signing key exists
 */
async function initVault() {
  const vault = getVaultClient(process.env.VAULT_ROOT_TOKEN);

  try {
    const health = await vault.health();
    if (!health.initialized) throw new Error('Vault not initialized');
    if (health.sealed) throw new Error('Vault is sealed');

    try {
      await vault.read('transit/keys/mcp-signing-key');
    } catch {
      throw new Error("Vault signing key 'mcp-signing-key' not found. Please create it.");
    }

    console.log('Vault initialized and signing key validated.');
  } catch (err) {
    console.error('Vault initialization error:', err.message);
    throw err;
  }
}

/**
 * Fetch blinding factors from Vault KV path
 * @param {string} blindingRef - e.g., 'bf-BIRTH-1760180351188-323-1760180464168'
 * @returns {Promise<Object>} - returns stored object with BigInt values
 */
async function fetchBlindingFactors(blindingRef) {
  if (!process.env.VAULT_ROOT_TOKEN) {
    throw new Error('Vault root token not set in environment variables');
  }

  const vault = getVaultClient(process.env.VAULT_ROOT_TOKEN);

  try {
    // KV v2 path: kv/data/<blindingRef>
    const res = await vault.read(`kv/data/${blindingRef}`);
    const stored = res?.data?.data || {};

    // Convert stringified blinding factors back to BigInt
    const factors = {};
    for (const [key, value] of Object.entries(stored)) {
      factors[key] = BigInt(value);
    }

    return factors;
  } catch (err) {
    console.error(`[fetchBlindingFactors] Failed to fetch ${blindingRef}:`, err.message);
    throw new Error(`Unable to fetch blinding factors for ${blindingRef}`);
  }
}

module.exports = {
  getVaultClient,
  signDataWithZKP,
  getPublicKey,
  initVault,
  prepareZKPAndSelectiveDisclosure,
  storeBlindingFactor,
  getBlindingFactor,
  fetchBlindingFactors
};