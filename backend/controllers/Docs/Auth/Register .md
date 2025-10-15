# User Registration Controller Documentation

## 📋 Overview

The `registerUser` controller handles the registration of users within the Municipal Credentials Platform (MCP) ecosystem. It supports multiple roles (APPLICANT, OFFICER, COMMISSIONER) with different cryptographic key management strategies, including automated Vault setup for commissioners and local key generation for applicants.

## 🏗️ Registration Architecture

![Registartion Architecture](diagrams/Registartion.png)

## 🎯 Key Features

- **👥 Multi-Role Support**: APPLICANT, OFFICER, COMMISSIONER with distinct capabilities
- **🔐 Cryptographic Identity**: Automated DID and key pair generation
- **🏦 Vault Integration**: Automated key management for commissioners
- **🔑 Security Tiers**: Different key strategies based on user role
- **📋 Input Validation**: Comprehensive field validation with role-specific requirements
- **💾 Secure Storage**: Proper handling of sensitive cryptographic material
- **🎯 Production Ready**: Separate demo vs production key management

## 🔧 Core Implementation

### Registration Flow

![Registration Flow](diagrams/Registration%20Flow.png)

### Main Controller Function

```javascript
/**
 * Controller: Register a new user in the MCP ecosystem
 * Supports roles: APPLICANT, OFFICER, COMMISSIONER
 * - Applicants get local RSA key pair (demo)
 * - Commissioners get automated Vault-managed keys
 */
exports.registerUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      department,
      blockchainAddress,
      role,
      phone,
      address,
    } = req.body;

    // Input validation and user creation logic...
  } catch (error) {
    console.error('User Registration Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during user registration.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
```

## 📊 Input Validation

### Role-Based Validation Rules

```javascript
// Basic required fields for all users
if (!name || !email || !password) {
  return res.status(400).json({
    success: false,
    message: 'Name, email, and password are required.',
  });
}

const assignedRole = role || 'APPLICANT';

// Applicant-specific validation
if (assignedRole === 'APPLICANT' && (!phone || !address)) {
  return res.status(400).json({
    success: false,
    message: 'Phone and address are required for applicants.',
  });
}

// Officer/Commissioner validation
if (
  (assignedRole === 'OFFICER' || assignedRole === 'COMMISSIONER') &&
  !department
) {
  return res.status(400).json({
    success: false,
    message: 'Department is required for OFFICER or COMMISSIONER.',
  });
}

// Commissioner-specific validation
if (assignedRole === 'COMMISSIONER' && !blockchainAddress) {
  return res.status(400).json({
    success: false,
    message: 'Blockchain address is required for COMMISSIONER.',
  });
}
```

### Department Structure
```javascript
// Expected department values based on application types
const VALID_DEPARTMENTS = {
  HEALTHCARE: ['BIRTH', 'DEATH'],        // Handles birth and death certificates
  LICENSE: ['TRADE_LICENSE'],            // Handles business licenses
  NOC: ['NOC']                           // Handles No Objection Certificates
};
```

## 🔐 Cryptographic Identity Management

### DID Generation Strategy

![DID Generation Strategy](diagrams/DID%20Generation.png)

### Commissioner Vault Automation

```javascript
if (assignedRole === 'COMMISSIONER') {
  // Create unique DID for commissioner
  const uniqueId = crypto.randomBytes(8).toString('hex');
  did = `did:mcp:${uniqueId}`;

  try {
    // Setup Vault automation (creates key, policy, and token)
    vaultMeta = await setupCommissionerVaultAccess(uniqueId);

    // Fetch public key from Vault using the commissioner's scoped token
    publicKeyPem = await getPublicKey(vaultMeta.token, vaultMeta.keyName);
  } catch (err) {
    console.error('Vault automation failed:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to configure commissioner signing access in Vault.',
    });
  }

  // Private key is never stored locally for commissioners
  privateKeyPem = undefined;
}
```

### Applicant Local Key Generation

```javascript
/**
 * Helper: Generate a unique DID and RSA key pair
 * Used only for demo applicants (NOT for commissioners in production)
 */
function generateDIDAndKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,  // Strong 2048-bit RSA keys
  });

  const publicKeyPem = publicKey.export({ type: 'pkcs1', format: 'pem' });
  const privateKeyPem = privateKey.export({ type: 'pkcs1', format: 'pem' });

  const uniqueId = crypto.randomBytes(8).toString('hex');
  const did = `did:mcp:${uniqueId}`;

  return { did, publicKeyPem, privateKeyPem };
}
```

## 💾 User Data Persistence

### User Document Structure

```javascript
const userData = {
  // Basic information
  name,
  email,
  password, // Hashed by Mongoose pre-save hook
  
  // Role and department
  role: assignedRole,
  department: department || undefined,
  
  // Blockchain integration
  blockchainAddress: blockchainAddress || undefined,
  
  // Applicant-specific fields
  ...(assignedRole === 'APPLICANT' && { phone, address }),
  
  // Cryptographic identity
  ...(did && { did }),
  ...(publicKeyPem && { publicKey: publicKeyPem }),
  
  // Vault metadata (commissioners only)
  ...(vaultMeta && { vault: vaultMeta }),
};

const user = new User(userData);
await user.save();
```

### Response Data Sanitization

