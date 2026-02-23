-- Add 'youtube_merged' auth type for accounts that merged a YouTube account
-- into an email/password account.

-- Update the auth_type check constraint to include 'youtube_merged'.
DO $$
BEGIN
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_auth_type_check;
  ALTER TABLE users DROP CONSTRAINT IF EXISTS check_auth_type;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

ALTER TABLE users
  ADD CONSTRAINT users_auth_type_check
  CHECK (auth_type IN ('anonymous', 'password', 'youtube', 'merged', 'youtube_merged'));

-- One-time fix: mark existing password accounts that have YouTube linked as youtube_merged.
UPDATE users
  SET auth_type = 'youtube_merged'
  WHERE auth_type = 'password'
    AND youtube_verified = true;
