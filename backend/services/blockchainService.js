const { ethers } = require("ethers");
const CredentialRegistryABI = require("../../artifacts/contracts/CredentialRegistry.sol/CredentialRegistry.json");

class BlockchainService {
  constructor() {
    // Provider & wallet setup
    this.provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    this.contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      CredentialRegistryABI.abi,
      this.wallet
    );
  }

  // ==============================
  // Normalize data for hashing
  // ==============================
  normalizeForHash(data) {
    return {
      credentialId: data.credentialId,
      type: data.type,
      recipient: {
        name: data.recipient?.name || "",
        email: data.recipient?.email || "",
        phone: data.recipient?.phone || ""
      },
      applicationId: data.applicationDetails?.applicationId || "",
      ipfsCID: data.ipfsCID || ""
    };
  }

  // ==============================
  // Generate deterministic hash
  // ==============================
  generateHash(data) {
    const normalized = this.normalizeForHash(data);
    const stringified = JSON.stringify(normalized);

    console.log("📦 Normalized Data for Hash:", normalized);
    console.log("🔑 Stringified Hash Input:", stringified);

    return ethers.keccak256(ethers.toUtf8Bytes(stringified));
  }

  // ==============================
  // Issue credential on blockchain
  // ==============================
  async issueCredential(credentialId, documentHash, ipfsCID, expiryTimestamp = 0) {
    try {
      const tx = await this.contract.issueCertificate(
        credentialId,
        documentHash,
        ipfsCID,
        expiryTimestamp
      );
      const receipt = await tx.wait();
      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: receipt.status === 1 ? "SUCCESS" : "FAILED",
      };
    } catch (error) {
      console.error("❌ Blockchain Issue Credential Error:", error);
      throw new Error("Failed to issue credential on blockchain");
    }
  }

  // ==============================
  // Verify credential
  // ==============================
  async verifyCredential(credentialId, documentHash) {
    try {
      return await this.contract.verifyCertificate(credentialId, documentHash);
    } catch (error) {
      console.error("❌ Blockchain Verify Credential Error:", error);
      return false;
    }
  }

  // ==============================
  // Get credential from blockchain
  // ==============================
  async getCredential(credentialId) {
    try {
      return await this.contract.getCertificate(credentialId);
    } catch (error) {
      console.error("❌ Blockchain Get Credential Error:", error);
      return null;
    }
  }

  // ==============================
  // Revoke credential
  // ==============================
  async revokeCredential(credentialId) {
    try {
      const tx = await this.contract.revokeCertificate(credentialId);
      const receipt = await tx.wait();
      return {
        transactionHash: receipt.hash,
        status: receipt.status === 1 ? "SUCCESS" : "FAILED",
      };
    } catch (error) {
      console.error("❌ Blockchain Revoke Credential Error:", error);
      throw new Error("Failed to revoke credential on blockchain");
    }
  }
}

module.exports = new BlockchainService();