# Credential Model Documentation

## 📋 Overview

The `Credential` model defines the MongoDB schema for Verifiable Credentials (VCs) issued through the Municipal Credentials Platform. It provides comprehensive storage for credential data, cryptographic proofs, blockchain anchoring, and verification history with full support for Zero-Knowledge Proofs and selective disclosure.

## 🏗️ Schema Architecture

![Credential Schema Architecture](diagrams/Credential%20Schema-Architecture.png)

## 🎯 Key Features

- **🔗 Blockchain Integration**: Full on-chain anchoring with transaction tracking
- **🔐 Zero-Knowledge Proofs**: Comprehensive ZKP storage and management
- **📜 Verifiable Credentials**: W3C-compliant VC data storage
- **💾 IPFS Storage**: Decentralized credential document storage
- **🕵️ Selective Disclosure**: Field-level disclosure control and commitments
- **📊 Lifecycle Management**: Complete credential status tracking
- **🔍 Verification History**: Comprehensive audit trail of all verifications
- **🔒 Cryptographic Integrity**: Deterministic hashing for verification

## 📊 Schema Structure

### Core Identifiers

```javascript
// ---------------------
// Core Identifiers
// ---------------------
credentialId: { type: String, required: true, unique: true, index: true },
applicationId: { type: String, required: true, ref: "Application", index: true },
type: { type: String, enum: ["BIRTH", "DEATH", "TRADE_LICENSE", "NOC"], required: true, index: true },
```

### Parties Involved

```javascript
// ---------------------
// Parties Involved
// ---------------------
recipient: { name: String, email: String, phone: String },
issuer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
issuerDID: { type: String, required: true },
holderDID: { type: String, required: true },
holderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
```

### Blockchain & Storage Metadata

```javascript
// ---------------------
// On-chain & Off-chain Metadata
// ---------------------
schemaType: { type: String, required: true },
ipfsCID: { type: String, required: true },
blockchainTxHash: { type: String, required: true },
credentialHash: { type: String, required: true },
registryContract: { type: String, required: true },
issuerAddress: { type: String, required: true },
```

## 🔐 Verifiable Credential Data

### VC Data Structure

```javascript
// ---------------------
// Full VC Data
// ---------------------
vcData: {
  type: Object,
  required: true,
  /**
   * Structure:
   * {
   *   vcJwt: string,             // Vault-signed JWT
   *   payload: Object            // Canonical VC payload used for deterministic hash & verification
   * }
   */
  set: function (data) {
    if (data && data.payload) {
      this.credentialHash = computeHashBytes32(data.payload);
    }
    return data;
  },
},
```

### Automatic Hash Computation

```javascript
// -----------------------------------------
// Helper: Compute deterministic hash for Solidity
// -----------------------------------------
const computeHashBytes32 = (input) => {
  const str = typeof input === "string" ? input : canonicalize(input);
  const hash = crypto.createHash("sha256").update(str).digest("hex");
  return "0x" + hash.padStart(64, "0").slice(0, 64);
};

// -----------------------------------------
// Helper: Canonicalize object deterministically
// -----------------------------------------
const canonicalize = (obj) => {
  if (!obj || typeof obj !== "object") return JSON.stringify(obj);
  const sortedKeys = Object.keys(obj).sort();
  const result = {};
  for (const key of sortedKeys) {
    result[key] = canonicalize(obj[key]);
  }
  return JSON.stringify(result);
};
```

### Signature Information

```javascript
vcSignature: { type: String, required: true },
issuerPublicKey: String,
issuerVaultKeyRef: String,
issuerKeyVersion: Number,
```

## 🔐 Zero-Knowledge Proof Integration

### ZKP Proof Sub-schema

```javascript
// -----------------------------------------
// Sub-schema: ZKP Proof Schema
// -----------------------------------------
const zkpProofSchema = new mongoose.Schema(
  {
    proof: { type: Object, required: false },
    publicSignals: { type: [String], required: false },
  },
  { _id: false }
);
```

### ZKP Storage Structure

```javascript
// ---------------------
// Zero-Knowledge Proofs
// ---------------------
zkpProofs: { 
  birth: zkpProofSchema, 
  death: zkpProofSchema, 
  trade: zkpProofSchema, 
  noc: zkpProofSchema 
},
vcCommitments: { 
  birth: String, 
  death: String, 
  trade: String, 
  noc: String 
},
merkleRoot: { type: String },
disclosedFields: { type: [String], default: [] },
zkCommitments: { 
  birth: String, 
  death: String, 
  trade: String, 
  noc: String 
},
blindingFactorRef: String,
disclosurePolicy: [String],
```

### ZKP Data Flow

![ZKP Data Flow](diagrams/ZKP%20Data%20flow.png)

## ⚙️ Credential Lifecycle Management

### Status Tracking

```javascript
// ---------------------
// Credential Lifecycle
// ---------------------
issueDate: { type: Date, default: Date.now },
expiryDate: Date,
credentialStatus: { 
  type: String, 
  enum: ["ISSUED", "REVOKED", "EXPIRED", "ACTIVE"], 
  default: "ISSUED" 
},
revocationStatus: { type: Boolean, default: false },
revokedReason: String,
revokedAt: Date,
```

### Status Transition Flow

![Status Transition Flow](diagrams/Status%20Transition%20Flow.png)

## 🔍 Verification & Audit System

### Verification History

```javascript
// ---------------------
// Verification History
// ---------------------
verificationLogs: [
  {
    verifiedBy: String,
    verifiedAt: { type: Date, default: Date.now },
    result: { 
      type: String, 
      enum: ["VALID", "REVOKED", "HASH_MISMATCH", "EXPIRED", "INVALID"] 
    },
    jwtVerified: { type: Boolean, default: false },
  },
],
```

