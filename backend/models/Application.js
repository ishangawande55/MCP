/**
 * @file Application.js
 * @author Ishan Gawande
 * @description
 * MongoDB schema for municipal applications (Birth, Death, Trade License, NOC).
 * Supports selective disclosure (SD) flags for sensitive fields to enable
 * zero-knowledge proof (ZKP) generation.
 *
 * Each application tracks:
 *  - Applicant details
 *  - Type-specific details (birth, death, trade, noc)
 *  - Disclosure flags for ZKP
 *  - Supporting documents
 *  - Workflow status and history
 *  - Assignment to officers/commissioners
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
    applicationId: {
      type: String,
      required: true,
      unique: true,
    },
    credentialId: {
      type: String,
      ref: "Credential",
    },
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
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      did: { type: String, required: true },
    },

    // ---------------------
    // Type-specific Fields
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
    // Selective Disclosure Flags for ZKP
    // ---------------------
    /**
     * Each field marked as 1 = disclosed, 0 = hidden
     * This maps directly to the structure of sensitive data sections
     * and will be used for generating ZKP proofs.
     */
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
    disclosedFields: {
      type: [String],
      default: [],
    },

    // ---------------------
    // Supporting Documents
    // ---------------------
    supportingDocuments: [{ name: String, ipfsCID: String }],

    // ---------------------
    // Application Workflow Status
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
    forwardedCommissionerPublicKey: { type: String }, // added for issuance
    forwardedAt: { type: Date },

    // ---------------------
    // Review & Issuance
    // ---------------------
    reviewComments: String,
    issuedAt: { type: Date },
    credential: { type: mongoose.Schema.Types.ObjectId, ref: "Credential" },

    // ---------------------
    // ZKP & SD Integration
    // ---------------------
    zkProof: { type: Object, required: false },       // ZKP proof generated post-submission
    publicSignals: { type: [String], required: false }, // Public signals from ZKP
    merkleRoot: { type: String, required: false },   // Root to be anchored on blockchain

    // ---------------------
    // Application History
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