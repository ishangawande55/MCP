/**
 * @file createApplicationController.js
 * @author
 * Ishan Rajeshwar Gawande
 * @description
 * Controller to handle creation of municipal applications (Birth, Death,
 * Trade License, NOC) by registered applicants.
 * Integrates Zero-Knowledge Proofs (ZKP) and Selective Disclosure (SD)
 * for sensitive fields.
 * Maintains application history, type-specific details, and persists data
 * in MongoDB.
 * -----------------------------------------------------------------------------
 * Key Features:
 *  - Authorization check for APPLICANT role
 *  - Validation of application type
 *  - Automatic department assignment
 *  - Unique application ID generation
 *  - ZKP proof generation using aligned circuit input order
 *  - Application is NOT saved if ZKP generation fails
 *  - Selective disclosure fields stored for later VC issuance
 *  - Returns disclosed fields in response for applicant acknowledgment
 */

const Application = require('../../models/Application');
const ZKPService = require('../../services/ZKPService');
const { APPLICATION_STATUS, APPLICATION_TYPES } = require('../../utils/constants');

/**
 * Create a new municipal application submitted by an authenticated APPLICANT.
 * Handles selective disclosure, type-specific details, and ZKP proof generation.
 */
const createApplication = async (req, res) => {
  try {
    const user = req.user; // Auth middleware injects authenticated user

    // --------------------------
    // Authorization check
    // --------------------------
    if (!user || user.role !== 'APPLICANT') {
      return res.status(403).json({
        success: false,
        message: 'Only applicants can create applications.',
      });
    }

    // --------------------------
    // Extract request data
    // --------------------------
    const {
      type,
      birthDetails,
      deathDetails,
      tradeDetails,
      nocDetails,
      supportingDocuments,
      disclosedFields = [], // Fields applicant allows to disclose
    } = req.body;

    // --------------------------
    // Validate application type
    // --------------------------
    if (!Object.values(APPLICATION_TYPES).includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid application type.',
      });
    }

    // --------------------------
    // Determine department automatically based on type
    // --------------------------
    const departmentMap = {
      BIRTH: 'HEALTHCARE',
      DEATH: 'HEALTHCARE',
      TRADE_LICENSE: 'LICENSE',
      NOC: 'NOC',
    };
    const department = departmentMap[type];

    // --------------------------
    // Generate unique application ID
    // --------------------------
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const applicationId = `${type}-${timestamp}-${random}`;

    // --------------------------
    // Build base application object
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
      userId: user._id,
      status: APPLICATION_STATUS.PENDING,
      supportingDocuments: supportingDocuments || [],
      disclosedFields, // Store applicant's disclosure choices in schema
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
    // Add type-specific details
    // --------------------------
    switch (type) {
      case 'BIRTH':
        applicationData.birthDetails = birthDetails || {};
        break;
      case 'DEATH':
        applicationData.deathDetails = deathDetails || {};
        break;
      case 'TRADE_LICENSE':
        applicationData.tradeDetails = tradeDetails || {};
        break;
      case 'NOC':
        applicationData.nocDetails = nocDetails || {};
        break;
    }

    // --------------------------
    // Generate ZKP proof and Merkle root
    // --------------------------
    try {
      const zkpResult = await ZKPService.generateProofFromApplication(applicationData);

      applicationData.zkpProof = zkpResult.proof;
      applicationData.publicSignals = zkpResult.publicSignals;
      applicationData.merkleRoot = zkpResult.merkleRoot;
    } catch (zkError) {
      console.error('ZKP Generation Error:', zkError);
      return res.status(400).json({
        success: false,
        message: 'Application creation failed: Zero-Knowledge Proof generation error.',
        error: zkError.message,
      });
    }

    // --------------------------
    // Save application to MongoDB
    // --------------------------
    const application = new Application(applicationData);
    await application.save();

    // --------------------------
    // Prepare response with type-specific details and disclosed fields
    // --------------------------
    const typeDetails = {
      birthDetails: application.birthDetails,
      deathDetails: application.deathDetails,
      tradeDetails: application.tradeDetails,
      nocDetails: application.nocDetails,
    };

    return res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: {
        application: {
          id: application._id,
          applicationId: application.applicationId,
          type: application.type,
          department: application.department,
          status: application.status,
          merkleRoot: application.merkleRoot || null,
          disclosedFields: application.disclosedFields, // Returned for applicant acknowledgment
          createdAt: application.createdAt,
          ...typeDetails,
        },
      },
    });
  } catch (error) {
    console.error('Create Application Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during application submission.',
      error: error.message,
    });
  }
};

module.exports = { createApplication };