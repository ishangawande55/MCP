const express = require('express');
const ethers = require("ethers");
const auth = require('../middleware/auth');
const { requireOfficer } = require('../middleware/roleCheck');
const Application = require('../models/Application');
const Credential = require('../models/Credential');
const blockchainService = require('../services/blockchainService');
const ipfsService = require('../services/ipfsService');
const pdfService = require('../services/pdfService');
const { APPLICATION_STATUS } = require('../utils/constants');
const fs = require('fs');

const router = express.Router();

/**
 * Helper function to build a normalized credential object
 * Ensures consistent data structure for PDF, blockchain hash, and MongoDB
 */
function buildCredentialObject(application, credentialId, ipfsCID = '', blockchainTxHash = '') {
  return {
    credentialId,
    type: application.type,
    recipient: {
      name: application.applicant.name,
      email: application.applicant.email,
      phone: application.applicant.phone
    },
    applicationDetails: {
      applicationId: application.applicationId,
      type: application.type,
      applicant: application.applicant,
      supportingDocuments: application.supportingDocuments || [],
      assignedOfficer: application.assignedOfficer?.toString(),
      status: application.status,
      reviewComments: application.reviewComments || [],
      createdAt: application.createdAt?.toISOString(),
      updatedAt: application.updatedAt?.toISOString()
    },
    ipfsCID,
    blockchainTxHash
  };
}

// ==============================
// ISSUE CREDENTIAL
// ==============================
router.post('/issue/:applicationId', auth, requireOfficer, async (req, res) => {
  try {
    const { applicationId } = req.params;

    // Find the approved application assigned to the officer
    const application = await Application.findOne({
      applicationId,
      status: APPLICATION_STATUS.APPROVED,
      assignedOfficer: req.user._id
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Approved application not found or not assigned to you.'
      });
    }

    // Generate unique credential ID
    const credentialId = `CRED-${applicationId}-${Date.now()}`;

    // Step 1: Build normalized credential object (initial, without IPFS & blockchain hash)
    let credentialObj = buildCredentialObject(application, credentialId);

    // Step 2: Generate PDF certificate with initial object
    const tempPdfPath = await pdfService.generateCertificate(credentialObj, application);

    // Step 3: Upload PDF to IPFS
    const ipfsCID = await ipfsService.uploadFile(tempPdfPath);
    credentialObj.ipfsCID = ipfsCID; // update IPFS CID

    // Step 4: Generate blockchain hash of the credential object
    const documentHash = blockchainService.generateHash(credentialObj);

    // Step 5: Anchor credential on blockchain
    const blockchainResult = await blockchainService.issueCredential(
      credentialId,
      documentHash,
      ipfsCID,
      0 // No expiry for now
    );

    if (blockchainResult.status !== 'SUCCESS') {
      throw new Error('Blockchain transaction failed');
    }
    credentialObj.blockchainTxHash = blockchainResult.transactionHash; // update blockchain hash

    // Step 6: Save credential in MongoDB
    const credential = new Credential({
      credentialId,
      applicationId: application.applicationId,
      type: application.type,
      recipient: credentialObj.recipient,
      documentHash,
      ipfsCID,
      blockchainTxHash: blockchainResult.transactionHash,
      issuer: req.user._id,
      issueDate: new Date(),
      status: 'ACTIVE'
    });
    await credential.save();

    // Step 7: Update application status
    application.status = APPLICATION_STATUS.ISSUED;
    application.updatedAt = new Date();
    await application.save();

    // Step 8: Regenerate PDF with final IPFS CID & blockchain hash for response
    const finalPdfPath = await pdfService.generateCertificate(credentialObj, application);
    const pdfBuffer = fs.readFileSync(finalPdfPath);
    fs.unlinkSync(finalPdfPath); // clean up temp file

    res.json({
      success: true,
      message: 'Credential issued successfully',
      data: {
        credential: {
          id: credential._id,
          credentialId: credential.credentialId,
          type: credential.type,
          ipfsCID: credential.ipfsCID,
          blockchainTxHash: credential.blockchainTxHash,
          issueDate: credential.issueDate
        },
        pdf: pdfBuffer.toString('base64'),
        downloadUrl: `/api/credentials/download/${credential.credentialId}`
      }
    });

  } catch (error) {
    console.error('Issue Credential Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during credential issuance: ' + error.message
    });
  }
});