```javascript
const responseData = {
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  department: user.department,
  blockchainAddress: user.blockchainAddress,
  did,
  publicKey: publicKeyPem,
  
  // Only return private key for demo applicants
  ...(assignedRole === 'APPLICANT' && { privateKey: privateKeyPem }),
  
  // Vault metadata (without sensitive token)
  ...(vaultMeta && {
    vault: {
      keyName: vaultMeta.keyName,
      policyName: vaultMeta.policyName,
      createdAt: vaultMeta.createdAt,
      scopedToken: true, // confirmation flag
    },
  }),
};
```

## 💡 Usage Examples

### Commissioner Registration
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Commissioner Sharma",
  "email": "sharma@municipal.gov",
  "password": "securePassword123",
  "role": "COMMISSIONER",
  "department": "HEALTHCARE",
  "blockchainAddress": "0x742d35Cc6634C0532925a3b8bc1934eF04240000"
}
```

**Response:**
```json
{
  "success": true,
  "message": "COMMISSIONER registered successfully.",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Commissioner Sharma",
    "email": "sharma@municipal.gov",
    "role": "COMMISSIONER",
    "department": "HEALTHCARE",
    "blockchainAddress": "0x742d35Cc6634C0532925a3b8bc1934eF04240000",
    "did": "did:mcp:a1b2c3d4e5f67890",
    "publicKey": "-----BEGIN RSA PUBLIC KEY-----...",
    "vault": {
      "keyName": "commissioner-key-a1b2c3d4",
      "policyName": "commissioner-policy-a1b2c3d4",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "scopedToken": true
    }
  }
}
```

### Applicant Registration
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Rajesh Kumar",
  "email": "rajesh@example.com",
  "password": "userPassword123",
  "role": "APPLICANT",
  "phone": "+91-9876543210",
  "address": "123 Main Street, Mumbai"
}
```

**Response:**
```json
{
  "success": true,
  "message": "APPLICANT registered successfully.",
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "name": "Rajesh Kumar",
    "email": "rajesh@example.com",
    "role": "APPLICANT",
    "phone": "+91-9876543210",
    "address": "123 Main Street, Mumbai",
    "did": "did:mcp:b2c3d4e5f678901a",
    "publicKey": "-----BEGIN RSA PUBLIC KEY-----...",
    "privateKey": "-----BEGIN RSA PRIVATE KEY-----..."
  }
}
```

### Officer Registration
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Officer Patel",
  "email": "patel@municipal.gov",
  "password": "officerPass123",
  "role": "OFFICER",
  "department": "LICENSE"
}
```

## 🛡️ Security Considerations

### Key Management Strategies

![Key Management Strategies](diagrams/Key%20Management%20Startegies.png)

### Security Best Practices

```javascript
// Never store commissioner private keys locally
privateKeyPem = undefined;

// Hash passwords using Mongoose pre-save hooks
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Sanitize response data - never return Vault tokens
scopedToken: true, // Flag instead of actual token
```

### Error Handling

```javascript
} catch (error) {
  console.error('User Registration Error:', error);
  res.status(500).json({
    success: false,
    message: 'Server error during user registration.',
    // Only expose error details in development
    error: process.env.NODE_ENV === 'development' ? error.message : undefined,
  });
}
```

## 🔄 Integration Dependencies

### Required Services
```javascript
const crypto = require('crypto');
const User = require('../../models/User');
const { setupCommissionerVaultAccess } = require('../../services/vaultAutomationService');
const { getPublicKey } = require('../../services/vaultService');
```

### Environment Setup
```env
# Vault Configuration
VAULT_ADDR=http://vault:8200
VAULT_ROOT_TOKEN=s.root-token

# Database
MONGODB_URI=mongodb://localhost:27017/mcp_db

# Security
NODE_ENV=development
```

## 📈 Production Considerations

### Commissioner Key Rotation
```javascript
// Future enhancement: Key rotation for commissioners
async function rotateCommissionerKeys(commissionerId) {
  const user = await User.findById(commissionerId);
  const newUniqueId = crypto.randomBytes(8).toString('hex');
  
  // Setup new Vault key
  const newVaultMeta = await setupCommissionerVaultAccess(newUniqueId);
  const newPublicKey = await getPublicKey(newVaultMeta.token, newVaultMeta.keyName);
  
  // Update user with new keys
  user.vault = newVaultMeta;
  user.publicKey = newPublicKey;
  user.did = `did:mcp:${newUniqueId}`;
  await user.save();
  
  // Archive old key (implementation depends on Vault setup)
  await archiveOldVaultKey(user.vault.keyName);
}
```

### Bulk Registration Support
```javascript
// Future enhancement: Bulk officer registration
async function bulkRegisterOfficers(officersData) {
  const results = [];
  for (const officerData of officersData) {
    try {
      const result = await registerUser({ body: officerData });
      results.push({ success: true, data: result });
    } catch (error) {
      results.push({ success: false, error: error.message });
    }
  }
  return results;
}
```

---

**Author**: Ishan Gawande  
**Version**: 1.0.0  
**Security**: Role-based key management, Vault integration  
**Compliance**: Cryptographic identity standards, DID specification  
**Integration**: Multi-service orchestration with proper error handling  
**License**: MIT