-- Migration: Create supplier_exports table
-- Part of Story 2.4: Supplier Excel Export with Embedded Images
-- Tracks generated export files per country

CREATE TABLE IF NOT EXISTS supplier_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL REFERENCES countries(code),
  file_name TEXT NOT NULL,
  file_url TEXT,
  order_range TEXT,
  total_items INTEGER,
  total_production_cost NUMERIC(10,2),
  total_shipping_cost NUMERIC(10,2),
  total_cost NUMERIC(10,2),
  exported_by UUID REFERENCES users(id),
  exported_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_exports_country ON supplier_exports(country_code);

ALTER TABLE supplier_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_exports_admin_all" ON supplier_exports;
CREATE POLICY "supplier_exports_admin_all" ON supplier_exports
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');
