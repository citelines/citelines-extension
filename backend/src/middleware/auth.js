const User = require('../models/User');

/**
 * Middleware to authenticate requests using X-Anonymous-ID header
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
async function authenticateAnonymous(req, res, next) {
  const anonymousId = req.headers['x-anonymous-id'];

  if (!anonymousId) {
    return res.status(401).json({
      error: 'Missing X-Anonymous-ID header',
      message: 'Anonymous ID is required for authentication'
    });
  }

  try {
    // Find user by anonymous ID
    const user = await User.findByAnonymousId(anonymousId);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid anonymous ID',
        message: 'User not found. Please register first.'
      });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      error: 'Authentication failed',
      message: 'An error occurred during authentication'
    });
  }
}

/**
 * Optional authentication middleware (doesn't fail if no auth provided)
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
async function optionalAuth(req, res, next) {
  const anonymousId = req.headers['x-anonymous-id'];

  if (anonymousId) {
    try {
      const user = await User.findByAnonymousId(anonymousId);
      if (user) {
        req.user = user;
      }
    } catch (error) {
      console.error('Optional auth error:', error);
      // Continue without authentication
    }
  }

  next();
}

module.exports = {
  authenticateAnonymous,
  optionalAuth
};
