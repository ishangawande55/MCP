# Application Assignment Controller Documentation

## 📋 Overview

The `assignApplication` controller handles the workflow where an officer forwards a municipal application to the appropriate department commissioner for final approval and credential issuance. It ensures proper authorization, department validation, and maintains comprehensive audit trails.

## 🏗️ Assignment Workflow Architecture

![Assignment Workflow](diagrams/Assignment%20Workflow.png)

## 🎯 Key Features

- **🔐 Department Authorization**: Officers can only forward applications from their department
- **👥 Commissioner Discovery**: Automatically finds the appropriate commissioner
- **🔑 Cryptographic Readiness**: Validates commissioner has DID and public key
- **📊 Audit Trail**: Comprehensive history tracking of all assignment actions
- **🔄 Status Management**: Updates application status throughout workflow
- **💾 Data Integrity**: Ensures all required fields are populated before forwarding

## 🔧 Core Implementation

### Assignment Flow

![Assignmet Flow](diagrams/Assignment%20Flow.png)

### Main Controller Function

```javascript
/**
 * Forward an application from an officer to the department commissioner
 * - Validates officer department
 * - Finds commissioner
 * - Adds DID, publicKey, and forwardedAt
 * - Updates history for audit trail
 */
const assignApplication = async (req, res) => {
  try {
    const application = await Application.findOne({ applicationId: req.params.id });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found.'
      });
    }

    const officer = req.user;

    // Department validation and commissioner assignment continues...
  } catch (error) {
    console.error('Assign Application Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during application forwarding.'
    });
  }
};
```

## 📊 Data Models & Relationships

### Application State Transition

![Application State](diagrams/Application%20State.png)

### Department Mapping Logic

```javascript
const departmentMap = {
  BIRTH: 'HEALTHCARE',
  DEATH: 'HEALTHCARE',
  TRADE_LICENSE: 'LICENSE', 
  NOC: 'NOC'
};
const expectedDept = departmentMap[application.type];

if (officer.department !== expectedDept) {
  return res.status(403).json({
    success: false,
    message: `You are not authorized to process ${application.type} applications.`
  });
}
```

### Commissioner Discovery

```javascript
// Find commissioner of the department
const commissioner = await User.findOne({
  department: officer.department,
  role: 'COMMISSIONER'
});

if (!commissioner) {
  return res.status(404).json({
    success: false,
    message: 'No commissioner found for this department.'
  });
}

// Validate commissioner is properly provisioned
if (!commissioner.did || !commissioner.publicKey) {
  return res.status(400).json({
    success: false,
    message: 'Commissioner is not provisioned with DID/publicKey. Contact admin.'
  });
}
```

## 💾 Application Update Process

### Field Updates During Assignment

```javascript
// Forward application with commissioner details
application.assignedOfficer = officer._id;
application.forwardedCommissioner = commissioner._id;
application.forwardedCommissionerDID = commissioner.did;
application.forwardedCommissionerPublicKey = commissioner.publicKey;
application.department = officer.department;
application.status = APPLICATION_STATUS.FORWARDED_TO_COMMISSIONER;
application.forwardedAt = new Date();
application.updatedAt = new Date();
```

### Audit Trail Implementation

```javascript
// Maintain audit/history
if (!Array.isArray(application.history)) application.history = [];
application.history.push({
  action: 'FORWARDED_TO_COMMISSIONER',
  by: {
    id: officer._id,
    name: officer.name,
    did: officer.did || null,
    role: officer.role
  },
  to: {
    id: commissioner._id,
    name: commissioner.name,
    did: commissioner.did
  },
  at: application.forwardedAt,
  note: `Forwarded ${application.type} application to ${officer.department} commissioner`
});
```

## 💡 Usage Examples

### Sample API Request
```http
PUT /api/applications/BIRTH-1640995200000-456/assign
Authorization: Bearer <officer_jwt_token>
Content-Type: application/json
```

### Success Response
```json
{
  "success": true,
  "message": "Application forwarded to HEALTHCARE commissioner successfully.",
  "data": {
    "application": {
      "applicationId": "BIRTH-1640995200000-456",
      "type": "BIRTH",
      "department": "HEALTHCARE",
      "status": "FORWARDED_TO_COMMISSIONER",
      "forwardedCommissionerDID": "did:gov:healthcare001",
      "forwardedAt": "2024-01-15T10:30:00.000Z",
      "history": [
        {
          "action": "FORWARDED_TO_COMMISSIONER",
          "by": {
            "id": "officer123",
            "name": "Dr. Smith",
            "role": "OFFICER"
          },
          "to": {
            "id": "commissioner456", 
            "name": "Commissioner Jones",
            "did": "did:gov:healthcare001"
          },
          "at": "2024-01-15T10:30:00.000Z",
          "note": "Forwarded BIRTH application to HEALTHCARE commissioner"
        }
      ]
    },
    "officer": {
      "id": "officer123",
      "name": "Dr. Smith",
      "department": "HEALTHCARE",
      "did": "did:gov:officer789"
    },
    "forwardedTo": {
      "id": "commissioner456",
      "name": "Commissioner Jones", 
      "did": "did:gov:healthcare001",
      "publicKey": "04b8d3f..."
    },
    "department": "HEALTHCARE"
  }
}
```

