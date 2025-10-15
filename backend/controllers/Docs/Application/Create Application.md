# Create Application Controller Documentation

## 📋 Overview

The `createApplicationController` handles the creation of municipal applications (Birth, Death, Trade License, NOC) with integrated Zero-Knowledge Proofs (ZKP) and Selective Disclosure capabilities. It ensures secure, privacy-preserving application submission while maintaining comprehensive audit trails.

## 🏗️ Controller Architecture

![Create Application Controller](diagrams/Controller%20Create%20Application.png)

## 🎯 Key Features

- **🔐 Role-Based Access**: Only authenticated APPLICANTs can create applications
- **📋 Type-Specific Handling**: Supports Birth, Death, Trade License, and NOC applications
- **🔒 Privacy-Preserving**: Zero-Knowledge Proofs for selective disclosure
- **🏢 Automatic Routing**: Intelligent department assignment based on application type
- **📊 Audit Trail**: Comprehensive history tracking for all actions
- **🆔 Unique Identifiers**: Generated application IDs with timestamps
- **💾 Data Integrity**: ZKP proofs stored with application data

## 🔧 Core Implementation

### Request Flow

![Request Flow](diagrams/Request%20Flow.png)

### Main Controller Function

```javascript
/**
 * Create a new municipal application submitted by an authenticated APPLICANT.
 * Handles selective disclosure, type-specific details, and ZKP proof generation.
 */
const createApplication = async (req, res) => {
  try {
    const user = req.user; // Auth middleware injects authenticated user

    // Authorization check
    if (!user || user.role !== 'APPLICANT') {
      return res.status(403).json({
        success: false,
        message: 'Only applicants can create applications.',
      });
    }

    // Extract and validate request data
    const {
      type,
      birthDetails,
      deathDetails,
      tradeDetails,
      nocDetails,
      supportingDocuments,
      disclosedFields = [],
    } = req.body;

    // Application processing continues...
  } catch (error) {
    // Error handling
  }
};
```

## 📊 Data Models & Structures

### Application Schema Structure

```javascript
{
  // Core Identification
  applicationId: "BIRTH-1640995200000-123",
  type: "BIRTH", // APPLICATION_TYPES enum
  department: "HEALTHCARE", // Auto-assigned
  
  // Applicant Information
  applicant: {
    userId: ObjectId("..."),
    name: "John Doe",
    email: "john@example.com",
    phone: "+1234567890",
    address: "123 Main St",
    did: "did:gov:abc123" // Decentralized ID
  },
  
  // Type-Specific Details (mutually exclusive)
  birthDetails: { /* Birth-specific fields */ },
  deathDetails: { /* Death-specific fields */ },
  tradeDetails: { /* Trade license fields */ },
  nocDetails: { /* NOC-specific fields */ },
  
  // ZKP & Privacy
  disclosedFields: ["childName", "dateOfBirth"],
  initialZkpProof: { /* Groth16 proof object */ },
  initialPublicSignals: [...],
  initialMerkleRoot: "192873918273918273...",
  
  // Status & Tracking
  status: "PENDING", // APPLICATION_STATUS enum
  supportingDocuments: [{ url: "...", type: "PDF" }],
  history: [
    {
      action: "CREATED",
      by: { id: "...", name: "...", role: "APPLICANT" },
      at: "2024-01-15T10:30:00.000Z",
      note: "Application created by applicant"
    }
  ],
  
  // Timestamps
  createdAt: "2024-01-15T10:30:00.000Z",
  updatedAt: "2024-01-15T10:30:00.000Z"
}
```

### Department Mapping Logic

![Department Mapping](diagrams/Department%20Mapping.png)

**Implementation:**
```javascript
const departmentMap = {
  BIRTH: 'HEALTHCARE',
  DEATH: 'HEALTHCARE', 
  TRADE_LICENSE: 'LICENSE',
  NOC: 'NOC',
};
const department = departmentMap[type];
```

### Application ID Generation

```javascript
// Format: TYPE-TIMESTAMP-RANDOM
const timestamp = Date.now();
const random = Math.floor(Math.random() * 1000);
const applicationId = `${type}-${timestamp}-${random}`;

// Examples:
// "BIRTH-1640995200000-456"
// "TRADE_LICENSE-1640995260000-789" 
// "NOC-1640995320000-123"
```

## 🔐 ZKP Integration

### Proof Generation Flow

![Proof Generation](diagrams/Proof%20Generation.png)

**Integration Code:**
```javascript
// Generate ZKP proof and Merkle root
try {
  const zkpResult = await ZKPService.generateProofFromApplication(applicationData);

  applicationData.initialZkpProof = zkpResult.proof;
  applicationData.initialPublicSignals = zkpResult.publicSignals;
  applicationData.initialMerkleRoot = zkpResult.merkleRoot;
} catch (zkError) {
  console.error('ZKP Generation Error:', zkError);
  return res.status(400).json({
    success: false,
    message: 'Application creation failed: Zero-Knowledge Proof generation error.',
    error: zkError.message,
  });
}
```

