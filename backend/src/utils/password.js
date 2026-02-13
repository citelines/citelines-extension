/**
 * Password utilities for secure authentication
 *
 * - bcrypt hashing (12 rounds)
 * - Password strength validation
 * - Secure token generation for email verification and password reset
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');

const SALT_ROUNDS = 12;  // 12 rounds = ~600ms to hash (current standard)

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Bcrypt hash
 * @throws {Error} - If password doesn't meet strength requirements
 */
async function hashPassword(password) {
  // Validate password strength
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  // Check for mixed case and numbers
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasUpperCase || !hasLowerCase || !hasNumber) {
    throw new Error('Password must contain uppercase, lowercase, and numbers');
  }

  // Hash with bcrypt (includes salt automatically)
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against its hash
 * @param {string} password - Plain text password
 * @param {string} hash - Bcrypt hash
 * @returns {Promise<boolean>} - True if password matches
 */
async function verifyPassword(password, hash) {
  if (!password || !hash) {
    return false;
  }

  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('[Password] Error verifying password:', error);
    return false;
  }
}

/**
 * Generate a secure random token
 * Used for email verification and password reset
 * @param {number} length - Byte length (default: 32 = 256 bits)
 * @returns {string} - Base64URL encoded token
 */
function generateToken(length = 32) {
  return crypto
    .randomBytes(length)
    .toString('base64url');  // URL-safe base64 (no +, /, =)
}

/**
 * Validate password strength (without hashing)
 * @param {string} password - Plain text password
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validatePasswordStrength(password) {
  const errors = [];

  if (!password) {
    errors.push('Password is required');
    return { valid: false, errors };
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Optional: Check for special characters
  // if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
  //   errors.push('Password must contain at least one special character');
  // }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  validatePasswordStrength
};
