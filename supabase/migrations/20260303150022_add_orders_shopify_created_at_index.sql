-- Add missing index on orders.shopify_created_at (QA CONCERN)
-- Used by revenue-engine.ts for all date-range revenue queries.

CREATE INDEX IF NOT EXISTS idx_orders_shopify_created_at
  ON orders(shopify_created_at DESC);