### Selective Disclosure Handling

```javascript
// Example disclosedFields for different application types
const birthDisclosure = ["childName", "dateOfBirth"]; // Hide gender, fatherName
const tradeDisclosure = ["businessName", "ownerName"]; // Hide financial details
const fullDisclosure = []; // Empty array = disclose all fields

// These fields are used by ZKP circuit to determine:
// - Which field hashes to include in Merkle root
// - Which fields remain private (zeroed in circuit)
```

## 💡 Usage Examples

### Sample API Requests

#### Birth Certificate Application
```javascript
// POST /api/applications
{
  "type": "BIRTH",
  "birthDetails": {
    "childName": "Aarav Kumar",
    "dateOfBirth": "2023-05-15",
    "gender": "Male",
    "fatherName": "Rajesh Kumar",
    "placeOfBirth": "Municipal Hospital, Delhi",
    "motherName": "Priya Kumar"
  },
  "disclosedFields": ["childName", "dateOfBirth"],
  "supportingDocuments": [
    {
      "url": "https://ipfs.io/ipfs/QmXyz...",
      "type": "HOSPITAL_RECORD"
    }
  ]
}
```

#### Trade License Application
```javascript
{
  "type": "TRADE_LICENSE", 
  "tradeDetails": {
    "businessName": "Patel Electronics",
    "registrationNumber": "TL-2024-789",
    "ownerName": "Amit Patel",
    "licenseType": "RETAIL",
    "businessAddress": "123 Market Street, Mumbai",
    "validTill": "2025-12-31"
  },
  "disclosedFields": ["businessName", "ownerName"],
  "supportingDocuments": [
    {
      "url": "https://ipfs.io/ipfs/QmAbc...",
      "type": "IDENTITY_PROOF"
    }
  ]
}
```

### Success Response Format
```javascript
{
  "success": true,
  "message": "Application submitted successfully",
  "data": {
    "application": {
      "id": "507f1f77bcf86cd799439011",
      "applicationId": "BIRTH-1640995200000-456",
      "type": "BIRTH",
      "department": "HEALTHCARE",
      "status": "PENDING",
      "merkleRoot": "192873918273918273918273981273981",
      "initialZkpProof": { /* Groth16 proof object */ },
      "disclosedFields": ["childName", "dateOfBirth"],
      "birthDetails": {
        "childName": "Aarav Kumar",
        "dateOfBirth": "2023-05-15"
        // Note: gender and fatherName are not returned as they're private
      },
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

## 🛡️ Security & Validation

### Authorization Middleware
```javascript
// Expected req.user structure from authentication
{
  _id: "user123",
  role: "APPLICANT",
  name: "John Doe",
  email: "john@example.com",
  phone: "+1234567890",
  address: "123 Main St",
  did: "did:gov:abc123"
}
```

### Input Validation Constants
```javascript
// utils/constants.js
const APPLICATION_TYPES = {
  BIRTH: 'BIRTH',
  DEATH: 'DEATH', 
  TRADE_LICENSE: 'TRADE_LICENSE',
  NOC: 'NOC'
};

const APPLICATION_STATUS = {
  PENDING: 'PENDING',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  ISSUED: 'ISSUED'
};
```

### Error Handling Scenarios

![Error handling scenarios](diagrams/Error%20Handling%20.png)

## 🔄 Integration Points

### Dependencies
```javascript
const Application = require('../../models/Application'); // MongoDB model
const ZKPService = require('../../services/ZKPService'); // Zero-Knowledge Proof service
const { APPLICATION_STATUS, APPLICATION_TYPES } = require('../../utils/constants');
```

### Environment Requirements
```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/municipal_db

# ZKP Circuit Assets
ZKP_WASM_PATH=./zkp/build/ApplicationZKP/ApplicationZKP.wasm
ZKP_ZKEY_PATH=./zkp/build/ApplicationZKP/ApplicationZKP.zkey
```

## 📈 Monitoring & Logging

### Audit Trail Entries
```javascript
history: [
  {
    action: 'CREATED',
    by: {
      id: user._id,
      name: user.name,
      did: user.did || null,
      role: user.role,
    },
    at: new Date(),
    note: 'Application created by applicant',
  }
  // Additional entries added during:
  // - Review by commissioner
  // - Approval/Rejection
  // - Credential issuance
]
```

### Error Logging
```javascript
console.error('ZKP Generation Error:', zkError);
console.error('Create Application Error:', error);

// In production, integrate with:
// - Structured logging (Winston/Pino)
// - Error tracking (Sentry/LogRocket)
// - Metrics collection (Prometheus)
```

---

**Author**: Ishan Gawande  
**Version**: 1.0.0  
**Security**: Role-based access, ZKP proofs, Selective disclosure  
**Integration**: MongoDB, ZKP Service, Authentication Middleware  
**Compliance**: Privacy-preserving data handling  
**License**: MIT