### Error Response Examples

#### Department Authorization Error
```json
{
  "success": false,
  "message": "You are not authorized to process BIRTH applications."
}
```

#### Commissioner Not Found
```json
{
  "success": false, 
  "message": "No commissioner found for this department."
}
```

#### Commissioner Not Provisioned
```json
{
  "success": false,
  "message": "Commissioner is not provisioned with DID/publicKey. Contact admin."
}
```

## 🛡️ Security & Validation

### Authorization Requirements

```javascript
// Expected officer user structure from authentication
{
  _id: "officer123",
  role: "OFFICER", 
  department: "HEALTHCARE", // Must match application type
  name: "Dr. Smith",
  email: "smith@municipal.gov",
  did: "did:gov:officer789" // Optional but recommended
}
```

### Commissioner Validation Criteria

```javascript
// Valid commissioner must have:
{
  role: "COMMISSIONER",
  department: "HEALTHCARE", // Matching officer's department
  did: "did:gov:healthcare001", // Required for VC issuance
  publicKey: "04b8d3f...", // Required for cryptographic signing
  name: "Commissioner Jones",
  // Additional provisioning fields...
}
```

### Application Status Constants
```javascript
// utils/constants.js
const APPLICATION_STATUS = {
  PENDING: 'PENDING',
  UNDER_REVIEW: 'UNDER_REVIEW', 
  FORWARDED_TO_COMMISSIONER: 'FORWARDED_TO_COMMISSIONER',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CREDENTIAL_ISSUED: 'CREDENTIAL_ISSUED'
};
```

## 🔄 Integration Points

### Dependencies
```javascript
const Application = require('../../models/Application'); // MongoDB Application model
const User = require('../../models/User'); // MongoDB User model  
const { APPLICATION_STATUS } = require('../../utils/constants'); // Status enums
```

### Database Schema Requirements

#### Application Model
```javascript
{
  applicationId: String, // Unique identifier
  type: String, // BIRTH, DEATH, TRADE_LICENSE, NOC
  department: String, // Auto-assigned during forwarding
  status: String, // Updated to FORWARDED_TO_COMMISSIONER
  assignedOfficer: ObjectId, // Reference to officer
  forwardedCommissioner: ObjectId, // Reference to commissioner
  forwardedCommissionerDID: String, // Commissioner's DID
  forwardedCommissionerPublicKey: String, // Commissioner's public key
  forwardedAt: Date, // Timestamp of assignment
  history: Array, // Audit trail entries
  // ... other application fields
}
```

#### User Model
```javascript
{
  role: String, // OFFICER, COMMISSIONER, APPLICANT
  department: String, // HEALTHCARE, LICENSE, NOC
  did: String, // Decentralized Identifier
  publicKey: String, // Cryptographic public key
  name: String,
  email: String,
  // ... other user fields
}
```

## 📈 Monitoring & Logging

### Audit Trail Structure
```javascript
history: [
  {
    action: 'FORWARDED_TO_COMMISSIONER',
    by: {
      id: ObjectId,
      name: String, 
      did: String, // Optional
      role: String
    },
    to: {
      id: ObjectId,
      name: String,
      did: String
    },
    at: Date,
    note: String // Human-readable description
  }
]
```

### Error Handling
```javascript
try {
  // Assignment logic...
} catch (error) {
  console.error('Assign Application Error:', error);
  // Log additional context for debugging
  console.error('Officer:', officer._id, 'Application:', req.params.id);
  res.status(500).json({
    success: false,
    message: 'Server error during application forwarding.'
  });
}
```

## 🚀 Next Steps After Assignment

After successful assignment, the application is ready for:

1. **Commissioner Review**: Commissioner can now access and review the application
2. **Credential Issuance**: Commissioner can issue Verifiable Credentials using their DID
3. **Blockchain Anchoring**: Application data can be anchored on blockchain via commissioner's keys
4. **Notification System**: Applicant can be notified of assignment status

---

**Author**: Ishan Gawande  
**Version**: 1.0.0  
**Security**: Department-based authorization, DID validation  
**Workflow**: Officer → Commissioner assignment with audit trails  
**Integration**: MongoDB, User/Application models, Authentication middleware  
**License**: MIT