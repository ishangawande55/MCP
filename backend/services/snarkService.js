// backend/services/snarkService.js
/**
 * snarkService.js
 * Thin service that calls snarkVerifier and provides convenience paths.
 */

const path = require('path');
const { verifyProof } = require('../utils/snarkVerifier');

const BUILD_DIR = path.join(__dirname, '..', 'build'); // adjust if you use different path

async function verifyCircuitProof(proof, publicSignals, circuitName = 'birthEquality') {
  const vkPath = path.join(BUILD_DIR, `${circuitName}_verification_key.json`);
  return await verifyProof(proof, publicSignals, vkPath);
}

module.exports = { verifyCircuitProof };