-- Migration 008: Create settings table
-- Part of Story 1.1: Supabase Foundation

CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE settings IS 'Application-wide key-value settings';
COMMENT ON COLUMN settings.key IS 'Setting key — e.g. webhook_url, default_currency, timezone';
