const crypto = require('crypto');

/**
 * Generate a simple DID string for the user
 * Format: did:mcp:<role>:<randomHex>
 */
function generateDID(role = 'applicant') {
  const randomHex = crypto.randomBytes(16).toString('hex');
  return `did:mcp:${role.toLowerCase()}:${randomHex}`;
}

module.exports = { generateDID };