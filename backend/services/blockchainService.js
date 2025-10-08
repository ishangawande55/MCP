const { ethers } = require("ethers");
const CredentialRegistryABI = require("../../artifacts/contracts/CredentialRegistry.sol/CredentialRegistry.json");
require("dotenv").config();

/**
 * @class BlockchainService
 * Handles blockchain interactions for credentials (issue, verify, revoke, fetch)
 */
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

    // Default signer
    this.setSigner("ADMIN");
  }

  /**
   * Set the signer dynamically for different roles
   * @param {string} role - "ADMIN" | "HEALTHCARE_COMMISSIONER" | "LICENSES_COMMISSIONER" | "NOC_COMMISSIONER"
   */
  setSigner(role) {
    if (!this.wallets[role]) throw new Error(`No wallet configured for role: ${role}`);
    this.wallet = this.wallets[role];
    this.contract = new ethers.Contract(this.contractAddress, CredentialRegistryABI.abi, this.wallet);
    console.log(`Signer set to ${role} (${this.wallet.address})`);
  }

  /**
   * Convert hash string to bytes32 format
   */
  _hashToBytes32(hash) {
    // Remove '0x' prefix if present and ensure it's hex
    const cleanHash = hash.replace(/^0x/, '');

    // Check if it's already a valid bytes32 hex string
    if (cleanHash.length === 64 && /^[0-9a-fA-F]+$/.test(cleanHash)) {
      return '0x' + cleanHash;
    }

    // If it's not 64 chars, pad it or hash it
    let finalHash = cleanHash;
    if (cleanHash.length < 64) {
      // Pad with zeros to make 64 chars
      finalHash = cleanHash.padEnd(64, '0');
    } else if (cleanHash.length > 64) {
      // Hash it again to get fixed length
      const crypto = require('crypto');
      finalHash = crypto.createHash('sha256').update(cleanHash).digest('hex');
    }

    return '0x' + finalHash;
  }

  /**
   * Issue credential on blockchain
   */
  async issueCredential(credentialId, documentHash, ipfsCID, issuerDID, holderDID, expiryTimestamp = 0, schema = "") {
    try {
      const hashBytes32 = this._hashToBytes32(documentHash);

      const tx = await this.contract.issueCertificate(
        credentialId,
        hashBytes32,
        ipfsCID,
        issuerDID,
        holderDID,
        expiryTimestamp,
        schema
      );

      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new Error("Transaction failed on blockchain");
      }

      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: "SUCCESS",
      };
    } catch (error) {
      console.error("Blockchain Issue Credential Error:", error);
      throw new Error(`Failed to issue credential on blockchain: ${error.message}`);
    }
  }

  /**
   * Verify credential integrity and status
   */
  async verifyCredential(credentialId, documentHash) {
    try {
      const hashBytes32 = this._hashToBytes32(documentHash);
      return await this.contract.verifyCertificate(credentialId, hashBytes32);
    } catch (error) {
      console.error("Blockchain Verify Credential Error:", error);
      return false;
    }
  }

  /**
   * Get credential hash from blockchain
   */
  async getCredentialHash(credentialId) {
    try {
      // Solidity stores credential under keccak256(bytes(credentialId))
      const idHash = ethers.keccak256(ethers.toUtf8Bytes(credentialId));
      const credHashBytes32 = await this.contract.getCredentialHashByIdHash(idHash);
      return credHashBytes32; // returns 0x... (32 bytes hex)
    } catch (error) {
      console.error("Blockchain Get Credential Hash Error:", error);
      return "0x";
    }
  }

  /**
   * Fetch full credential from blockchain
   */
  async getCredential(credentialId) {
    try {
      return await this.contract.getCertificate(credentialId);
    } catch (error) {
      console.error("Blockchain Get Credential Error:", error);
      return null;
    }
  }

  /**
   * Revoke a credential on blockchain
   */
  async revokeCredential(credentialId, reason = "") {
    try {
      const tx = await this.contract.revokeCertificate(credentialId, reason);
      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new Error("Revocation transaction failed");
      }

      return {
        transactionHash: receipt.hash,
        status: "SUCCESS",
      };
    } catch (error) {
      console.error("Blockchain Revoke Credential Error:", error);
      throw new Error(`Failed to revoke credential on blockchain: ${error.message}`);
    }
  }
}

module.exports = new BlockchainService();