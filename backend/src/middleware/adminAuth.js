/**
 * Admin Authentication Middleware
 * Verifies user has admin privileges
 */

const { authenticateAnonymous, optionalAuth } = require('./auth');

/**
 * Require admin privileges
 * Must be used after authenticateAnonymous or optionalAuth
 */
const requireAdmin = async (req, res, next) => {
  // First ensure user is authenticated
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'You must be logged in to access admin functions'
    });
  }

  // Check if user is admin
  if (!req.user.is_admin) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin privileges required'
    });
  }

  next();
};

/**
 * Combined middleware: authenticate + require admin
 */
const authenticateAdmin = [authenticateAnonymous, requireAdmin];

module.exports = {
  requireAdmin,
  authenticateAdmin
};