### Verification Log Structure

```javascript
// Example verification log entry
{
  verifiedBy: "did:mcp:verifier123",
  verifiedAt: "2024-01-15T10:30:00.000Z",
  result: "VALID",
  jwtVerified: true,
  // Additional fields can be added for detailed verification results
}
```

## 💡 Usage Examples

### Creating a Birth Certificate Credential

```javascript
const credential = new Credential({
  credentialId: "cred-BIRTH-1640995200000-456-1640995300000",
  applicationId: "BIRTH-1640995200000-456",
  type: "BIRTH",
  
  // Parties
  recipient: {
    name: "Rajesh Kumar",
    email: "rajesh@example.com",
    phone: "+91-9876543210"
  },
  issuerDID: "did:mcp:commissioner:healthcare001",
  holderDID: "did:mcp:applicant:rajesh123",
  
  // Blockchain & Storage
  schemaType: "BIRTH_Credential",
  ipfsCID: "QmXyz123...",
  blockchainTxHash: "0xabc123...",
  registryContract: "0x742d35Cc6634C0532925a3b8bc1934eF04240000",
  issuerAddress: "0xCommissionerAddress",
  
  // VC Data (triggers automatic hash computation)
  vcData: {
    vcJwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    payload: {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiableCredential", "BIRTH_Credential"],
      issuer: "did:mcp:commissioner:healthcare001",
      issuanceDate: "2024-01-15T10:30:00Z",
      credentialSubject: {
        id: "did:mcp:applicant:rajesh123",
        name: "Rajesh Kumar",
        // ... other subject data
      }
    }
  },
  
  vcSignature: "VAULT_SIGNED",
  
  // ZKP Data
  merkleRoot: "0x192873918273918273918273981273981",
  disclosedFields: ["childName", "dateOfBirth"],
  disclosurePolicy: ["childName", "dateOfBirth"]
});

await credential.save();
```

### Adding Verification Log

```javascript
await Credential.updateOne(
  { credentialId: "cred-BIRTH-1640995200000-456-1640995300000" },
  {
    $push: {
      verificationLogs: {
        verifiedBy: "did:mcp:verifier456",
        verifiedAt: new Date(),
        result: "VALID",
        jwtVerified: true
      }
    }
  }
);
```

### Revoking a Credential

```javascript
await Credential.updateOne(
  { credentialId: "cred-BIRTH-1640995200000-456-1640995300000" },
  {
    credentialStatus: "REVOKED",
    revocationStatus: true,
    revokedReason: "Document forgery detected",
    revokedAt: new Date()
  }
);
```

## 🔄 Integration Points

### Relationship with Application Model

![Relationship with Application Model](diagrams/Relationship%20with%20Application%20Flow.png)

### Index Optimization

```javascript
// -----------------------------------------
// Index Optimization
// -----------------------------------------
credentialSchema.index({ credentialId: 1 });
credentialSchema.index({ issuerDID: 1 });
credentialSchema.index({ holderDID: 1 });
credentialSchema.index({ type: 1 });
credentialSchema.index({ merkleRoot: 1 });

// Additional recommended indexes
credentialSchema.index({ applicationId: 1 });
credentialSchema.index({ credentialStatus: 1 });
credentialSchema.index({ issueDate: -1 });
credentialSchema.index({ issuerAddress: 1 });
credentialSchema.index({ "verificationLogs.verifiedAt": -1 });
```

## 🛡️ Security Considerations

### Deterministic Hashing

- **Canonical JSON**: Ensures consistent hash computation across systems
- **SHA-256**: Cryptographically secure hashing algorithm
- **Bytes32 Format**: Compatible with Solidity smart contracts
- **Automatic Computation**: Hash computed automatically when VC data is set

### Data Integrity

- **Immutable Core**: Critical fields cannot be modified after issuance
- **Audit Trail**: All verifications are permanently logged
- **Blockchain Anchoring**: Merkle root provides tamper-evident storage
- **Signature Verification**: JWT signatures ensure issuer authenticity

### Privacy Protection

- **Selective Disclosure**: Only store disclosed fields in plain text
- **ZKP Commitments**: Cryptographic commitments for hidden fields
- **DID Usage**: Decentralized identifiers instead of personal data
- **IPFS Storage**: Sensitive documents stored off-chain

## 🚀 Advanced Features

### Method Extensions

```javascript
// Additional useful methods for the credential model
credentialSchema.methods.verifyIntegrity = function() {
  const computedHash = computeHashBytes32(this.vcData.payload);
  return computedHash === this.credentialHash;
};

credentialSchema.methods.isExpired = function() {
  return this.expiryDate && new Date() > this.expiryDate;
};

credentialSchema.methods.getVerificationStats = function() {
  const stats = { total: 0, valid: 0, invalid: 0 };
  this.verificationLogs.forEach(log => {
    stats.total++;
    if (log.result === 'VALID') stats.valid++;
    else stats.invalid++;
  });
  return stats;
};
```

### Virtual Fields

```javascript
// Virtual fields for derived properties
credentialSchema.virtual('isActive').get(function() {
  return this.credentialStatus === 'ACTIVE' && !this.isExpired();
});

credentialSchema.virtual('daysUntilExpiry').get(function() {
  if (!this.expiryDate) return null;
  const diffTime = this.expiryDate - new Date();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});
```

---

**Author**: Ishan Gawande  
**Version**: 1.0.0  
**Security**: Deterministic hashing, ZKP integration, Blockchain anchoring  
**Features**: Complete credential lifecycle, Verification auditing, Selective disclosure  
**Integration**: MongoDB, IPFS, Blockchain, ZKP proofs, User models  
**License**: MIT