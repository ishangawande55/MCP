require('dotenv').config();
const Vault = require('node-vault');

const vaultAddr = process.env.VAULT_ADDR || 'http://127.0.0.1:8200';
const token = process.env.VAULT_ROOT_TOKEN || process.env.VAULT_TOKEN; // root preferred

const vault = Vault({ apiVersion: 'v1', endpoint: vaultAddr, token });

// Vault policy definition
const policyName = 'mcp-app-policy';
const policyHCL = `
# Transit engine permissions
path "transit/keys/*" { capabilities = ["create","read","update","list"] }
path "transit/sign/*" { capabilities = ["update"] }
path "transit/verify/*" { capabilities = ["update"] }

# Optional secret storage
path "secret/data/mcp/*" { capabilities = ["create","read","update","delete","list"] }
`;

async function initVault() {
  try {
    console.log('🔐 Initializing Vault...');

    // 1️⃣ Vault health check
    const health = await vault.health();
    if (!health.initialized) throw new Error('Vault is not initialized');
    if (health.sealed) throw new Error('Vault is sealed. Unseal it before use.');
    console.log('✅ Vault is initialized and unsealed');

    // 2️⃣ Check if token is root
    const lookup = await vault.tokenLookupSelf();
    const isRoot = lookup.data.policies.includes('root');

    if (!isRoot) {
      console.warn('⚠️ Token is not root. Ensure it has sufficient permissions.');
    }

    // 3️⃣ Enable Transit engine if not exists
    const mounts = await vault.mounts();
    if (!mounts['transit/']) {
      if (!isRoot) throw new Error('Root token required to enable Transit engine.');
      console.log('⚙️ Enabling Transit engine...');
      await vault.mount({ mount_point: 'transit', type: 'transit', description: 'Transit engine for signing DIDs' });
      console.log('✅ Transit engine enabled');
    } else {
      console.log('✅ Transit engine already enabled');
    }

    // 4️⃣ Create signing key
    const keyName = 'mcp-signing-key';
    try {
      await vault.read(`transit/keys/${keyName}`);
      console.log(`🔑 Signing key '${keyName}' already exists`);
    } catch {
      if (!isRoot) throw new Error('Root token required to create signing key');
      console.log(`🪄 Creating signing key '${keyName}'...`);
      await vault.write(`transit/keys/${keyName}`, { type: 'ecdsa-p256', exportable: true });
      console.log(`✅ Signing key '${keyName}' created`);
    }

    // 5️⃣ Create policy
    try {
      await vault.write(`sys/policies/acl/${policyName}`, { policy: policyHCL });
      console.log(`✅ Policy '${policyName}' created`);
    } catch (err) {
      console.warn(`⚠️ Policy '${policyName}' may already exist or insufficient permissions`);
    }

    // 6️⃣ Create app token
    if (isRoot) {
      const tokenResp = await vault.tokenCreate({
        policies: [policyName],
        ttl: '24h', // adjust as needed
      });
      console.log('🚀 App token created for your application:');
      console.log(tokenResp.auth.client_token);
      console.log('💡 Save this as VAULT_TOKEN in your .env file');
    }

    console.log('✅ Vault bootstrap complete');
  } catch (err) {
    console.error('❌ Vault bootstrap failed:', err.message);
    process.exit(1);
  }
}

initVault();