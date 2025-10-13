const { ethers } = require("ethers");
const CredentialRegistryABI = require("../../artifacts/contracts/CredentialRegistry.sol/CredentialRegistry.json");
require("dotenv").config();

/**
 * @class BlockchainService
 * @author Ishan Gawande
 * @description
 * Handles blockchain interactions for credentials:
 *  - Issue credentials (single and batch)
 *  - Verify credentials
 *  - Revoke credentials
 *  - Fetch credential metadata
 *  - Supports anchoring ZKP Merkle roots on-chain for selective disclosure
 */
class BlockchainService {
  constructor() {
    // Initialize JSON-RPC provider
    this.provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
    this.contractAddress = process.env.CONTRACT_ADDRESS;

    // Load wallets for different authorized roles
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
   * Dynamically set the signer based on role
   * @param {string} role
   */
  setSigner(role) {
    if (!this.wallets[role]) throw new Error(`No wallet configured for role: ${role}`);
    this.wallet = this.wallets[role];
    this.contract = new ethers.Contract(this.contractAddress, CredentialRegistryABI.abi, this.wallet);
    console.log(`Signer set to ${role} (${this.wallet.address})`);
  }

  /**
   * Converts any value (hex, decimal, BigInt, string) into bytes32 hex string
   * Suitable for Solidity bytes32 parameters
   * @param {string|number|BigInt} value
   * @returns {string} 0x-prefixed bytes32 hex string
   */
  _toBytes32(value) {
    const crypto = require("crypto");

    if (!value) throw new Error("Invalid value for bytes32 conversion");

    // Convert numbers/BigInt to string
    let str = typeof value === "bigint" || typeof value === "number" ? value.toString() : value;

    // If already hex with 0x, remove prefix
    if (str.startsWith("0x")) str = str.slice(2);

    // If still not 64 chars, hash it to ensure fixed length
    if (str.length !== 64) {
      str = crypto.createHash("sha256").update(str).digest("hex");
    }

    return "0x" + str;
  }

  /**
   * Issues a single credential on-chain
   * @param {string} credentialId - Human-readable credential ID
   * @param {string} documentHash - SHA-256 hash of credential content
   * @param {string} ipfsCID - IPFS CID of full credential
   * @param {string|number|BigInt} merkleRoot - ZKP Merkle root for selective disclosure
   * @param {string} issuerDID - DID of the issuer
   * @param {string} holderDID - DID of the credential holder
   * @param {number} expiryTimestamp - Expiry timestamp (0 = never expires)
   * @param {string} schema - Credential schema/type string
   */
  async issueCredential(
    credentialId,
    documentHash,
    ipfsCID,
    merkleRoot,
    issuerDID,
    holderDID,
    expiryTimestamp = 0,
    schema = ""
  ) {
    try {
      const hashBytes32 = this._toBytes32(documentHash);
      const merkleBytes32 = this._toBytes32(merkleRoot);

      const tx = await this.contract.issueCertificate(
        credentialId,
        hashBytes32,
        ipfsCID,
        merkleBytes32,
        issuerDID,
        holderDID,
        expiryTimestamp,
        schema
      );

      const receipt = await tx.wait();
      if (receipt.status !== 1) throw new Error("Transaction failed on blockchain");

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
   * Verifies a credential on-chain
   */
  async verifyCredential(credentialId, documentHash) {
    try {
      const hashBytes32 = this._toBytes32(documentHash);
      return await this.contract.verifyCertificate(credentialId, hashBytes32);
    } catch (error) {
      console.error("Blockchain Verify Credential Error:", error);
      return [false, 1]; // Default: STATUS_NOT_FOUND
    }
  }

  /**
   * Batch issuance of multiple credentials with Merkle roots
   */
  async batchIssue(
    credentialIds,
    documentHashes,
    ipfsCIDs,
    merkleRoots,
    issuerDIDs,
    holderDIDs,
    expiries,
    schemas
  ) {
    try {
      const len = credentialIds.length;
      if (
        len !== documentHashes.length ||
        len !== ipfsCIDs.length ||
        len !== merkleRoots.length ||
        len !== issuerDIDs.length ||
        len !== holderDIDs.length ||
        len !== expiries.length ||
        len !== schemas.length
      )
        throw new Error("Array length mismatch");

      const txs = [];
      for (let i = 0; i < len; i++) {
        const docBytes32 = this._toBytes32(documentHashes[i]);
        const merkleBytes32 = this._toBytes32(merkleRoots[i]);

        const tx = await this.contract.issueCertificate(
          credentialIds[i],
          docBytes32,
          ipfsCIDs[i],
          merkleBytes32,
          issuerDIDs[i],
          holderDIDs[i],
          expiries[i],
          schemas[i]
        );
        txs.push(tx.wait());
      }

      const receipts = await Promise.all(txs);
      receipts.forEach((r) => {
        if (r.status !== 1) throw new Error("One or more batch transactions failed");
      });

      return receipts.map((r) => ({ transactionHash: r.hash, blockNumber: r.blockNumber, status: "SUCCESS" }));
    } catch (error) {
      console.error("Blockchain Batch Issue Error:", error);
      throw new Error(`Failed to batch issue credentials: ${error.message}`);
    }
  }
}

module.exports = new BlockchainService();