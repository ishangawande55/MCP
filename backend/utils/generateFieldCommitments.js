const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

function generateFieldCommitments(details) {
  const commitments = {};
  const leaves = [];

  for (const [key, value] of Object.entries(details)) {
    if (value) {
      const hash = keccak256(JSON.stringify(value)).toString('hex');
      commitments[key] = hash;
      leaves.push(hash);
    }
  }

  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const root = tree.getRoot().toString('hex');

  return { commitments, merkleRoot: root, tree };
}