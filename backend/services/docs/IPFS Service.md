# IPFS Service Documentation

## 📋 Overview

The IPFSService provides decentralized storage capabilities for Verifiable Credentials and documents using the InterPlanetary File System (IPFS). It supports both Infura-managed IPFS and local IPFS nodes with fallback mechanisms for development environments.

## 🏗️ Service Architecture

![IPFS Service Architecture](diagrams/IPFS%20Architecture.png)

## 🎯 Key Features

- **🔐 Multi-Environment Support**: Infura IPFS for production, local node for development
- **🔄 Smart Fallback**: Automatic mock CIDs when IPFS is unavailable
- **📁 Dual Upload Types**: Support for files and JSON data
- **🌐 Gateway Integration**: Multiple IPFS gateway support
- **⚡ Performance Optimized**: Timeout management and connection pooling
- **🔧 Health Monitoring**: Connection testing and status reporting

## 🔧 Configuration & Initialization

### Environment Setup
```javascript
class IPFSService {
  constructor() {
    // Detect environment: Infura for production, local for development
    this.useInfura = !!process.env.INFURA_IPFS_PROJECT_ID;
    this.apiUrl = this.useInfura 
      ? process.env.INFURA_IPFS_ENDPOINT 
      : process.env.IPFS_API_URL;
  }
}
```

### Required Environment Variables
```env
# Production (Infura)
INFURA_IPFS_PROJECT_ID=your_project_id
INFURA_IPFS_PROJECT_SECRET=your_project_secret
INFURA_IPFS_ENDPOINT=https://ipfs.infura.io:5001

# Development (Local IPFS)
IPFS_API_URL=http://localhost:5001

# Optional Gateway (for retrieval)
IPFS_GATEWAY_URL=https://ipfs.io/ipfs
# Alternatives: https://cloudflare-ipfs.com/ipfs, https://gateway.pinata.cloud/ipfs
```

## 📊 Authentication Management

![Authentication Management](diagrams/Authentication%20Management.png)

**Method**: `getAuthHeaders()`
```javascript
getAuthHeaders() {
  if (this.useInfura) {
    // Infura uses Basic authentication with Project ID + Secret
    const auth = Buffer.from(
      `${process.env.INFURA_IPFS_PROJECT_ID}:${process.env.INFURA_IPFS_PROJECT_SECRET}`
    ).toString('base64');
    
    return { Authorization: `Basic ${auth}` };
  }
  return {}; // Local IPFS typically requires no authentication
}
```

## 📤 Upload Operations

### File Upload Flow

![File Upload Flow](diagrams/File%20upload%20flow.png)

**Method**: `uploadFile(filePath)`
```javascript
/**
 * Upload a file from local path to IPFS
 * @param {string} filePath - Path to the file to upload
 * @returns {Promise<{cid: string}>} IPFS Content Identifier
 */
async uploadFile(filePath) {
  try {
    console.log(`Uploading file to IPFS: ${filePath}`);
    
    // Create FormData with file stream
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));

    // Send to IPFS API
    const response = await axios.post(`${this.apiUrl}/api/v0/add`, formData, {
      headers: { 
        ...formData.getHeaders(), 
        ...this.getAuthHeaders() 
      },
      timeout: 30000, // 30-second timeout for large files
    });

    console.log(`File uploaded to IPFS. CID: ${response.data.Hash}`);
    return { cid: response.data.Hash };
  } catch (error) {
    console.error('IPFS Upload Error:', error.response?.data || error.message);
    
    // Fallback for development/local environments
    if (!this.useInfura) return await this.fallbackUpload(filePath);
    
    throw new Error(`Failed to upload file to IPFS: ${error.message}`);
  }
}
```

### JSON Data Upload

**Method**: `uploadJSON(data)`
```javascript
/**
 * Upload JSON data directly to IPFS
 * @param {Object} data - JSON-serializable data
 * @returns {Promise<{cid: string}>} IPFS Content Identifier
 */
async uploadJSON(data) {
  try {
    console.log('Uploading JSON data to IPFS...');
    
    const formData = new FormData();
    // Convert JSON to buffer and append as file
    formData.append('file', Buffer.from(JSON.stringify(data)), 'data.json');

    const response = await axios.post(`${this.apiUrl}/api/v0/add`, formData, {
      headers: { 
        ...formData.getHeaders(), 
        ...this.getAuthHeaders() 
      },
    });

    console.log(`JSON uploaded to IPFS. CID: ${response.data.Hash}`);
    return { cid: response.data.Hash };
  } catch (error) {
    console.error('IPFS JSON Upload Error:', error);
    throw new Error('Failed to upload JSON to IPFS');
  }
}
```

