-- Migration: Create exchanges table
-- Part of Story 2.1: Exchanges Schema + n8n Webhook Integration

CREATE TABLE exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,                              -- Soft FK to orders(id) — exchange may arrive before order sync
  order_number TEXT,                           -- Shopify order number (e.g., 'PT#124042')
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_review', 'waiting_customer', 'approved', 'rejected', 'completed')),
  reason TEXT,
  received_description TEXT,
  original_email_text TEXT,
  internal_notes TEXT,
  source TEXT NOT NULL DEFAULT 'email'
    CHECK (source IN ('email', 'manual')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_exchanges_status ON exchanges(status);
CREATE INDEX idx_exchanges_order_number ON exchanges(order_number);
CREATE INDEX idx_exchanges_created ON exchanges(created_at DESC);

-- Enable RLS
ALTER TABLE exchanges ENABLE ROW LEVEL SECURITY;

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE exchanges;

COMMENT ON TABLE exchanges IS 'Exchange/return requests — populated via n8n webhook or manual entry. Realtime enabled.';
COMMENT ON COLUMN exchanges.order_id IS 'Soft FK to orders(id) — NULL if order not yet synced';
COMMENT ON COLUMN exchanges.source IS 'Origin of the exchange record: email (n8n AI) or manual (admin UI)';
