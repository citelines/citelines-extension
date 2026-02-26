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
