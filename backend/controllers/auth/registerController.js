const crypto = require('crypto');
const User = require('../../models/User');
const { vaultClient, getPublicKey } = require('../../services/vaultService');

/**
 * Helper: Generate a unique DID and RSA key pair
 * Note: Private keys for commissioners should NOT be stored locally in production.
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
 * Register a new user in the system.
 * Roles: APPLICANT, OFFICER, COMMISSIONER
 * Commissioners will use Vault for signing VCs; private keys are not stored locally.
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

    // --------------------------
    // 1️⃣ Validate mandatory fields
    // --------------------------
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
      });
    }

    const assignedRole = role || 'APPLICANT';

    // APPLICANT must provide phone & address
    if (assignedRole === 'APPLICANT' && (!phone || !address)) {
      return res.status(400).json({
        success: false,
        message: 'Phone and address are required for applicants.',
      });
    }

    // OFFICER / COMMISSIONER must provide department
    if ((assignedRole === 'OFFICER' || assignedRole === 'COMMISSIONER') && !department) {
      return res.status(400).json({
        success: false,
        message: 'Department is required for OFFICER or COMMISSIONER.',
      });
    }

    // COMMISSIONER must provide blockchain address
    if (assignedRole === 'COMMISSIONER' && !blockchainAddress) {
      return res.status(400).json({
        success: false,
        message: 'Blockchain address is required for COMMISSIONER.',
      });
    }

    // --------------------------
    // 2️⃣ Generate DID and key info
    // --------------------------
    let did, publicKeyPem, privateKeyPem;

    if (assignedRole === 'COMMISSIONER') {
      // Commissioners: DID + public key from Vault
      const uniqueId = crypto.randomBytes(8).toString('hex');
      did = `did:mcp:${uniqueId}`;

      try {
        publicKeyPem = await getPublicKey('mcp-signing-key'); // Vault Transit key
      } catch (err) {
        console.error('Error fetching public key from Vault:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch signing key from Vault.',
        });
      }

      // Private key is never stored locally
      privateKeyPem = undefined;
    } else if (assignedRole === 'APPLICANT') {
      // Applicants: generate DID & local RSA key pair (for demo purposes)
      const keyData = generateDIDAndKeys();
      did = keyData.did;
      publicKeyPem = keyData.publicKeyPem;
      privateKeyPem = keyData.privateKeyPem;
    }

    // --------------------------
    // 3️⃣ Check if user already exists
    // --------------------------
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists.',
      });
    }

    // --------------------------
    // 4️⃣ Prepare user object
    // --------------------------
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
    };

    // Save user to MongoDB
    const user = new User(userData);
    await user.save();

    // --------------------------
    // 5️⃣ Prepare response (include private key only for applicants)
    // --------------------------
    const responseData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      blockchainAddress: user.blockchainAddress,
      ...(assignedRole === 'APPLICANT' && { phone, address }),
      ...(did && { did }),
      ...(publicKeyPem && { publicKey: publicKeyPem }),
      ...(privateKeyPem && { privateKey: privateKeyPem }), // DO NOT include for Commissioners
    };

    res.status(201).json({
      success: true,
      message: `${assignedRole} registered successfully`,
      data: responseData,
    });
  } catch (error) {
    console.error('User Registration Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during user registration.',
    });
  }
};