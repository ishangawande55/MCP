# DID & Verifiable Credentials Service Documentation

## 📋 Overview

The DID & VC Service provides cryptographic identity generation and Verifiable Credential signing/verification capabilities. It implements W3C-compliant Decentralized Identifiers (DIDs) and Verifiable Credentials using secp256k1 elliptic curve cryptography.

## 🏗️ Cryptographic Architecture

![Cryptographic Architecture](diagrams/Cryptographic%20Architecture.png)

## 🎯 Key Features

- **🔐 W3C Compliance**: Standards-compliant DIDs and Verifiable Credentials
- **🔒 Strong Cryptography**: secp256k1 ECDSA with SHA-256 hashing
- **🌐 Decentralized Identity**: Self-sovereign identity without central authority
- **📜 Verifiable Proofs**: Cryptographic proof of credential authenticity
- **⚡ Lightweight**: Pure JavaScript implementation with minimal dependencies

## 📝 Core Functions

### 1. DID Generation

![DID Genration](diagrams/DID%20Genration.png)

**Method**: `generateDID()`
```javascript
/**
 * Generate a new DID for a Commissioner (1-time setup)
 * Returns { did, privateKey, publicKey }
 * @returns {Object} DID document with keys
 */
const generateDID = () => {
  // Generate secp256k1 key pair
  const keyPair = EC.genKeyPair();

  // Extract keys in hex format
  const publicKey = keyPair.getPublic('hex');
  const privateKey = keyPair.getPrivate('hex');

  // Create DID format: did:gov:<publicKeyHash>
  const did = `did:gov:${crypto.createHash('sha256')
    .update(publicKey)
    .digest('hex')
    .slice(0, 16)}`;

  return { did, publicKey, privateKey };
};
```

**DID Format Specification:**
```
did:gov:a1b2c3d4e5f67890
│    │   └─────────────┬─────────────┘
│    │                 │
│    │                 └── Unique Identifier (first 16 chars of SHA-256(publicKey))
│    │
│    └── Method (government context)
│
└── DID Scheme Identifier
```

**Output Example:**
```json
{
  "did": "did:gov:a1b2c3d4e5f67890",
  "publicKey": "04b8d3f... (130 hex chars)",
  "privateKey": "a1b2c3d4... (64 hex chars)"
}
```

### 2. VC Signing Process

![VC Signing Process](diagrams/VC%20Signing%20Process.png)

**Method**: `signVC(vcPayload, privateKey)`
```javascript
/**
 * Sign a Verifiable Credential JSON with Commissioner's private key
 * @param {Object} vcPayload - The unsigned VC JSON object
 * @param {String} privateKey - The commissioner's private key (hex)
 * @returns {Object} Signed VC (W3C-compatible)
 */
const signVC = async (vcPayload, privateKey) => {
  // Load private key for signing
  const key = EC.keyFromPrivate(privateKey);
  
  // Create canonical JSON string for deterministic hashing
  const vcString = JSON.stringify(vcPayload);

  // Hash the VC JSON before signing (SHA-256)
  const vcHash = crypto.createHash('sha256').update(vcString).digest();

  // ECDSA signature using secp256k1
  const signature = key.sign(vcHash);
  const signatureHex = Buffer.from(signature.toDER()).toString('hex');

  // Attach proof to VC (per W3C Verifiable Credentials spec)
  const signedVC = {
    ...vcPayload,  // Preserve all original VC data
    proof: {
      type: 'EcdsaSecp256k1Signature2019',
      created: new Date().toISOString(),
      proofPurpose: 'assertionMethod',
      verificationMethod: vcPayload.issuer,  // DID of issuer
      signatureValue: signatureHex
    }
  };

  return signedVC;
};
```

**VC Proof Structure (W3C Compliant):**
```json
{
  "proof": {
    "type": "EcdsaSecp256k1Signature2019",
    "created": "2024-01-15T10:30:00.000Z",
    "proofPurpose": "assertionMethod",
    "verificationMethod": "did:gov:a1b2c3d4e5f67890",
    "signatureValue": "30440220..."
  }
}
```

### 3. VC Verification Process

![VC Verification](diagrams/VC%20Verification%20Process.png)

**Method**: `verifyVC(signedVC, publicKey)`
```javascript
/**
 * Verify a signed VC against Commissioner's DID public key
 * @param {Object} signedVC - The signed VC JSON
 * @param {String} publicKey - Commissioner's DID public key (hex)
 * @returns {Boolean} true if valid signature, else false
 */
const verifyVC = async (signedVC, publicKey) => {
  try {
    // Separate proof from VC content
    const { proof, ...unsignedVC } = signedVC;
    
    // Recreate canonical JSON string
    const vcString = JSON.stringify(unsignedVC);
    
    // Recompute hash (must match signing process)
    const vcHash = crypto.createHash('sha256').update(vcString).digest();

    // Load public key for verification
    const key = EC.keyFromPublic(publicKey, 'hex');
    
    // Verify ECDSA signature
    const isValid = key.verify(vcHash, proof.signatureValue);

    return isValid;
  } catch (error) {
    console.error('VC Verification Error:', error);
    return false;  // Graceful failure on any error
  }
};
```

## 🔐 Cryptographic Details

### Key Generation (secp256k1)
```javascript
// Using elliptic library for secp256k1
const EC = new elliptic.ec('secp256k1');
const keyPair = EC.genKeyPair();

// Key formats:
const privateKey = keyPair.getPrivate('hex');  // 64-character hex string
const publicKey = keyPair.getPublic('hex');    // 130-character hex string (04 + X + Y)
```