### Development Fallback

```javascript
/**
 * Fallback method for development when IPFS is unavailable
 * Generates mock CIDs to avoid breaking development workflows
 */
async fallbackUpload(filePath) {
  console.log('Local IPFS failed. Returning mock CID for development...');
  
  // Generate deterministic mock CID based on file path and timestamp
  return { cid: `QmMock${Date.now()}DevelopmentCID` };
}
```

## 📥 Retrieve Operations

### File Retrieval Flow

![File Retrival Flow](diagrams/File%20Retrival%20Flow.png)

**Method**: `getFile(cid)`
```javascript
/**
 * Retrieve a file from IPFS by its CID
 * @param {string} cid - IPFS Content Identifier
 * @returns {Promise<Stream>} Readable stream of file content
 */
async getFile(cid) {
  try {
    const gatewayUrl = process.env.IPFS_GATEWAY_URL || 'https://ipfs.io/ipfs';
    const response = await axios.get(`${gatewayUrl}/${cid}`, {
      responseType: 'stream', // Handle large files efficiently
      timeout: 15000, // 15-second timeout for retrieval
    });
    return response.data;
  } catch (error) {
    console.error('IPFS Get File Error:', error);
    throw new Error('Failed to retrieve file from IPFS');
  }
}
```

### Gateway URL Generation

**Method**: `getIPFSGatewayURL(cid)`
```javascript
/**
 * Generate a public gateway URL for an IPFS CID
 * @param {string} cid - IPFS Content Identifier
 * @returns {string} Publicly accessible URL
 */
getIPFSGatewayURL(cid) {
  const gateway = process.env.IPFS_GATEWAY_URL || 'https://ipfs.io/ipfs';
  return `${gateway}/${cid}`;
}
```

## 🔍 Health Monitoring

### Connection Testing

![Connection Testing](diagrams/Connection%20Testing.png)

**Method**: `checkConnection()`
```javascript
/**
 * Test connection to IPFS node
 * @returns {Promise<boolean>} Connection status
 */
async checkConnection() {
  try {
    const response = await axios.post(`${this.apiUrl}/api/v0/version`, null, {
      headers: this.getAuthHeaders(),
      timeout: 5000, // 5-second timeout for health check
    });
    
    console.log(`IPFS Connection OK. Version: ${response.data.Version}`);
    return true;
  } catch (error) {
    console.warn('IPFS node not reachable:', error.message);
    return false;
  }
}
```

## 💡 Usage Examples

### Complete Credential Storage Workflow

```javascript
const IPFSService = require('./ipfs-service');
const { signVC } = require('./did-service');

async function issueAndStoreCredential(commissioner, credentialData, holderDID) {
  try {
    // 1. Sign the Verifiable Credential
    const signedVC = await signVC({
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      "type": ["VerifiableCredential", "TradeLicense"],
      "issuer": commissioner.did,
      "issuanceDate": new Date().toISOString(),
      "credentialSubject": {
        "id": holderDID,
        ...credentialData
      }
    }, commissioner.privateKey);

    // 2. Upload signed VC to IPFS
    const uploadResult = await IPFSService.uploadJSON(signedVC);
    
    // 3. Get public gateway URL for sharing
    const gatewayUrl = IPFSService.getIPFSGatewayURL(uploadResult.cid);
    
    console.log(`Credential stored at: ${gatewayUrl}`);
    
    return {
      cid: uploadResult.cid,
      gatewayUrl: gatewayUrl,
      signedVC: signedVC
    };
    
  } catch (error) {
    console.error('Credential issuance failed:', error);
    throw error;
  }
}
```

### Document Upload with Metadata

