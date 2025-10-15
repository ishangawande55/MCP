# BlockchainService Class Documentation

## 📋 Overview

The `BlockchainService` class provides a comprehensive interface for interacting with the CredentialRegistry smart contract. It handles credential issuance, verification, revocation, and management with support for multiple authorized roles and ZKP Merkle roots.

## 🏗️ Service Architecture

![Service Architecture](diagrams/Service%20Architecture.png)

## 🎯 Key Features

- **🔐 Multi-Role Support**: Dynamic signer switching for different authorities
- **🔒 Secure Key Management**: Environment-based private key configuration
- **⚡ Gas Optimization**: Efficient batch operations and data encoding
- **📊 Comprehensive Operations**: Full credential lifecycle management
- **🛡️ Error Handling**: Robust transaction monitoring and status verification
- **🔧 Data Transformation**: Automatic bytes32 conversion for blockchain compatibility

## 👥 Role-Based Access Control

![Role Base Acess Control](diagrams/RBC%20Acess.png)

### Configured Roles

![Configured Role](diagrams/Role%20Configuration.png)

## 🔧 Core Methods

### Constructor & Initialization

![Constructor Initialization](diagrams/Constructor%20and%20initialization.png)

**Initialization Flow:**
```javascript
constructor() {
  // JSON-RPC provider for blockchain connection
  this.provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
  
  // Multi-role wallet configuration
  this.wallets = {
    ADMIN: new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, this.provider),
    HEALTHCARE_COMMISSIONER: new ethers.Wallet(process.env.HEALTHCARE_COMMISSIONER_PRIVATE_KEY, this.provider),
    // ... other roles
  };
  
  // Default to ADMIN role
  this.setSigner("ADMIN");
}
```

### Dynamic Signer Management

**Method**: `setSigner(role)`
```javascript
/**
 * Dynamically set the signer based on role
 * @param {string} role - Role name (ADMIN, HEALTHCARE_COMMISSIONER, etc.)
 */
setSigner(role) {
  if (!this.wallets[role]) throw new Error(`No wallet configured for role: ${role}`);
  this.wallet = this.wallets[role];
  this.contract = new ethers.Contract(this.contractAddress, CredentialRegistryABI.abi, this.wallet);
  console.log(`Signer set to ${role} (${this.wallet.address})`);
}
```

**Usage Example:**
```javascript
// Switch to healthcare commissioner for medical credentials
blockchainService.setSigner("HEALTHCARE_COMMISSIONER");
await blockchainService.issueCredential(...medicalCredentialData);
```

### Data Transformation Engine

![Data Transformation Engine](diagrams/Data%20Transformation%20Engine.png)

**Method**: `_toBytes32(value)`
```javascript
/**
 * Converts any value to bytes32 hex string for Solidity compatibility
 * @param {string|number|BigInt} value - Input value
 * @returns {string} 0x-prefixed bytes32 hex string
 */
_toBytes32(value) {
  const crypto = require("crypto");
  if (!value) throw new Error("Invalid value for bytes32 conversion");

  // Convert numbers/BigInt to string
  let str = typeof value === "bigint" || typeof value === "number" 
    ? value.toString() 
    : value;

  // Remove 0x prefix if present
  if (str.startsWith("0x")) str = str.slice(2);

  // Hash to 64 chars if not already correct length
  if (str.length !== 64) {
    str = crypto.createHash("sha256").update(str).digest("hex");
  }

  return "0x" + str;
}
```

## 📝 Core Operations

### Single Credential Issuance

![Single Credential Issuance](diagrams/Single%20Credential%20Issuance.png)

**Method**: `issueCredential()`
```javascript
async issueCredential(
  credentialId,        // "vc:healthcare:license:12345"
  documentHash,        // SHA-256 of credential content
  ipfsCID,             // "QmXyz..." IPFS content identifier
  merkleRoot,          // ZKP Merkle root for selective disclosure
  issuerDID,           // "did:mcp:health:commissioner001"
  holderDID,           // "did:mcp:citizen:johnsmith"
  expiryTimestamp = 0, // 0 = never expires
  schema = ""          // "HealthcareLicense"
) {
  // Data transformation
  const hashBytes32 = this._toBytes32(documentHash);
  const merkleBytes32 = this._toBytes32(merkleRoot);

  // Blockchain transaction
  const tx = await this.contract.issueCertificate(
    credentialId, hashBytes32, ipfsCID, merkleBytes32,
    issuerDID, holderDID, expiryTimestamp, schema
  );

  // Wait for confirmation
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error("Transaction failed on blockchain");

  return {
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    status: "SUCCESS"
  };
}
```

### Credential Verification

**Method**: `verifyCredential()`
```javascript
async verifyCredential(credentialId, documentHash) {
  try {
    const hashBytes32 = this._toBytes32(documentHash);
    return await this.contract.verifyCertificate(credentialId, hashBytes32);
  } catch (error) {
    console.error("Blockchain Verify Credential Error:", error);
    return [false, 1]; // Default: STATUS_NOT_FOUND
  }
}
```

