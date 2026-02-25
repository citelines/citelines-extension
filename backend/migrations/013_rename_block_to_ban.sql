-- Migration 013: Rename "block" to "ban" + add banned_ips table
-- Part of unified suspension UX + IP enforcement

-- Rename columns on users table
ALTER TABLE users RENAME COLUMN is_blocked TO is_banned;
ALTER TABLE users RENAME COLUMN blocked_at TO banned_at;
ALTER TABLE users RENAME COLUMN blocked_reason TO ban_reason;

-- Update audit log action types
UPDATE admin_actions SET action_type = 'ban_user' WHERE action_type = 'block_user';
UPDATE admin_actions SET action_type = 'unban_user' WHERE action_type = 'unblock_user';

-- Create banned_ips table for IP-based enforcement
CREATE TABLE IF NOT EXISTS banned_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address INET NOT NULL,
  user_id UUID REFERENCES users(id),
  banned_by UUID REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_banned_ips_address ON banned_ips(ip_address);
