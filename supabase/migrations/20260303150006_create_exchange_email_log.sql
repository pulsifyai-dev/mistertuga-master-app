-- Migration: Create exchange_email_log table
-- Part of Story 2.2: Exchanges/Returns UI + Email Templates
-- Immutable log of emails sent for exchange/return requests

CREATE TABLE IF NOT EXISTS exchange_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id UUID NOT NULL REFERENCES exchanges(id),
  template_id UUID REFERENCES email_templates(id),
  recipient_email TEXT NOT NULL,
  subject TEXT,
  body_rendered TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  sent_by UUID REFERENCES users(id),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced'))
);

CREATE INDEX IF NOT EXISTS idx_exchange_email_log_exchange ON exchange_email_log(exchange_id);

ALTER TABLE exchange_email_log ENABLE ROW LEVEL SECURITY;

-- RLS: Admin full CRUD, Fornecedor no access
DROP POLICY IF EXISTS "exchange_email_log_admin_all" ON exchange_email_log;
CREATE POLICY "exchange_email_log_admin_all" ON exchange_email_log
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');
