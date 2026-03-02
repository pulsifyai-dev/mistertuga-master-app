# MisterTuga Insights — Complete Schema Blueprint

**Author:** @pm (Morgan) + @data-engineer (Dara)
**Date:** 2026-03-02
**Status:** APPROVED (owner-reviewed)
**Source:** `docs/product/mistertuga_master.md`, `docs/architecture/technical-debt-assessment.md`

---

## Purpose

This document defines the **complete database schema** for MisterTuga Insights, covering both:
- **Phase 1 (EPIC-1):** Tables built during Firebase → Supabase migration
- **Phase 2 (EPIC-2):** Tables added for new features (Exchanges, Suppliers, Ads, etc.)

The schema is designed as a single coherent blueprint so that Phase 2 tables integrate seamlessly without schema conflicts.

---

## Schema Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    EPIC-1 TABLES (Migration)                │
│                                                             │
│  users          orders           customers                  │
│  settings       order_items      countries                  │
│  expenses       audit_log        shopify_stores             │
│  export_checkpoints                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   EPIC-2 TABLES (New Features)              │
│                                                             │
│  exchanges              exchange_attachments                │
│  exchange_email_log     email_templates                     │
│  order_costs            cost_rules                          │
│  supplier_exports       supplier_export_items               │
│  ad_accounts            ad_spend                            │
│  expense_categories     manual_expenses                     │
│  daily_revenue          daily_revenue_breakdown             │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: EPIC-1 Tables

> These tables are created in **Story 1.1** (Supabase Foundation).

### users
```sql
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
```

### countries
```sql
CREATE TABLE countries (
  code TEXT PRIMARY KEY,           -- 'PT', 'ES', 'DE', 'UK', etc.
  name TEXT NOT NULL,
  flag_emoji TEXT,
  shopify_store_id UUID REFERENCES shopify_stores(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### shopify_stores
```sql
-- Multi-store Shopify configuration
-- Added in EPIC-1 to support current multi-country architecture
CREATE TABLE shopify_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL REFERENCES countries(code),
  store_domain TEXT NOT NULL,      -- e.g., 'zndr1q-xu.myshopify.com'
  store_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- Note: Shopify API tokens stored in environment variables, NOT in database
```

### customers
```sql
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
  UNIQUE(email, phone)            -- Dedup key for migration
);
```

### orders
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL,       -- Shopify order number (e.g., 'PT#124042')
  shopify_order_id TEXT UNIQUE,     -- Shopify internal ID
  customer_id UUID REFERENCES customers(id),
  country_code TEXT NOT NULL REFERENCES countries(code),
  status TEXT DEFAULT 'open',
  financial_status TEXT,            -- paid, pending, refunded
  fulfillment_status TEXT,          -- fulfilled, partial, unfulfilled
  total_price NUMERIC(10,2),
  subtotal_price NUMERIC(10,2),
  total_tax NUMERIC(10,2),
  total_shipping NUMERIC(10,2),
  currency TEXT DEFAULT 'EUR',
  tracking_number TEXT,
  tracking_url TEXT,
  tracking_company TEXT,
  shipping_address JSONB,           -- Full address as structured JSON
  note TEXT,
  shopify_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ            -- Soft delete
);

CREATE INDEX idx_orders_country ON orders(country_code);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_shopify_id ON orders(shopify_order_id);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
```

### order_items
```sql
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
  customization TEXT,               -- e.g., 'Derick 9' (player name/number)
  version TEXT,                     -- e.g., 'Fan Edition', 'Player Edition'
  thumbnail_url TEXT,               -- Shopify CDN image URL
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
```

### settings
```sql
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- Example keys: 'webhook_url', 'default_currency', 'timezone',
--               'shopify_sync_interval', 'tracking_url_patterns'
```

### expenses
```sql
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
```

### audit_log
```sql
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
```

### export_checkpoints
```sql
-- Tracks last export per country to prevent duplicate exports
-- Added in EPIC-1 to support current supplier export workflow
CREATE TABLE export_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL REFERENCES countries(code),
  export_type TEXT NOT NULL,        -- 'supplier_orders', 'revenue_report'
  last_order_number TEXT,           -- Last exported order
  last_export_at TIMESTAMPTZ,
  exported_by UUID REFERENCES users(id),
  metadata JSONB,                   -- Additional export context
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(country_code, export_type)
);
```

