const Application = require('../../models/Application');
const User = require('../../models/User');
const { APPLICATION_STATUS } = require('../../utils/constants');

/**
 * Forward an application from an officer to the department commissioner
 * - Validates officer department
 * - Finds commissioner
 * - Adds DID, publicKey, and forwardedAt
 * - Updates history for audit trail
 */
const assignApplication = async (req, res) => {
  try {
    const application = await Application.findOne({ applicationId: req.params.id });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found.'
      });
    }

    const officer = req.user;

    // Map application types to departments
    const departmentMap = {
      BIRTH: 'HEALTHCARE',
      DEATH: 'HEALTHCARE',
      TRADE_LICENSE: 'LICENSE',
      NOC: 'NOC'
    };
    const expectedDept = departmentMap[application.type];

    if (officer.department !== expectedDept) {
      return res.status(403).json({
        success: false,
        message: `You are not authorized to process ${application.type} applications.`
      });
    }

    // Find commissioner of the department
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

    if (!commissioner.did || !commissioner.publicKey) {
      return res.status(400).json({
        success: false,
        message: 'Commissioner is not provisioned with DID/publicKey. Contact admin.'
      });
    }

    // Forward application
    application.assignedOfficer = officer._id;
    application.forwardedCommissioner = commissioner._id;
    application.forwardedCommissionerDID = commissioner.did;
    application.forwardedCommissionerPublicKey = commissioner.publicKey;
    application.department = officer.department;
    application.status = APPLICATION_STATUS.FORWARDED_TO_COMMISSIONER;
    application.forwardedAt = new Date();
    application.updatedAt = new Date();

    // Maintain audit/history
    if (!Array.isArray(application.history)) application.history = [];
    application.history.push({
      action: 'FORWARDED_TO_COMMISSIONER',
      by: {
        id: officer._id,
        name: officer.name,
        did: officer.did || null,
        role: officer.role
      },
      to: {
        id: commissioner._id,
        name: commissioner.name,
        did: commissioner.did
      },
      at: application.forwardedAt,
      note: `Forwarded ${application.type} application to ${officer.department} commissioner`
    });

    await application.save();

    res.json({
      success: true,
      message: `Application forwarded to ${officer.department} commissioner successfully.`,
      data: {
        application,
        officer: {
          id: officer._id,
          name: officer.name,
          department: officer.department,
          did: officer.did || null
        },
        forwardedTo: {
          id: commissioner._id,
          name: commissioner.name,
          did: commissioner.did,
          publicKey: commissioner.publicKey
        },
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