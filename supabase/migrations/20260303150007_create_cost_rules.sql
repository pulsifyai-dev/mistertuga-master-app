-- Migration: Create cost_rules table
-- Part of Story 2.3: Supplier Cost Calculation Engine
-- Production and shipping rate tables per country/product type

CREATE TABLE IF NOT EXISTS cost_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country_code TEXT REFERENCES countries(code),
  rule_type TEXT NOT NULL CHECK (rule_type IN ('production', 'shipping')),
  base_rate NUMERIC(10,2),
  rate_tiers JSONB,                 -- [{min_qty: 1, max_qty: 50, rate: 3.50}, ...]
  is_active BOOLEAN DEFAULT true,
  effective_from DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cost_rules ENABLE ROW LEVEL SECURITY;

-- RLS: Admin full CRUD, Fornecedor no access
DROP POLICY IF EXISTS "cost_rules_admin_all" ON cost_rules;
CREATE POLICY "cost_rules_admin_all" ON cost_rules
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');
