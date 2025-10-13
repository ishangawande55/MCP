/**
 * @file verifyProof.js
 * @description Verify a zkSNARK proof for a given circuit
 */

const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

/**
 * Verify a zkSNARK proof
 * @param {string} circuitName - Circuit name
 * @param {object} proof - zkSNARK proof
 * @param {Array} publicSignals - Public signals
 * @returns {boolean} Verification result
 */
const verifyProof = async (circuitName, proof, publicSignals) => {
  try {
    const vkeyPath = path.join(__dirname, '../build', circuitName, `${circuitName}_vkey.json`);
    if (!fs.existsSync(vkeyPath)) throw new Error('vkey file missing.');

    const vkey = JSON.parse(fs.readFileSync(vkeyPath));
    return await snarkjs.groth16.verify(vkey, publicSignals, proof);
  } catch (err) {
    console.error(`[verifyProof] Error: ${err.message}`);
    return false;
  }
};

module.exports = { verifyProof };