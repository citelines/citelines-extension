-- Migration 004: Temporary Accounts (90-day soft expiry)
-- Created: 2026-02-12
-- Purpose: Add display names and expiry for anonymous users

-- Add new columns to users table
ALTER TABLE users
  ADD COLUMN display_name VARCHAR(100),
  ADD COLUMN account_created_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN expires_at TIMESTAMP;

-- Add indexes
CREATE INDEX idx_users_expires_at ON users(expires_at);
CREATE INDEX idx_users_display_name ON users(display_name);

-- Function to generate Wikipedia-style temporary display names
-- Uses random 6-digit identifier to prevent tracking/enumeration
CREATE OR REPLACE FUNCTION generate_anonymous_display_name()
RETURNS VARCHAR AS $$
DECLARE
  year VARCHAR(4);
  random_id VARCHAR(6);
  name VARCHAR(50);
  attempts INTEGER := 0;
  max_attempts INTEGER := 100;
BEGIN
  year := EXTRACT(YEAR FROM NOW())::VARCHAR;

  -- Try to generate unique random display name
  LOOP
    -- Generate random 6-digit number (000000-999999)
    -- Format: ~YYYY-NNNNNN (e.g., ~2026-472935)
    random_id := LPAD(FLOOR(RANDOM() * 1000000)::VARCHAR, 6, '0');
    name := '~' || year || '-' || random_id;

    -- Check if this name already exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE display_name = name) THEN
      RETURN name;
    END IF;

    -- Prevent infinite loop (very unlikely with 1M possibilities)
    attempts := attempts + 1;
    IF attempts >= max_attempts THEN
      -- Fallback: add timestamp suffix
      name := '~' || year || '-' || random_id || '-' || EXTRACT(EPOCH FROM NOW())::VARCHAR;
      RETURN name;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set expiry date for anonymous users
CREATE OR REPLACE FUNCTION set_anonymous_expiry()
RETURNS TRIGGER AS $$
BEGIN
  -- Anonymous users: expire in 90 days
  IF NEW.auth_type = 'anonymous' THEN
    NEW.expires_at = COALESCE(NEW.account_created_at, NOW()) + INTERVAL '90 days';

    -- Generate display name if not provided
    IF NEW.display_name IS NULL THEN
      NEW.display_name = generate_anonymous_display_name();
    END IF;

  -- Registered users: never expire
  ELSIF NEW.auth_type IN ('password', 'google') THEN
    NEW.expires_at = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_user_expiry_and_display_name
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_anonymous_expiry();

-- Backfill existing users
UPDATE users
SET account_created_at = created_at,
    expires_at = created_at + INTERVAL '90 days',
    display_name = generate_anonymous_display_name()
WHERE auth_type = 'anonymous' AND display_name IS NULL;

-- Function to check if user is expired
CREATE OR REPLACE FUNCTION is_user_expired(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  expiry TIMESTAMP;
BEGIN
  SELECT expires_at INTO expiry
  FROM users
  WHERE id = user_id;

  -- Registered users (expires_at = NULL) never expire
  IF expiry IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if expiry date has passed
  RETURN expiry < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to handle expired account (soft delete)
CREATE OR REPLACE FUNCTION handle_expired_account(old_user_id UUID)
RETURNS UUID AS $$
DECLARE
  new_user_id UUID;
  old_display_name VARCHAR(100);
BEGIN
  -- Get old display name for logging
  SELECT display_name INTO old_display_name
  FROM users
  WHERE id = old_user_id;

  -- Mark user as expired (don't delete - keep citations visible)
  UPDATE users
  SET auth_type = 'expired',
      anonymous_id = NULL  -- Clear anonymous_id so they can't auth anymore
  WHERE id = old_user_id;

  -- Log the expiry
  INSERT INTO user_stats (user_id, warnings)
  VALUES (old_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN old_user_id;
END;
$$ LANGUAGE plpgsql;

-- Scheduled job to clean up expired accounts (run daily via cron)
CREATE OR REPLACE FUNCTION expire_old_accounts()
RETURNS TABLE(expired_count INTEGER) AS $$
DECLARE
  count INTEGER;
BEGIN
  -- Mark all expired anonymous accounts
  WITH expired_users AS (
    UPDATE users
    SET auth_type = 'expired',
        anonymous_id = NULL
    WHERE auth_type = 'anonymous'
      AND expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO count FROM expired_users;

  RETURN QUERY SELECT count;
END;
$$ LANGUAGE plpgsql;

-- Add auth_type enum values
-- Note: Can't use ALTER TYPE in migration, so using VARCHAR validation instead
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_auth_type_check;

ALTER TABLE users
  ADD CONSTRAINT users_auth_type_check
  CHECK (auth_type IN ('anonymous', 'password', 'google', 'expired'));

-- Comments for documentation
COMMENT ON COLUMN users.display_name IS 'Public display name: ~YYYY-NNNNNN (random) for anonymous, user-chosen for registered';
COMMENT ON COLUMN users.expires_at IS 'NULL = never expires (registered users), TIMESTAMP = expiry date (anonymous users)';
COMMENT ON FUNCTION generate_anonymous_display_name() IS 'Generates Wikipedia-style temporary account names with random 6-digit ID (e.g., ~2026-472935)';
COMMENT ON FUNCTION expire_old_accounts() IS 'Run daily via cron to mark expired anonymous accounts (soft delete)';
