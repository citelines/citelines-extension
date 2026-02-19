-- Add account merge support: allow a secondary account to be merged into a primary.
-- The secondary account is deactivated (auth_type = 'merged') and all its shares
-- are transferred to the primary account.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS merged_into UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS merged_at   TIMESTAMP;

-- Update the auth_type check constraint to include 'merged'.
-- Drop the existing constraint first (name may vary; use a DO block to be safe).
DO $$
BEGIN
  -- Try dropping known constraint names
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_auth_type_check;
  ALTER TABLE users DROP CONSTRAINT IF EXISTS check_auth_type;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

ALTER TABLE users
  ADD CONSTRAINT users_auth_type_check
  CHECK (auth_type IN ('anonymous', 'password', 'youtube', 'merged'));
