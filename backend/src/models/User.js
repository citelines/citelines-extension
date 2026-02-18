const db = require('../config/database');
const { hashPassword, generateToken } = require('../utils/password');
const { generateAnonymousId } = require('../utils/tokenGenerator');

/**
 * User model for database operations
 */
class User {
  /**
   * Create a new anonymous user
   * @param {string} anonymousId
   * @returns {Promise<Object>} Created user
   */
  static async create(anonymousId) {
    const query = `
      INSERT INTO users (anonymous_id, auth_type, created_at)
      VALUES ($1, 'anonymous', NOW())
      RETURNING id, anonymous_id, auth_type, created_at
    `;

    const result = await db.query(query, [anonymousId]);
    return result.rows[0];
  }

  /**
   * Find user by anonymous ID
   * @param {string} anonymousId
   * @returns {Promise<Object|null>} User or null
   */
  static async findByAnonymousId(anonymousId) {
    const query = `
      SELECT id, anonymous_id, auth_type, email, display_name, created_at,
             is_admin, is_suspended, suspended_until, suspension_reason,
             is_blocked, blocked_at, blocked_reason
      FROM users
      WHERE anonymous_id = $1
    `;

    const result = await db.query(query, [anonymousId]);
    return result.rows[0] || null;
  }

  /**
   * Find user by ID
   * @param {string} userId
   * @returns {Promise<Object|null>} User or null
   */
  static async findById(userId) {
    const query = `
      SELECT id, anonymous_id, auth_type, email, display_name, created_at,
             is_admin, is_suspended, suspended_until, suspension_reason,
             is_blocked, blocked_at, blocked_reason
      FROM users
      WHERE id = $1
    `;

    const result = await db.query(query, [userId]);
    return result.rows[0] || null;
  }

  /**
   * Check if anonymous ID exists
   * @param {string} anonymousId
   * @returns {Promise<boolean>}
   */
  static async exists(anonymousId) {
    const query = `
      SELECT EXISTS(SELECT 1 FROM users WHERE anonymous_id = $1) as exists
    `;

    const result = await db.query(query, [anonymousId]);
    return result.rows[0].exists;
  }

  /**
   * Update user information
   * @param {string} userId
   * @param {Object} updates
   * @returns {Promise<Object>} Updated user
   */
  static async update(userId, updates) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      if (['email', 'display_name', 'auth_type'].includes(key)) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(userId);

    const query = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, anonymous_id, auth_type, email, display_name, created_at
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Create a new registered user with email/password
   * @param {Object} params - { email, password, displayName }
   * @returns {Promise<Object>} Created user
   */
  static async createWithPassword({ email, password, displayName }) {
    const passwordHash = await hashPassword(password);
    const verificationToken = generateToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const anonymousId = generateAnonymousId();

    const query = `
      INSERT INTO users
        (anonymous_id, email, password_hash, display_name, email_verification_token,
         email_verification_expires, auth_type, email_verified, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'password', false, NOW())
      RETURNING id, anonymous_id, email, display_name, auth_type, email_verified, created_at,
                email_verification_token, email_verification_expires
    `;

    const result = await db.query(query, [
      anonymousId,
      email.toLowerCase(),
      passwordHash,
      displayName,
      verificationToken,
      verificationExpires
    ]);

    return result.rows[0];
  }

  /**
   * Upgrade an anonymous account to registered (with email/password)
   * Preserves all citations by keeping the same user ID
   * @param {string} anonymousId - Anonymous ID to upgrade
   * @param {Object} params - { email, password, displayName }
   * @returns {Promise<Object>} Updated user
   */
  static async upgradeAnonymousToRegistered(anonymousId, { email, password, displayName }) {
    const passwordHash = await hashPassword(password);
    const verificationToken = generateToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const query = `
      UPDATE users
      SET email = $1,
          password_hash = $2,
          display_name = $3,
          email_verification_token = $4,
          email_verification_expires = $5,
          auth_type = 'password',
          expires_at = NULL,
          linked_anonymous_id = $6,
          email_verified = false
      WHERE anonymous_id = $7
      RETURNING id, email, display_name, auth_type, email_verified, created_at,
                email_verification_token, email_verification_expires,
                linked_anonymous_id, citations_count
    `;

    const result = await db.query(query, [
      email.toLowerCase(),
      passwordHash,
      displayName,
      verificationToken,
      verificationExpires,
      anonymousId,
      anonymousId
    ]);

    return result.rows[0];
  }

