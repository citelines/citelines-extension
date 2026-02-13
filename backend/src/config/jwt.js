/**
 * JWT (JSON Web Token) configuration
 *
 * - Stateless authentication
 * - 30-day token expiry (configurable)
 * - User info embedded in token payload
 */

const jwt = require('jsonwebtoken');

// JWT secret - MUST be set in environment variables for production
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-CHANGE-IN-PRODUCTION';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';  // 30 days

if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'dev-secret-CHANGE-IN-PRODUCTION') {
  console.error('⚠️  WARNING: JWT_SECRET not set in production! Using insecure default.');
}

/**
 * Generate a JWT token for a user
 * @param {Object} user - User object from database
 * @returns {string} - JWT token
 */
function generateToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    authType: user.auth_type,
    displayName: user.display_name,
    iat: Math.floor(Date.now() / 1000)  // Issued at (Unix timestamp)
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
}

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token
 * @returns {Object} - Decoded payload
 * @throws {Error} - If token is invalid or expired
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired. Please sign in again.');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token. Please sign in again.');
    } else {
      throw new Error('Token verification failed.');
    }
  }
}

/**
 * Decode a token without verifying (useful for debugging)
 * @param {string} token - JWT token
 * @returns {Object} - Decoded payload (unverified)
 */
function decodeToken(token) {
  return jwt.decode(token);
}

/**
 * Get token expiration date
 * @param {string} token - JWT token
 * @returns {Date} - Expiration date
 */
function getTokenExpiration(token) {
  const decoded = decodeToken(token);
  if (decoded && decoded.exp) {
    return new Date(decoded.exp * 1000);
  }
  return null;
}

module.exports = {
  generateToken,
  verifyToken,
  decodeToken,
  getTokenExpiration,
  JWT_SECRET  // Export for testing purposes only
};
