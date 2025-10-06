exports.getCurrentUser = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          department: req.user.department,
          blockchainAddress: req.user.blockchainAddress
        }
      }
    });
  } catch (error) {
    console.error('Get User Error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching user data.' });
  }
};