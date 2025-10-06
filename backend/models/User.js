const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['OFFICER', 'ADMIN', 'COMMISSIONER'], // Added COMMISSIONER role
      default: 'OFFICER'
    },
    department: {
      type: String,
      enum: ['HEALTHCARE', 'LICENSE', 'NOC'], // Only valid departments
      required: function () {
        // Department required for OFFICER, optional for ADMIN
        return this.role === 'OFFICER' || this.role === 'COMMISSIONER';
      }
    },
    blockchainAddress: {
      type: String,
      required: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);