### Signature Process
```javascript
// 1. Hash the VC payload
const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest();

// 2. ECDSA signature
const signature = key.sign(hash);

// 3. DER encoding for interoperability
const signatureDER = signature.toDER();
const signatureHex = Buffer.from(signatureDER).toString('hex');
```

## 💡 Usage Examples

### Complete Commissioner Setup
```javascript
const { generateDID, signVC, verifyVC } = require('./did-service');

// 1. Generate DID for new commissioner
const { did, publicKey, privateKey } = generateDID();
console.log('Generated DID:', did);
console.log('Public Key:', publicKey.substring(0, 20) + '...');
console.log('Private Key:', '[SECURELY STORED]');

// 2. Create unsigned Verifiable Credential
const unsignedVC = {
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://www.w3.org/2018/credentials/examples/v1"
  ],
  "id": "http://example.gov/credentials/3732",
  "type": ["VerifiableCredential", "UniversityDegreeCredential"],
  "issuer": did,  // Commissioner's DID
  "issuanceDate": new Date().toISOString(),
  "credentialSubject": {
    "id": "did:example:ebfeb1f712ebc6f1c276e12ec21",
    "degree": {
      "type": "BachelorDegree",
      "name": "Bachelor of Science and Arts"
    }
  }
};

// 3. Sign the VC
const signedVC = await signVC(unsignedVC, privateKey);
console.log('Signed VC with proof:', signedVC.proof.type);

// 4. Verify the VC (as a verifier would)
const isValid = await verifyVC(signedVC, publicKey);
console.log('VC Signature Valid:', isValid);  // true
```

### Integration with Commissioner Registration
```javascript
async function registerCommissioner(commissionerData) {
  // Generate cryptographic identity
  const { did, publicKey, privateKey } = generateDID();
  
  // Store private key securely (Vault/HSM)
  await secureKeyStorage.store(privateKey, commissionerData.id);
  
  // Return public identity information
  return {
    commissionerId: commissionerData.id,
    did: did,
    publicKey: publicKey,
    blockchainAddress: await createBlockchainWallet(),
    registrationDate: new Date()
  };
}
```

### Credential Issuance Workflow
```javascript
async function issueCredential(commissionerId, credentialData, holderDID) {
  // 1. Retrieve commissioner's private key
  const privateKey = await secureKeyStorage.retrieve(commissionerId);
  
  // 2. Create VC payload
  const vcPayload = {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    "type": ["VerifiableCredential", credentialData.type],
    "issuer": commissionerId.did,
    "issuanceDate": new Date().toISOString(),
    "credentialSubject": {
      "id": holderDID,
      ...credentialData.claims
    }
  };
  
  // 3. Sign the VC
  const signedVC = await signVC(vcPayload, privateKey);
  
  // 4. Anchor on blockchain
  await blockchainService.issueCredential(
    credentialData.id,
    crypto.createHash('sha256').update(JSON.stringify(signedVC)).digest('hex'),
    signedVC
  );
  
  return signedVC;
}
```

## 🛡️ Security Considerations

### Private Key Storage
```javascript
// NEVER store private keys in plaintext
// Recommended storage approaches:

// 1. HashiCorp Vault
const vaultStorage = {
  store: async (keyId, privateKey) => {
    await vault.write(`secret/data/keys/${keyId}`, { privateKey });
  },
  retrieve: async (keyId) => {
    const data = await vault.read(`secret/data/keys/${keyId}`);
    return data.privateKey;
  }
};

// 2. Hardware Security Module (HSM)
// 3. Encrypted database with key rotation
```

### Cryptographic Best Practices
- **Key Generation**: Use cryptographically secure random number generation
- **Hash Function**: SHA-256 for strong collision resistance
- **Signature Scheme**: ECDSA with secp256k1 (bitcoin-standard)
- **Key Storage**: Private keys never exposed to application logic

## 📊 Performance Characteristics

### Operation Timings

![Operation Timings](diagrams/Operation%20Timings.png)

### Memory Usage
- **Key Pairs**: ~200 bytes per DID
- **Signatures**: ~70-72 bytes DER encoded
- **VC Proofs**: ~500 bytes including metadata

## 🔧 Error Handling

### Graceful Failure Modes
```javascript
// Verification always returns boolean, never throws
const isValid = await verifyVC(signedVC, publicKey);
if (!isValid) {
  // Handle invalid signature: log, alert, reject credential
  console.warn('Invalid VC signature detected');
  throw new Error('Credential verification failed');
}

// Signing throws only on critical errors
try {
  const signedVC = await signVC(payload, privateKey);
} catch (error) {
  console.error('Critical signing error:', error);
  // Alert administrators, halt operations
}
```

## 🌐 Standards Compliance

### W3C Verifiable Credentials
- **Proof Format**: EcdsaSecp256k1Signature2019
- **DID Method**: `did:gov` (custom government context)
- **VC Structure**: JSON-LD with proper `@context`

### Future Extensions
```javascript
// Support for multiple signature types
const SIGNATURE_TYPES = {
  SECP256K1: 'EcdsaSecp256k1Signature2019',
  ED25519: 'Ed25519Signature2018',
  RSA: 'RsaSignature2018'
};

// JSON-LD context expansion
const CONTEXTS = {
  VC_V1: 'https://www.w3.org/2018/credentials/v1',
  VC_EXAMPLES: 'https://www.w3.org/2018/credentials/examples/v1',
  GOV_VC: 'https://schema.gov.in/credentials/v1'
};
```

---

**Author**: Ishan Gawande  
**Version**: 1.0.0  
**Standards**: W3C Verifiable Credentials, Decentralized Identifiers  
**Cryptography**: secp256k1 ECDSA with SHA-256  
**License**: MIT