const crypto = require('crypto');
const elliptic = require('elliptic');
const EC = new elliptic.ec('secp256k1');

/**
 * Generate a new DID for a Commissioner (1-time setup)
 * Returns { did, privateKey, publicKey }
 */
const generateDID = () => {
  const keyPair = EC.genKeyPair();

  const publicKey = keyPair.getPublic('hex');
  const privateKey = keyPair.getPrivate('hex');

  // Create DID format → e.g. did:gov:<publicKeyHash>
  const did = `did:gov:${crypto.createHash('sha256').update(publicKey).digest('hex').slice(0, 16)}`;

  return { did, publicKey, privateKey };
};

/**
 * Sign a Verifiable Credential JSON with Commissioner’s private key
 * @param {Object} vcPayload - The unsigned VC JSON object
 * @param {String} privateKey - The commissioner's private key (hex)
 * @returns {Object} Signed VC (W3C-compatible)
 */
const signVC = async (vcPayload, privateKey) => {
  const key = EC.keyFromPrivate(privateKey);
  const vcString = JSON.stringify(vcPayload);

  // Hash the VC JSON before signing
  const vcHash = crypto.createHash('sha256').update(vcString).digest();

  // ECDSA signature
  const signature = key.sign(vcHash);
  const signatureHex = Buffer.from(signature.toDER()).toString('hex');

  // Attach proof to VC (per W3C spec)
  const signedVC = {
    ...vcPayload,
    proof: {
      type: 'EcdsaSecp256k1Signature2019',
      created: new Date().toISOString(),
      proofPurpose: 'assertionMethod',
      verificationMethod: vcPayload.issuer,
      signatureValue: signatureHex
    }
  };

  return signedVC;
};

/**
 * Verify a signed VC against Commissioner’s DID public key
 * @param {Object} signedVC - The signed VC JSON
 * @param {String} publicKey - Commissioner’s DID public key (hex)
 * @returns {Boolean} true if valid signature, else false
 */
const verifyVC = async (signedVC, publicKey) => {
  try {
    const { proof, ...unsignedVC } = signedVC;
    const vcString = JSON.stringify(unsignedVC);
    const vcHash = crypto.createHash('sha256').update(vcString).digest();

    const key = EC.keyFromPublic(publicKey, 'hex');
    const isValid = key.verify(vcHash, proof.signatureValue);

    return isValid;
  } catch (error) {
    console.error('VC Verification Error:', error);
    return false;
  }
};

module.exports = {
  generateDID,
  signVC,
  verifyVC
};