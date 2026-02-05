const crypto = require('crypto');

/**
 * Generate a cryptographically secure anonymous ID (128-bit)
 * @returns {string} Base64url encoded anonymous ID
 */
function generateAnonymousId() {
  return crypto.randomBytes(16).toString('base64url');
}

/**
 * Generate a short, unique share token (8 alphanumeric characters)
 * @returns {string} Share token
 */
function generateShareToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(8);
  let token = '';

  for (let i = 0; i < 8; i++) {
    token += chars[bytes[i] % chars.length];
  }

  return token;
}

/**
 * Generate a unique share token with collision retry logic
 * @param {Function} checkExists - Async function to check if token exists
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<string>} Unique share token
 */
async function generateUniqueShareToken(checkExists, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    const token = generateShareToken();
    const exists = await checkExists(token);

    if (!exists) {
      return token;
    }
  }

  throw new Error('Failed to generate unique share token after multiple attempts');
}

module.exports = {
  generateAnonymousId,
  generateShareToken,
  generateUniqueShareToken
};
