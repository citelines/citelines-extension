-- Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_shares_video_public ON shares(video_id, is_public, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shares_user_created ON shares(user_id, created_at DESC);

-- Index for searching annotations (future full-text search)
CREATE INDEX IF NOT EXISTS idx_shares_annotations ON shares USING GIN (annotations);
