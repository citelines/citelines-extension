/**
 * Middleware to check if anonymous user account has expired
 *
 * Flow:
 * 1. User authenticates (anonymous or registered)
 * 2. Check if account expired
 * 3. If expired:
 *    - Mark account as 'expired' (soft delete)
 *    - Citations remain visible with old pseudonym
 *    - Return 401 with specific error code
 *    - Extension creates new anonymous account
 * 4. If not expired or registered: continue
 */

const db = require('../config/database');

/**
 * Check if user's account has expired
 */
async function checkUserExpiry(req, res, next) {
  // Skip if no user (unauthenticated endpoints)
  if (!req.user) {
    return next();
  }

  const user = req.user;

  // Registered users never expire
  if (user.auth_type === 'password' || user.auth_type === 'google') {
    return next();
  }

  // Already marked as expired
  if (user.auth_type === 'expired') {
    return res.status(401).json({
      error: 'Account expired',
      code: 'ACCOUNT_EXPIRED',
      message: 'Your temporary account has expired after 90 days. A new account will be created.',
      expiryDate: user.expires_at
    });
  }

  // Anonymous user - check expiry
  if (user.auth_type === 'anonymous' && user.expires_at) {
    const now = new Date();
    const expiryDate = new Date(user.expires_at);

    if (expiryDate < now) {
      // Account expired - mark as expired (soft delete)
      try {
        await db.query(
          `UPDATE users
           SET auth_type = 'expired',
               anonymous_id = NULL
           WHERE id = $1`,
          [user.id]
        );

        console.log(`[Expiry] Marked account as expired: ${user.display_name} (${user.id})`);

        return res.status(401).json({
          error: 'Account expired',
          code: 'ACCOUNT_EXPIRED',
          message: 'Your temporary account has expired after 90 days. A new account will be created.',
          expiryDate: user.expires_at,
          oldDisplayName: user.display_name,
          citationsPreserved: true
        });

      } catch (error) {
        console.error('[Expiry] Error marking account as expired:', error);
        // Continue anyway - let them use expired account rather than erroring
        return next();
      }
    }

    // Not expired yet - add warning if close to expiry
    const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry <= 10) {
      // Add warning to response headers
      res.setHeader('X-Account-Expiry-Warning', daysUntilExpiry);
      res.setHeader('X-Account-Expires-At', expiryDate.toISOString());

      console.log(`[Expiry] Warning: ${user.display_name} expires in ${daysUntilExpiry} days`);
    }
  }

  next();
}

/**
 * Get expiry info for current user
 */
async function getExpiryInfo(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = req.user;

  // Registered users never expire
  if (user.auth_type === 'password' || user.auth_type === 'google') {
    return res.json({
      accountType: user.auth_type,
      expires: false,
      displayName: user.display_name
    });
  }

  // Expired account
  if (user.auth_type === 'expired') {
    return res.json({
      accountType: 'expired',
      expires: true,
      expired: true,
      expiryDate: user.expires_at,
      displayName: user.display_name,
      message: 'This account has expired. Citations remain visible but you can no longer edit them.'
    });
  }

  // Anonymous account
  const now = new Date();
  const expiryDate = new Date(user.expires_at);
  const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

  return res.json({
    accountType: 'anonymous',
    expires: true,
    expired: false,
    expiryDate: user.expires_at,
    daysUntilExpiry: daysUntilExpiry,
    displayName: user.display_name,
    warning: daysUntilExpiry <= 10 ? `Your account expires in ${daysUntilExpiry} days. Sign up to keep your citations!` : null
  });
}

module.exports = {
  checkUserExpiry,
  getExpiryInfo
};
