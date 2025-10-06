const { ethers } = require("ethers");
const CredentialRegistryABI = require("../../artifacts/contracts/CredentialRegistry.sol/CredentialRegistry.json");
require("dotenv").config();

class BlockchainService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
    this.contractAddress = process.env.CONTRACT_ADDRESS;

    // Load wallets for authorized issuers
    this.wallets = {
      ADMIN: new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, this.provider),
      HEALTHCARE_COMMISSIONER: new ethers.Wallet(process.env.HEALTHCARE_COMMISSIONER_PRIVATE_KEY, this.provider),
      LICENSES_COMMISSIONER: new ethers.Wallet(process.env.LICENSES_COMMISSIONER_PRIVATE_KEY, this.provider),
      NOC_COMMISSIONER: new ethers.Wallet(process.env.NOC_COMMISSIONER_PRIVATE_KEY, this.provider),
    };

    // Default to ADMIN wallet
    this.setSigner("ADMIN");
  }

  /**
   * Set the signer dynamically for different roles
   * @param {string} role - "ADMIN" | "HEALTHCARE_COMMISSIONER" | "LICENSES_COMMISSIONER" | "NOC_COMMISSIONER"
   */
  setSigner(role) {
    if (!this.wallets[role]) throw new Error(`No wallet configured for role: ${role}`);
    this.wallet = this.wallets[role];
    this.contract = new ethers.Contract(
      this.contractAddress,
      CredentialRegistryABI.abi,
      this.wallet
    );
    console.log(`Signer set to ${role} (${this.wallet.address})`);
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

    console.log("Normalized Data for Hash:", normalized);
    console.log("Stringified Hash Input:", stringified);

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
      console.error("Blockchain Issue Credential Error:", error);
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
      console.error("Blockchain Verify Credential Error:", error);
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
      console.error("Blockchain Get Credential Error:", error);
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
      console.error("Blockchain Revoke Credential Error:", error);
      throw new Error("Failed to revoke credential on blockchain");
    }
  }
}

module.exports = new BlockchainService();