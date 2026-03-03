-- Migration 014: Enable Supabase Realtime on orders table
-- Part of Story 1.1: Supabase Foundation

ALTER PUBLICATION supabase_realtime ADD TABLE orders;

COMMENT ON TABLE orders IS 'Shopify orders — Realtime enabled for live dashboard updates';
