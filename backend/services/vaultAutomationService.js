/**
 * Vault Automation Service
 * -------------------------
 * Handles automated creation of:
 *  - Transit signing keys per commissioner
 *  - Vault policies with minimal privileges
 *  - Scoped Vault tokens for signing operations
 *
 * Each commissioner gets:
 *  keyName:  transit/keys/commissioner-key-<uniqueId>
 *  policy:   commissioner-policy-<uniqueId>
 *  token:    Scoped Vault token for signing only
 */

const axios = require('axios');
require('dotenv').config();

// Load from .env
const VAULT_ADDR = process.env.VAULT_ADDR || 'http://127.0.0.1:8200';
const VAULT_ROOT_TOKEN = process.env.VAULT_ROOT_TOKEN;

/**
 * Creates a new Transit key for a commissioner
 * @param {string} keyName
 */
async function createTransitKey(keyName) {
  const url = `${VAULT_ADDR}/v1/transit/keys/${keyName}`;
  const headers = { 'X-Vault-Token': VAULT_ROOT_TOKEN };

  try {
    await axios.post(
      url,
      {
        type: 'rsa-2048',
        exportable: true,
        allow_plaintext_backup: false,
      },
      { headers }
    );
    console.log(`Created Vault transit key: ${keyName}`);
  } catch (err) {
    if (err.response && err.response.status === 400 && err.response.data.errors[0].includes('exists')) {
      console.log(`Key ${keyName} already exists`);
    } else {
      console.error('Failed to create transit key:', err.response?.data || err.message);
      throw err;
    }
  }
}

/**
 * Creates a new Vault policy allowing signing and key read
 * @param {string} policyName
 * @param {string} keyName
 */
async function createPolicy(policyName, keyName) {
  const policyHCL = `
path "transit/sign/${keyName}" {
  capabilities = ["create", "update"]
}

path "transit/keys/${keyName}" {
  capabilities = ["read"]
}
`;

  const url = `${VAULT_ADDR}/v1/sys/policy/${policyName}`;
  const headers = { 'X-Vault-Token': VAULT_ROOT_TOKEN };

  try {
    await axios.put(url, { policy: policyHCL }, { headers });
    console.log(`Created Vault policy: ${policyName}`);
  } catch (err) {
    console.error('Failed to create policy:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Generates a scoped token bound to the policy
 * @param {string} policyName
 * @returns {Promise<string>} token
 */
async function generateScopedToken(policyName) {
  const url = `${VAULT_ADDR}/v1/auth/token/create`;
  const headers = { 'X-Vault-Token': VAULT_ROOT_TOKEN };

  try {
    const { data } = await axios.post(
      url,
      {
        policies: [policyName],
        ttl: '24h', // Token valid for 24 hours (configurable)
        renewable: true,
      },
      { headers }
    );

    const token = data.auth.client_token;
    console.log(`Generated scoped Vault token for policy: ${policyName}`);
    return token;
  } catch (err) {
    console.error('Failed to generate scoped token:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Main function:
 * Sets up Vault key + policy + token for a commissioner automatically
 * @param {string} uniqueId
 * @returns {Promise<Object>} vault metadata
 */
async function setupCommissionerVaultAccess(uniqueId) {
  const keyName = `commissioner-key-${uniqueId}`;
  const policyName = `commissioner-policy-${uniqueId}`;

  console.log(`\n Setting up Vault access for commissioner [${uniqueId}]`);

  // Create signing key
  await createTransitKey(keyName);

  // Create scoped policy
  await createPolicy(policyName, keyName);

  // Create token bound to policy
  const token = await generateScopedToken(policyName);

  // Return metadata for MongoDB
  return {
    keyName,
    policyName,
    token,
    createdAt: new Date(),
  };
}

module.exports = { setupCommissionerVaultAccess };