const Credential = require('../../models/Credential');
const Application = require('../../models/Application');
const blockchainService = require('../../services/blockchainService');

// Build only immutable fields for verification (same as issuance)
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

exports.verifyCredential = async (req, res) => {
  try {
    const { credentialId } = req.body;
    if (!credentialId) {
      return res.status(400).json({ success: false, message: 'Credential ID is required.' });
    }

    // Fetch credential from MongoDB
    const mongoCredential = await Credential.findOne({ credentialId }).populate("issuer", "name department");
    if (!mongoCredential) {
      return res.status(404).json({ success: false, message: 'Credential not found.' });
    }

    // Fetch application to rebuild immutable object
    const application = await Application.findOne({ applicationId: mongoCredential.applicationId });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Associated application not found.' });
    }

    // Rebuild immutable object for hash
    const immutableObj = buildImmutableCredentialObject(application, credentialId);

    // Recalculate hash exactly like during issuance
    const documentHashBytes32 = blockchainService.generateHash(immutableObj);

    // Verify on blockchain
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
    res.status(500).json({ success: false, message: 'Server error during verification.', error: error.message });
  }
};