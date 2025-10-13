/**
 * @file verifySelectiveDisclosure.js
 * @description
 * zkSNARK selective disclosure verifier using Poseidon commitments.
 * Compares user-provided revealed fields against stored commitments and blinding factors.
 */

const { computeCommitment } = require('./zkpSnark/computeCommitment');
const { getBlindingFactor } = require('../services/vaultService');

/**
 * Verify selective disclosure proof.
 * @param {object} zkCommitments - Stored commitments per sensitive field (decimal strings)
 * @param {string|null} blindingRef - Reference key to retrieve blinding factors from Vault
 * @param {object} proof - User-submitted proof, must contain `revealedFields`
 * @returns {object} { verified: boolean|null, revealedFields: object|null }
 */
const verifySelectiveDisclosure = async (zkCommitments, blindingRef, proof) => {
  try {
    if (!proof || !proof.revealedFields || !zkCommitments) return { verified: null, revealedFields: null };

    // Fetch blinding factors from Vault if reference provided
    const blindingFactors = blindingRef ? (await getBlindingFactor(blindingRef)) || {} : {};

    // Track which fields are successfully verified
    const verifiedFields = {};

    // Iterate over revealed fields
    for (const [fieldKey, fieldValue] of Object.entries(proof.revealedFields)) {
      const storedCommitment = zkCommitments[fieldKey];
      if (!storedCommitment) return { verified: false, revealedFields: null };

      const bfHex = blindingFactors[fieldKey] || null;

      // Recompute commitment
      const recomputedCommitment = await computeCommitment(fieldValue, bfHex);

      // Normalize both to decimal string for comparison
      const decimalRecomputed = typeof recomputedCommitment === 'bigint' ? recomputedCommitment.toString() : BigInt(recomputedCommitment).toString();
      const decimalStored = BigInt(storedCommitment).toString();

      if (decimalRecomputed !== decimalStored) return { verified: false, revealedFields: null };

      verifiedFields[fieldKey] = fieldValue;
    }

    return { verified: true, revealedFields: verifiedFields };
  } catch (err) {
    console.error('[verifySelectiveDisclosure] Error:', err.message);
    return { verified: false, revealedFields: null };
  }
};

module.exports = { verifySelectiveDisclosure };