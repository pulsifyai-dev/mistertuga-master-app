-- Migration 001: Create countries table
-- Part of Story 1.1: Supabase Foundation

CREATE TABLE countries (
  code TEXT PRIMARY KEY,                -- 'PT', 'ES', 'DE', 'UK', etc.
  name TEXT NOT NULL,
  flag_emoji TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Note: shopify_store_id FK added in migration 003 after shopify_stores exists

COMMENT ON TABLE countries IS 'Supported country codes for multi-country Shopify architecture';

-- Seed initial countries (from current Firestore data)
INSERT INTO countries (code, name, flag_emoji) VALUES
  ('PT', 'Portugal', '🇵🇹'),
  ('ES', 'Spain', '🇪🇸'),
  ('DE', 'Germany', '🇩🇪');
-- Migration 002: Create shopify_stores table
-- Part of Story 1.1: Supabase Foundation

CREATE TABLE shopify_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL REFERENCES countries(code),
  store_domain TEXT NOT NULL,            -- e.g., 'zndr1q-xu.myshopify.com'
  store_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE shopify_stores IS 'Multi-store Shopify configuration. API tokens stored in env vars, NOT in database.';
COMMENT ON COLUMN shopify_stores.store_domain IS 'Shopify store domain without protocol';

-- Seed current stores
INSERT INTO shopify_stores (country_code, store_domain, store_name) VALUES
  ('PT', 'zndr1q-xu.myshopify.com', 'MisterTuga PT'),
  ('ES', 'ric8re-zg.myshopify.com', 'MisterTuga ES'),
  ('DE', '4t7fzn-v9.myshopify.com', 'MisterTuga DE');
-- Migration 003: Add shopify_store_id FK to countries (resolves circular dependency)
-- Part of Story 1.1: Supabase Foundation

ALTER TABLE countries
  ADD COLUMN shopify_store_id UUID REFERENCES shopify_stores(id);

-- Link existing countries to their stores
UPDATE countries SET shopify_store_id = (
  SELECT id FROM shopify_stores WHERE shopify_stores.country_code = countries.code LIMIT 1
);
-- Migration 004: Create users table
-- Part of Story 1.1: Supabase Foundation

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'FORNECEDOR')),
  assigned_countries TEXT[] DEFAULT '{}',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE users IS 'Application users — synced from Supabase Auth during migration';
COMMENT ON COLUMN users.role IS 'ADMIN = full access, FORNECEDOR = supplier with read-only country access';
COMMENT ON COLUMN users.assigned_countries IS 'Array of country codes this user can access';
-- Migration 005: Create customers table
-- Part of Story 1.1: Supabase Foundation

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  postal_code TEXT,
  country_code TEXT REFERENCES countries(code),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(email, phone)                   -- Dedup key for migration
);

CREATE INDEX idx_customers_country ON customers(country_code);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email);

COMMENT ON TABLE customers IS 'Normalized customer data — extracted from Firestore embedded customer objects';
-- Migration 006: Create orders table
-- Part of Story 1.1: Supabase Foundation

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL,             -- Shopify order number (e.g., 'PT#124042')
  shopify_order_id TEXT UNIQUE,           -- Shopify internal ID
  customer_id UUID REFERENCES customers(id),
  country_code TEXT NOT NULL REFERENCES countries(code),
  status TEXT DEFAULT 'open',
  financial_status TEXT,                  -- paid, pending, refunded
  fulfillment_status TEXT,                -- fulfilled, partial, unfulfilled
  total_price NUMERIC(10,2),
  subtotal_price NUMERIC(10,2),
  total_tax NUMERIC(10,2),
  total_shipping NUMERIC(10,2),
  currency TEXT DEFAULT 'EUR',
  tracking_number TEXT,
  tracking_url TEXT,
  tracking_company TEXT,
  shipping_address JSONB,                 -- Full address as structured JSON
  note TEXT,
  shopify_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ                  -- Soft delete
);

