const { verifyCredential } = require('did-jwt-vc');
const { EthrDID } = require('ethr-did');

/**
 * Verifies a Verifiable Credential JWT signed by an Ethereum DID.
 *
 * @param {string} vcJwt - The VC JWT to verify
 * @param {string} issuerDID - The Ethereum DID of the issuer (e.g., "did:ethr:0x1234...")
 * @returns {Promise<{ success: boolean, payload?: object, error?: string }>}
 */
async function verifyCredentialJwt(vcJwt, issuerDID) {
  try {
    // Initialize EthrDID object with issuer DID (public key verification)
    const ethrDid = new EthrDID({ address: issuerDID.replace('did:ethr:', '') });

    // Verify the VC JWT
    const verifiedVC = await verifyCredential(vcJwt, { resolver: { resolve: async (did) => ({ didDocument: { verificationMethod: [{ id: `${did}#keys-1`, type: 'EcdsaSecp256k1VerificationKey2019', controller: did, publicKeyHex: ethrDid.address }] } }) } });
console.log(verifiedVC)
    return {
      success: true,
      payload: verifiedVC,
    };
  } catch (error) {
    console.error('VC JWT verification error:', error);
    return {
      success: false,
      error: error.message || 'Failed to verify VC JWT',
    };
  }
}

module.exports = { verifyCredentialJwt };