---

## Phase 2: EPIC-2 Tables

> These tables are created in individual EPIC-2 stories via migrations.

### exchanges (Story 2.1)
```sql
-- Exchanges/Returns module — records from n8n AI email processing
CREATE TABLE exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  order_number TEXT,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_review', 'waiting_customer', 'approved', 'rejected', 'completed')),
  reason TEXT,                      -- AI-extracted reason for exchange
  received_description TEXT,        -- What customer received (AI-extracted)
  original_email_text TEXT,         -- Raw email content
  internal_notes TEXT,
  source TEXT DEFAULT 'email',      -- 'email', 'manual'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### exchange_attachments (Story 2.1)
```sql
CREATE TABLE exchange_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id UUID NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,           -- Supabase Storage URL
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### exchange_email_log (Story 2.2)
```sql
-- Track emails sent to customers for exchanges
CREATE TABLE exchange_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id UUID NOT NULL REFERENCES exchanges(id),
  template_id UUID REFERENCES email_templates(id),
  recipient_email TEXT NOT NULL,
  subject TEXT,
  body_rendered TEXT,               -- Final rendered email body
  sent_at TIMESTAMPTZ DEFAULT now(),
  sent_by UUID REFERENCES users(id),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced'))
);
```

### email_templates (Story 2.2)
```sql
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject_template TEXT NOT NULL,   -- Supports {{placeholders}}
  body_template TEXT NOT NULL,      -- Supports {{customer_name}}, {{order_number}}, etc.
  template_type TEXT DEFAULT 'exchange',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### order_costs (Story 2.3)
```sql
-- Per-order production and shipping cost calculations
CREATE TABLE order_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  production_cost NUMERIC(10,2),
  shipping_cost NUMERIC(10,2),
  total_cost NUMERIC(10,2),
  currency TEXT DEFAULT 'USD',      -- Costs typically in USD (Chinese supplier)
  calculated_at TIMESTAMPTZ DEFAULT now(),
  cost_rule_id UUID REFERENCES cost_rules(id)
);

CREATE INDEX idx_order_costs_order ON order_costs(order_id);
```

### cost_rules (Story 2.3)
```sql
-- Production and shipping rate tables per country/product type
CREATE TABLE cost_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country_code TEXT REFERENCES countries(code),
  rule_type TEXT NOT NULL CHECK (rule_type IN ('production', 'shipping')),
  -- Rate structure: per-item base + quantity tiers
  base_rate NUMERIC(10,2),
  rate_tiers JSONB,                 -- [{min_qty: 1, max_qty: 50, rate: 3.50}, ...]
  is_active BOOLEAN DEFAULT true,
  effective_from DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### supplier_exports (Story 2.4)
```sql
-- Track generated supplier export files
CREATE TABLE supplier_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL REFERENCES countries(code),
  file_name TEXT NOT NULL,
  file_url TEXT,                    -- Supabase Storage URL
  order_range TEXT,                 -- e.g., 'PT#124042-PT#124066'
  total_items INTEGER,
  total_production_cost NUMERIC(10,2),
  total_shipping_cost NUMERIC(10,2),
  total_cost NUMERIC(10,2),
  exported_by UUID REFERENCES users(id),
  exported_at TIMESTAMPTZ DEFAULT now()
);
```

### supplier_export_items (Story 2.4)
```sql
-- Individual items in a supplier export (for reconciliation)
CREATE TABLE supplier_export_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_id UUID NOT NULL REFERENCES supplier_exports(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id),
  order_number TEXT,
  item_name TEXT,
  quantity INTEGER,
  size TEXT,
  customization TEXT,
  thumbnail_url TEXT,
  production_cost NUMERIC(10,2),
  shipping_cost NUMERIC(10,2)
);
```

### ad_accounts (Story 2.5)
```sql
-- Google Ads / Meta Ads account configuration
CREATE TABLE ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('google_ads', 'meta_ads')),
  account_id TEXT NOT NULL,         -- Platform account ID
  account_name TEXT,
  is_active BOOLEAN DEFAULT true,
  config JSONB,                     -- Platform-specific config
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- Note: API tokens stored in environment variables, NOT in database
```

