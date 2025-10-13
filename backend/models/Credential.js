/**
 * @file Credential.js
 * @author Ishan Gawande
 * @description
 * MongoDB schema for Verifiable Credentials (VCs) integrated with:
 *  - Zero-Knowledge Proofs (ZKPs)
 *  - Merkle root anchoring on blockchain
 *  - Selective disclosure commitments
 *  - Credential lifecycle and revocation tracking
 *  - Canonical VC payload storage for deterministic verification
 *
 * Each credential corresponds to a municipal application (Birth, Death, Trade License, NOC)
 * and stores cryptographic proofs, disclosed fields, commitments, and issuance metadata.
 */

const mongoose = require("mongoose");
const crypto = require("crypto");

// -----------------------------------------
// Helper: Canonicalize object deterministically
// -----------------------------------------
const canonicalize = (obj) => {
  if (!obj || typeof obj !== "object") return JSON.stringify(obj);
  const sortedKeys = Object.keys(obj).sort();
  const result = {};
  for (const key of sortedKeys) {
    result[key] = canonicalize(obj[key]);
  }
  return JSON.stringify(result);
};

// -----------------------------------------
// Helper: Compute deterministic hash for Solidity
// -----------------------------------------
const computeHashBytes32 = (input) => {
  const str = typeof input === "string" ? input : canonicalize(input);
  const hash = crypto.createHash("sha256").update(str).digest("hex");
  return "0x" + hash.padStart(64, "0").slice(0, 64);
};

// -----------------------------------------
// Sub-schema: ZKP Proof Schema
// -----------------------------------------
const zkpProofSchema = new mongoose.Schema(
  {
    proof: { type: Object, required: false },
    publicSignals: { type: [String], required: false },
  },
  { _id: false }
);

// -----------------------------------------
// Main Credential Schema
// -----------------------------------------
const credentialSchema = new mongoose.Schema(
  {
    // ---------------------
    // Core Identifiers
    // ---------------------
    credentialId: { type: String, required: true, unique: true, index: true },
    applicationId: { type: String, required: true, ref: "Application", index: true },
    type: { type: String, enum: ["BIRTH", "DEATH", "TRADE_LICENSE", "NOC"], required: true, index: true },

    // ---------------------
    // Parties Involved
    // ---------------------
    recipient: { name: String, email: String, phone: String },
    issuer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    issuerDID: { type: String, required: true },
    holderDID: { type: String, required: true },
    holderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // ---------------------
    // On-chain & Off-chain Metadata
    // ---------------------
    schemaType: { type: String, required: true },
    ipfsCID: { type: String, required: true },
    blockchainTxHash: { type: String, required: true },
    credentialHash: { type: String, required: true },
    registryContract: { type: String, required: true },
    issuerAddress: { type: String, required: true },

    // ---------------------
    // Full VC Data
    // ---------------------
    vcData: {
      type: Object,
      required: true,
      /**
       * Structure:
       * {
       *   vcJwt: string,             // Vault-signed JWT
       *   payload: Object            // Canonical VC payload used for deterministic hash & verification
       * }
       */
      set: function (data) {
        if (data && data.payload) {
          this.credentialHash = computeHashBytes32(data.payload);
        }
        return data;
      },
    },
    vcSignature: { type: String, required: true },
    issuerPublicKey: String,
    issuerVaultKeyRef: String,
    issuerKeyVersion: Number,

    // ---------------------
    // Zero-Knowledge Proofs
    // ---------------------
    zkpProofs: { birth: zkpProofSchema, death: zkpProofSchema, trade: zkpProofSchema, noc: zkpProofSchema },
    vcCommitments: { birth: String, death: String, trade: String, noc: String },
    merkleRoot: { type: String },
    disclosedFields: { type: [String], default: [] },
    zkCommitments: { birth: String, death: String, trade: String, noc: String },
    blindingFactorRef: String,
    disclosurePolicy: [String],

    // ---------------------
    // Credential Lifecycle
    // ---------------------
    issueDate: { type: Date, default: Date.now },
    expiryDate: Date,
    credentialStatus: { type: String, enum: ["ISSUED", "REVOKED", "EXPIRED", "ACTIVE"], default: "ISSUED" },
    revocationStatus: { type: Boolean, default: false },
    revokedReason: String,
    revokedAt: Date,

    // ---------------------
    // Verification History
    // ---------------------
    verificationLogs: [
      {
        verifiedBy: String,
        verifiedAt: { type: Date, default: Date.now },
        result: { type: String, enum: ["VALID", "REVOKED", "HASH_MISMATCH", "EXPIRED", "INVALID"] },
        jwtVerified: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

// -----------------------------------------
// Index Optimization
// -----------------------------------------
credentialSchema.index({ credentialId: 1 });
credentialSchema.index({ issuerDID: 1 });
credentialSchema.index({ holderDID: 1 });
credentialSchema.index({ type: 1 });
credentialSchema.index({ merkleRoot: 1 });

// -----------------------------------------
// Export Model
// -----------------------------------------
module.exports = mongoose.model("Credential", credentialSchema);