const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { generateDID } = require('../utils/didGenerator'); // new utility

const userSchema = new mongoose.Schema(
  {
    did: {
      type: String,
      unique: true,
      default: function () {
        // Auto-generate DID for all users (applicants/officers/commissioners)
        return generateDID(this.role);
      }
    },
    publicKey: { type: String }, // optional, filled if DID has key

    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: {
      type: String,
      required: function () { return this.role !== 'APPLICANT'; } // password optional for applicants
    },
    role: {
      type: String,
      enum: ['APPLICANT', 'OFFICER', 'COMMISSIONER', 'ADMIN'],
      default: 'APPLICANT'
    },
    department: {
      type: String,
      enum: ['HEALTHCARE', 'LICENSE', 'NOC'],
      required: function () { return this.role === 'OFFICER' || this.role === 'COMMISSIONER'; }
    },
    phone: { type: String, required: function () { return this.role === 'APPLICANT'; } },
    address: { type: String, required: function () { return this.role === 'APPLICANT'; } },
    blockchainAddress: { type: String },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  if (this.password) this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);