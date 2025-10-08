const { EthrDID } = require('ethr-did');
const { createVerifiableCredentialJwt } = require('did-jwt-vc');

/**
 * Signs a Verifiable Credential (VC) using Ethereum DID.
 * @param {Object} vcPayload - The Verifiable Credential JSON payload
 * @param {string} issuerPrivateKey - The private key of the issuer
 * @param {string} issuerDID - The Ethereum DID of the issuer
 * @returns {Promise<string>} - The signed VC JWT
 */
exports.signVCWithDID = async (vcPayload, issuerPrivateKey, issuerDID) => {
  try {
    // Initialize DID object
    const ethrDid = new EthrDID({ privateKey: issuerPrivateKey, address: issuerDID.replace('did:ethr:', '') });

    // Create JWT VC
    const jwt = await createVerifiableCredentialJwt(
      {
        sub: vcPayload.credentialSubject.applicant.did || 'did:example:unknown', // holder DID
        nbf: Math.floor(Date.now() / 1000),
        vc: vcPayload
      },
      ethrDid
    );

    return jwt;
  } catch (error) {
    console.error('Error signing VC with DID:', error);
    throw new Error('Failed to sign VC with DID');
  }
};