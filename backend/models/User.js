const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { generateDID } = require('../utils/didGenerator'); 

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
      required: function () {
        return this.role !== 'APPLICANT'; 
      }
    },
    role: {
      type: String,
      enum: ['APPLICANT', 'OFFICER', 'COMMISSIONER', 'ADMIN'],
      default: 'APPLICANT'
    },
    department: {
      type: String,
      enum: ['HEALTHCARE', 'LICENSE', 'NOC'],
      required: function () {
        return this.role === 'OFFICER' || this.role === 'COMMISSIONER';
      }
    },
    phone: {
      type: String,
      required: function () {
        return this.role === 'APPLICANT';
      }
    },
    address: {
      type: String,
      required: function () {
        return this.role === 'APPLICANT';
      }
    },
    blockchainAddress: { type: String },
    isActive: { type: Boolean, default: true },

    // Vault automation metadata
    vault: {
      keyName: { type: String },        // e.g., commissioner-key-u123
      policyName: { type: String },     // e.g., policy-commissioner-key-u123
      token: { type: String },          // Limited token for signing
      createdAt: { type: Date },        // Track when Vault key/policy created
      lastRotated: { type: Date }       // Optional future use (key rotation)
    },

    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  if (this.password) this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password for login
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);