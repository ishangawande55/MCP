#!/usr/bin/env bash
set -euo pipefail

# -----------------------------
# Config
# -----------------------------
CIRCUIT_NAME="birthEquality"
CIRCUITS_DIR="./circuits"
BUILD_DIR="./build/$CIRCUIT_NAME"
CIRCUIT_FILE="$CIRCUITS_DIR/$CIRCUIT_NAME.circom"

PTAU_FILE="$BUILD_DIR/pot12_final.ptau"
ZKEY_INIT="$BUILD_DIR/${CIRCUIT_NAME}_0000.zkey"
ZKEY_FINAL="$BUILD_DIR/${CIRCUIT_NAME}_final.zkey"
VERIFICATION_KEY="$BUILD_DIR/${CIRCUIT_NAME}_verification_key.json"

# -----------------------------
# Prepare build directory
# -----------------------------
mkdir -p "$BUILD_DIR"

echo "🚀 Compiling $CIRCUIT_NAME.circom..."
circom "$CIRCUIT_FILE" --r1cs --wasm --sym -o "$BUILD_DIR"
echo "✅ Circuit compiled successfully!"

# -----------------------------
# Check Powers of Tau
# -----------------------------
if [ ! -f "$PTAU_FILE" ]; then
    echo "⚠️  Powers of Tau file not found!"
    echo "Please run the following manually **once** before using this script again:"
    echo "  snarkjs powersoftau new bn128 12 $BUILD_DIR/pot12_0000.ptau -v"
    echo "  snarkjs powersoftau contribute $BUILD_DIR/pot12_0000.ptau $BUILD_DIR/pot12_final.ptau --name=\"dev contribution\" -v"
    exit 1
fi

# -----------------------------
# Groth16 zkey setup
# -----------------------------
if [ ! -f "$ZKEY_FINAL" ]; then
    echo "⚡ Generating Groth16 zkey..."

    # Step 1: Setup initial zkey
    snarkjs groth16 setup "$BUILD_DIR/$CIRCUIT_NAME.r1cs" "$PTAU_FILE" "$ZKEY_INIT"

    # Step 2: Contribute randomness to final zkey
    echo "automated contribution" | snarkjs zkey contribute "$ZKEY_INIT" "$ZKEY_FINAL" --name="dev contribution" -v

    # Step 3: Export verification key
    snarkjs zkey export verificationkey "$ZKEY_FINAL" "$VERIFICATION_KEY"

    echo "✅ zkey and verification key generated!"
else
    echo "✅ Groth16 zkey already exists. Skipping zkey setup."
fi

echo "🎉 Build completed! Artifacts in $BUILD_DIR"