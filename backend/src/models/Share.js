const db = require('../config/database');

/**
 * Share model for database operations
 */
class Share {
  /**
   * Create a new share
   * @param {Object} data - Share data
   * @returns {Promise<Object>} Created share
   */
  static async create({ shareToken, userId, videoId, title, annotations, isPublic = true }) {
    const query = `
      INSERT INTO shares (share_token, user_id, video_id, title, annotations, is_public, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, share_token, user_id, video_id, title, annotations, is_public, view_count, created_at, updated_at
    `;

    const result = await db.query(query, [
      shareToken,
      userId,
      videoId,
      title,
      JSON.stringify(annotations),
      isPublic
    ]);

    return result.rows[0];
  }

  /**
   * Find share by token
   * @param {string} shareToken
   * @returns {Promise<Object|null>} Share or null
   */
  static async findByToken(shareToken) {
    const query = `
      SELECT
        s.id, s.share_token, s.user_id, s.video_id, s.title,
        s.annotations, s.is_public, s.view_count, s.created_at, s.updated_at,
        u.display_name as creator_display_name,
        u.auth_type as creator_auth_type,
        u.youtube_channel_id as creator_youtube_channel_id
      FROM shares s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.share_token = $1
        AND s.deleted_by_admin IS NULL
    `;

    const result = await db.query(query, [shareToken]);
    return result.rows[0] || null;
  }

  /**
   * Check if share token exists
   * @param {string} shareToken
   * @returns {Promise<boolean>}
   */
  static async exists(shareToken) {
    const query = `
      SELECT EXISTS(SELECT 1 FROM shares WHERE share_token = $1) as exists
    `;

    const result = await db.query(query, [shareToken]);
    return result.rows[0].exists;
  }

  /**
   * Find shares by video ID
   * @param {string} videoId
   * @param {number} limit
   * @param {number} offset
   * @returns {Promise<Array>} Array of shares
   */
  static async findByVideoId(videoId, limit = 50, offset = 0) {
    const query = `
      SELECT
        s.id, s.share_token, s.user_id, s.video_id, s.title,
        s.annotations, s.is_public, s.view_count, s.created_at, s.updated_at,
        u.display_name as creator_display_name,
        u.auth_type as creator_auth_type,
        u.youtube_channel_id as creator_youtube_channel_id
      FROM shares s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.video_id = $1
        AND s.is_public = true
        AND s.deleted_by_admin IS NULL
      ORDER BY s.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [videoId, limit, offset]);
    return result.rows;
  }

  /**
   * Find shares by user ID
   * @param {string} userId
   * @param {number} limit
   * @param {number} offset
   * @returns {Promise<Array>} Array of shares
   */
  static async findByUserId(userId, limit = 50, offset = 0) {
    const query = `
      SELECT id, share_token, user_id, video_id, title, annotations, is_public, view_count, created_at, updated_at
      FROM shares
      WHERE user_id = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [userId, limit, offset]);
    return result.rows;
  }

  /**
   * Increment view count for a share
   * @param {string} shareToken
   * @returns {Promise<void>}
   */
  static async incrementViewCount(shareToken) {
    const query = `
      UPDATE shares
      SET view_count = view_count + 1
      WHERE share_token = $1
    `;

    await db.query(query, [shareToken]);
  }

  /**
   * Update share
   * @param {string} shareToken
   * @param {Object} updates
   * @returns {Promise<Object>} Updated share
   */
  static async update(shareToken, updates) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.title !== undefined) {
      fields.push(`title = $${paramIndex}`);
      values.push(updates.title);
      paramIndex++;
    }

    if (updates.annotations !== undefined) {
      fields.push(`annotations = $${paramIndex}`);
      values.push(JSON.stringify(updates.annotations));
      paramIndex++;
    }

    if (updates.isPublic !== undefined) {
      fields.push(`is_public = $${paramIndex}`);
      values.push(updates.isPublic);
      paramIndex++;
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    fields.push(`updated_at = NOW()`);
    values.push(shareToken);

    const query = `
      UPDATE shares
      SET ${fields.join(', ')}
      WHERE share_token = $${paramIndex}
      RETURNING id, share_token, user_id, video_id, title, annotations, is_public, view_count, created_at, updated_at
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Delete share
   * @param {string} shareToken
   * @returns {Promise<boolean>} True if deleted
   */
  static async delete(shareToken) {
    const query = `
      DELETE FROM shares
      WHERE share_token = $1
      RETURNING id
    `;

    const result = await db.query(query, [shareToken]);
    return result.rowCount > 0;
  }

  /**
   * Count user's shares
   * @param {string} userId
   * @returns {Promise<number>}
   */
  static async countByUserId(userId) {
    const query = `
      SELECT COUNT(*) as count
      FROM shares
      WHERE user_id = $1
    `;

    const result = await db.query(query, [userId]);
    return parseInt(result.rows[0].count);
  }
}

module.exports = Share;
