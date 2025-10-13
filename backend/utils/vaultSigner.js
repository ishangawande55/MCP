/**
 * @file vaultSigner.js
 * @description
 * Handles signing of Verifiable Credentials (VCs) using commissioner Vault keys.
 * Supports optional ZKP commitments for selective disclosure.
 */

const Commissioner = require('../models/User');
const { signDataWithZKP } = require('../services/vaultService');

/**
 * Simple Vault VC signer for controller
 * @param {object} vcPayload - VC payload
 * @param {string} vaultKeyName - Vault key name
 * @param {string} vaultToken - Vault token (optional, defaults to commissioner token)
 * @returns {Promise<string>} signed VC (Base64/JWT)
 */
async function signVCWithVault(vcPayload, vaultKeyName, vaultToken) {
  if (!vcPayload || !vaultKeyName) {
    throw new Error('Missing VC payload or Vault key name');
  }

  if (!vaultToken) {
    throw new Error('Vault token not provided. Use commissioner.vault.token');
  }

  // Use vaultService to sign
  const result = await signDataWithZKP(vaultToken, vaultKeyName, vcPayload);

  // Return signed VC string for controller
  return result.signature;
}

/**
 * Advanced ZKP-enabled VC signing
 * @param {object} vcPayload
 * @param {string} commissionerId - MongoDB _id of commissioner
 * @param {object} zkCommitments - optional
 * @param {object} zkpProofs - optional
 * @param {string} blindingFactorRef - optional
 * @returns {Promise<object>} signed VC + metadata
 */
async function signVCWithVaultZKP(vcPayload, commissionerId, zkCommitments = {}, zkpProofs = {}, blindingFactorRef = null) {
  const commissioner = await Commissioner.findById(commissionerId);
  if (!commissioner || !commissioner.vault) {
    throw new Error(`Vault credentials not found for commissioner ${commissionerId}`);
  }

  const { keyName, token } = commissioner.vault;

  const payloadWithZKP = {
    ...vcPayload,
    zkCommitments,
    zkpProofs,
    blindingFactorRef
  };

  const result = await signDataWithZKP(token, keyName, payloadWithZKP);

  return {
    signedVC: result.signature,
    vcPayload: payloadWithZKP,
    zkpProofs: result.zkpProof,
    blindingFactorRef
  };
}

module.exports = { signVCWithVault, signVCWithVaultZKP };