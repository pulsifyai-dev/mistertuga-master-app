-- Migration: Create supplier_export_items table
-- Part of Story 2.4: Supplier Excel Export with Embedded Images
-- Individual items included in each export for reconciliation

CREATE TABLE IF NOT EXISTS supplier_export_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_id UUID NOT NULL REFERENCES supplier_exports(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id),
  order_number TEXT,
  item_name TEXT,
  quantity INTEGER,
  size TEXT,
  customization TEXT,
  thumbnail_url TEXT,
  production_cost NUMERIC(10,2),
  shipping_cost NUMERIC(10,2)
);

CREATE INDEX IF NOT EXISTS idx_supplier_export_items_export ON supplier_export_items(export_id);

ALTER TABLE supplier_export_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_export_items_admin_all" ON supplier_export_items;
CREATE POLICY "supplier_export_items_admin_all" ON supplier_export_items
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');
