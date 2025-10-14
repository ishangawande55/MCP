/**
 * @file Application.js
 * @author Ishan Gawande
 * @description
 * -----------------------------------------------------------------------------
 * MongoDB schema for municipal applications (Birth, Death, Trade License, NOC).
 * Fully supports selective disclosure (SD) and Zero-Knowledge Proof (ZKP) lifecycle:
 *  - initial proof generation
 *  - intermediate proofs (if any)
 *  - final proof for issuance
 *  - corresponding public signals
 * -----------------------------------------------------------------------------
 */

const mongoose = require("mongoose");

// -----------------------------------------
// Main Application Schema
// -----------------------------------------
const applicationSchema = new mongoose.Schema(
  {
    // ---------------------
    // Core Identifiers
    // ---------------------
    applicationId: { type: String, required: true, unique: true },
    credentialId: { type: String, ref: "Credential" },
    type: {
      type: String,
      enum: ["BIRTH", "DEATH", "TRADE_LICENSE", "NOC"],
      required: true,
    },
    department: {
      type: String,
      enum: ["HEALTHCARE", "LICENSE", "NOC"],
      required: true,
    },

    // ---------------------
    // Applicant Details
    // ---------------------
    applicant: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      did: { type: String, required: true },
    },

    // ---------------------
    // Type-specific Details
    // ---------------------
    birthDetails: {
      childName: String,
      dateOfBirth: Date,
      gender: String,
      placeOfBirth: String,
      fatherName: String,
      motherName: String,
    },
    deathDetails: {
      deceasedName: String,
      dateOfDeath: Date,
      placeOfDeath: String,
      causeOfDeath: String,
    },
    tradeDetails: {
      businessName: String,
      businessType: String,
      businessAddress: String,
      licenseDuration: Number,
    },
    nocDetails: {
      purpose: String,
      propertyAddress: String,
      applicantType: String,
    },

    // ---------------------
    // Selective Disclosure Flags
    // ---------------------
    disclosedFlags: {
      birthDetails: {
        childName: { type: Number, default: 1 },
        dateOfBirth: { type: Number, default: 1 },
        gender: { type: Number, default: 1 },
        placeOfBirth: { type: Number, default: 1 },
        fatherName: { type: Number, default: 1 },
        motherName: { type: Number, default: 1 },
      },
      deathDetails: {
        deceasedName: { type: Number, default: 1 },
        dateOfDeath: { type: Number, default: 1 },
        placeOfDeath: { type: Number, default: 1 },
        causeOfDeath: { type: Number, default: 1 },
      },
      tradeDetails: {
        businessName: { type: Number, default: 1 },
        businessType: { type: Number, default: 1 },
        businessAddress: { type: Number, default: 1 },
        licenseDuration: { type: Number, default: 1 },
      },
      nocDetails: {
        purpose: { type: Number, default: 1 },
        propertyAddress: { type: Number, default: 1 },
        applicantType: { type: Number, default: 1 },
      },
    },
    disclosedFields: { type: [String], default: [] },

    // ---------------------
    // Supporting Documents
    // ---------------------
    supportingDocuments: [
      { name: String, ipfsCID: String }
    ],

    // ---------------------
    // Workflow Status
    // ---------------------
    status: {
      type: String,
      enum: [
        "PENDING",
        "UNDER_REVIEW",
        "FORWARDED_TO_COMMISSIONER",
        "APPROVED",
        "REJECTED",
        "ISSUED",
      ],
      default: "PENDING",
    },

    // ---------------------
    // Officer & Commissioner Assignment
    // ---------------------
    assignedOfficer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    forwardedCommissioner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    forwardedCommissionerDID: { type: String },
    forwardedCommissionerPublicKey: { type: String },
    forwardedAt: { type: Date },

    // ---------------------
    // Review & Issuance
    // ---------------------
    reviewComments: String,
    issuedAt: { type: Date },
    credential: { type: mongoose.Schema.Types.ObjectId, ref: "Credential" },

    // ---------------------
    // ZKP & Selective Disclosure Integration
    // ---------------------
    /**
     * Multiple ZKP proofs lifecycle:
     * - initialZkpProof: proof generated at submission
     * - intermediateZkpProof: optional intermediate proofs
     * - finalZkpProof: final proof for issuance / selective disclosure
     * 
     * Public signals must match corresponding proofs.
     */
    initialZkpProof: { type: Object, required: false },
    intermediateZkpProof: { type: Object, required: false },
    finalZkpProof: { type: Object, required: false },

    initialPublicSignals: { type: [String], required: false },
    intermediatePublicSignals: { type: [String], required: false },
    finalPublicSignals: { type: [String], required: false },

    merkleRoot: { type: String, required: false }, // Anchored root for blockchain verification

    // ---------------------
    // Application History & Audit
    // ---------------------
    history: [
      {
        action: String,
        by: {
          id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          name: String,
          role: String,
          did: String,
        },
        to: {
          id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          name: String,
          did: String,
        },
        at: { type: Date, default: Date.now },
        note: String,
      },
    ],
  },
  { timestamps: true }
);

// -----------------------------------------
// Export Model
// -----------------------------------------
module.exports = mongoose.model("Application", applicationSchema);