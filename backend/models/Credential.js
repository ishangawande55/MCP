/**
 * @file Credential.js
 * @author Ishan Gawande
 * @description
 * MongoDB schema for verifiable credentials (VCs) with integrated
 * zero-knowledge proofs (ZKPs) and selective disclosure commitments.
 *
 * Each credential (e.g., Birth, Death, Trade License, NOC) may store:
 *  - A zkSNARK proof (proof + publicSignals)
 *  - A cryptographic commitment (Poseidon hash)
 *  - A disclosure policy and revocation status
 */

const mongoose = require("mongoose");

// -----------------------------------------
// Sub-schema: ZKP Proof Schema
// -----------------------------------------
const zkpProofSchema = new mongoose.Schema(
  {
    proof: {
      type: Object,
      required: false, // Generated post-issuance
    },
    publicSignals: {
      type: [String],
      required: false,
    },
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
    credentialId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    applicationId: {
      type: String,
      required: true,
      ref: "Application",
      index: true,
    },

    type: {
      type: String,
      enum: ["BIRTH", "DEATH", "TRADE_LICENSE", "NOC"],
      required: true,
      index: true,
    },

    // ---------------------
    // Parties Involved
    // ---------------------
    recipient: {
      name: String,
      email: String,
      phone: String,
    },
    issuer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    issuerDID: {
      type: String,
      required: true,
    },
    holderDID: {
      type: String,
      required: true,
    },
    holderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // ---------------------
    // On-chain / Off-chain Metadata
    // ---------------------
    schemaType: {
      type: String,
      required: true,
    },
    documentHash: String,
    ipfsCID: {
      type: String,
      required: true,
    },
    blockchainTxHash: {
      type: String,
      required: true,
    },
    credentialHash: {
      type: String,
      required: true,
    },
    registryContract: {
      type: String,
      required: true,
    },
    issuerAddress: {
      type: String,
      required: true,
    },

    // ---------------------
    // Cryptographic Integrity
    // ---------------------
    vcData: {
      type: Object,
      required: true,
    },
    vcSignature: {
      type: String,
      required: true,
    },
    issuerPublicKey: String,
    issuerVaultKeyRef: String,
    issuerKeyVersion: Number,

    // ---------------------
    // Zero-Knowledge Proofs
    // ---------------------
    zkpProofs: {
      birth: zkpProofSchema,
      death: zkpProofSchema,
      trade: zkpProofSchema,
      noc: zkpProofSchema,
    },

    vcCommitments: {               // Hash commitments for sensitive fields
      birth: { type: String, required: false },
      death: { type: String, required: false },
      trade: { type: String, required: false },
      noc: { type: String, required: false }
    },

    merkleRoot: { type: String, required: false },

    disclosedFields: { type: [String], default: [] },

    // ---------------------
    // Commitments (Poseidon hashes)
    // ---------------------
    zkCommitments: {
      birth: String,
      death: String,
      trade: String,
      noc: String,
    },

    // ---------------------
    // Selective Disclosure
    // ---------------------
    blindingFactorRef: String,
    disclosurePolicy: [String],

    // ---------------------
    // Credential Lifecycle
    // ---------------------
    issueDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: Date,

    credentialStatus: {
      type: String,
      enum: ["ISSUED", "REVOKED", "EXPIRED", "ACTIVE"],
      default: "ISSUED",
    },
    revocationStatus: {
      type: Boolean,
      default: false,
    },
    revokedReason: String,
    revokedAt: Date,

    // ---------------------
    // Verification History
    // ---------------------
    verificationLogs: [
      {
        verifiedBy: String,
        verifiedAt: {
          type: Date,
          default: Date.now,
        },
        result: {
          type: String,
          enum: ["VALID", "REVOKED", "HASH_MISMATCH", "EXPIRED", "INVALID"],
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// -----------------------------------------
// Index Optimization
// -----------------------------------------
credentialSchema.index({ credentialId: 1 });
credentialSchema.index({ issuerDID: 1 });
credentialSchema.index({ holderDID: 1 });
credentialSchema.index({ type: 1 });

// -----------------------------------------
// Export Model
// -----------------------------------------
module.exports = mongoose.model("Credential", credentialSchema);