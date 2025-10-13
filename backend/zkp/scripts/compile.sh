#!/bin/bash

CIRCUIT_NAME="ApplicationZKP"
CIRCUIT_DIR="../circuits"
BUILD_DIR="$(pwd)/../build/${CIRCUIT_NAME}"
INCLUDE_DIR="$(pwd)/../circuits/lib/circomlib"   # folder containing poseidon.circom
CONSTANTS_DIR="$(pwd)/../circuits/lib"           # folder containing poseidon_constants.circom

echo "🚀 Starting compilation for circuit: ${CIRCUIT_NAME}"
mkdir -p ${BUILD_DIR}

# Circom 2.x only allows one -l at a time, so use the folder with poseidon.circom as the include
circom ${CIRCUIT_DIR}/${CIRCUIT_NAME}.circom \
  --r1cs --wasm --sym \
  -l ${INCLUDE_DIR} \
  -o ${BUILD_DIR}

if [ $? -ne 0 ]; then
  echo "❌ Compilation failed."
  exit 1
else
  echo "✅ Circuit compiled successfully into: ${BUILD_DIR}"
fi