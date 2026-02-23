-- Analytics events table for tracking extension usage.
-- PRIVACY: This table stores NO PII. session_id is an anonymous UUID,
-- not linked to any user account, email, or identity.

CREATE TABLE IF NOT EXISTS analytics_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  session_id VARCHAR(64),
  video_id VARCHAR(20),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created
  ON analytics_events(event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_created
  ON analytics_events(created_at);
