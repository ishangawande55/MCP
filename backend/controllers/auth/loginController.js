const jwt = require('jsonwebtoken');
const User = require('../../models/User');

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password.'
      });
    }

    // Find active user
    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // Validate password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // Create JWT payload
    const payload = {
      id: user._id,
      email: user.email,
      role: user.role,
    };

    // Optionally include DID for officers/commissioners
    if (user.did) payload.did = user.did;

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

    // Response data
    const responseData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department || null,
      blockchainAddress: user.blockchainAddress || null,
      did: user.did || null,
    };

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: responseData
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};