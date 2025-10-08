const Application = require('../../models/Application');
const { APPLICATION_STATUS, APPLICATION_TYPES } = require('../../utils/constants');

/**
 * Create a new application submitted by a registered APPLICANT.
 * Only users with role 'APPLICANT' can create applications.
 */
const createApplication = async (req, res) => {
  try {
    const user = req.user; // Auth middleware injects authenticated user

    // --------------------------
    // 1️⃣ Authorization check
    // --------------------------
    if (!user || user.role !== 'APPLICANT') {
      return res.status(403).json({
        success: false,
        message: 'Only applicants can create applications.',
      });
    }

    const {
      type,
      birthDetails,
      deathDetails,
      tradeDetails,
      nocDetails,
      supportingDocuments,
    } = req.body;

    // --------------------------
    // 2️⃣ Validate application type
    // --------------------------
    if (!Object.values(APPLICATION_TYPES).includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid application type.',
      });
    }

    // --------------------------
    // 3️⃣ Determine department automatically
    // --------------------------
    const departmentMap = {
      BIRTH: 'HEALTHCARE',
      DEATH: 'HEALTHCARE',
      TRADE_LICENSE: 'LICENSE',
      NOC: 'NOC',
    };
    const department = departmentMap[type];

    // --------------------------
    // 4️⃣ Generate unique application ID
    // --------------------------
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const applicationId = `${type}-${timestamp}-${random}`;

    // --------------------------
    // 5️⃣ Build base application object
    // --------------------------
    const applicationData = {
      applicationId,
      type,
      department,
      applicant: {
        userId: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        address: user.address || '',
        did: user.did || null,
      },
      userId: user._id, // Reference to applicant
      status: APPLICATION_STATUS.PENDING,
      supportingDocuments: supportingDocuments || [],
      history: [
        {
          action: 'CREATED',
          by: {
            id: user._id,
            name: user.name,
            did: user.did || null,
            role: user.role,
          },
          at: new Date(),
          note: 'Application created by applicant',
        },
      ],
    };

    // --------------------------
    // 6️⃣ Add type-specific details
    // --------------------------
    switch (type) {
      case 'BIRTH':
        applicationData.birthDetails = birthDetails;
        break;
      case 'DEATH':
        applicationData.deathDetails = deathDetails;
        break;
      case 'TRADE_LICENSE':
        applicationData.tradeDetails = tradeDetails;
        break;
      case 'NOC':
        applicationData.nocDetails = nocDetails;
        break;
    }

    // --------------------------
    // 7️⃣ Save application to MongoDB
    // --------------------------
    const application = new Application(applicationData);
    await application.save();

    // --------------------------
    // 8️⃣ Prepare response (include only relevant type-specific details)
    // --------------------------
    const typeDetails = {
      birthDetails: application.birthDetails,
      deathDetails: application.deathDetails,
      tradeDetails: application.tradeDetails,
      nocDetails: application.nocDetails,
    };

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
        },
      },
    });
  } catch (error) {
    console.error('Create Application Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during application submission.',
    });
  }
};

module.exports = { createApplication };