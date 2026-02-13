#!/bin/bash
# Run migration 006 on Railway database
# This script executes the SQL directly

echo "Running migration 006: Admin Moderation System"
echo "=============================================="

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set"
  echo "Get it from Railway: railway variables | grep DATABASE_URL"
  exit 1
fi

# Run migration
psql "$DATABASE_URL" << 'EOF'

-- Migration 006: Admin Moderation System

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_actions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions(created_at DESC);

-- Verify tables
SELECT 'Migration complete!' as status;
\dt admin_actions
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'admin_actions';

EOF

echo ""
echo "Migration 006 complete!"
