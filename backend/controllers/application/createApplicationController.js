const Application = require('../../models/Application');
const { APPLICATION_STATUS, APPLICATION_TYPES } = require('../../utils/constants');

const createApplication = async (req, res) => {
  try {
    const {
      type,
      applicant,
      birthDetails,
      deathDetails,
      tradeDetails,
      nocDetails,
      supportingDocuments
    } = req.body;

    // Validate application type
    if (!Object.values(APPLICATION_TYPES).includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid application type.'
      });
    }

    // Map type → department automatically
    const departmentMap = {
      BIRTH: 'HEALTHCARE',
      DEATH: 'HEALTHCARE',
      TRADE_LICENSE: 'LICENSE',
      NOC: 'NOC'
    };
    const department = departmentMap[type];

    // Generate unique application ID
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const applicationId = `${type}-${timestamp}-${random}`;

    // Base application data
    const applicationData = {
      applicationId,
      type,
      department,
      applicant,
      status: APPLICATION_STATUS.PENDING,
      supportingDocuments: supportingDocuments || []
    };

    // Assign type-specific details
    let typeDetails = {};
    if (type === 'BIRTH') {
      applicationData.birthDetails = birthDetails;
      typeDetails = { birthDetails };
    }
    if (type === 'DEATH') {
      applicationData.deathDetails = deathDetails;
      typeDetails = { deathDetails };
    }
    if (type === 'TRADE_LICENSE') {
      applicationData.tradeDetails = tradeDetails;
      typeDetails = { tradeDetails };
    }
    if (type === 'NOC') {
      applicationData.nocDetails = nocDetails;
      typeDetails = { nocDetails };
    }

    // Save to DB
    const application = new Application(applicationData);
    await application.save();

    // Respond with only relevant type-specific details
    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: {
        application: {
          id: application._id,
          applicationId: application.applicationId,
          type: application.type,
          department: application.department,
          status: application.status,
          createdAt: application.createdAt,
          ...typeDetails, 
        }
      }
    });
  } catch (error) {
    console.error('Create Application Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during application submission.'
    });
  }
};

module.exports = { createApplication };