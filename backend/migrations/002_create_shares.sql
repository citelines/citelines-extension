-- Create shares table
CREATE TABLE IF NOT EXISTS shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_token VARCHAR(8) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id VARCHAR(20) NOT NULL,
  title VARCHAR(255),
  annotations JSONB NOT NULL,
  is_public BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX idx_shares_token ON shares(share_token);
CREATE INDEX idx_shares_user_id ON shares(user_id);
CREATE INDEX idx_shares_video_id ON shares(video_id);
CREATE INDEX idx_shares_created_at ON shares(created_at DESC);
