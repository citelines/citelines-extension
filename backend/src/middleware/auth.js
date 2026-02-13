/**
 * Authentication middleware supporting dual authentication:
 * 1. JWT tokens (registered users) - Authorization: Bearer <token>
 * 2. Anonymous IDs (anonymous users) - X-Anonymous-ID: <id>
 *
 * Backwards compatible: existing anonymous users continue working
 */

const User = require('../models/User');
const { verifyToken } = require('../config/jwt');

/**
 * Authenticate user - supports BOTH JWT and anonymous ID
 * Tries JWT first, falls back to anonymous ID
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
async function authenticateUser(req, res, next) {
  try {
    // Strategy 1: Try JWT token first (registered users)
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        const payload = verifyToken(token);
        const user = await User.findById(payload.userId);

        if (user) {
          req.user = user;
          req.authType = 'jwt';
          req.authMethod = 'token';
          return next();
        }
      } catch (err) {
        // Invalid JWT - log and fall through to anonymous
        console.log('[Auth] Invalid JWT token, trying anonymous:', err.message);
      }
    }

    // Strategy 2: Try anonymous ID (anonymous users)
    const anonymousId = req.headers['x-anonymous-id'];

    if (anonymousId) {
      const user = await User.findByAnonymousId(anonymousId);

      if (user) {
        req.user = user;
        req.authType = 'anonymous';
        req.authMethod = 'anonymous_id';
        return next();
      } else {
        // Anonymous ID not found - might be expired/deleted
        return res.status(401).json({
          error: 'Invalid anonymous ID',
          code: 'ANONYMOUS_ID_NOT_FOUND',
          message: 'User not found. Please register first.'
        });
      }
    }

    // No valid authentication found
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please sign in or allow extension to create anonymous account',
      hint: 'Provide either Authorization: Bearer <token> or X-Anonymous-ID: <id>'
    });

  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    return res.status(500).json({
      error: 'Authentication failed',
      message: 'An error occurred during authentication'
    });
  }
}

/**
 * Optional authentication middleware
 * Doesn't fail if no auth provided - just sets req.user if available
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
async function optionalAuth(req, res, next) {
  try {
    // Try JWT first
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        const payload = verifyToken(token);
        const user = await User.findById(payload.userId);

        if (user) {
          req.user = user;
          req.authType = 'jwt';
          req.authMethod = 'token';
          return next();
        }
      } catch (err) {
        // Invalid JWT - continue without auth
      }
    }

    // Try anonymous ID
    if (!req.user) {
      const anonymousId = req.headers['x-anonymous-id'];

      if (anonymousId) {
        const user = await User.findByAnonymousId(anonymousId);

        if (user) {
          req.user = user;
          req.authType = 'anonymous';
          req.authMethod = 'anonymous_id';
        }
      }
    }

    // Continue regardless (user may be null)
    next();

  } catch (error) {
    console.error('[Auth] Optional auth error:', error);
    // Continue without auth
    next();
  }
}

/**
 * Backwards compatible alias for authenticateUser
 * Existing routes using authenticateAnonymous still work
 */
const authenticateAnonymous = authenticateUser;

module.exports = {
  authenticateUser,
  authenticateAnonymous,  // Backwards compatible
  optionalAuth
};
