-- Migration 001: Create countries table
-- Part of Story 1.1: Supabase Foundation

CREATE TABLE countries (
  code TEXT PRIMARY KEY,                -- 'PT', 'ES', 'DE', 'UK', etc.
  name TEXT NOT NULL,
  flag_emoji TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Note: shopify_store_id FK added in migration 003 after shopify_stores exists

COMMENT ON TABLE countries IS 'Supported country codes for multi-country Shopify architecture';

-- Seed initial countries (from current Firestore data)
INSERT INTO countries (code, name, flag_emoji) VALUES
  ('PT', 'Portugal', '🇵🇹'),
  ('ES', 'Spain', '🇪🇸'),
  ('DE', 'Germany', '🇩🇪');
