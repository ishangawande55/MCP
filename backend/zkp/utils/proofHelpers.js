const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");

const buildPath = path.join(__dirname, "../build/ApplicationZKP/ApplicationZKP_js");

exports.generateProof = async (input) => {
  const wasmPath = path.join(buildPath, "ApplicationZKP.wasm");
  const zkeyPath = path.join(__dirname, "../setup/ApplicationZKP_final.zkey");

  console.log("🧠 Generating witness and proof...");

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasmPath,
    zkeyPath
  );

  console.log("✅ Proof generated successfully!");
  return { proof, publicSignals };
};

exports.verifyProof = async (proof, publicSignals) => {
  const vkeyPath = path.join(__dirname, "../setup/verification_key.json");
  const vKey = JSON.parse(fs.readFileSync(vkeyPath));

  const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
  return verified;
};