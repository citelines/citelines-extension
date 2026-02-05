-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  auth_type VARCHAR(50) DEFAULT 'anonymous' CHECK (auth_type IN ('anonymous', 'email', 'google', 'youtube')),
  email VARCHAR(255),
  display_name VARCHAR(100)
);

-- Create index on anonymous_id for fast lookups
CREATE INDEX idx_users_anonymous_id ON users(anonymous_id);
CREATE INDEX idx_users_auth_type ON users(auth_type);
