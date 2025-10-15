# Application Processing or Commisssioner Application Controller Documentation

## 📋 Overview

The `CommissionerApplication` controller handles the final approval/rejection workflow for municipal applications by commissioners. It integrates Zero-Knowledge Proofs, Vault-signed Verifiable Credentials, IPFS storage, and blockchain anchoring to create a comprehensive credential issuance system with selective disclosure capabilities.

## 🏗️ Processing Workflow Architecture

![Processing Workflow](diagrams/Processing%20Workflow.png)

## 🎯 Key Features

- **🔐 Commissioner Authorization**: Strict role and assignment validation
- **🔄 Dual Processing**: Support for both approval and rejection workflows
- **🔒 Zero-Knowledge Proofs**: Selective disclosure with ZKP integration
- **📜 Verifiable Credentials**: Vault-signed VCs with W3C compliance
- **💾 IPFS Storage**: Decentralized credential storage
- **⛓️ Blockchain Anchoring**: Immutable credential registration
- **📊 Audit Trail**: Comprehensive history tracking
- **🛡️ Duplicate Prevention**: Ensures single credential issuance per application

## 🔧 Core Implementation

### Main Processing Flow

![Main Processing Flow](diagrams/Main%20Processing%20Flow.png)

### Controller Entry Point

```javascript
/**
 * Controller: Process application (APPROVE / REJECT)
 * @route POST /api/applications/:id/process
 */
const processApplication = async (req, res) => {
  try {
    const { action, reviewComments } = req.body;
    const applicationId = req.params.id;

    // Fetch and validate application
    const application = await Application.findOne({ applicationId });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const commissioner = req.user;
    
    // Authorization and validation logic continues...
  } catch (error) {
    console.error('Commissioner Process Application Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while processing application.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
```

## 📊 Authorization & Validation

### Commissioner Validation

```javascript
// Authorization check: Only commissioners can process applications
if (commissioner.role !== 'COMMISSIONER') {
  return res.status(403).json({ success: false, message: 'Only commissioners can process applications.' });
}

// Assignment validation
if (application.forwardedCommissioner?.toString() !== commissioner._id.toString()) {
  return res.status(403).json({ success: false, message: 'Application not assigned to you.' });
}

// Status validation
if (application.status !== APPLICATION_STATUS.FORWARDED_TO_COMMISSIONER) {
  return res.status(400).json({ success: false, message: 'Application not ready for processing.' });
}
```

### Rejection Workflow

```javascript
if (action === 'REJECT') {
  application.status = APPLICATION_STATUS.REJECTED;
  application.reviewComments = reviewComments || 'Rejected by commissioner';
  application.updatedAt = new Date();
  application.history = application.history || [];
  application.history.push({
    action: 'REJECTED',
    by: { id: commissioner._id, name: commissioner.name, did: commissioner.did },
    at: new Date(),
    note: reviewComments || 'Application rejected'
  });

  await application.save();
  return res.json({ success: true, message: 'Application rejected successfully.', data: application });
}
```

## 🔐 ZKP Integration

### Proof Generation

```javascript
// Flatten type-specific details for ZKP input
let typeDetails;
switch (application.type) {
  case 'BIRTH': typeDetails = application.birthDetails || {}; break;
  case 'DEATH': typeDetails = application.deathDetails || {}; break;
  case 'TRADE_LICENSE': typeDetails = application.tradeDetails || {}; break;
  case 'NOC': typeDetails = application.nocDetails || {}; break;
}

const zkpInput = { ...application.toObject(), disclosedFields: application.disclosedFields || [] };
Object.assign(zkpInput, typeDetails);

// Generate ZKP proof and Merkle root
let zkpResult;
try {
  zkpResult = await ZKPService.generateProofFromApplication(zkpInput);

  // Save final proof & signals according to new schema
  application.finalZkpProof = zkpResult.proof;
  application.finalPublicSignals = zkpResult.publicSignals;
  application.merkleRoot = zkpResult.merkleRoot;

} catch (zkError) {
  console.error('ZKP Generation Error:', zkError);
  return res.status(400).json({ success: false, message: 'ZKP generation failed', error: zkError.message });
}
```

### Selective Disclosure Filtering

