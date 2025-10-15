# Credential Download Controller Documentation

## 📋 Overview

The `downloadCredential` controller handles the generation and download of Verifiable Credentials as PDF documents. It creates professional, printable certificate formats that include credential details, applicant information, and blockchain verification data.

## 🏗️ Download Architecture

![Download Architecture](diagrams/Download%20Architecture.png)

## 🎯 Key Features

- **📄 Professional PDF Generation**: Creates standardized credential certificates
- **🔗 Blockchain Integration**: Includes transaction hashes and IPFS CIDs
- **👤 Applicant Details**: Displays recipient information clearly
- **📋 Application Context**: Shows full application history and details
- **⚡ Stream Processing**: Efficient file streaming for large documents
- **🧹 Automatic Cleanup**: Temporary file management
- **🎯 Custom Filenames**: Credential ID-based file naming

## 🔧 Core Implementation

### Download Flow

![Download Flow](diagrams/Download%20Flow.png)

### Main Controller Function

```javascript
exports.downloadCredential = async (req, res) => {
  try {
    const { credentialId } = req.params;
    const credential = await Credential.findOne({ credentialId });
    if (!credential) return res.status(404).json({ success: false, message: 'Credential not found.' });

    const application = await Application.findOne({ applicationId: credential.applicationId });
    const credentialObj = buildCredentialObject(application, credentialId, credential.ipfsCID, credential.blockchainTxHash);

    const tempPdfPath = await pdfService.generateCertificate(credentialObj, application);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${credential.credentialId}.pdf`);

    const pdfStream = fs.createReadStream(tempPdfPath);
    pdfStream.pipe(res);
    pdfStream.on('end', () => fs.unlinkSync(tempPdfPath));
  } catch (error) {
    console.error('Download Credential Error:', error);
    res.status(500).json({ success: false, message: 'Server error during download.' });
  }
};
```

## 📊 Data Structure Building

### Credential Object Builder

```javascript
function buildCredentialObject(application, credentialId, ipfsCID = '', blockchainTxHash = '') {
  return {
    credentialId,
    type: application.type,
    recipient: {
      name: application.applicant.name,
      email: application.applicant.email,
      phone: application.applicant.phone
    },
    applicationDetails: {
      applicationId: application.applicationId,
      type: application.type,
      applicant: application.applicant,
      supportingDocuments: application.supportingDocuments || [],
      assignedOfficer: application.assignedOfficer?.toString(),
      status: application.status,
      reviewComments: application.reviewComments || [],
      createdAt: application.createdAt?.toISOString(),
      updatedAt: application.updatedAt?.toISOString()
    },
    ipfsCID,
    blockchainTxHash
  };
}
```

### Object Structure Details

![Object Structure](diagrams/Object%20Structure.png)

## 📄 PDF Generation Integration

### PDF Service Integration

```javascript
const tempPdfPath = await pdfService.generateCertificate(credentialObj, application);
```

**Expected PDF Service Interface:**
```javascript
// pdfService.generateCertificate signature
/**
 * @param {Object} credentialData - Formatted credential information
 * @param {Object} applicationData - Full application details for context
 * @returns {Promise<string>} Path to generated PDF file
 */
async function generateCertificate(credentialData, applicationData) {
  // Implementation creates PDF with:
  // - Professional layout and branding
  // - QR codes for verification
  // - Blockchain transaction details
  // - Applicant information
  // Returns path to temporary file
}
```

### Response Headers Configuration

```javascript
res.setHeader('Content-Type', 'application/pdf');
res.setHeader('Content-Disposition', `attachment; filename=${credential.credentialId}.pdf`);

// Headers ensure:
// - Browser recognizes content as PDF
// - File downloads with proper naming
// - Prevents inline display for sensitive documents
```

## 💾 Stream Processing & Cleanup

### Efficient File Streaming

```javascript
const pdfStream = fs.createReadStream(tempPdfPath);
pdfStream.pipe(res);

// Benefits:
// - Memory efficient for large PDFs
// - Starts sending data immediately
// - Handles backpressure automatically
```

### Automatic Cleanup

```javascript
pdfStream.on('end', () => fs.unlinkSync(tempPdfPath));

// Ensures:
// - Temporary files are deleted after streaming
// - No disk space leaks
// - Clean server state maintenance
```

## 💡 Usage Examples

### API Request
```http
GET /api/credentials/cred-BIRTH-1640995200000-456-1640995300000/download
Authorization: Bearer <user_jwt_token>
```

### Response Headers
```
Content-Type: application/pdf
Content-Disposition: attachment; filename=cred-BIRTH-1640995200000-456-1640995300000.pdf
Content-Length: 24576
```

### Generated PDF Content Example
```
┌─────────────────────────────────────────────────────┐
│                MUNICIPAL CREDENTIAL                 │
│                 CERTIFICATE                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Credential ID: cred-BIRTH-1640995200000-456        │
│  Type: BIRTH CERTIFICATE                            │
│  Issue Date: January 15, 2024                       │
│                                                     │
│  RECIPIENT INFORMATION:                             │
│  ────────────────────────                           │
│  Name: Rajesh Kumar                                 │
│  Email: rajesh@example.com                          │
│  Phone: +91-9876543210                              │
│                                                     │
│  BLOCKCHAIN VERIFICATION:                           │
│  ────────────────────────                           │
│  IPFS CID: QmXyz123...                              │
│  Transaction: 0xabc123...                           │
│                                                     │
│  [QR CODE FOR VERIFICATION]                         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## 🛡️ Error Handling