CREATE INDEX idx_orders_country ON orders(country_code);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_shopify_id ON orders(shopify_order_id);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_status ON orders(status);

COMMENT ON TABLE orders IS 'Shopify orders — migrated from Firestore orders/{countryCode}/orders/{orderId}';
COMMENT ON COLUMN orders.deleted_at IS 'Soft delete for audit trail';
COMMENT ON COLUMN orders.shipping_address IS 'Full Shopify address as structured JSON';
-- Migration 007: Create order_items table
-- Part of Story 1.1: Supabase Foundation

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  shopify_line_item_id TEXT,
  product_name TEXT NOT NULL,
  variant_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2),
  total_price NUMERIC(10,2),
  size TEXT,
  customization TEXT,                     -- e.g., 'Derick 9' (player name/number)
  version TEXT,                           -- e.g., 'Fan Edition', 'Player Edition'
  thumbnail_url TEXT,                     -- Shopify CDN image URL
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

COMMENT ON TABLE order_items IS 'Order line items — normalized from Firestore embedded items array';
-- Migration 008: Create settings table
-- Part of Story 1.1: Supabase Foundation

CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE settings IS 'Application-wide key-value settings';
COMMENT ON COLUMN settings.key IS 'Setting key — e.g. webhook_url, default_currency, timezone';
-- Migration 009: Create expenses table
-- Part of Story 1.1: Supabase Foundation

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  date DATE NOT NULL,
  category TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_expenses_date ON expenses(date DESC);
CREATE INDEX idx_expenses_category ON expenses(category);

COMMENT ON TABLE expenses IS 'General expenses — migrated from Firestore profit-stats';
-- Migration 010: Create audit_log table + trigger function
-- Part of Story 1.1: Supabase Foundation

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_by UUID,
  changed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_table ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_time ON audit_log(changed_at DESC);
CREATE INDEX idx_audit_user ON audit_log(changed_by);

COMMENT ON TABLE audit_log IS 'Immutable audit trail for all critical table changes';

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id::TEXT, 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id::TEXT, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id::TEXT, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_trigger_func IS 'Generic audit trigger — captures INSERT/UPDATE/DELETE with old/new data and auth.uid()';
-- Migration 011: Apply audit triggers to critical tables
-- Part of Story 1.1: Supabase Foundation

-- Orders audit (most critical — tracks all order changes)
CREATE TRIGGER audit_orders
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Users audit (role changes, profile updates)
CREATE TRIGGER audit_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Settings audit (webhook URL changes, config changes)
CREATE TRIGGER audit_settings
  AFTER INSERT OR UPDATE OR DELETE ON settings
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
-- Migration 012: Create export_checkpoints table
-- Part of Story 1.1: Supabase Foundation

CREATE TABLE export_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL REFERENCES countries(code),
  export_type TEXT NOT NULL,              -- 'supplier_orders', 'revenue_report'
  last_order_number TEXT,                 -- Last exported order
  last_export_at TIMESTAMPTZ,
  exported_by UUID REFERENCES users(id),
  metadata JSONB,                         -- Additional export context
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(country_code, export_type)
);

COMMENT ON TABLE export_checkpoints IS 'Tracks last export per country to prevent duplicate supplier exports';
COMMENT ON COLUMN export_checkpoints.export_type IS 'Type of export — supplier_orders or revenue_report';
-- Migration 013: Create updated_at auto-update trigger
-- Part of Story 1.1: Supabase Foundation

-- Generic function to auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at column
CREATE TRIGGER set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON shopify_stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- Migration 014: Enable Supabase Realtime on orders table
-- Part of Story 1.1: Supabase Foundation

ALTER PUBLICATION supabase_realtime ADD TABLE orders;

COMMENT ON TABLE orders IS 'Shopify orders — Realtime enabled for live dashboard updates';
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
