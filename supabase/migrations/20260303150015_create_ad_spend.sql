-- Migration: Create ad_spend table
-- Part of Story 2.5: Google Ads + Meta Ads Integration
-- Daily granularity spend data, idempotent fetches via UNIQUE constraint

CREATE TABLE IF NOT EXISTS ad_spend (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id UUID NOT NULL REFERENCES ad_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  spend NUMERIC(10,2) NOT NULL,
  impressions INTEGER,
  clicks INTEGER,
  conversions INTEGER,
  currency TEXT DEFAULT 'EUR',
  fetched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ad_account_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ad_spend_date ON ad_spend(date DESC);
CREATE INDEX IF NOT EXISTS idx_ad_spend_account ON ad_spend(ad_account_id);

ALTER TABLE ad_spend ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_spend_admin_all" ON ad_spend;
CREATE POLICY "ad_spend_admin_all" ON ad_spend
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');
