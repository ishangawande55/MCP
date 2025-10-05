const express = require('express');
const auth = require('../middleware/auth');
const { requireOfficer } = require('../middleware/roleCheck');
const Application = require('../models/Application');
const { APPLICATION_STATUS, APPLICATION_TYPES } = require('../utils/constants');

const router = express.Router();

// @desc    Create new application (Citizen submission)
// @route   POST /api/applications
// @access  Public (or could add basic auth for citizens)
router.post('/', async (req, res) => {
  try {
    const { type, applicant, ...typeSpecificData } = req.body;

    // Validate application type
    if (!Object.values(APPLICATION_TYPES).includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid application type.'
      });
    }

    // Generate unique application ID
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const applicationId = `${type}-${timestamp}-${random}`;

    // Create application data structure
    const applicationData = {
      applicationId,
      type,
      applicant,
      status: APPLICATION_STATUS.PENDING
    };

    // Add type-specific data
    if (type === 'BIRTH') {
      applicationData.birthDetails = typeSpecificData;
    } else if (type === 'DEATH') {
      applicationData.deathDetails = typeSpecificData;
    } else if (type === 'TRADE_LICENSE') {
      applicationData.tradeDetails = typeSpecificData;
    } else if (type === 'NOC') {
      applicationData.nocDetails = typeSpecificData;
    }

    const application = new Application(applicationData);
    await application.save();

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: {
        application: {
          id: application._id,
          applicationId: application.applicationId,
          type: application.type,
          status: application.status,
          createdAt: application.createdAt
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
});

// @desc    Get all applications (with filtering)
// @route   GET /api/applications
// @access  Private/Officer
router.get('/', auth, requireOfficer, async (req, res) => {
  try {
    const { status, type, page = 1, limit = 10 } = req.query;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    // Pagination
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
});

// @desc    Get single application
// @route   GET /api/applications/:id
// @access  Private/Officer
router.get('/:id', auth, requireOfficer, async (req, res) => {
  try {
    const application = await Application.findOne({ 
      $or: [
        { _id: req.params.id },
        { applicationId: req.params.id }
      ]
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
});

// @desc    Assign application to officer
// @route   PUT /api/applications/:id/assign
// @access  Private/Officer
router.put('/:id/assign', auth, requireOfficer, async (req, res) => {
  try {
    const application = await Application.findOne({ applicationId: req.params.id });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found.'
      });
    }

    application.assignedOfficer = req.user._id;
    application.status = APPLICATION_STATUS.UNDER_REVIEW;
    application.updatedAt = new Date();

    await application.save();

    res.json({
      success: true,
      message: 'Application assigned successfully',
      data: { application }
    });

  } catch (error) {
    console.error('Assign Application Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during assignment.'
    });
  }
});

// @desc    Review application (Approve/Reject)
// @route   PUT /api/applications/:id/review
// @access  Private/Officer
router.put('/:id/review', auth, requireOfficer, async (req, res) => {
  try {
    const { status, comments } = req.body;

    if (![APPLICATION_STATUS.APPROVED, APPLICATION_STATUS.REJECTED].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be APPROVED or REJECTED.'
      });
    }

    const application = await Application.findOne({
      applicationId: req.params.id,
      assignedOfficer: req.user._id
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found or not assigned to you.'
      });
    }

    application.status = status;
    application.reviewComments = comments;
    application.updatedAt = new Date();

    await application.save();

    res.json({
      success: true,
      message: `Application ${status.toLowerCase()} successfully`,
      data: { application }
    });

  } catch (error) {
    console.error('Review Application Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during review.'
    });
  }
});

// @desc    Get application statistics
// @route   GET /api/applications/stats/dashboard
// @access  Private/Officer
router.get('/stats/dashboard', auth, requireOfficer, async (req, res) => {
  try {
    const stats = await Application.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalApplications = await Application.countDocuments();
    const assignedToMe = await Application.countDocuments({ 
      assignedOfficer: req.user._id,
      status: { $in: [APPLICATION_STATUS.UNDER_REVIEW, APPLICATION_STATUS.PENDING] }
    });

    const statusCounts = {};
    stats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
    });

    res.json({
      success: true,
      data: {
        totalApplications,
        assignedToMe,
        statusCounts
      }
    });

  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching dashboard statistics.'
    });
  }
});

module.exports = router;