// ==============================
// DOWNLOAD CREDENTIAL PDF
// ==============================
router.get('/download/:credentialId', async (req, res) => {
  try {
    const { credentialId } = req.params;
    const credential = await Credential.findOne({ credentialId });
    if (!credential) {
      return res.status(404).json({ success: false, message: 'Credential not found.' });
    }

    const application = await Application.findOne({ applicationId: credential.applicationId });
    const credentialObj = buildCredentialObject(application, credentialId, credential.ipfsCID, credential.blockchainTxHash);

    const tempPdfPath = await pdfService.generateCertificate(credentialObj, application);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${credential.credentialId}.pdf`);

    const pdfStream = fs.createReadStream(tempPdfPath);
    pdfStream.pipe(res);
    pdfStream.on('end', () => fs.unlinkSync(tempPdfPath));

  } catch (error) {
    console.error('Download Credential Error:', error);
    res.status(500).json({ success: false, message: 'Server error during download.' });
  }
});

// ==============================
// VERIFY CREDENTIAL
// ==============================
router.post('/verify', async (req, res) => {
  try {
    const { credentialId } = req.body;
    if (!credentialId) {
      return res.status(400).json({ success: false, message: 'Credential ID is required.' });
    }

    // 1. Fetch from DB
    const mongoCredential = await Credential.findOne({ credentialId }).populate("issuer", "name department");
    if (!mongoCredential) {
      return res.status(404).json({ success: false, message: 'Credential not found.' });
    }

    // 2. Fetch related application
    const application = await Application.findOne({ applicationId: mongoCredential.applicationId });

    // 3. Build full object (recipient + applicationDetails)
    const credentialObj = buildCredentialObject(
      application,
      credentialId,
      mongoCredential.ipfsCID,
      mongoCredential.blockchainTxHash
    );

    // 4. Generate the same hash as issuance
    const documentHashBytes32 = blockchainService.generateHash(credentialObj);

    // 5. Verify against blockchain
    const isValid = await blockchainService.verifyCredential(credentialId, documentHashBytes32);

    res.json({
      success: true,
      message: isValid ? 'Credential is valid and untampered.' : 'Credential is invalid or tampered.',
      data: {
        isValid,
        credential: {
          id: mongoCredential._id,
          credentialId: mongoCredential.credentialId,
          type: mongoCredential.type,
          recipient: mongoCredential.recipient,
          issuer: mongoCredential.issuer,
          ipfsCID: mongoCredential.ipfsCID,
          blockchainTxHash: mongoCredential.blockchainTxHash,
          issueDate: mongoCredential.issueDate,
          status: mongoCredential.status
        }
      }
    });

  } catch (error) {
    console.error('Blockchain Verify Credential Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during verification.',
      error: error.message
    });
  }
});

// ==============================
// GET CREDENTIAL BY QR
// ==============================
router.get('/qr/:credentialId', async (req, res) => {
  try {
    const { credentialId } = req.params;
    const credential = await Credential.findOne({ credentialId }).populate('issuer', 'name department');
    if (!credential) return res.status(404).json({ success: false, message: 'Credential not found.' });

    const application = await Application.findOne({ applicationId: credential.applicationId });

    res.json({
      success: true,
      data: {
        credential: {
          id: credential._id,
          credentialId: credential.credentialId,
          type: credential.type,
          recipient: credential.recipient,
          issuer: credential.issuer,
          issueDate: credential.issueDate,
          ipfsCID: credential.ipfsCID,
          blockchainTxHash: credential.blockchainTxHash,
          applicationDetails: application
        },
        verificationUrl: `${process.env.FRONTEND_URL}/verify/${credential.credentialId}`
      }
    });

  } catch (error) {
    console.error('QR Credential Error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching credential data.' });
  }
});

// ==============================
// GET ALL CREDENTIALS
// ==============================
router.get('/', auth, requireOfficer, async (req, res) => {
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
});

// ==============================
// REVOKE CREDENTIAL
// ==============================
router.put('/revoke/:credentialId', auth, requireOfficer, async (req, res) => {
  try {
    const { credentialId } = req.params;
    const { reason } = req.body;

    const credential = await Credential.findOne({ credentialId });
    if (!credential) return res.status(404).json({ success: false, message: 'Credential not found.' });

    const blockchainResult = await blockchainService.revokeCredential(credentialId);
    if (blockchainResult.status !== 'SUCCESS') throw new Error('Blockchain revocation failed');

    credential.status = 'REVOKED';
    credential.revocationReason = reason;
    await credential.save();

    res.json({ success: true, message: 'Credential revoked successfully', data: { credential, blockchainTxHash: blockchainResult.transactionHash } });

  } catch (error) {
    console.error('Revoke Credential Error:', error);
    res.status(500).json({ success: false, message: 'Server error during revocation: ' + error.message });
  }
});

module.exports = router;