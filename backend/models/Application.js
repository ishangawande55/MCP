const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    applicationId: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ["BIRTH", "DEATH", "TRADE_LICENSE", "NOC"],
      required: true,
    },
    applicant: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
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
      enum: ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "ISSUED"],
      default: "PENDING",
    },
    assignedOfficer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewComments: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Application", applicationSchema);
