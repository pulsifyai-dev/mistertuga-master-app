-- Migration 004: Create users table
-- Part of Story 1.1: Supabase Foundation

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'FORNECEDOR')),
  assigned_countries TEXT[] DEFAULT '{}',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE users IS 'Application users — synced from Supabase Auth during migration';
COMMENT ON COLUMN users.role IS 'ADMIN = full access, FORNECEDOR = supplier with read-only country access';
COMMENT ON COLUMN users.assigned_countries IS 'Array of country codes this user can access';
