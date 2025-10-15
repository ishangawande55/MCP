# Verifiable Credential Verification Controller Documentation

## 📋 Overview

The `verifyCredential` controller provides comprehensive verification of Verifiable Credentials (VCs) issued through the Municipal Credentials Platform. It performs multi-layered validation including blockchain anchoring, cryptographic signatures, and Zero-Knowledge Proofs to ensure credential integrity and authenticity.

## 🏗️ Verification Architecture

![Verification Architecture](diagrams/Verification%20Architecture.png)

## 🎯 Key Features

- **🔍 Multi-Layer Verification**: Blockchain, JWT, and ZKP validation
- **⛓️ Blockchain Integrity**: Verifies on-chain hash and Merkle root anchoring
- **🔐 Cryptographic Proof**: Validates Vault-signed JWT signatures
- **🕵️ ZKP Verification**: Confirms selective disclosure proofs
- **📊 Comprehensive Audit**: Detailed verification logging
- **🛡️ Security First**: Handles revocation and expiration checks
- **⚡ Performance Optimized**: Parallel verification where possible
- **🔧 Error Resilience**: Graceful handling of partial failures

## 🔧 Core Implementation

### Verification Flow

![Verification Flow](diagrams/Verification%20Flow.png)

### Main Controller Function

```javascript
exports.verifyCredential = async (req, res) => {
  try {
    const { credentialId } = req.body;
    if (!credentialId) {
      return res.status(400).json({ success: false, message: 'Credential ID is required.' });
    }

    // Multi-step verification process...
  } catch (error) {
    console.error('Credential Verification Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during credential verification.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
```

## 📊 Data Models & Relationships

### Verification Data Flow

![Verification Data Flow](diagrams/Verification%20Data%20Flow.png)

## 🔐 Verification Steps

### Step 1: Credential & Application Lookup

```javascript
// Step 1: Fetch Credential and Related Application
const credential = await Credential.findOne({ credentialId }).lean();
if (!credential) return res.status(404).json({ success: false, message: 'Credential not found.' });

const application = await Application.findOne({ applicationId: credential.applicationId }).lean();
if (!application) return res.status(404).json({ success: false, message: 'Related application not found.' });
```

### Step 2: Revocation & Expiration Check

```javascript
// Step 2: Check revocation/expiration
if (credential.credentialStatus === 'REVOKED') {
  return res.json({
    success: false,
    message: 'Credential has been revoked.',
    data: { credentialId, result: 'REVOKED', revokedReason: credential.revokedReason, revokedAt: credential.revokedAt }
  });
}

if (credential.expiryDate && new Date() > new Date(credential.expiryDate)) {
  return res.json({
    success: false,
    message: 'Credential has expired.',
    data: { credentialId, result: 'EXPIRED', expiryDate: credential.expiryDate }
  });
}
```

### Step 3: Deterministic Hash Recalculation

```javascript
// Step 3: Recalculate deterministic hash (same as during issuance)
const vcPayload = credential.vcData?.payload;
if (!vcPayload) return res.status(500).json({ success: false, message: 'VC payload missing for verification.' });

vcPayload.issuanceDate = normalizeIssuanceDate(vcPayload.issuanceDate);
const canonicalPayload = canonicalize(vcPayload);
const recalculatedHashBytes32 = toBytes32(canonicalPayload);
```

### Step 4: Merkle Root Conversion

```javascript
// Step 4: Convert stored Merkle root to bytes32 (matches blockchain format)
let storedMerkleRootBytes32 = null;
if (application.merkleRoot) {
  storedMerkleRootBytes32 = toBytes32(application.merkleRoot);
}
```

### Step 5: Blockchain Verification

```javascript
// Step 5: Blockchain verification (safe handling of onChainStatus)
let blockchainValid = false;
let onChainHash = null;
let onChainMerkleRoot = null;
let onChainStatus = null;

try {
  let cert;
  if (blockchainService.contract?.getCertificate) {
    cert = await blockchainService.contract.getCertificate(credentialId);
    onChainHash = cert.hash?.toString() || cert[0]?.toString() || null;
    onChainMerkleRoot = cert.merkleRoot?.toString() || cert[1]?.toString() || null;
    // Keep status as string to prevent JS overflow
    onChainStatus = cert.status !== undefined ? cert.status.toString() : cert[2]?.toString();
  }

  blockchainValid =
    onChainHash === recalculatedHashBytes32 &&
    onChainMerkleRoot === storedMerkleRootBytes32

} catch (err) {
  console.warn(`[Verification Log] Blockchain verification failed: ${err.message}`);
}
```

### Step 6: JWT Signature Verification

