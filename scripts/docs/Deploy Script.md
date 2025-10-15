# CredentialRegistry Deployment Script

## 📋 Overview

This deployment script automates the setup and initialization of the CredentialRegistry smart contract, configuring a multi-issuer environment with proper access controls and role assignments.

## 🏗️ Deployment Architecture

![Deployment Architecture](diagrams/Deployment%20Architecture.png)

## 🎯 Deployment Objectives

### Primary Goals
- **🏭 Contract Deployment**: Deploy CredentialRegistry with proper admin setup
- **👥 Multi-Issuer Setup**: Configure multiple authorized issuers for redundancy
- **🔐 Role Management**: Establish hierarchical access control
- **📊 Verification**: Provide clear deployment output and verification

## 🔧 Technical Implementation

### Script Flow

![Script Flow](diagrams/Script%20Flow.png)

## 📝 Code Walkthrough

### 1. **Initial Setup**
```javascript
const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying CredentialRegistry...");
```
- **Hardhat Import**: Uses Hardhat's Ethereum development environment
- **Main Function**: Async function for deployment orchestration
- **Logging**: Clear status indicators for deployment progress

### 2. **Account Configuration**
```javascript
// Get first 4 signers
const signers = await ethers.getSigners();
const deployer = signers[0];
const additionalIssuers = signers.slice(1, 4); // accounts #1, #2, #3
```

**Account Allocation:**

![Account Allocation](diagrams/Account%20Allocation.png)

### 3. **Contract Deployment**
```javascript
// Get contract factory
const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");

// ✅ Deploy contract with deployer as admin
const registry = await CredentialRegistry.deploy(await deployer.getAddress());
await registry.waitForDeployment(); // ethers v6
```

**Deployment Parameters:**
- **Factory**: Loads compiled contract ABI and bytecode
- **Constructor**: Passes deployer address as initial admin
- **Wait Pattern**: Uses ethers v6 `waitForDeployment()` for transaction confirmation

### 4. **Issuer Configuration**
```javascript
// Add additional issuers (accounts #1, #2, #3)
for (const issuer of additionalIssuers) {
  await registry.addIssuer(await issuer.getAddress());
  console.log("📝 Authorized issuer added:", await issuer.getAddress());
}
```

**Role Assignment Flow:**
1. **Iterate** through additional issuers array
2. **Call** `addIssuer()` function for each address
3. **Log** each successful issuer addition
4. **Emit** `IssuerAdded` events for on-chain tracking

### 5. **Final Verification**
```javascript
// Show all authorized issuers (deployer + first 3 additional issuers)
const allIssuers = [deployer, ...additionalIssuers];
console.log("🎯 All authorized issuers:");
for (const issuer of allIssuers) {
  console.log(await issuer.getAddress());
}
```

**Final Configuration Output:**
```
🎯 All authorized issuers:
0x70997970C51812dc3A010C7d01b50e0d17dc79C8  # Deployer/Admin
0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC  # Issuer #1
0x90F79bf6EB2c4f870365E785982E1f101E93b906  # Issuer #2
0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65  # Issuer #3
```

## 🛡️ Security Considerations

### Access Control Hierarchy

![Acess Control Hierarchy](diagrams/Acess%20Control%20Hierarchy.png)


### Privilege Separation
- **Admin Role**: Only deployer has full administrative privileges
- **Issuer Roles**: Multiple issuers for operational redundancy
- **No Single Point of Failure**: 4 authorized issuers prevent system downtime

## 🚀 Execution Commands

### Basic Deployment
```bash
npx hardhat run scripts/deploy.js --network localhost
```

### Network-Specific Deployment
```bash
# Testnet
npx hardhat run scripts/deploy.js --network goerli

# Mainnet (with verification)
npx hardhat run scripts/deploy.js --network mainnet
```

### With Verification
```bash
npx hardhat verify --network mainnet DEPLOYED_CONTRACT_ADDRESS "DEPLOYER_ADDRESS"
```

## 📊 Expected Output

```
🚀 Deploying CredentialRegistry...
✅ CredentialRegistry deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
📝 Authorized issuer added: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
📝 Authorized issuer added: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
📝 Authorized issuer added: 0x90F79bf6EB2c4f870365E785982E1f101E93b906
🎯 All authorized issuers:
0x70997970C51812dc3A010C7d01b50e0d17dc79C8
0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
0x90F79bf6EB2c4f870365E785982E1f101E93b906
0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
```

## 🔧 Customization Options

### Modify Issuer Count
```javascript
// For more issuers
const additionalIssuers = signers.slice(1, 6); // 5 additional issuers

// For fewer issuers  
const additionalIssuers = signers.slice(1, 2); // 1 additional issuer
```

### Different Admin Strategy
```javascript
// Use specific admin address
const adminAddress = "0x742d35Cc6634C0532925a3b8D31139ef04240000";
const registry = await CredentialRegistry.deploy(adminAddress);
```

## 🐛 Troubleshooting

### Common Issues
1. **Insufficient Funds**: Ensure deployer account has ETH for gas
2. **Network Configuration**: Verify Hardhat network settings
3. **Contract Compilation**: Run `npx hardhat compile` first
4. **Role Assignment**: Check that deployer has DEFAULT_ADMIN_ROLE

### Verification Steps
```bash
# Check contract deployment
npx hardhat ethers-verify --address DEPLOYED_ADDRESS

# Verify issuer roles
npx hardhat console --network localhost
> const registry = await ethers.getContractAt("CredentialRegistry", "0x...")
> await registry.hasRole(ISSUER_ROLE, "ISSUER_ADDRESS")
```

## 📈 Gas Optimization

### Deployment Costs
- **Contract Creation**: ~1,500,000 gas
- **Issuer Additions**: ~50,000 gas per issuer
- **Total Estimated**: ~1,650,000 gas

### Batch Alternatives
Consider using a batch add function in the contract for larger issuer sets to save gas.

---

**Network**: Compatible with any EVM network  
**Requirements**: Hardhat, ethers.js v6, compiled contracts  
**Security**: Implements principle of least privilege for role management