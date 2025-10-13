#!/bin/bash

# ==========================================================
# 🚀 Circom Compiler Script for ApplicationZKP
# ==========================================================

CIRCUIT_NAME="ApplicationZKP"
CIRCUIT_DIR="./circuits"
BUILD_DIR="./build/${CIRCUIT_NAME}"
NODE_MODULES_DIR="./node_modules"

echo "🚀 Starting compilation for circuit: ${CIRCUIT_NAME}"
echo "----------------------------------------"

# Create build folder
mkdir -p ${BUILD_DIR}

# Compile the circuit
circom ${CIRCUIT_DIR}/${CIRCUIT_NAME}.circom \
  --r1cs --wasm --sym \
  -l ${NODE_MODULES_DIR}/circomlib/circuits \
  -o ${BUILD_DIR}

if [ $? -ne 0 ]; then
  echo "❌ Compilation failed."
  exit 1
else
  echo "✅ Circuit compiled successfully into: ${BUILD_DIR}"
fi