### Comprehensive Error Management

```javascript
} catch (error) {
  console.error('Download Credential Error:', error);
  res.status(500).json({ 
    success: false, 
    message: 'Server error during download.' 
  });
}

// Specific error scenarios handled:
// - Credential not found (404)
// - Application not found (implicit 500)
// - PDF generation failures
// - File system errors
// - Stream processing issues
```

### Stream Error Handling (Enhanced)

```javascript
// Enhanced version with better error handling
const pdfStream = fs.createReadStream(tempPdfPath);

pdfStream.on('error', (streamError) => {
  console.error('Stream Error:', streamError);
  if (!res.headersSent) {
    res.status(500).json({ 
      success: false, 
      message: 'Error streaming PDF file.' 
    });
  }
  // Ensure cleanup even on stream errors
  try { fs.unlinkSync(tempPdfPath); } catch (e) { /* ignore */ }
});

pdfStream.pipe(res);

pdfStream.on('end', () => {
  try {
    fs.unlinkSync(tempPdfPath);
  } catch (cleanupError) {
    console.warn('Cleanup warning:', cleanupError);
  }
});
```

## 🔄 Integration Dependencies

### Required Services
```javascript
const fs = require('fs');                          // File system operations
const Credential = require('../../models/Credential'); // Credential data
const Application = require('../../models/Application'); // Application context
const pdfService = require('../../services/pdfService'); // PDF generation
```

### Expected Data Models

#### Credential Model
```javascript
{
  credentialId: String,        // Unique identifier
  applicationId: String,       // Reference to application
  ipfsCID: String,             // IPFS content identifier
  blockchainTxHash: String,    // Blockchain transaction
  // ... other credential fields
}
```

#### Application Model
```javascript
{
  applicationId: String,
  type: String,                // BIRTH, DEATH, TRADE_LICENSE, NOC
  applicant: {
    name: String,
    email: String,
    phone: String,
    // ... other applicant details
  },
  supportingDocuments: Array,  // Document references
  assignedOfficer: ObjectId,   // Officer reference
  status: String,              // Application status
  reviewComments: Array,       // Review history
  createdAt: Date,
  updatedAt: Date
}
```

## 📈 Performance Optimization

### Memory-Efficient Streaming

```javascript
// For very large PDFs, consider additional optimizations
const highWaterMark = 64 * 1024; // 64KB chunks

const pdfStream = fs.createReadStream(tempPdfPath, {
  highWaterMark,
  encoding: null // Binary encoding for PDF
});

pdfStream.pipe(res);
```

### Caching Strategy (Future Enhancement)

```javascript
// Cache generated PDFs for frequently accessed credentials
const pdfCache = new Map();

async function getOrGeneratePDF(credentialId, application) {
  const cacheKey = credentialId;
  
  if (pdfCache.has(cacheKey)) {
    const cached = pdfCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.filePath;
    }
  }
  
  // Generate new PDF
  const credentialObj = buildCredentialObject(application, credentialId);
  const pdfPath = await pdfService.generateCertificate(credentialObj, application);
  
  // Cache result
  pdfCache.set(cacheKey, {
    filePath: pdfPath,
    timestamp: Date.now()
  });
  
  return pdfPath;
}
```

## 🔒 Security Considerations

### Access Control
```javascript
// In a production scenario, add role-based access control
const user = req.user;

// Applicants can only download their own credentials
if (user.role === 'APPLICANT') {
  const userCredential = await Credential.findOne({
    credentialId,
    holderDID: user.did
  });
  if (!userCredential) {
    return res.status(403).json({
      success: false,
      message: 'Access denied to this credential.'
    });
  }
}

// Officers/Commissioners can download credentials they processed
// Add additional authorization checks as needed
```

### File Path Security
```javascript
// Ensure generated PDF paths are within safe directories
const safeTempDir = path.join(__dirname, '../../temp/pdfs');

// Validate the generated path is within safe directory
if (!tempPdfPath.startsWith(safeTempDir)) {
  throw new Error('Invalid PDF path generated');
}
```

---

**Author**: Ishan Gawande  
**Version**: 1.0.0  
**Features**: PDF generation, streaming, automatic cleanup  
**Integration**: MongoDB, PDF service, file system  
**Security**: Access control, path validation  
**License**: MIT