```javascript
/**
 * Filters an object to include only fields allowed for selective disclosure.
 */
const filterDisclosedFields = (details, disclosedFields) => {
  if (!details || !disclosedFields) return {};
  return Object.keys(details)
    .filter((key) => disclosedFields.includes(key))
    .reduce((obj, key) => {
      obj[key] = details[key];
      return obj;
    }, {});
};

// Usage in VC payload creation
const disclosedDetails = filterDisclosedFields(typeDetails, application.disclosedFields);
```

## 📜 Verifiable Credential Creation

### VC Payload Structure

```javascript
const vcPayload = {
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  id: `vc-${application.applicationId}`,
  type: ["VerifiableCredential", `${application.type}_Credential`],
  issuer: { 
    id: commissioner.did, 
    name: commissioner.name, 
    department: commissioner.department 
  },
  issuanceDate: issuanceDate,
  credentialSubject: {
    id: application.applicant.did,
    applicant: application.applicant,
    applicationId: application.applicationId,
    type: application.type,
    department: application.department,
    details: disclosedDetails  // Only disclosed fields included
  }
};
```

### Vault Signing Integration

```javascript
// Vault signing
const vaultKeyName = commissioner.vault?.keyName;
const vaultToken = commissioner.vault?.token;
if (!vaultKeyName || !vaultToken) {
  return res.status(400).json({ success: false, message: 'Vault key/token missing for commissioner.' });
}
const vcJwt = await signVCWithVault(vaultToken, vaultKeyName, vcPayload, application.disclosedFields);

// Check if Vault returned something
if (!vcJwt) {
  throw new Error('Vault signing failed. Cannot proceed.');
}
```

## 💾 Storage & Blockchain Integration

### IPFS Storage

```javascript
// If vcJwt is an object (not a standard JWT), use it directly
const ipfsResult = await ipfsService.uploadJSON(vcJwt);
console.log('VC uploaded to IPFS:', ipfsResult);
const ipfsCID = typeof ipfsResult === 'string' ? ipfsResult : ipfsResult.cid;
```

### Blockchain Data Preparation

```javascript
/**
 * Deterministically canonicalize an object for hashing.
 * Ensures consistent key ordering for blockchain hashes.
 */
const canonicalize = (obj) => {
  if (!obj || typeof obj !== 'object') return JSON.stringify(obj);
  const sortedKeys = Object.keys(obj).sort();
  const result = {};
  for (const key of sortedKeys) {
    result[key] = typeof obj[key] === 'object' && obj[key] !== null
      ? JSON.parse(canonicalize(obj[key]))
      : obj[key];
  }
  return JSON.stringify(result);
};

/**
 * Converts input string to 0x-prefixed bytes32 hex for Solidity compatibility.
 */
const toBytes32 = (input) => {
  if (!input) throw new Error('Cannot convert empty value to bytes32');
  let hex;
  if (/^0x[0-9a-fA-F]+$/.test(input)) {
    hex = input.slice(2);
  } else {
    hex = crypto.createHash('sha256').update(input.toString()).digest('hex');
  }
  hex = hex.padStart(64, '0').slice(0, 64);
  return '0x' + hex;
};

// Generate deterministic blockchain hash
const canonicalPayload = canonicalize(vcPayload);
const payloadHashBytes32 = toBytes32(canonicalPayload);
const merkleRootBytes32 = toBytes32(application.merkleRoot);
```

### Blockchain Issuance

```javascript
// Blockchain issuance
const credentialId = `cred-${application.applicationId}-${Date.now()}`;
const departmentRoleMap = {
  'HEALTHCARE': 'HEALTHCARE_COMMISSIONER',
  'LICENSE': 'LICENSES_COMMISSIONER',
  'NOC': 'NOC_COMMISSIONER'
};
const role = departmentRoleMap[application.department] || 'ADMIN';
blockchainService.setSigner(role);

const tx = await blockchainService.issueCredential(
  credentialId,
  payloadHashBytes32,
  ipfsCID,
  merkleRootBytes32,
  commissioner.did,
  application.applicant.did,
  0,  // No expiry
  `${application.type}_Credential`
);
```

## 💾 Data Persistence

### Credential Model Storage

