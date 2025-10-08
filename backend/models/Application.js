const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
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

    applicant: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      did: { type: String, required: true }
    },

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

    supportingDocuments: [{ name: String, ipfsCID: String }],

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

    assignedOfficer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    forwardedCommissioner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    reviewComments: String,

    forwardedCommissionerDID: { type: String },
    forwardedCommissionerPublicKey: { type: String }, // added for issuance
    forwardedAt: { type: Date },

    issuedAt: { type: Date },
    credential: { type: mongoose.Schema.Types.ObjectId, ref: "Credential" },

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

module.exports = mongoose.model("Application", applicationSchema);