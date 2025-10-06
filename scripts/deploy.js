const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying CredentialRegistry...");

  // Get first 4 signers
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const additionalIssuers = signers.slice(1, 4); // accounts #1, #2, #3

  // Get contract factory
  const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");

  // Deploy contract
  const registry = await CredentialRegistry.deploy();
  await registry.waitForDeployment(); // ethers v6

  console.log("✅ CredentialRegistry deployed to:", registry.target);

  // Add additional issuers
  for (const issuer of additionalIssuers) {
    await registry.addIssuer(await issuer.getAddress());
    console.log("📝 Authorized issuer added:", await issuer.getAddress());
  }

  // Show all authorized issuers
  const allIssuers = [deployer, ...additionalIssuers];
  console.log("🎯 All authorized issuers:");
  for (const issuer of allIssuers) {
    console.log(await issuer.getAddress());
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });