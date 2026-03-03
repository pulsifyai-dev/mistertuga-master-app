-- Migration: Create order_costs table
-- Part of Story 2.3: Supplier Cost Calculation Engine
-- Per-order production and shipping cost calculations

CREATE TABLE IF NOT EXISTS order_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id),
  production_cost NUMERIC(10,2),
  shipping_cost NUMERIC(10,2),
  total_cost NUMERIC(10,2),
  currency TEXT DEFAULT 'USD',
  calculated_at TIMESTAMPTZ DEFAULT now(),
  cost_rule_id UUID REFERENCES cost_rules(id)
);

CREATE INDEX IF NOT EXISTS idx_order_costs_order ON order_costs(order_id);

ALTER TABLE order_costs ENABLE ROW LEVEL SECURITY;

-- RLS: Admin read/write, Fornecedor no access
DROP POLICY IF EXISTS "order_costs_admin_all" ON order_costs;
CREATE POLICY "order_costs_admin_all" ON order_costs
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');
