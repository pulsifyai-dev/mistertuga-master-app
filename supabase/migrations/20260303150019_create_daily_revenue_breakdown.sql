-- Migration: Create daily_revenue_breakdown table
-- Part of Story 2.7: Daily Revenue Dashboard
-- Optional per-product/channel breakdown linked to daily_revenue

CREATE TABLE IF NOT EXISTS daily_revenue_breakdown (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_revenue_id UUID NOT NULL REFERENCES daily_revenue(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,
  dimension_value TEXT NOT NULL,
  revenue NUMERIC(12,2),
  order_count INTEGER,
  item_count INTEGER
);

ALTER TABLE daily_revenue_breakdown ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_revenue_breakdown_admin_all" ON daily_revenue_breakdown;
CREATE POLICY "daily_revenue_breakdown_admin_all" ON daily_revenue_breakdown
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');
