-- Migration: Create user_role() helper function
-- Part of Story 1.2: Auth Migration
-- Reads role from JWT claim first (fast path), falls back to users table

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'user_role',
    (SELECT role FROM public.users WHERE id = auth.uid())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.user_role() IS 'Returns user role from JWT claim (fast) or users table (fallback). Used by RLS policies.';
-- Migration: Set custom JWT claim for user_role on login
-- Part of Story 1.2: Auth Migration
-- Populates user_role in JWT claims from users.role column

-- Function to set user_role claim in JWT metadata
CREATE OR REPLACE FUNCTION public.handle_auth_user_role()
RETURNS TRIGGER AS $$
DECLARE
  _role TEXT;
  _assigned_countries TEXT[];
BEGIN
  -- Look up user role and assigned countries from public.users
  SELECT role, assigned_countries
  INTO _role, _assigned_countries
  FROM public.users
  WHERE id = NEW.id;

  -- If user exists in public.users, set the claim
  IF _role IS NOT NULL THEN
    NEW.raw_app_meta_data = jsonb_set(
      COALESCE(NEW.raw_app_meta_data, '{}'::jsonb),
      '{user_role}',
      to_jsonb(_role)
    );
    NEW.raw_app_meta_data = jsonb_set(
      NEW.raw_app_meta_data,
      '{assigned_countries}',
      to_jsonb(_assigned_countries)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users to inject role into JWT on token refresh
CREATE TRIGGER on_auth_user_updated
  BEFORE UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_role();

COMMENT ON FUNCTION public.handle_auth_user_role() IS 'Injects user_role and assigned_countries from public.users into JWT app_metadata on auth token refresh';
-- Migration: Enable RLS on ALL public tables
-- Part of Story 1.2: Auth Migration
-- MUST run before creating policies

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_checkpoints ENABLE ROW LEVEL SECURITY;
-- Migration: Create RLS policies for ALL tables
-- Part of Story 1.2: Auth Migration
-- Depends on: user_role() helper function (migration 150001)

-- ============================================================
-- USERS TABLE
-- ADMIN: full CRUD
-- Users: read own profile, update own profile
-- ============================================================

CREATE POLICY "users_admin_all" ON users
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');

CREATE POLICY "users_self_read" ON users
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users_self_update" ON users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- ORDERS TABLE
-- ADMIN: full CRUD
-- FORNECEDOR: read-only for assigned countries
-- ============================================================

CREATE POLICY "orders_admin_all" ON orders
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');

CREATE POLICY "orders_fornecedor_read" ON orders
  FOR SELECT
  USING (
    public.user_role() = 'FORNECEDOR'
    AND country_code = ANY(
      (SELECT assigned_countries FROM users WHERE id = auth.uid())
    )
  );

-- ============================================================
-- ORDER_ITEMS TABLE
-- Follows orders policy via FK — if user can see the order, can see items
-- ============================================================

CREATE POLICY "order_items_admin_all" ON order_items
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');

CREATE POLICY "order_items_fornecedor_read" ON order_items
  FOR SELECT
  USING (
    public.user_role() = 'FORNECEDOR'
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND o.country_code = ANY(
        (SELECT assigned_countries FROM users WHERE id = auth.uid())
      )
    )
  );

-- ============================================================
-- CUSTOMERS TABLE
-- ADMIN: full CRUD
-- FORNECEDOR: read-only (via order relationship)
-- ============================================================

CREATE POLICY "customers_admin_all" ON customers
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');

CREATE POLICY "customers_fornecedor_read" ON customers
  FOR SELECT
  USING (public.user_role() = 'FORNECEDOR');

-- ============================================================
-- SETTINGS TABLE
-- ADMIN: read + insert + update (split policies per Phase 5 correction)
-- FORNECEDOR: read-only
-- ============================================================

CREATE POLICY "settings_admin_read" ON settings
  FOR SELECT
  USING (public.user_role() = 'ADMIN');

CREATE POLICY "settings_admin_insert" ON settings
  FOR INSERT
  WITH CHECK (public.user_role() = 'ADMIN');

CREATE POLICY "settings_admin_update" ON settings
  FOR UPDATE
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');

CREATE POLICY "settings_admin_delete" ON settings
  FOR DELETE
  USING (public.user_role() = 'ADMIN');

CREATE POLICY "settings_fornecedor_read" ON settings
  FOR SELECT
  USING (public.user_role() = 'FORNECEDOR');

-- ============================================================
-- EXPENSES TABLE
-- ADMIN only
-- ============================================================

CREATE POLICY "expenses_admin_all" ON expenses
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');

-- ============================================================
-- AUDIT_LOG TABLE
-- ADMIN: read-only (no direct writes — trigger-based inserts via SECURITY DEFINER)
-- ============================================================

CREATE POLICY "audit_log_admin_read" ON audit_log
  FOR SELECT
  USING (public.user_role() = 'ADMIN');

-- ============================================================
-- COUNTRIES TABLE
-- All authenticated users can read
-- ADMIN can write (add new countries)
-- ============================================================

CREATE POLICY "countries_auth_read" ON countries
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "countries_admin_write" ON countries
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');

-- ============================================================
-- SHOPIFY_STORES TABLE
-- All authenticated users can read
-- ADMIN can write
-- ============================================================

CREATE POLICY "shopify_stores_auth_read" ON shopify_stores
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "shopify_stores_admin_write" ON shopify_stores
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');

-- ============================================================
-- EXPORT_CHECKPOINTS TABLE
-- ADMIN only
-- ============================================================

CREATE POLICY "export_checkpoints_admin_all" ON export_checkpoints
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');
