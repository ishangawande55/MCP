const Application = require('../../models/Application');

const getAllApplications = async (req, res) => {
  try {
    const { status, type, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const applications = await Application.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('assignedOfficer', 'name email department');

    const total = await Application.countDocuments(filter);

    res.json({
      success: true,
      data: {
        applications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get Applications Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching applications.'
    });
  }
};

module.exports = { getAllApplications };