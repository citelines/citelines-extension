-- Migration 006: Admin Moderation System
-- Adds admin roles, user suspension/blocking, citation soft delete, and audit logging

-- Add admin flag to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Add suspension fields to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- Add blocking fields to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

-- Add soft delete fields to shares (citations)
ALTER TABLE shares ADD COLUMN IF NOT EXISTS deleted_by_admin UUID REFERENCES users(id);
ALTER TABLE shares ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE shares ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Create admin actions audit log
CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES users(id),
  action_type VARCHAR(50) NOT NULL,
  target_type VARCHAR(20) NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for admin_actions
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_actions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions(created_at DESC);

-- Comment on columns
COMMENT ON COLUMN users.is_admin IS 'True if user has admin privileges';
COMMENT ON COLUMN users.is_suspended IS 'True if user is temporarily suspended';
COMMENT ON COLUMN users.suspended_until IS 'When the suspension expires (NULL = not suspended)';
COMMENT ON COLUMN users.is_blocked IS 'True if user is permanently blocked';
COMMENT ON COLUMN shares.deleted_by_admin IS 'Admin user ID who deleted this citation';
COMMENT ON COLUMN admin_actions.action_type IS 'delete_citation, restore_citation, suspend_user, unsuspend_user, block_user, unblock_user';
COMMENT ON COLUMN admin_actions.target_type IS 'user or citation';
