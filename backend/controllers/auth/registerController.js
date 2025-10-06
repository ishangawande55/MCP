const User = require('../../models/User');

exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, department, blockchainAddress, role } = req.body;

    // Validate required fields for self-registration
    if (!name || !email || !password || !department) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and department are required.'
      });
    }

    // Validate department for officer
    const validDepartments = ['HEALTHCARE', 'LICENSES', 'NOC'];
    if (!validDepartments.includes(department)) {
      return res.status(400).json({
        success: false,
        message: `Invalid department. Must be one of: ${validDepartments.join(', ')}`
      });
    }

    // Role handling
    let assignedRole = 'OFFICER'; // default for self-registration
    let blockchainAddr = undefined;

    if (role && (role === 'ADMIN' || role === 'COMMISSIONER')) {
      // Admin / Commissioner creation (must provide blockchain address)
      if (!blockchainAddress) {
        return res.status(400).json({
          success: false,
          message: 'Blockchain address is required for ADMIN or COMMISSIONER.'
        });
      }
      assignedRole = role;
      blockchainAddr = blockchainAddress;
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists.'
      });
    }

    // Create user object
    const userData = {
      name,
      email,
      password,
      role: assignedRole,
      department,
      blockchainAddress: blockchainAddr // undefined for normal officers
    };

    const user = new User(userData);
    await user.save();

    res.status(201).json({
      success: true,
      message: `${assignedRole} registered successfully`,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          blockchainAddress: user.blockchainAddress
        }
      }
    });

  } catch (error) {
    console.error('User Registration Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during user registration.'
    });
  }
};