```javascript
async function uploadLicenseDocument(licenseData, documentPath) {
  // 1. Upload the PDF/document file
  const fileUpload = await IPFSService.uploadFile(documentPath);
  
  // 2. Upload structured metadata
  const metadataUpload = await IPFSService.uploadJSON({
    documentType: 'Trade License',
    issueDate: licenseData.issueDate,
    expiryDate: licenseData.expiryDate,
    documentCID: fileUpload.cid,
    issuer: licenseData.issuerDID,
    holder: licenseData.holderDID
  });
  
  return {
    documentCID: fileUpload.cid,
    metadataCID: metadataUpload.cid,
    documentUrl: IPFSService.getIPFSGatewayURL(fileUpload.cid),
    metadataUrl: IPFSService.getIPFSGatewayURL(metadataUpload.cid)
  };
}
```

### Health-Check Integration

```javascript
async function initializeIPFS() {
  console.log('Initializing IPFS service...');
  
  const isConnected = await IPFSService.checkConnection();
  
  if (!isConnected) {
    if (IPFSService.useInfura) {
      throw new Error('Cannot connect to Infura IPFS - check credentials');
    } else {
      console.warn('Local IPFS not available - using fallback mode for development');
    }
  }
  
  return isConnected;
}

// Application startup
initializeIPFS().then(connected => {
  if (connected) {
    console.log('✅ IPFS service ready');
  } else {
    console.log('⚠️ IPFS service in fallback mode');
  }
});
```

## 🛡️ Error Handling & Best Practices

### Comprehensive Error Management

```javascript
// Example error handling wrapper
async function robustIPFSUpload(data, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await IPFSService.uploadJSON(data);
    } catch (error) {
      console.warn(`IPFS upload attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw new Error(`IPFS upload failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

### CID Validation
```javascript
function validateCID(cid) {
  // Basic CID validation (v0 and v1)
  const cidRegex = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$|^bafy[a-zA-Z0-9]{50,}$/;
  return cidRegex.test(cid);
}

// Usage
const result = await IPFSService.uploadJSON(data);
if (!validateCID(result.cid)) {
  throw new Error('Invalid CID received from IPFS');
}
```

## 📊 Performance Optimization

### Timeout Configuration

![Timeout Configuration](diagrams/Timeout%20Configuration.png)

### Memory Management
```javascript
// For large files, use streams to avoid memory issues
const uploadLargeFile = async (filePath) => {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath)); // Stream, not buffer
  
  return await axios.post(`${this.apiUrl}/api/v0/add`, formData, {
    headers: { ...formData.getHeaders(), ...this.getAuthHeaders() },
    timeout: 60000, // Longer timeout for very large files
    maxContentLength: 100 * 1024 * 1024, // 100MB max
  });
};
```

## 🔄 Integration Patterns

### With Blockchain Service
```javascript
async function anchorCredentialOnChain(credentialData, documentPath) {
  // 1. Store document on IPFS
  const ipfsResult = await IPFSService.uploadFile(documentPath);
  
  // 2. Calculate hash for blockchain
  const documentHash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(documentPath))
    .digest('hex');
  
  // 3. Anchor on blockchain
  const blockchainResult = await BlockchainService.issueCredential(
    credentialData.id,
    documentHash,
    ipfsResult.cid
  );
  
  return {
    ipfsCID: ipfsResult.cid,
    blockchainTx: blockchainResult.transactionHash,
    documentHash: documentHash
  };
}
```

### Multi-Gateway Strategy
```javascript
class MultiGatewayIPFSService extends IPFSService {
  async getFileWithFallback(cid, gateways = [
    'https://ipfs.io/ipfs',
    'https://cloudflare-ipfs.com/ipfs', 
    'https://gateway.pinata.cloud/ipfs'
  ]) {
    for (const gateway of gateways) {
      try {
        const response = await axios.get(`${gateway}/${cid}`, {
          responseType: 'stream',
          timeout: 10000,
        });
        return response.data;
      } catch (error) {
        console.warn(`Gateway ${gateway} failed: ${error.message}`);
      }
    }
    throw new Error('All IPFS gateways failed');
  }
}
```

---

**Author**: Ishan Gawande  
**Version**: 1.1.0  
**Compatibility**: Node.js 14+, IPFS 0.14+  
**Dependencies**: axios, form-data, fs  
**License**: MIT