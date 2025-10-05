require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const createAdminUser = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@municipal.gov' });
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists');
      process.exit(0);
    }

    // Create admin user
    const admin = new User({
      name: 'Municipal Admin',
      email: 'admin@municipal.gov',
      password: 'admin123', 
      role: 'ADMIN',
      department: 'Administration',
      blockchainAddress: process.env.ADMIN_BLOCKCHAIN_ADDRESS || '0x0000000000000000000000000000000000000000'
    });

    await admin.save();
    console.log('✅ Admin user created successfully');
    console.log('📧 Email: admin@municipal.gov');
    console.log('🔑 Password: admin123');
    console.log('⚠️  CHANGE THESE CREDENTIALS IN PRODUCTION!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
};

createAdminUser();