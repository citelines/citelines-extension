-- Add case-insensitive unique constraint on display_name
-- NULLs are allowed (anonymous users have no display name)
CREATE UNIQUE INDEX IF NOT EXISTS users_display_name_unique_lower
  ON users (LOWER(display_name))
  WHERE display_name IS NOT NULL;
