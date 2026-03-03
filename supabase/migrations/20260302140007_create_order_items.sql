-- Migration 007: Create order_items table
-- Part of Story 1.1: Supabase Foundation

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  shopify_line_item_id TEXT,
  product_name TEXT NOT NULL,
  variant_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2),
  total_price NUMERIC(10,2),
  size TEXT,
  customization TEXT,                     -- e.g., 'Derick 9' (player name/number)
  version TEXT,                           -- e.g., 'Fan Edition', 'Player Edition'
  thumbnail_url TEXT,                     -- Shopify CDN image URL
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

COMMENT ON TABLE order_items IS 'Order line items — normalized from Firestore embedded items array';
