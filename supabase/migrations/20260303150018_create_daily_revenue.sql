-- Migration: Create daily_revenue table
-- Part of Story 2.7: Daily Revenue Dashboard
-- Replaces n8n "Faturamento e Taxas (Diário)" workflow

CREATE TABLE IF NOT EXISTS daily_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  country_code TEXT REFERENCES countries(code),
  total_revenue NUMERIC(12,2),
  total_tax NUMERIC(12,2),
  total_shipping NUMERIC(12,2),
  order_count INTEGER,
  item_count INTEGER,
  currency TEXT DEFAULT 'EUR',
  calculated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, country_code)
);

CREATE INDEX idx_daily_revenue_date ON daily_revenue(date DESC);

ALTER TABLE daily_revenue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_revenue_admin_all" ON daily_revenue;
CREATE POLICY "daily_revenue_admin_all" ON daily_revenue
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');
