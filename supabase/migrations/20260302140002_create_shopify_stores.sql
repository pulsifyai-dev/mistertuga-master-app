-- Migration 002: Create shopify_stores table
-- Part of Story 1.1: Supabase Foundation

CREATE TABLE shopify_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL REFERENCES countries(code),
  store_domain TEXT NOT NULL,            -- e.g., 'zndr1q-xu.myshopify.com'
  store_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE shopify_stores IS 'Multi-store Shopify configuration. API tokens stored in env vars, NOT in database.';
COMMENT ON COLUMN shopify_stores.store_domain IS 'Shopify store domain without protocol';

-- Seed current stores
INSERT INTO shopify_stores (country_code, store_domain, store_name) VALUES
  ('PT', 'zndr1q-xu.myshopify.com', 'MisterTuga PT'),
  ('ES', 'ric8re-zg.myshopify.com', 'MisterTuga ES'),
  ('DE', '4t7fzn-v9.myshopify.com', 'MisterTuga DE');
