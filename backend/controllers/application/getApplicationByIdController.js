const Application = require('../../models/Application');

const getApplicationById = async (req, res) => {
  try {
    const application = await Application.findOne({
      $or: [{ _id: req.params.id }, { applicationId: req.params.id }]
    }).populate('assignedOfficer', 'name email department');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found.'
      });
    }

    res.json({
      success: true,
      data: { application }
    });
  } catch (error) {
    console.error('Get Application Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching application.'
    });
  }
};

module.exports = { getApplicationById };