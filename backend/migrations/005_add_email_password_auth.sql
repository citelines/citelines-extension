-- Migration 005: Email/Password Authentication
-- Created: 2026-02-12
-- Purpose: Add email/password registration while preserving anonymous access

-- Add email/password authentication fields
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),

  -- Email verification
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP,

  -- Password reset
  ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP,

  -- Account linking (track which anonymous account was upgraded)
  ADD COLUMN IF NOT EXISTS linked_anonymous_id VARCHAR(255);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);

-- Update auth_type constraint to allow 'password' type
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_auth_type_check;

ALTER TABLE users
  ADD CONSTRAINT users_auth_type_check
  CHECK (auth_type IN ('anonymous', 'password', 'google', 'expired'));

-- Function to find user by email verification token
CREATE OR REPLACE FUNCTION find_user_by_verification_token(token VARCHAR)
RETURNS TABLE (
  id UUID,
  email VARCHAR,
  display_name VARCHAR,
  email_verification_expires TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email, u.display_name, u.email_verification_expires
  FROM users u
  WHERE u.email_verification_token = token
    AND u.email_verification_expires > NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to find user by password reset token
CREATE OR REPLACE FUNCTION find_user_by_reset_token(token VARCHAR)
RETURNS TABLE (
  id UUID,
  email VARCHAR,
  display_name VARCHAR,
  password_reset_expires TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email, u.display_name, u.password_reset_expires
  FROM users u
  WHERE u.password_reset_token = token
    AND u.password_reset_expires > NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON COLUMN users.email IS 'User email address (unique, required for registered users)';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hashed password (12 rounds)';
COMMENT ON COLUMN users.email_verified IS 'Whether email address has been verified';
COMMENT ON COLUMN users.email_verification_token IS 'Token for email verification (expires in 24 hours)';
COMMENT ON COLUMN users.password_reset_token IS 'Token for password reset (expires in 1 hour)';
COMMENT ON COLUMN users.linked_anonymous_id IS 'If upgraded from anonymous, stores original anonymous_id';

-- Example user states after migration:
--
-- Anonymous user (unchanged):
-- {
--   id: uuid,
--   anonymous_id: "abc123",
--   display_name: "~2026-472935",
--   auth_type: "anonymous",
--   expires_at: "2026-05-13",
--   email: NULL,
--   password_hash: NULL
-- }
--
-- Registered user (upgraded from anonymous):
-- {
--   id: uuid,  -- Same ID!
--   anonymous_id: "abc123",  -- Preserved
--   display_name: "JohnDoe42",
--   auth_type: "password",
--   expires_at: NULL,  -- Never expires
--   email: "user@gmail.com",
--   password_hash: "$2b$12...",
--   email_verified: true,
--   linked_anonymous_id: "abc123"
-- }
--
-- New registered user (never anonymous):
-- {
--   id: uuid,
--   anonymous_id: NULL,
--   display_name: "Alice",
--   auth_type: "password",
--   expires_at: NULL,
--   email: "alice@gmail.com",
--   password_hash: "$2b$12...",
--   email_verified: true
-- }
