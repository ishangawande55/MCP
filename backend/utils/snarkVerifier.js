// backend/utils/snarkVerifier.js
/**
 * snarkVerifier.js
 * Thin wrapper that verifies a Groth16 proof using snarkjs.
 *
 * Usage:
 *   const { verifyProof } = require('../utils/snarkVerifier');
 *   const ok = await verifyProof(proofObj, publicSignals, verificationKeyPath);
 *
 * verificationKeyPath should be the JSON file produced by snarkjs:
 *   e.g. build/verification_key.json
 */

const snarkjs = require('snarkjs');
const fs = require('fs').promises;
const path = require('path');

async function loadVerificationKey(vkPath) {
  const vkJson = await fs.readFile(path.resolve(vkPath), 'utf8');
  return JSON.parse(vkJson);
}

/**
 * Verify a Groth16 proof.
 * @param {object} proof - proof json produced by snarkjs (proof.json)
 * @param {array} publicSignals - public signals array (public.json)
 * @param {string} vkPath - path to verification_key.json
 * @returns {boolean}
 */
async function verifyProof(proof, publicSignals, vkPath) {
  try {
    const vkey = await loadVerificationKey(vkPath);
    const ok = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    return !!ok;
  } catch (err) {
    console.error('[snarkVerifier] verifyProof error:', err);
    return false;
  }
}

module.exports = { verifyProof };