```javascript
// Step 6: Vault JWT verification
let jwtVerified = false;
let jwtError = null;
try {
  const vcJwt = credential.vcData?.vcJwt;
  if (!vcJwt || typeof vcJwt !== 'string') jwtError = 'Invalid or missing vcJwt';
  else jwtVerified = !!(await verifyCredentialJwt(vcJwt));
} catch (err) {
  jwtError = err.message || String(err);
}
```

### Step 7: ZKP Proof Verification

```javascript
// Step 7: ZKP verification
let zkpVerified = false;
let zkpError = null;
try {
  const proof = application.finalZkpProof || application.zkpProof || application.initialZkpProof;
  const publicSignals = application.finalPublicSignals || application.publicSignals || application.initialPublicSignals;
  if (!proof || !publicSignals) zkpError = 'Missing ZKP proof or public signals';
  else zkpVerified = await ZKPService.verifyProof(proof, publicSignals);
} catch (err) {
  zkpError = err.message || String(err);
}
```

### Step 8: Audit Logging

```javascript
// Step 8: Persist verification audit log
try {
  await Credential.updateOne(
    { credentialId },
    {
      $push: {
        verificationLogs: {
          verifiedBy: req.user?.id || 'anonymous',
          verifiedAt: new Date(),
          blockchainValid,
          jwtVerified,
          zkpVerified,
          onChainHash,
          onChainMerkleRoot,
          onChainStatus,
          jwtError: jwtError || null,
          zkpError: zkpError || null
        }
      }
    }
  );
} catch (err) {
  console.warn(`[Verification Log] Failed to persist verification log: ${err.message}`);
}
```

## 🔧 Helper Functions

### Deterministic Canonicalization

```javascript
/**
 * Deterministically canonicalize an object for hashing.
 * Ensures consistent key ordering for blockchain hash calculation.
 */
const canonicalize = (obj) => {
  if (!obj || typeof obj !== 'object') return JSON.stringify(obj);
  const sortedKeys = Object.keys(obj).sort();
  const normalized = {};
  for (const key of sortedKeys) {
    let value = obj[key];
    if (typeof value === 'bigint') value = value.toString();
    else if (value && typeof value === 'object') value = JSON.parse(canonicalize(value));
    normalized[key] = value;
  }
  return JSON.stringify(normalized);
};
```

### Date Normalization

```javascript
/**
 * Normalize issuanceDate to ignore milliseconds and ensure deterministic hash
 */
const normalizeIssuanceDate = (date) => {
  if (!date) return new Date().toISOString().split('.')[0] + 'Z';
  return new Date(date).toISOString().split('.')[0] + 'Z';
};
```

### Bytes32 Conversion

```javascript
/**
 * Converts input string/number to 0x-prefixed bytes32 hash
 */
const toBytes32 = (input) => {
  if (!input) throw new Error('Cannot convert empty value to bytes32');
  let hex;
  if (/^0x[0-9a-fA-F]+$/.test(input)) {
    hex = input.slice(2);
  } else {
    hex = crypto.createHash('sha256').update(String(input)).digest('hex');
  }
  hex = hex.padStart(64, '0').slice(0, 64);
  return '0x' + hex;
};
```

## 💡 Usage Examples

### Verification Request
```http
POST /api/credentials/verify
Content-Type: application/json
Authorization: Bearer <optional_jwt_token>

{
  "credentialId": "cred-BIRTH-1640995200000-456-1640995300000"
}
```

### Successful Verification Response
```json
{
  "success": true,
  "message": "Credential is valid: blockchain hash, JWT, and ZKP verified.",
  "data": {
    "credentialId": "cred-BIRTH-1640995200000-456-1640995300000",
    "type": "BIRTH",
    "issuerDID": "did:mcp:healthcare001",
    "holderDID": "did:mcp:applicant123",
    "ipfsCID": "QmXyz123...",
    "blockchainTxHash": "0xabc123...",
    "recalculatedHash": "0x192873918273918273918273981273981",
    "onChainHash": "0x192873918273918273918273981273981",
    "onChainMerkleRoot": "0x298371928739187239187293871293871",
    "blockchainValid": true,
    "jwtVerified": true,
    "jwtError": null,
    "zkpVerified": true,
    "zkpError": null,
    "merkleRoot": "0x298371928739187239187293871293871",
    "vcPayload": {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      "id": "vc-BIRTH-1640995200000-456",
      "type": ["VerifiableCredential", "BIRTH_Credential"],
      "issuer": { "id": "did:mcp:healthcare001", "name": "Commissioner Sharma" },
      "issuanceDate": "2024-01-15T10:30:00Z",
      "credentialSubject": {
        "id": "did:mcp:applicant123",
        "applicationId": "BIRTH-1640995200000-456",
        "type": "BIRTH",
        "details": {
          "childName": "Aarav Kumar",
          "dateOfBirth": "2023-05-15"
        }
      }
    }
  }
}
```

