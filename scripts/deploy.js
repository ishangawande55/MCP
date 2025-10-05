const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying CredentialRegistry...");

  // Get the first signer (deployer)
  const [deployer] = await ethers.getSigners();

  // Get the contract factory
  const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");

  // Deploy contract
  const registry = await CredentialRegistry.deploy();

  // Wait for deployment
  await registry.waitForDeployment(); // ethers v6

  console.log("✅ CredentialRegistry deployed to:", registry.target);
  console.log("📝 First authorized issuer:", await deployer.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });