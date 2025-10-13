const { generateProof, verifyProof } = require("./utils/proofHelpers");
const circomlibjs = require("circomlibjs");

(async () => {
  try {
    //  Initialize Poseidon
    const poseidon = await circomlibjs.buildPoseidon();
    const F = poseidon.F;

    //  Define fields and disclosed flags
    const fields = [10, 20, 30, 40];
    const disclosed = [1, 0, 1, 0]; // 1 = disclosed, 0 = hidden

    //  Compute field hashes according to disclosed flags
    const fieldHashes = fields.map((v, i) => {
      const val = BigInt(v);
      return disclosed[i] ? poseidon([val]) : BigInt(0);
    });

    //  Compute the Merkle root (Poseidon hash of field hashes)
    const merkleRootBigInt = poseidon(fieldHashes);

    //  Convert to string for snarkjs input
    const merkleRoot = F.toString(merkleRootBigInt);

    console.log(" Computed merkleRoot:", merkleRoot);

    //  Prepare input for the circuit
    const input = {
      merkleRoot,           // Correct Poseidon hash
      applicationType: 1,   // numeric
      fields,               // match nFields=4
      disclosed,
    };

    //  Generate proof
    const { proof, publicSignals } = await generateProof(input);

    //  Verify proof
    const valid = await verifyProof(proof, publicSignals);

    console.log(valid ? "✅ Proof is valid" : "❌ Invalid proof");
  } catch (err) {
    console.error("Error:", err);
  }
})();