### Partial Verification Failure
```json
{
  "success": false,
  "message": "Credential verification failed: check blockchain, JWT, or ZKP integrity.",
  "data": {
    "credentialId": "cred-BIRTH-1640995200000-456-1640995300000",
    "type": "BIRTH",
    "blockchainValid": true,
    "jwtVerified": false,
    "jwtError": "JWT signature verification failed",
    "zkpVerified": true,
    "zkpError": null,
    "recalculatedHash": "0x192873918273918273918273981273981",
    "onChainHash": "0x192873918273918273918273981273981"
  }
}
```

### Revoked Credential Response
```json
{
  "success": false,
  "message": "Credential has been revoked.",
  "data": {
    "credentialId": "cred-BIRTH-1640995200000-456-1640995300000",
    "result": "REVOKED",
    "revokedReason": "Document forgery detected",
    "revokedAt": "2024-01-20T14:30:00.000Z"
  }
}
```

## 🛡️ Security & Error Handling

### Graceful Failure Handling

```javascript
// Blockchain verification with error resilience
try {
  // Blockchain interaction that might fail
  let cert = await blockchainService.contract.getCertificate(credentialId);
  // Process results...
} catch (err) {
  console.warn(`[Verification Log] Blockchain verification failed: ${err.message}`);
  // Continue with other verification steps
}

// JWT verification with detailed error tracking
let jwtVerified = false;
let jwtError = null;
try {
  // JWT verification logic...
} catch (err) {
  jwtError = err.message || String(err);
}
```

### Audit Trail Security

```javascript
verificationLogs: {
  verifiedBy: req.user?.id || 'anonymous',  // Track who performed verification
  verifiedAt: new Date(),                   // Timestamp for audit
  blockchainValid,                          // Individual component results
  jwtVerified,
  zkpVerified,
  onChainHash,                             // Raw data for forensic analysis
  onChainMerkleRoot,
  onChainStatus,
  jwtError: jwtError || null,              // Error details for debugging
  zkpError: zkpError || null
}
```

## 🔄 Integration Dependencies

### Required Services
```javascript
const Credential = require('../../models/Credential');
const Application = require('../../models/Application');
const blockchainService = require('../../services/blockchainService');
const ZKPService = require('../../services/ZKPService');
const crypto = require('crypto');
const { verifyCredentialJwt } = require('../../utils/didJwtVerifier');
```

### Expected Data Models

#### Credential Model
```javascript
{
  credentialId: String,
  applicationId: String,
  type: String,
  vcData: {
    vcJwt: String,
    payload: Object
  },
  credentialStatus: String, // ISSUED, REVOKED
  expiryDate: Date,
  issuerDID: String,
  holderDID: String,
  ipfsCID: String,
  blockchainTxHash: String,
  verificationLogs: [{
    verifiedBy: String,
    verifiedAt: Date,
    blockchainValid: Boolean,
    jwtVerified: Boolean,
    zkpVerified: Boolean,
    // ... other audit fields
  }]
}
```

#### Application Model
```javascript
{
  applicationId: String,
  merkleRoot: String,
  finalZkpProof: Object,
  finalPublicSignals: Array,
  // Fallback fields for backward compatibility
  zkpProof: Object,
  publicSignals: Array,
  initialZkpProof: Object,
  initialPublicSignals: Array
}
```

## 📈 Performance Optimization

### Parallel Verification (Future Enhancement)
```javascript
// Potential optimization: Run verification steps in parallel
const [blockchainResult, jwtResult, zkpResult] = await Promise.allSettled([
  verifyBlockchain(credentialId, recalculatedHashBytes32, storedMerkleRootBytes32),
  verifyJWT(credential.vcData?.vcJwt),
  verifyZKP(application)
]);

// Process results with error handling for each...
```

### Caching Strategy
```javascript
// Cache frequent verification results (e.g., for public credentials)
const verificationCache = new Map();

function getCacheKey(credentialId, verifierId) {
  return `${credentialId}:${verifierId || 'public'}`;
}

// Check cache before full verification
const cacheKey = getCacheKey(credentialId, req.user?.id);
const cachedResult = verificationCache.get(cacheKey);
if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL) {
  return res.json(cachedResult.data);
}
```

---

**Author**: Ishan Gawande  
**Version**: 1.0.0  
**Security**: Multi-layer verification with audit trails  
**Compliance**: W3C Verifiable Credentials, ZKP standards  
**Integration**: Blockchain, JWT, ZKP, MongoDB  
**License**: MIT