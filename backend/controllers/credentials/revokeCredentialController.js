const Credential = require('../../models/Credential');
const blockchainService = require('../../services/blockchainService');

exports.revokeCredential = async (req, res) => {
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
};