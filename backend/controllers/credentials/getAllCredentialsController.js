const Credential = require('../../models/Credential');

exports.getAllCredentials = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const credentials = await Credential.find()
      .sort({ issueDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('issuer', 'name email department');

    const total = await Credential.countDocuments();

    res.json({
      success: true,
      data: {
        credentials,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get Credentials Error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching credentials.' });
  }
};