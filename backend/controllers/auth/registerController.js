const crypto = require('crypto');
const User = require('../../models/User');
const { setupCommissionerVaultAccess } = require('../../services/vaultAutomationService');
const { getPublicKey } = require('../../services/vaultService');

/**
 * Helper: Generate a unique DID and RSA key pair
 * Used only for demo applicants (NOT for commissioners in production)
 */
function generateDIDAndKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  const publicKeyPem = publicKey.export({ type: 'pkcs1', format: 'pem' });
  const privateKeyPem = privateKey.export({ type: 'pkcs1', format: 'pem' });

  const uniqueId = crypto.randomBytes(8).toString('hex');
  const did = `did:mcp:${uniqueId}`;

  return { did, publicKeyPem, privateKeyPem };
}

/**
 * Controller: Register a new user in the MCP ecosystem
 * Supports roles: APPLICANT, OFFICER, COMMISSIONER
 * - Applicants get local RSA key pair (demo)
 * - Commissioners get automated Vault-managed keys
 */
exports.registerUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      department,
      blockchainAddress,
      role,
      phone,
      address,
    } = req.body;

    // -----------------------------
    // Validate input data
    // -----------------------------
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
      });
    }

    const assignedRole = role || 'APPLICANT';

    if (assignedRole === 'APPLICANT' && (!phone || !address)) {
      return res.status(400).json({
        success: false,
        message: 'Phone and address are required for applicants.',
      });
    }

    if (
      (assignedRole === 'OFFICER' || assignedRole === 'COMMISSIONER') &&
      !department
    ) {
      return res.status(400).json({
        success: false,
        message: 'Department is required for OFFICER or COMMISSIONER.',
      });
    }

    if (assignedRole === 'COMMISSIONER' && !blockchainAddress) {
      return res.status(400).json({
        success: false,
        message: 'Blockchain address is required for COMMISSIONER.',
      });
    }

    // -----------------------------
    //  Check for existing user
    // -----------------------------
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists.',
      });
    }

    // -----------------------------
    //  Generate DID and keys
    // -----------------------------
    let did, publicKeyPem, privateKeyPem, vaultMeta;

    if (assignedRole === 'COMMISSIONER') {
      // Create unique DID for commissioner
      const uniqueId = crypto.randomBytes(8).toString('hex');
      did = `did:mcp:${uniqueId}`;

      try {
        // Setup Vault automation (creates key, policy, and token)
        vaultMeta = await setupCommissionerVaultAccess(uniqueId);

        // Fetch public key from Vault using the commissioner’s scoped token
        publicKeyPem = await getPublicKey(vaultMeta.token, vaultMeta.keyName);
      } catch (err) {
        console.error('Vault automation failed:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to configure commissioner signing access in Vault.',
        });
      }

      // Private key is never stored locally for commissioners
      privateKeyPem = undefined;
    } else if (assignedRole === 'APPLICANT') {
      // Applicants get local RSA keys (demo)
      const keyData = generateDIDAndKeys();
      did = keyData.did;
      publicKeyPem = keyData.publicKeyPem;
      privateKeyPem = keyData.privateKeyPem;
    } else {
      // Officers or admins just get a DID
      const uniqueId = crypto.randomBytes(8).toString('hex');
      did = `did:mcp:${uniqueId}`;
    }

    // -----------------------------
    //  Save new user
    // -----------------------------
    const userData = {
      name,
      email,
      password,
      role: assignedRole,
      department: department || undefined,
      blockchainAddress: blockchainAddress || undefined,
      ...(assignedRole === 'APPLICANT' && { phone, address }),
      ...(did && { did }),
      ...(publicKeyPem && { publicKey: publicKeyPem }),
      ...(vaultMeta && { vault: vaultMeta }), // attach vault info if available
    };

    const user = new User(userData);
    await user.save();

    // -----------------------------
    //  Respond with safe data
    // -----------------------------
    const responseData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      blockchainAddress: user.blockchainAddress,
      did,
      publicKey: publicKeyPem,
      ...(assignedRole === 'APPLICANT' && { privateKey: privateKeyPem }), // only for demo
      ...(vaultMeta && {
        vault: {
          keyName: vaultMeta.keyName,
          policyName: vaultMeta.policyName,
          createdAt: vaultMeta.createdAt,
          scopedToken: true, // confirmation flag
        },
      }),
    };

    res.status(201).json({
      success: true,
      message: `${assignedRole} registered successfully.`,
      data: responseData,
    });
  } catch (error) {
    console.error('User Registration Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during user registration.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};