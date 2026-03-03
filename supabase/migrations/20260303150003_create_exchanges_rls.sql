-- Migration: RLS policies for exchanges and exchange_attachments
-- Part of Story 2.1: Exchanges Schema + n8n Webhook Integration
-- Pattern follows: supabase/migrations/20260302150004_create_rls_policies.sql

-- ============================================================
-- EXCHANGES TABLE
-- ADMIN: full CRUD
-- FORNECEDOR: no access (exchanges are admin-only operations)
-- Service role: bypasses RLS automatically
-- ============================================================

DROP POLICY IF EXISTS "exchanges_admin_all" ON exchanges;
CREATE POLICY "exchanges_admin_all" ON exchanges
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');

-- ============================================================
-- EXCHANGE_ATTACHMENTS TABLE
-- ADMIN: full CRUD
-- FORNECEDOR: no access
-- Service role: bypasses RLS automatically
-- ============================================================

DROP POLICY IF EXISTS "exchange_attachments_admin_all" ON exchange_attachments;
CREATE POLICY "exchange_attachments_admin_all" ON exchange_attachments
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');
