-- Migration 006: Create orders table
-- Part of Story 1.1: Supabase Foundation

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL,             -- Shopify order number (e.g., 'PT#124042')
  shopify_order_id TEXT UNIQUE,           -- Shopify internal ID
  customer_id UUID REFERENCES customers(id),
  country_code TEXT NOT NULL REFERENCES countries(code),
  status TEXT DEFAULT 'open',
  financial_status TEXT,                  -- paid, pending, refunded
  fulfillment_status TEXT,                -- fulfilled, partial, unfulfilled
  total_price NUMERIC(10,2),
  subtotal_price NUMERIC(10,2),
  total_tax NUMERIC(10,2),
  total_shipping NUMERIC(10,2),
  currency TEXT DEFAULT 'EUR',
  tracking_number TEXT,
  tracking_url TEXT,
  tracking_company TEXT,
  shipping_address JSONB,                 -- Full address as structured JSON
  note TEXT,
  shopify_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ                  -- Soft delete
);

CREATE INDEX idx_orders_country ON orders(country_code);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_shopify_id ON orders(shopify_order_id);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_status ON orders(status);

COMMENT ON TABLE orders IS 'Shopify orders — migrated from Firestore orders/{countryCode}/orders/{orderId}';
COMMENT ON COLUMN orders.deleted_at IS 'Soft delete for audit trail';
COMMENT ON COLUMN orders.shipping_address IS 'Full Shopify address as structured JSON';
