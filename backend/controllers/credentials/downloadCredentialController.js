const fs = require('fs');
const Credential = require('../../models/Credential');
const Application = require('../../models/Application');
const pdfService = require('../../services/pdfService');

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

exports.downloadCredential = async (req, res) => {
  try {
    const { credentialId } = req.params;
    const credential = await Credential.findOne({ credentialId });
    if (!credential) return res.status(404).json({ success: false, message: 'Credential not found.' });

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
};