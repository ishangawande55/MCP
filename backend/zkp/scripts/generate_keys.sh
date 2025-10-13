#!/bin/bash
# ==========================================================
# 🚀 ZKP Key Generation Script for ApplicationZKP
# ==========================================================
# Usage:
#   bash generate_keys.sh
# This will:
#   1. Generate a Groth16 zkey (proving key)
#   2. Export the verification key (JSON)
# ==========================================================

CIRCUIT_NAME="ApplicationZKP"
BUILD_DIR="../build/${CIRCUIT_NAME}"
PTAU_FILE="../setup/powersOfTau28_hez_final.ptau"

echo "🚀 Starting ZKP key generation for circuit: ${CIRCUIT_NAME}"
mkdir -p ${BUILD_DIR}

# Step 1: Generate initial zkey
echo "🔑 Generating initial .zkey..."
snarkjs groth16 setup \
  ${BUILD_DIR}/${CIRCUIT_NAME}.r1cs \
  ${PTAU_FILE} \
  ${BUILD_DIR}/${CIRCUIT_NAME}_0000.zkey

if [ $? -ne 0 ]; then
    echo "❌ Initial zkey generation failed."
    exit 1
fi

# Step 2: Contribute to ceremony (optional)
echo "🎉 Contributing to zkey ceremony..."
snarkjs zkey contribute \
  ${BUILD_DIR}/${CIRCUIT_NAME}_0000.zkey \
  ${BUILD_DIR}/${CIRCUIT_NAME}.zkey \
  --name="Ishan Gawande contribution" \
  -v -e="Random entropy for ceremony"

if [ $? -ne 0 ]; then
    echo "❌ Zkey contribution failed."
    exit 1
fi

# Step 3: Export verification key
echo "📝 Exporting verification key..."
snarkjs zkey export verificationkey \
  ${BUILD_DIR}/${CIRCUIT_NAME}.zkey \
  ${BUILD_DIR}/verification_key.json

if [ $? -ne 0 ]; then
    echo "❌ Verification key export failed."
    exit 1
fi

echo "✅ ZKP keys generated successfully!"
echo "Proving key: ${BUILD_DIR}/${CIRCUIT_NAME}.zkey"
echo "Verification key: ${BUILD_DIR}/verification_key.json"