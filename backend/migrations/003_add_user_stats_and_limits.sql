-- Migration 003: Add user statistics and rate limiting tables
-- Created: 2026-02-12
-- Purpose: Track citation counts and implement DDOS protection

-- Add statistics columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS citations_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_citation_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS account_created_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_rate_limited BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rate_limit_until TIMESTAMP;

-- Create user_stats table for detailed metrics
CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Citation metrics
  total_citations INTEGER DEFAULT 0,
  citations_today INTEGER DEFAULT 0,
  citations_this_hour INTEGER DEFAULT 0,
  citations_last_reset TIMESTAMP DEFAULT NOW(),

  -- Rate limiting counters
  rapid_fire_count INTEGER DEFAULT 0,      -- Citations in quick succession
  last_rapid_fire_reset TIMESTAMP DEFAULT NOW(),

  -- Spam indicators
  duplicate_text_count INTEGER DEFAULT 0,   -- Same text posted multiple times
  cross_video_spam_count INTEGER DEFAULT 0, -- Same text across videos

  -- Account health
  warnings INTEGER DEFAULT 0,
  suspensions INTEGER DEFAULT 0,
  last_warning_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);

-- Create rate_limit_events table for monitoring
CREATE TABLE IF NOT EXISTS rate_limit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,        -- 'citation_created', 'vote_cast', etc.
  video_id VARCHAR(20),
  ip_address INET,
  user_agent TEXT,

  -- Rate limit context
  limit_type VARCHAR(50),                 -- 'hourly', 'daily', 'rapid_fire', 'video_spam'
  limit_value INTEGER,                    -- What was the limit?
  current_count INTEGER,                  -- How many did they have?
  blocked BOOLEAN DEFAULT false,          -- Was this request blocked?

  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for querying recent events
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_user_id ON rate_limit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_created_at ON rate_limit_events(created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_blocked ON rate_limit_events(blocked);

-- Create video_citation_counts for per-video limits
CREATE TABLE IF NOT EXISTS video_citation_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  video_id VARCHAR(20) NOT NULL,
  citation_count INTEGER DEFAULT 0,
  first_citation_at TIMESTAMP DEFAULT NOW(),
  last_citation_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_video_citation_counts_lookup ON video_citation_counts(user_id, video_id);

-- Function to reset daily counters (run via cron)
CREATE OR REPLACE FUNCTION reset_daily_counters()
RETURNS void AS $$
BEGIN
  UPDATE user_stats
  SET citations_today = 0,
      citations_last_reset = NOW()
  WHERE citations_last_reset < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Function to reset hourly counters (run via cron)
CREATE OR REPLACE FUNCTION reset_hourly_counters()
RETURNS void AS $$
BEGIN
  UPDATE user_stats
  SET citations_this_hour = 0,
      rapid_fire_count = 0,
      last_rapid_fire_reset = NOW()
  WHERE last_rapid_fire_reset < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Function to increment citation count
CREATE OR REPLACE FUNCTION increment_citation_count(p_user_id UUID, p_video_id VARCHAR(20))
RETURNS void AS $$
BEGIN
  -- Update user stats
  INSERT INTO user_stats (user_id, total_citations, citations_today, citations_this_hour)
  VALUES (p_user_id, 1, 1, 1)
  ON CONFLICT (user_id) DO UPDATE SET
    total_citations = user_stats.total_citations + 1,
    citations_today = user_stats.citations_today + 1,
    citations_this_hour = user_stats.citations_this_hour + 1,
    updated_at = NOW();

  -- Update users table
  UPDATE users
  SET citations_count = citations_count + 1,
      last_citation_at = NOW()
  WHERE id = p_user_id;

  -- Update video-specific counts
  INSERT INTO video_citation_counts (user_id, video_id, citation_count)
  VALUES (p_user_id, p_video_id, 1)
  ON CONFLICT (user_id, video_id) DO UPDATE SET
    citation_count = video_citation_counts.citation_count + 1,
    last_citation_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE user_stats IS 'Detailed user statistics for rate limiting and spam detection';
COMMENT ON TABLE rate_limit_events IS 'Audit log of rate limiting events for monitoring abuse patterns';
COMMENT ON TABLE video_citation_counts IS 'Per-video citation counts to prevent video-specific spam';
