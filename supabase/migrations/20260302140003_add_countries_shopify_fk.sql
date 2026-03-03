-- Migration 003: Add shopify_store_id FK to countries (resolves circular dependency)
-- Part of Story 1.1: Supabase Foundation

ALTER TABLE countries
  ADD COLUMN shopify_store_id UUID REFERENCES shopify_stores(id);

-- Link existing countries to their stores
UPDATE countries SET shopify_store_id = (
  SELECT id FROM shopify_stores WHERE shopify_stores.country_code = countries.code LIMIT 1
);
