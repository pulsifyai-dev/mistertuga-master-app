-- Migration: Create RLS policies for ALL tables
-- Part of Story 1.2: Auth Migration
-- Depends on: user_role() helper function (migration 150001)

-- ============================================================
-- USERS TABLE
-- ADMIN: full CRUD
-- Users: read own profile, update own profile
-- ============================================================

DROP POLICY IF EXISTS "users_admin_all" ON users;
CREATE POLICY "users_admin_all" ON users
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');

DROP POLICY IF EXISTS "users_self_read" ON users;
CREATE POLICY "users_self_read" ON users
  FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "users_self_update" ON users;
CREATE POLICY "users_self_update" ON users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- ORDERS TABLE
-- ADMIN: full CRUD
-- FORNECEDOR: read-only for assigned countries
-- ============================================================

DROP POLICY IF EXISTS "orders_admin_all" ON orders;
CREATE POLICY "orders_admin_all" ON orders
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');

DROP POLICY IF EXISTS "orders_fornecedor_read" ON orders;
CREATE POLICY "orders_fornecedor_read" ON orders
  FOR SELECT
  USING (
    public.user_role() = 'FORNECEDOR'
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND orders.country_code = ANY(u.assigned_countries)
    )
  );

-- ============================================================
-- ORDER_ITEMS TABLE
-- Follows orders policy via FK — if user can see the order, can see items
-- ============================================================

DROP POLICY IF EXISTS "order_items_admin_all" ON order_items;
CREATE POLICY "order_items_admin_all" ON order_items
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');

DROP POLICY IF EXISTS "order_items_fornecedor_read" ON order_items;
CREATE POLICY "order_items_fornecedor_read" ON order_items
  FOR SELECT
  USING (
    public.user_role() = 'FORNECEDOR'
    AND EXISTS (
      SELECT 1 FROM orders o
      JOIN users u ON u.id = auth.uid()
      WHERE o.id = order_items.order_id
      AND o.country_code = ANY(u.assigned_countries)
    )
  );

-- ============================================================
-- CUSTOMERS TABLE
-- ADMIN: full CRUD
-- FORNECEDOR: read-only (via order relationship)
-- ============================================================

DROP POLICY IF EXISTS "customers_admin_all" ON customers;
CREATE POLICY "customers_admin_all" ON customers
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');

DROP POLICY IF EXISTS "customers_fornecedor_read" ON customers;
CREATE POLICY "customers_fornecedor_read" ON customers
  FOR SELECT
  USING (public.user_role() = 'FORNECEDOR');

-- ============================================================
-- SETTINGS TABLE
-- ADMIN: read + insert + update (split policies per Phase 5 correction)
-- FORNECEDOR: read-only
-- ============================================================

DROP POLICY IF EXISTS "settings_admin_read" ON settings;
CREATE POLICY "settings_admin_read" ON settings
  FOR SELECT
  USING (public.user_role() = 'ADMIN');

DROP POLICY IF EXISTS "settings_admin_insert" ON settings;
CREATE POLICY "settings_admin_insert" ON settings
  FOR INSERT
  WITH CHECK (public.user_role() = 'ADMIN');

DROP POLICY IF EXISTS "settings_admin_update" ON settings;
CREATE POLICY "settings_admin_update" ON settings
  FOR UPDATE
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');

DROP POLICY IF EXISTS "settings_admin_delete" ON settings;
CREATE POLICY "settings_admin_delete" ON settings
  FOR DELETE
  USING (public.user_role() = 'ADMIN');

DROP POLICY IF EXISTS "settings_fornecedor_read" ON settings;
CREATE POLICY "settings_fornecedor_read" ON settings
  FOR SELECT
  USING (public.user_role() = 'FORNECEDOR');

-- ============================================================
-- EXPENSES TABLE
-- ADMIN only
-- ============================================================

DROP POLICY IF EXISTS "expenses_admin_all" ON expenses;
CREATE POLICY "expenses_admin_all" ON expenses
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');

-- ============================================================
-- AUDIT_LOG TABLE
-- ADMIN: read-only (no direct writes — trigger-based inserts via SECURITY DEFINER)
-- ============================================================

DROP POLICY IF EXISTS "audit_log_admin_read" ON audit_log;
CREATE POLICY "audit_log_admin_read" ON audit_log
  FOR SELECT
  USING (public.user_role() = 'ADMIN');

-- ============================================================
-- COUNTRIES TABLE
-- All authenticated users can read
-- ADMIN can write (add new countries)
-- ============================================================

DROP POLICY IF EXISTS "countries_auth_read" ON countries;
CREATE POLICY "countries_auth_read" ON countries
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "countries_admin_write" ON countries;
CREATE POLICY "countries_admin_write" ON countries
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');

-- ============================================================
-- SHOPIFY_STORES TABLE
-- All authenticated users can read
-- ADMIN can write
-- ============================================================

DROP POLICY IF EXISTS "shopify_stores_auth_read" ON shopify_stores;
CREATE POLICY "shopify_stores_auth_read" ON shopify_stores
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "shopify_stores_admin_write" ON shopify_stores;
CREATE POLICY "shopify_stores_admin_write" ON shopify_stores
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');

-- ============================================================
-- EXPORT_CHECKPOINTS TABLE
-- ADMIN only
-- ============================================================

DROP POLICY IF EXISTS "export_checkpoints_admin_all" ON export_checkpoints;
CREATE POLICY "export_checkpoints_admin_all" ON export_checkpoints
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');