### ad_spend (Story 2.5)
```sql
-- Daily ad spend data from Google Ads / Meta Ads
CREATE TABLE ad_spend (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id UUID NOT NULL REFERENCES ad_accounts(id),
  date DATE NOT NULL,
  spend NUMERIC(10,2) NOT NULL,
  impressions INTEGER,
  clicks INTEGER,
  conversions INTEGER,
  currency TEXT DEFAULT 'EUR',
  fetched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ad_account_id, date)
);

CREATE INDEX idx_ad_spend_date ON ad_spend(date DESC);
```

### expense_categories (Story 2.6)
```sql
-- Services/Software catalog for expense tracking
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,                    -- 'software', 'service', 'subscription', 'other'
  fixed_monthly_cost NUMERIC(10,2),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### manual_expenses (Story 2.6)
```sql
-- Manual expense entries (extends existing expenses table)
CREATE TABLE manual_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES expense_categories(id),
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### daily_revenue (Story 2.7)
```sql
-- Daily revenue aggregations (replaces n8n "Faturamento" workflow)
CREATE TABLE daily_revenue (
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
```

### daily_revenue_breakdown (Story 2.7)
```sql
-- Optional: Per-product/channel breakdown
CREATE TABLE daily_revenue_breakdown (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_revenue_id UUID NOT NULL REFERENCES daily_revenue(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,          -- 'product', 'channel', 'payment_method'
  dimension_value TEXT NOT NULL,
  revenue NUMERIC(12,2),
  order_count INTEGER,
  item_count INTEGER
);
```

---

## RLS Strategy Summary

| Table | Admin | Fornecedor | Service Role |
|-------|-------|------------|-------------|
| users | Full CRUD | Read own profile | Full |
| orders | Full CRUD | Read own countries only | Full |
| order_items | Full CRUD | Read via order access | Full |
| customers | Full CRUD | Read via order access | Full |
| settings | Full CRUD | Read only | Full |
| expenses | Full CRUD | No access | Full |
| audit_log | Read only | No access | Full |
| exchanges | Full CRUD | No access | Full |
| cost_rules | Full CRUD | No access | Full |
| ad_accounts | Full CRUD | No access | Full |
| email_templates | Full CRUD | No access | Full |

> Detailed RLS policies implemented in Story 1.2 (EPIC-1 tables) and respective EPIC-2 stories.

---

## Migration Order

**EPIC-1 (10 migration scripts in Story 1.1):**
1. `001_create_countries.sql`
2. `002_create_shopify_stores.sql`
3. `003_create_users.sql`
4. `004_create_customers.sql`
5. `005_create_orders.sql`
6. `006_create_order_items.sql`
7. `007_create_settings.sql`
8. `008_create_expenses.sql`
9. `009_create_audit_log.sql`
10. `010_create_export_checkpoints.sql`

**EPIC-2 (migrations per story):**
- Story 2.1: `011_create_exchanges.sql`, `012_create_exchange_attachments.sql`
- Story 2.2: `013_create_email_templates.sql`, `014_create_exchange_email_log.sql`
- Story 2.3: `015_create_cost_rules.sql`, `016_create_order_costs.sql`
- Story 2.4: `017_create_supplier_exports.sql`, `018_create_supplier_export_items.sql`
- Story 2.5: `019_create_ad_accounts.sql`, `020_create_ad_spend.sql`
- Story 2.6: `021_create_expense_categories.sql`, `022_create_manual_expenses.sql`
- Story 2.7: `023_create_daily_revenue.sql`, `024_create_daily_revenue_breakdown.sql`

---

## Key Design Decisions

1. **Soft deletes** on orders (`deleted_at`) — audit trail requirement
2. **JSONB for shipping_address** — flexible Shopify address format
3. **Separate order_items** — normalized from Firestore nested array
4. **export_checkpoints** — prevents duplicate supplier exports (critical business rule)
5. **shopify_stores config** — supports dynamic multi-country architecture
6. **Cost rules with rate_tiers JSONB** — flexible pricing tiers without schema changes
7. **API tokens in env vars** — NEVER in database (security)
8. **Currency per table** — supports multi-currency (EUR orders, USD costs)

---

*Generated by @pm (Morgan) — Schema Blueprint for EPIC-1 + EPIC-2*
*— Morgan, planejando o futuro 📊*
