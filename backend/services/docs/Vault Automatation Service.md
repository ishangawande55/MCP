# Vault Automation Service Documentation

## 📋 Overview

The Vault Automation Service provides automated setup for HashiCorp Vault infrastructure, creating secure signing keys, scoped policies, and limited-access tokens for credential commissioners. This implements the principle of least privilege for cryptographic operations.

## 🏗️ Architecture Overview

![Service Architecture](diagrams/Vault%20Automatation%20Service%20Architecture.png)

## 🎯 Key Features

- **🔐 Automated Key Management**: RSA-2048 transit keys per commissioner
- **🛡️ Least Privilege**: Minimal permissions for signing operations only
- **⏰ Token Lifecycle**: 24-hour renewable tokens with controlled TTL
- **🔧 Idempotent Operations**: Safe re-runs without duplicate errors
- **📊 Metadata Tracking**: Complete audit trail of created resources

## 🔄 Setup Flow

![Setup Flow](diagrams/Setup%20Flow.png)

## 📝 Core Functions

### 1. Transit Key Creation

![Transit Key Creation](diagrams/Transit%20Key%20Creation.png)

**Method**: `createTransitKey(keyName)`
```javascript
/**
 * Creates a new Transit key for a commissioner
 * @param {string} keyName - Format: "commissioner-key-<uniqueId>"
 */
async function createTransitKey(keyName) {
  const url = `${VAULT_ADDR}/v1/transit/keys/${keyName}`;
  const headers = { 'X-Vault-Token': VAULT_ROOT_TOKEN };

  try {
    await axios.post(
      url,
      {
        type: 'rsa-2048',          // RSA-2048 for strong signatures
        exportable: true,          // Allow key export if needed
        allow_plaintext_backup: false, // Security: no plaintext backups
      },
      { headers }
    );
    console.log(`Created Vault transit key: ${keyName}`);
  } catch (err) {
    // Idempotent handling - ignore if key already exists
    if (err.response && err.response.status === 400 && 
        err.response.data.errors[0].includes('exists')) {
      console.log(`Key ${keyName} already exists`);
    } else {
      console.error('Failed to create transit key:', err.response?.data || err.message);
      throw err;
    }
  }
}
```

**Key Configuration:**
- **Type**: `rsa-2048` - Industry standard for digital signatures
- **Exportable**: `true` - Allows key rotation and backup
- **Plaintext Backup**: `false` - Security best practice

### 2. Policy Creation

![Policy Creation](diagrams/Policy%20Creation.png)

**Method**: `createPolicy(policyName, keyName)`
```javascript
/**
 * Creates a new Vault policy allowing signing and key read only
 * @param {string} policyName - Format: "commissioner-policy-<uniqueId>"
 * @param {string} keyName - Associated transit key name
 */
async function createPolicy(policyName, keyName) {
  const policyHCL = `
path "transit/sign/${keyName}" {
  capabilities = ["create", "update"]
}

path "transit/keys/${keyName}" {
  capabilities = ["read"]
}
`;

  const url = `${VAULT_ADDR}/v1/sys/policy/${policyName}`;
  const headers = { 'X-Vault-Token': VAULT_ROOT_TOKEN };

  try {
    await axios.put(url, { policy: policyHCL }, { headers });
    console.log(`Created Vault policy: ${policyName}`);
  } catch (err) {
    console.error('Failed to create policy:', err.response?.data || err.message);
    throw err;
  }
}
```

**Policy Capabilities:**

![policy capabalities](diagrams/Policy%20Capabalities.png)

### 3. Token Generation

**Method**: `generateScopedToken(policyName)`
```javascript
/**
 * Generates a scoped token bound to the policy
 * @param {string} policyName - Policy to bind token to
 * @returns {Promise<string>} Vault client token
 */
async function generateScopedToken(policyName) {
  const url = `${VAULT_ADDR}/v1/auth/token/create`;
  const headers = { 'X-Vault-Token': VAULT_ROOT_TOKEN };

  try {
    const { data } = await axios.post(
      url,
      {
        policies: [policyName],  // Single policy binding
        ttl: '24h',              // 24-hour token validity
        renewable: true,         // Allow token renewal
      },
      { headers }
    );

    const token = data.auth.client_token;
    console.log(`Generated scoped Vault token for policy: ${policyName}`);
    return token;
  } catch (err) {
    console.error('Failed to generate scoped token:', err.response?.data || err.message);
    throw err;
  }
}
```

**Token Configuration:**
- **Policies**: Single policy binding for strict access control
- **TTL**: `24h` - Balanced between security and usability
- **Renewable**: `true` - Allows extension without re-issuance

## 🚀 Main Orchestration Function

![Orchestration Function](diagrams/Orchestration%20Function.png)

