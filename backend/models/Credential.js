const mongoose = require("mongoose");

const credentialSchema = new mongoose.Schema({
  credentialId: { type: String, required: true, unique: true },
  applicationId: { type: String, required: true, ref: "Application" },
  type: {
    type: String,
    enum: ["BIRTH", "DEATH", "TRADE_LICENSE", "NOC"],
    required: true,
  },
  recipient: { name: String, email: String, phone: String },
  documentHash: { type: String, required: true },
  ipfsCID: { type: String, required: true },
  blockchainTxHash: { type: String, required: true },
  issuer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  issueDate: { type: Date, default: Date.now },
  expiryDate: Date,
  status: {
    type: String,
    enum: ["ACTIVE", "EXPIRED", "REVOKED"],
    default: "ACTIVE",
  },
  revocationReason: String,
});

module.exports = mongoose.model("Credential", credentialSchema);
