-- Migration 008: Add YouTube channel fields for creator verification

-- Add YouTube channel fields to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS youtube_channel_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS youtube_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS youtube_channel_title VARCHAR(255);

-- Unique constraint (NULLs allowed for non-YouTube users)
CREATE UNIQUE INDEX IF NOT EXISTS users_youtube_channel_id_unique
  ON users (youtube_channel_id)
  WHERE youtube_channel_id IS NOT NULL;

-- Add 'youtube' to the auth_type constraint (drop old, recreate)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_auth_type_check;
ALTER TABLE users ADD CONSTRAINT users_auth_type_check
  CHECK (auth_type IN ('anonymous', 'password', 'google', 'youtube', 'expired'));
