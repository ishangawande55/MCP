const mongoose = require("mongoose");

const credentialSchema = new mongoose.Schema(
  {
    credentialId: {
      type: String,
      required: true,
      unique: true
    },

    applicationId: {
      type: String,
      required: true,
      ref: "Application"
    },
    type: {
      type: String,
      enum: ["BIRTH", "DEATH", "TRADE_LICENSE", "NOC"],
      required: true,
    },
    recipient: {
      name: String,
      email: String,
      phone: String,
    },
    documentHash: {
      type: String
    },
    issuer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    issueDate: {
      type: Date,
      default: Date.now
    },

    // === NEW FIELDS (enhanced functionality) ===
    issuerDID: {
      type: String,
      required: true
    },
    holderDID: {
      type: String,
      required: true
    },
    holderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    schemaType: {
      type: String,
      required: true
    },
    issuerVaultKeyRef: {
      type: String,
      required: false
    },
    issuerKeyVersion: {
      type: Number,
      required: false
    },
    issuerPublicKey: {
      type: String,
      required: false
    },
    vcData: {
      type: Object,
      required: true
    },
    vcSignature: {
      type: String,
      required: true
    },
    ipfsCID: {
      type: String,
      required: true
    },
    blockchainTxHash: {
      type: String,
      required: true
    },
    credentialHash: {
      type: String, required: true
    },
    issuerAddress: {
      type: String,
      required: true
    },
    registryContract: {
      type: String,
      required: true
    },

    // FIXED: Removed duplicate status field
    credentialStatus: {
      type: String,
      enum: ["ISSUED", "REVOKED", "EXPIRED", "ACTIVE"],
      default: "ISSUED",
    },
    revokedReason: {
      type: String,
      default: null
    },
    revokedAt: {
      type: Date,
      default: null
    },

    issuedAt: {
      type: Date,
      required: true
    },
    expiryDate: {
      type: Date,
      default: null
    },

    verificationLogs: [
      {
        verifiedBy: {
          type: String
        },
        verifiedAt: {
          type: Date,
          default: Date.now
        },
        result: {
          type: String,
          enum: ["VALID", "REVOKED", "HASH_MISMATCH", "EXPIRED", "INVALID"]
        },
      },
    ],
  },
  {
    timestamps: true
  }
);

// Index for faster queries
credentialSchema.index({ credentialId: 1 });
credentialSchema.index({ applicationId: 1 });
credentialSchema.index({ issuerDID: 1 });
credentialSchema.index({ holderDID: 1 });

module.exports = mongoose.model("Credential", credentialSchema);