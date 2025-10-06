const Application = require('../../models/Application');
const User = require('../../models/User');
const { APPLICATION_STATUS } = require('../../utils/constants');

const assignApplication = async (req, res) => {
  try {
    const application = await Application.findOne({ applicationId: req.params.id });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found.'
      });
    }

    // Officer who is updating (current logged-in user)
    const officer = req.user;

    // Map application types to departments
    const departmentMap = {
      BIRTH: 'HEALTHCARE',
      DEATH: 'HEALTHCARE',
      TRADE_LICENSE: 'LICENSE',
      NOC: 'NOC'
    };

    const expectedDept = departmentMap[application.type];

    // Validate officer’s department
    if (officer.department !== expectedDept) {
      return res.status(403).json({
        success: false,
        message: `You are not authorized to process ${application.type} applications.`
      });
    }

    // Find commissioner of same department
    const commissioner = await User.findOne({
      department: officer.department,
      role: 'COMMISSIONER'
    });

    if (!commissioner) {
      return res.status(404).json({
        success: false,
        message: 'No commissioner found for this department.'
      });
    }

    // Update and forward application
    application.assignedOfficer = officer._id;
    application.forwardedCommissioner = commissioner._id;
    application.department = officer.department;
    application.status = APPLICATION_STATUS.FORWARDED_TO_COMMISSIONER;
    application.updatedAt = new Date();

    await application.save();

    res.json({
      success: true,
      message: `Application forwarded to ${officer.department} commissioner successfully.`,
      data: {
        application,
        officer: officer.name,
        forwardedTo: commissioner.name,
        department: officer.department
      }
    });

  } catch (error) {
    console.error('Assign Application Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during application forwarding.'
    });
  }
};

module.exports = { assignApplication };