**Verification Status Codes:**
- `[true, 0]` - ✅ **VALID**
- `[false, 1]` - ❌ **NOT_FOUND** 
- `[false, 2]` - 🚫 **REVOKED**
- `[false, 3]` - ⏰ **EXPIRED**
- `[false, 4]` - 🔍 **HASH_MISMATCH**

### Batch Credential Issuance

![Batch Credential Issuance](diagrams/Batch%20Credential%20Issuance.png)

**Method**: `batchIssue()`
```javascript
async batchIssue(
  credentialIds,    // ["vc:license:1", "vc:license:2", ...]
  documentHashes,   // [hash1, hash2, ...]
  ipfsCIDs,         // ["Qm...1", "Qm...2", ...]
  merkleRoots,      // [root1, root2, ...]
  issuerDIDs,       // ["did:...1", "did:...2", ...]
  holderDIDs,       // ["did:...1", "did:...2", ...]
  expiries,         // [0, 1735689600, ...]
  schemas           // ["License", "License", ...]
) {
  // Array length validation
  const len = credentialIds.length;
  if (len !== documentHashes.length || len !== ipfsCIDs.length || ...) {
    throw new Error("Array length mismatch");
  }

  // Process all credentials
  const txs = [];
  for (let i = 0; i < len; i++) {
    const tx = await this.contract.issueCertificate(
      credentialIds[i],
      this._toBytes32(documentHashes[i]),
      ipfsCIDs[i],
      this._toBytes32(merkleRoots[i]),
      issuerDIDs[i],
      holderDIDs[i],
      expiries[i],
      schemas[i]
    );
    txs.push(tx.wait());
  }

  // Wait for all confirmations
  const receipts = await Promise.all(txs);
  receipts.forEach(r => {
    if (r.status !== 1) throw new Error("One or more batch transactions failed");
  });

  return receipts.map(r => ({
    transactionHash: r.hash,
    blockNumber: r.blockNumber,
    status: "SUCCESS"
  }));
}
```

## 🛡️ Error Handling & Security

### Transaction Monitoring
```javascript
const receipt = await tx.wait();
if (receipt.status !== 1) throw new Error("Transaction failed on blockchain");
```

**Status Codes:**
- `1` - ✅ Transaction successful
- `0` - ❌ Transaction reverted

### Graceful Verification Failures
```javascript
try {
  return await this.contract.verifyCertificate(credentialId, hashBytes32);
} catch (error) {
  console.error("Blockchain Verify Credential Error:", error);
  return [false, 1]; // Default to NOT_FOUND on error
}
```

## 🔧 Configuration

### Environment Variables
```env
BLOCKCHAIN_RPC_URL=https://polygon-mainnet.infura.io/v3/your-key
CONTRACT_ADDRESS=0x742d35Cc6634C0532925a3b8bc1934eF04240000
ADMIN_PRIVATE_KEY=0xabc123...
HEALTHCARE_COMMISSIONER_PRIVATE_KEY=0xdef456...
LICENSES_COMMISSIONER_PRIVATE_KEY=0xghi789...
NOC_COMMISSIONER_PRIVATE_KEY=0xjkl012...
```

### Dependencies
```json
{
  "ethers": "^6.0.0",
  "dotenv": "^16.0.0"
}
```

## 💡 Usage Examples

### Basic Credential Issuance
```javascript
const result = await blockchainService.issueCredential(
  "vc:trade:license:789",
  "a1b2c3...sha256hash",
  "QmXyz...IPFSCID",
  "merkleRoot123",
  "did:mcp:licenses:commissioner001",
  "did:mcp:business:company456",
  1735689600, // Expiry: Dec 31, 2024
  "TradeLicense"
);

console.log(`Credential anchored in block ${result.blockNumber}`);
```

### Role-Specific Operations
```javascript
// Healthcare credentials
blockchainService.setSigner("HEALTHCARE_COMMISSIONER");
await blockchainService.issueCredential(...healthcareData);

// Business licenses  
blockchainService.setSigner("LICENSES_COMMISSIONER");
await blockchainService.issueCredential(...licenseData);
```

### Batch Processing
```javascript
const batchResult = await blockchainService.batchIssue(
  ["vc:1", "vc:2", "vc:3"],
  ["hash1", "hash2", "hash3"],
  ["CID1", "CID2", "CID3"],
  ["root1", "root2", "root3"],
  ["did:issuer", "did:issuer", "did:issuer"],
  ["did:holder1", "did:holder2", "did:holder3"],
  [0, 0, 1735689600],
  ["Schema", "Schema", "Schema"]
);
```

## 📊 Performance Considerations

### Gas Optimization
- **Batch Operations**: Significant gas savings for multiple credentials
- **Bytes32 Encoding**: Efficient storage and processing
- **Parallel Confirmation**: `Promise.all()` for batch transaction waiting

### Memory Management
- **Stream Processing**: Suitable for large batch operations
- **Error Boundaries**: Individual transaction failures don't block entire batch

---

**Author**: Ishan Gawande  
**Version**: 1.0.0  
**License**: MIT  
**Compatibility**: CredentialRegistry Smart Contract