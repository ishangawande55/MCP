const Credential = require('../../models/Credential');
const Application = require('../../models/Application');

exports.getCredentialByQR = async (req, res) => {
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
};