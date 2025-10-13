/**
 * @file computeCommitment.js
 * @description
 * Compute Poseidon hash commitments for zkSNARK inputs.
 * Converts input values and blinding factors to BigInt-safe format.
 * Used for selective disclosure in Verifiable Credentials.
 */

const circomlib = require('circomlibjs');

/**
 * Compute Poseidon hash commitment
 * @param {BigInt} value - Encoded sensitive field as BigInt
 * @param {BigInt} blinding - Random blinding factor as BigInt
 * @returns {string} Hex string of Poseidon hash
 */
const computeCommitment = async (value, blinding) => {
  try {
    if (typeof value !== 'bigint' || typeof blinding !== 'bigint') {
      throw new Error('Both value and blinding must be BigInt.');
    }

    // Initialize Poseidon hash
    const poseidon = await circomlib.buildPoseidon();

    // Compute commitment
    const commitmentBigInt = poseidon.F.toObject(poseidon([value, blinding]));

    // Return as hex string
    return '0x' + commitmentBigInt.toString(16);
  } catch (err) {
    console.error(`[computeCommitment] Error: ${err.message}`);
    throw err;
  }
};

module.exports = { computeCommitment };