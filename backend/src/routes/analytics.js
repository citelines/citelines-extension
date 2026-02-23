const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

const VALID_EVENTS = ['extension_installed', 'video_viewed', 'citation_clicked'];

/**
 * POST /api/analytics/events
 * Ingest analytics events from the extension.
 *
 * PRIVACY: No PII is stored. session_id is an anonymous UUID from
 * X-Anonymous-ID header, or a SHA-256 hash of the IP address.
 * Never store user IDs, emails, or other identifiable information.
 */
router.post('/events', asyncHandler(async (req, res) => {
  const { events } = req.body;

  if (!Array.isArray(events) || events.length === 0 || events.length > 50) {
    return res.status(400).json({ error: 'events must be an array of 1-50 items' });
  }

  // Anonymous session ID: prefer X-Anonymous-ID header, else hash the IP
  const sessionId = req.headers['x-anonymous-id']
    || crypto.createHash('sha256').update(req.ip || 'unknown').digest('hex').substring(0, 16);

  const validEvents = events.filter(e => VALID_EVENTS.includes(e.event_type));

  if (validEvents.length === 0) {
    return res.status(202).json({ accepted: 0 });
  }

  // Build multi-row INSERT
  const values = [];
  const params = [];
  let paramIndex = 1;

  for (const event of validEvents) {
    values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`);
    params.push(
      event.event_type,
      sessionId,
      event.video_id || null,
      JSON.stringify(event.metadata || {})
    );
    paramIndex += 4;
  }

  await db.query(
    `INSERT INTO analytics_events (event_type, session_id, video_id, metadata)
     VALUES ${values.join(', ')}`,
    params
  );

  res.status(202).json({ accepted: validEvents.length });
}));

module.exports = router;
