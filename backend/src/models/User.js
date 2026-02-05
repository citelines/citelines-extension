const db = require('../config/database');

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
      SELECT id, anonymous_id, auth_type, email, display_name, created_at
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
      SELECT id, anonymous_id, auth_type, email, display_name, created_at
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
}

module.exports = User;
