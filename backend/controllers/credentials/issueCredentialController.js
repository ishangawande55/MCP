const fs = require('fs');
const Application = require('../../models/Application');
const Credential = require('../../models/Credential');
const blockchainService = require('../../services/blockchainService');
const ipfsService = require('../../services/ipfsService');
const pdfService = require('../../services/pdfService');
const { APPLICATION_STATUS } = require('../../utils/constants');

// Build only immutable fields for hashing
function buildImmutableCredentialObject(application, credentialId) {
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
      birthDetails: application.birthDetails || undefined,
      deathDetails: application.deathDetails || undefined,
      tradeDetails: application.tradeDetails || undefined,
      nocDetails: application.nocDetails || undefined,
      createdAt: application.createdAt?.toISOString()
    }
  };
}

exports.issueCredential = async (req, res) => {
  try {
    const { applicationId } = req.params;

    // Ensure only Commissioners can issue credentials
    if (req.user.role !== 'COMMISSIONER') {
      return res.status(403).json({ success: false, message: 'Only Commissioners can issue credentials.' });
    }

    const application = await Application.findOne({
      applicationId,
      status: APPLICATION_STATUS.APPROVED,
      department: req.user.department
    });

    if (!application) {
      return res.status(404).json({ success: false, message: 'Approved application not found for your department.' });
    }

    const credentialId = `CRED-${applicationId}-${Date.now()}`;
    const immutableObj = buildImmutableCredentialObject(application, credentialId);

    // Generate PDF from the immutable object
    const tempPdfPath = await pdfService.generateCertificate(immutableObj, application);

    // Upload PDF to IPFS (optional, can be used for download)
    const ipfsCID = await ipfsService.uploadFile(tempPdfPath);

    // Generate hash ONLY from immutable object
    const documentHash = blockchainService.generateHash(immutableObj);

    // Store credential on blockchain
    const blockchainResult = await blockchainService.issueCredential(credentialId, documentHash, ipfsCID, 0);
    if (blockchainResult.status !== 'SUCCESS') throw new Error('Blockchain transaction failed');

    // Save credential in MongoDB
    const credential = new Credential({
      credentialId,
      applicationId: application.applicationId,
      type: application.type,
      recipient: immutableObj.recipient,
      documentHash,
      ipfsCID,
      blockchainTxHash: blockchainResult.transactionHash,
      issuer: req.user._id,
      issueDate: new Date(),
      status: 'ACTIVE'
    });
    await credential.save();

    // Update application status
    application.status = APPLICATION_STATUS.ISSUED;
    application.updatedAt = new Date();
    await application.save();

    // Return PDF as base64
    const pdfBuffer = fs.readFileSync(tempPdfPath);
    fs.unlinkSync(tempPdfPath);

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
    res.status(500).json({ success: false, message: 'Server error during credential issuance: ' + error.message });
  }
};