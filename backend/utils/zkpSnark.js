// utils/zkpSnark.js
const crypto = require('crypto');

/**
 * Convert arbitrary JSON/string into deterministic BigInt field element
 */
const objectToFieldBigInt = (value) => {
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  const hash = crypto.createHash('sha256').update(str).digest('hex');
  return BigInt('0x' + hash);
};

/**
 * Normalize commitment to decimal string for storage
 */
const normalizeCommitmentToDecimalString = (result) => {
  if (typeof result === 'bigint') return result.toString();
  if (typeof result === 'string') {
    if (result.startsWith('0x') || result.startsWith('0X')) return BigInt(result).toString();
    return BigInt(result).toString();
  }
  throw new Error('Unsupported commitment type.');
};

/**
 * Compute Poseidon/commitment (stub example, replace with actual function)
 */
const computeCommitment = async (value, blinding) => {
  // Implement Poseidon or your chosen zk commitment
  return value + blinding; // placeholder, replace with proper zk commitment
};

/**
 * Convert BigInt blinding to safe hex string for storage
 */
const safeStorageBlinding = (bf) => {
  if (typeof bf !== 'bigint') throw new Error('Blinding factor must be BigInt.');
  return '0x' + bf.toString(16);
};

module.exports = {
  objectToFieldBigInt,
  normalizeCommitmentToDecimalString,
  computeCommitment,
  safeStorageBlinding
};