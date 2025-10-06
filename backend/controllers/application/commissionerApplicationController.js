const Application = require('../../models/Application');
const { APPLICATION_STATUS } = require('../../utils/constants');

/**
 * Commissioner approves or rejects an application
 * req.user => logged-in commissioner
 * req.params.id => applicationId
 * req.body => { action: "APPROVE" | "REJECT", reviewComments: "optional comments" }
 */
const processApplication = async (req, res) => {
  try {
    const { action, reviewComments } = req.body;
    const application = await Application.findOne({ applicationId: req.params.id });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found.'
      });
    }

    const commissioner = req.user;

    // Check if logged-in user is a commissioner
    if (commissioner.role !== 'COMMISSIONER') {
      return res.status(403).json({
        success: false,
        message: 'Only commissioners can process applications.'
      });
    }

    // Ensure the commissioner belongs to the same department
    if (application.forwardedCommissioner.toString() !== commissioner._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'This application is not assigned to you.'
      });
    }

    // Ensure application is in correct status
    if (application.status !== APPLICATION_STATUS.FORWARDED_TO_COMMISSIONER) {
      return res.status(400).json({
        success: false,
        message: 'Application is not ready for commissioner action.'
      });
    }

    // Update application based on action
    if (action === 'APPROVE') {
      application.status = APPLICATION_STATUS.APPROVED;
    } else if (action === 'REJECT') {
      application.status = APPLICATION_STATUS.REJECTED;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use APPROVE or REJECT.'
      });
    }

    application.reviewComments = reviewComments || '';
    application.updatedAt = new Date();

    await application.save();

    res.json({
      success: true,
      message: `Application ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully.`,
      data: application
    });

  } catch (error) {
    console.error('Commissioner Process Application Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing application.'
    });
  }
};

module.exports = { processApplication };