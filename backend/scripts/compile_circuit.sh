#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# 🧩 CIRCOM CIRCUIT COMPILATION AND SETUP SCRIPT
# -----------------------------------------------------------------------------
# This script automates the compilation and trusted setup for a Circom circuit.
# It performs the following steps:
#   1. Compiles the circuit (.circom) into .r1cs, .wasm, and .sym files.
#   2. Ensures a Powers of Tau file (POT) exists or guides you to generate one.
#   3. Runs Groth16 setup and contribution ceremony.
#   4. Exports the verification key for proof verification.
#
# NOTE: This assumes you have `circom` and `snarkjs` globally installed.
###############################################################################

# -----------------------------
# 📁 Define important paths
# -----------------------------
CIRCUITS_DIR="./circuits"
CIRCUIT_NAME="birthEquality"
BUILD_DIR="./build/${CIRCUIT_NAME}"

# Create build directory if it doesn't exist
mkdir -p "${BUILD_DIR}"

echo "🚀 Starting compilation for circuit: ${CIRCUIT_NAME}.circom"
echo "----------------------------------------"

# -----------------------------
# 🧱 Step 1: Compile the circuit
# -----------------------------
# - `--r1cs`: Generates the constraint system file
# - `--wasm`: Generates a WebAssembly (WASM) witness generator
# - `--sym`: Generates symbol info for debugging
# - `-l`: Include path for circomlib circuits (Poseidon, etc.)
# - `-o`: Output directory for build artifacts

circom "${CIRCUITS_DIR}/${CIRCUIT_NAME}.circom" \
  --r1cs \
  --wasm \
  --sym \
  -o "${BUILD_DIR}"

echo "✅ Circuit compilation completed."
echo "Artifacts generated in: ${BUILD_DIR}"
echo ""

# -----------------------------
# ⚡ Step 2: Prepare Powers of Tau file
# -----------------------------
# The Powers of Tau (POT) file is a trusted setup phase used for Groth16 proofs.
# It defines the universal parameters required to generate proving/verification keys.

PTAU_FILE="${BUILD_DIR}/pot12_final.ptau"

if [ ! -f "${PTAU_FILE}" ]; then
  echo "⚠️  No Powers of Tau file found!"
  echo "👉 To generate one for testing, run the following commands manually:"
  echo ""
  echo "snarkjs powersoftau new bn128 12 ${BUILD_DIR}/pot12_0000.ptau -v"
  echo "snarkjs powersoftau contribute ${BUILD_DIR}/pot12_0000.ptau ${PTAU_FILE} --name=\"dev\" -v"
  echo ""
  echo "After generating, re-run this script."
  exit 1
fi

echo "✅ Powers of Tau file found: ${PTAU_FILE}"
echo ""

# -----------------------------
# 🧠 Step 3: Setup Groth16 ceremony
# -----------------------------
# This step uses the circuit R1CS file and the POT file to generate proving/verification keys.
# The zkey file will be used later to generate and verify proofs.

snarkjs groth16 setup \
  "${BUILD_DIR}/${CIRCUIT_NAME}.r1cs" \
  "${PTAU_FILE}" \
  "${BUILD_DIR}/${CIRCUIT_NAME}_0000.zkey"

# Contribute randomness (for trust) to the zkey file
snarkjs zkey contribute \
  "${BUILD_DIR}/${CIRCUIT_NAME}_0000.zkey" \
  "${BUILD_DIR}/${CIRCUIT_NAME}_final.zkey" \
  --name="dev contribution" \
  -v

echo "✅ Groth16 setup and contribution completed."
echo ""

# -----------------------------
# 🔑 Step 4: Export verification key
# -----------------------------
# The verification key is needed by verifiers (e.g., smart contracts or APIs)
# to verify zero-knowledge proofs generated using this circuit.

snarkjs zkey export verificationkey \
  "${BUILD_DIR}/${CIRCUIT_NAME}_final.zkey" \
  "${BUILD_DIR}/${CIRCUIT_NAME}_verification_key.json"

echo "✅ Verification key exported successfully."
echo ""
echo "🎉 Done! All build artifacts are stored in: ${BUILD_DIR}"
echo "----------------------------------------"