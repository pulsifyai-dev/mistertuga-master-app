-- Migration: Create ad_accounts table
-- Part of Story 2.5: Google Ads + Meta Ads Integration
-- API tokens stored in environment variables, NOT in database

CREATE TABLE IF NOT EXISTS ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('google_ads', 'meta_ads')),
  account_id TEXT NOT NULL,
  account_name TEXT,
  is_active BOOLEAN DEFAULT true,
  config JSONB,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT CHECK (last_sync_status IN ('success', 'error', 'pending')),
  last_sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ad_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_accounts_admin_all" ON ad_accounts;
CREATE POLICY "ad_accounts_admin_all" ON ad_accounts
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');