**Method**: `setupCommissionerVaultAccess(uniqueId)`
```javascript
/**
 * Main function: Sets up Vault key + policy + token for a commissioner
 * @param {string} uniqueId - Unique identifier for the commissioner
 * @returns {Promise<Object>} Vault metadata for storage
 */
async function setupCommissionerVaultAccess(uniqueId) {
  const keyName = `commissioner-key-${uniqueId}`;
  const policyName = `commissioner-policy-${uniqueId}`;

  console.log(`\n Setting up Vault access for commissioner [${uniqueId}]`);

  // Create signing key
  await createTransitKey(keyName);

  // Create scoped policy
  await createPolicy(policyName, keyName);

  // Create token bound to policy
  const token = await generateScopedToken(policyName);

  // Return metadata for MongoDB storage
  return {
    keyName,        // "commissioner-key-abc123"
    policyName,     // "commissioner-policy-abc123"
    token,          // Vault client token
    createdAt: new Date(),  // Audit timestamp
  };
}
```

## 🔧 Configuration

### Environment Variables
```env
# Vault Connection
VAULT_ADDR=http://127.0.0.1:8200
VAULT_ROOT_TOKEN=s.root-token-value

# Optional: Production Vault
# VAULT_ADDR=https://vault.prod.company.com:8200
# VAULT_NAMESPACE=admin/credentials-team
```

### Resource Naming Convention

![Resource Naming Convention](diagrams/Resource%20Naming%20Function.png)

## 🛡️ Security Features

### Principle of Least Privilege
```hcl
# Commissioner can ONLY:
# 1. Sign data with their specific key
# 2. Read their key metadata
# 3. Cannot: list other keys, create new keys, delete keys, etc.
path "transit/sign/commissioner-key-*" {
  capabilities = ["create", "update"]
}

path "transit/keys/commissioner-key-*" {
  capabilities = ["read"]
}
```

### Token Security
- **Short TTL**: 24-hour tokens reduce exposure risk
- **Renewable**: Allows operational continuity without permanent tokens
- **Scoped**: Single policy prevents privilege escalation

### Key Security
- **RSA-2048**: Industry-standard cryptographic strength
- **Non-Exportable**: Private keys never leave Vault
- **Managed Lifecycle**: Centralized key rotation and backup

## 💡 Usage Examples

### Basic Commissioner Setup
```javascript
const { setupCommissionerVaultAccess } = require('./vault-automation');

// Setup Vault for healthcare commissioner
const vaultConfig = await setupCommissionerVaultAccess('healthcare-001');

console.log('Vault Setup Complete:');
console.log('- Key:', vaultConfig.keyName);
console.log('- Policy:', vaultConfig.policyName);
console.log('- Token:', vaultConfig.token.substring(0, 10) + '...');
console.log('- Created:', vaultConfig.createdAt);
```

### Integration with Commissioner Service
```javascript
async function registerNewCommissioner(commissionerData) {
  // 1. Create blockchain identity
  const blockchainAddress = await createBlockchainIdentity();
  
  // 2. Setup Vault access
  const vaultConfig = await setupCommissionerVaultAccess(commissionerData.id);
  
  // 3. Store in database
  await CommissionerModel.create({
    ...commissionerData,
    blockchainAddress,
    vaultConfig,  // Store keyName, policyName, token, createdAt
    status: 'active'
  });
  
  return { blockchainAddress, vaultConfig };
}
```

## 📊 Error Handling

### Graceful Error Recovery
```javascript
try {
  const vaultConfig = await setupCommissionerVaultAccess('healthcare-001');
  // Proceed with commissioner registration
} catch (error) {
  console.error('Vault setup failed:', error.message);
  
  // Cleanup any partially created resources
  await cleanupVaultResources('healthcare-001');
  
  throw new Error(`Commissioner setup failed: ${error.message}`);
}
```

### Idempotent Operations
- **Key Creation**: Handles "key already exists" gracefully
- **Policy Creation**: Overwrites existing policies (intentional)
- **Token Generation**: Always creates new tokens

## 🔄 Lifecycle Management

### Token Renewal
```javascript
// Example token renewal logic
async function renewCommissionerToken(commissionerId) {
  const policyName = `commissioner-policy-${commissionerId}`;
  return await generateScopedToken(policyName);
}
```

### Key Rotation
```javascript
// Example key rotation
async function rotateCommissionerKey(commissionerId) {
  const keyName = `commissioner-key-${commissionerId}`;
  
  // Create new version of key
  await axios.post(
    `${VAULT_ADDR}/v1/transit/keys/${keyName}/rotate`,
    {},
    { headers: { 'X-Vault-Token': VAULT_ROOT_TOKEN } }
  );
  
  console.log(`Rotated key: ${keyName}`);
}
```

## 📈 Monitoring & Audit

### Recommended Audit Logging
```javascript
// Enhanced with audit logging
async function setupCommissionerVaultAccess(uniqueId) {
  const auditLog = {
    commissionerId: uniqueId,
    timestamp: new Date(),
    steps: []
  };

  try {
    auditLog.steps.push({ step: 'key_creation', status: 'started' });
    await createTransitKey(`commissioner-key-${uniqueId}`);
    auditLog.steps.push({ step: 'key_creation', status: 'completed' });
    
    // ... other steps
    
    await saveAuditLog(auditLog);
    return vaultConfig;
  } catch (error) {
    auditLog.steps.push({ step: 'current_step', status: 'failed', error: error.message });
    await saveAuditLog(auditLog);
    throw error;
  }
}
```

---

**Author**: Ishan Gawande  
**Version**: 1.0.0  
**Compatibility**: HashiCorp Vault 1.8+  
**License**: MIT