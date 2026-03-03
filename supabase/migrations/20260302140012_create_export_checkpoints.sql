-- Migration 012: Create export_checkpoints table
-- Part of Story 1.1: Supabase Foundation

CREATE TABLE export_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL REFERENCES countries(code),
  export_type TEXT NOT NULL,              -- 'supplier_orders', 'revenue_report'
  last_order_number TEXT,                 -- Last exported order
  last_export_at TIMESTAMPTZ,
  exported_by UUID REFERENCES users(id),
  metadata JSONB,                         -- Additional export context
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(country_code, export_type)
);

COMMENT ON TABLE export_checkpoints IS 'Tracks last export per country to prevent duplicate supplier exports';
COMMENT ON COLUMN export_checkpoints.export_type IS 'Type of export — supplier_orders or revenue_report';