  /**
   * Find user by email
   * @param {string} email
   * @returns {Promise<Object|null>} User or null
   */
  static async findByEmail(email) {
    const query = `
      SELECT id, anonymous_id, email, password_hash, display_name, auth_type,
             email_verified, created_at, expires_at, citations_count
      FROM users
      WHERE email = $1
    `;

    const result = await db.query(query, [email.toLowerCase()]);
    return result.rows[0] || null;
  }

  /**
   * Find user by display name (case-insensitive)
   * @param {string} displayName
   * @returns {Promise<Object|null>} User or null
   */
  static async findByDisplayName(displayName) {
    const query = `
      SELECT id, anonymous_id, display_name, auth_type, created_at
      FROM users
      WHERE LOWER(display_name) = LOWER($1)
        AND display_name IS NOT NULL
    `;
    const result = await db.query(query, [displayName]);
    return result.rows[0] || null;
  }

  /**
   * Find user by email verification token
   * @param {string} token
   * @returns {Promise<Object|null>} User or null
   */
  static async findByVerificationToken(token) {
    const query = `
      SELECT id, email, display_name, email_verification_expires
      FROM users
      WHERE email_verification_token = $1
        AND email_verification_expires > NOW()
    `;

    const result = await db.query(query, [token]);
    return result.rows[0] || null;
  }

  /**
   * Verify user's email address
   * @param {string} userId
   * @returns {Promise<void>}
   */
  static async verifyEmail(userId) {
    const query = `
      UPDATE users
      SET email_verified = true,
          email_verification_token = NULL,
          email_verification_expires = NULL
      WHERE id = $1
    `;

    await db.query(query, [userId]);
  }

  /**
   * Set password reset token
   * @param {string} userId
   * @param {string} token
   * @param {Date} expires
   * @returns {Promise<void>}
   */
  static async setPasswordResetToken(userId, token, expires) {
    const query = `
      UPDATE users
      SET password_reset_token = $1,
          password_reset_expires = $2
      WHERE id = $3
    `;

    await db.query(query, [token, expires, userId]);
  }

  /**
   * Find user by password reset token
   * @param {string} token
   * @returns {Promise<Object|null>} User or null
   */
  static async findByPasswordResetToken(token) {
    const query = `
      SELECT id, email, display_name, password_reset_expires
      FROM users
      WHERE password_reset_token = $1
        AND password_reset_expires > NOW()
    `;

    const result = await db.query(query, [token]);
    return result.rows[0] || null;
  }

  /**
   * Update user's password
   * @param {string} userId
   * @param {string} newPassword
   * @returns {Promise<void>}
   */
  static async updatePassword(userId, newPassword) {
    const passwordHash = await hashPassword(newPassword);

    const query = `
      UPDATE users
      SET password_hash = $1,
          password_reset_token = NULL,
          password_reset_expires = NULL
      WHERE id = $2
    `;

    await db.query(query, [passwordHash, userId]);
  }

  /**
   * Auto-unsuspend user (called when suspension expires)
   * @param {string} userId
   * @returns {Promise<void>}
   */
  static async unsuspend(userId) {
    const query = `
      UPDATE users
      SET is_suspended = false,
          suspended_until = NULL,
          suspension_reason = NULL
      WHERE id = $1
    `;

    await db.query(query, [userId]);
  }
}

module.exports = User;
