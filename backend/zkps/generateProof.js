/**
 * @file generateProof.js
 * @author Ishan Gawande
 * @description
 * Centralized ZK-SNARK proof generator for the Municipal Credential Platform (MCP).
 *
 * Each circuit (e.g., BirthEquality, DeathEquality, LicenseEquality)
 * will have its own .wasm and .zkey files under `build/<circuitName>/`.
 *
 * This utility:
 *   1. Loads the circuit build artifacts.
 *   2. Validates and serializes inputs to match Circom signal names.
 *   3. Generates a zkSNARK proof using Groth16.
 *   4. Returns the proof and publicSignals for verification or on-chain submission.
 */

const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");

/**
 * Generate zkSNARK proof for a specific circuit.
 *
 * @async
 * @param {string} circuitName - Name of the circuit (e.g., "birthEquality", "deathEquality").
 * @param {object} input - Key/value map of circuit signals and their BigInt values.
 *                         Must exactly match the signal names in the Circom file.
 * @returns {Promise<{ proof: object, publicSignals: string[] }>}
 *          proof: zkSNARK proof object
 *          publicSignals: array of public outputs for verifier contract
 *
 * @example
 * const { proof, publicSignals } = await generateProof("birthEquality", {
 *   commitment: BigInt("1234567890"),
 *   value: BigInt("111"),
 *   blinding: BigInt("222")
 * });
 */
const generateProof = async (circuitName, input) => {
  try {
    // ---------------------------------------
    //  Validate circuit build files
    // ---------------------------------------
    const buildPath = path.join(__dirname, "../build", circuitName);
    const wasmPath = path.join(buildPath, `${circuitName}_js`, `${circuitName}.wasm`);
    const zkeyPath = path.join(buildPath, `${circuitName}_final.zkey`);

    if (!fs.existsSync(wasmPath))
      throw new Error(`WASM file missing: ${wasmPath}`);
    if (!fs.existsSync(zkeyPath))
      throw new Error(`ZKey file missing: ${zkeyPath}`);

    // ---------------------------------------
    //  Serialize inputs for snarkjs
    // ---------------------------------------
    const serializedInput = {};
    for (const [key, value] of Object.entries(input)) {
      if (typeof value !== "bigint")
        throw new Error(`❌ Input "${key}" must be a BigInt — got ${typeof value}`);
      serializedInput[key] = value.toString(); // required by snarkjs
    }

    // ---------------------------------------
    //  Generate proof using Groth16
    // ---------------------------------------
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      serializedInput,
      wasmPath,
      zkeyPath
    );

    console.log(
      `✅ [generateProof] Proof generated successfully for circuit "${circuitName}".`
    );

    // ---------------------------------------
    //  Return proof + public signals
    // ---------------------------------------
    return { proof, publicSignals };
  } catch (error) {
    console.error(`❌ [generateProof] ${error.message}`);
    throw error;
  }
};

module.exports = { generateProof };