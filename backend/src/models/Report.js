const db = require('../config/database');

/**
 * Report model for citation reports and edit suggestions
 */
class Report {
  /**
   * Create a new report or suggestion
   * @param {Object} data
   * @returns {Promise<Object>} Created report
   */
  static async create({ reportType, reporterId, shareToken, annotationId, reason, suggestedText, details }) {
    const query = `
      INSERT INTO citation_reports (report_type, reporter_id, share_token, annotation_id, reason, suggested_text, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, report_type, reporter_id, share_token, annotation_id, reason, suggested_text, details, status, created_at
    `;

    const result = await db.query(query, [
      reportType,
      reporterId,
      shareToken,
      annotationId || null,
      reason || null,
      suggestedText || null,
      details || null
    ]);

    return result.rows[0];
  }

  /**
   * Find reports by status
   * @param {string} status
   * @param {number} limit
   * @param {number} offset
   * @returns {Promise<Array>}
   */
  static async findByStatus(status = 'pending', limit = 50, offset = 0) {
    const query = `
      SELECT
        r.*,
        u.display_name as reporter_display_name,
        u.auth_type as reporter_auth_type
      FROM citation_reports r
      LEFT JOIN users u ON r.reporter_id = u.id
      ORDER BY r.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    // If status is 'all', don't filter
    if (status === 'all') {
      const result = await db.query(query, [limit, offset]);
      return result.rows;
    }

    const filteredQuery = `
      SELECT
        r.*,
        u.display_name as reporter_display_name,
        u.auth_type as reporter_auth_type
      FROM citation_reports r
      LEFT JOIN users u ON r.reporter_id = u.id
      WHERE r.status = $1
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(filteredQuery, [status, limit, offset]);
    return result.rows;
  }

  /**
   * Get suggestion counts per (share_token, annotation_id) for a list of share tokens.
   * Also reports whether userId has a pending suggestion for each.
   * @param {string[]} shareTokens
   * @param {string|null} userId
   * @returns {Promise<Array>} rows with share_token, annotation_id, suggestion_count, user_has_suggestion
   */
  static async findByShareTokens(shareTokens, userId = null) {
    if (!shareTokens || shareTokens.length === 0) return [];

    const query = `
      SELECT share_token, annotation_id,
        COUNT(*) FILTER (WHERE report_type = 'suggestion' AND status = 'pending') AS suggestion_count,
        bool_or(reporter_id = $2 AND report_type = 'suggestion' AND status = 'pending') AS user_has_suggestion
      FROM citation_reports
      WHERE share_token = ANY($1)
      GROUP BY share_token, annotation_id
    `;

    const result = await db.query(query, [shareTokens, userId]);
    return result.rows;
  }

  /**
   * Find all pending suggestions for a share token (for owner review).
   * Includes reporter display name.
   * @param {string} shareToken
   * @returns {Promise<Array>}
   */
  static async findByShareToken(shareToken) {
    const query = `
      SELECT r.*, u.display_name as reporter_display_name
      FROM citation_reports r
      LEFT JOIN users u ON r.reporter_id = u.id
      WHERE r.share_token = $1 AND r.report_type = 'suggestion' AND r.status = 'pending'
      ORDER BY r.created_at DESC
    `;

    const result = await db.query(query, [shareToken]);
    return result.rows;
  }

  /**
   * Find a user's own pending suggestion for a specific annotation.
   * @param {string} shareToken
   * @param {string} annotationId
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  static async findUserSuggestion(shareToken, annotationId, userId) {
    const query = `
      SELECT id, suggested_text, reason, created_at
      FROM citation_reports
      WHERE share_token = $1 AND annotation_id = $2 AND reporter_id = $3
        AND report_type = 'suggestion' AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await db.query(query, [shareToken, annotationId, userId]);
    return result.rows[0] || null;
  }

  /**
   * Update a suggestion's content (only the reporter can update their own).
   * @param {string} reportId
   * @param {string} suggestedText
   * @param {string} reason
   * @returns {Promise<Object>}
   */
  static async updateSuggestion(reportId, suggestedText, reason) {
    const query = `
      UPDATE citation_reports
      SET suggested_text = $1, reason = $2
      WHERE id = $3
      RETURNING *
    `;

    const result = await db.query(query, [suggestedText, reason, reportId]);
    return result.rows[0];
  }

  /**
   * Update report status
   * @param {string} reportId
   * @param {string} status
   * @param {string} reviewedBy - Admin user ID
   * @returns {Promise<Object>}
   */
  static async updateStatus(reportId, status, reviewedBy) {
    const query = `
      UPDATE citation_reports
      SET status = $1, reviewed_by = $2, reviewed_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

    const result = await db.query(query, [status, reviewedBy, reportId]);
    return result.rows[0];
  }
}

module.exports = Report;
