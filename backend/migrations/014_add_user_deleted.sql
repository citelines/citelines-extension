-- Migration: Add deleted_at column for soft-deleted accounts
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