```javascript
// Save credential in database
const newCredential = new Credential({
  applicationId,
  credentialId,
  type: application.type,
  vcData: { vcJwt, payload: vcPayload },
  canonicalPayload,
  vcSignature: 'VAULT_SIGNED',
  ipfsCID,
  credentialHash: payloadHashBytes32,
  merkleRoot: application.merkleRoot,
  issuerDID: commissioner.did,
  holderDID: application.applicant.did,
  issuerAddress: commissioner.blockchainAddress,
  registryContract: process.env.CONTRACT_ADDRESS,
  blockchainTxHash: tx.transactionHash,
  schemaType: `${application.type}_Credential`,
  issuedAt: new Date(),
  credentialStatus: 'ISSUED'
});
await newCredential.save();
```

### Application Status Update

```javascript
// Update application with issuance details
application.status = APPLICATION_STATUS.APPROVED;
application.reviewComments = reviewComments || '';
application.credential = newCredential._id;
application.updatedAt = new Date();
application.issuedAt = new Date();
application.history = application.history || [];
application.history.push({
  action: 'APPROVED_AND_ISSUED',
  by: { id: commissioner._id, name: commissioner.name, did: commissioner.did },
  at: application.issuedAt,
  note: 'VC issued with selective disclosure, uploaded to IPFS, and anchored on blockchain with Merkle root.'
});
await application.save();
```

## 💡 Usage Examples

### API Request
```http
POST /api/applications/BIRTH-1640995200000-456/process
Authorization: Bearer <commissioner_jwt_token>
Content-Type: application/json

{
  "action": "APPROVE",
  "reviewComments": "All documents verified and approved"
}
```

### Success Response
```json
{
  "success": true,
  "message": "Application approved and credential issued successfully.",
  "data": {
    "application": {
      "applicationId": "BIRTH-1640995200000-456",
      "status": "APPROVED",
      "type": "BIRTH"
    },
    "credential": {
      "credentialId": "cred-BIRTH-1640995200000-456-1640995300000",
      "schemaType": "BIRTH_Credential",
      "issuedAt": "2024-01-15T10:35:00.000Z",
      "merkleRoot": "192873918273918273918273981273981"
    },
    "ipfsCID": "QmXyz123...",
    "blockchainTx": "0xabc123..."
  }
}
```

### Rejection Request
```http
POST /api/applications/BIRTH-1640995200000-456/process
Authorization: Bearer <commissioner_jwt_token>
Content-Type: application/json

{
  "action": "REJECT",
  "reviewComments": "Missing required supporting documents"
}
```

## 🛡️ Security & Error Handling

### Duplicate Issuance Prevention

```javascript
// Prevent duplicate issuance
const existingCredential = await Credential.findOne({ applicationId });
if (existingCredential) {
  return res.status(400).json({
    success: false,
    message: 'Credential already issued for this application.',
    credential: existingCredential
  });
}
```

### Comprehensive Error Handling

```javascript
} catch (error) {
  console.error('Commissioner Process Application Error:', error);
  return res.status(500).json({
    success: false,
    message: 'Server error while processing application.',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
}
```

## 🔄 Integration Dependencies

### Required Services
```javascript
const Application = require('../../models/Application');
const Credential = require('../../models/Credential');
const { APPLICATION_STATUS } = require('../../utils/constants');
const ipfsService = require('../../services/ipfsService');
const blockchainService = require('../../services/blockchainService');
const crypto = require('crypto');
const { signVCWithVault } = require('../../utils/vaultSigner');
const ZKPService = require('../../services/ZKPService');
```

### Environment Variables
```env
CONTRACT_ADDRESS=0x742d35Cc6634C0532925a3b8bc1934eF04240000
VAULT_ADDR=http://vault:8200
IPFS_API_URL=http://ipfs:5001
BLOCKCHAIN_RPC_URL=https://polygon-mainnet.infura.io/v3/your-key
```

---

**Author**: Ishan Gawande  
**Version**: 1.0.0  
**Security**: ZKP proofs, Vault signing, Blockchain anchoring  
**Integration**: Multi-service orchestration with audit trails  
**Compliance**: W3C Verifiable Credentials, Selective disclosure  
**License**: MIT