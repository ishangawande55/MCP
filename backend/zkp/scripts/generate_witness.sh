#!/bin/bash
# Generate witness for ApplicationZKP
# Usage: bash generate_witness.sh inputs/sampleInput.json

CIRCUIT="ApplicationZKP"
INPUT=$1

node build/$CIRCUIT_js/generate_witness.js build/$CIRCUIT.wasm $INPUT build/witness.wtns
echo "✅ Witness generated: build/witness.wtns"