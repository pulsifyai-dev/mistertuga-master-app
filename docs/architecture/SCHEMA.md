# SCHEMA.md — MisterTuga Data Model

**Phase:** Brownfield Discovery - Phase 2
**Author:** @data-engineer (Dara)
**Date:** 2026-03-02
**Status:** Draft

---

## 1. Current Database: Firestore (NoSQL)

### Overview

The application uses **Google Cloud Firestore** as its primary database — a document-oriented NoSQL store with real-time subscription capabilities. Data is organized in collections and subcollections.

**Firebase Project:** `gen-lang-client-0378123449`
**Region:** europe-west1

---

## 2. Collection Map

```
firestore/
│
├── users/{userId}                              # User profiles
│   ├── id: string (= userId)
│   ├── displayName: string
│   ├── email: string
│   ├── role: "ADMIN" | "BASIC" | "FORNECEDOR"
│   └── createdAt: string (ISO8601)
│
├── roles_admin/{userId}                        # Admin role lookup
│   └── (empty document - existence = admin)
│
├── orders/{countryCode}                        # Country group document
│   └── /orders/{orderId}                       # Subcollection: actual orders
│       ├── orderId: string
│       ├── date: Timestamp | string
│       ├── status: "Pending Production" | "Shipped"
│       ├── trackingNumber: string (optional)
│       ├── note: string (optional)
│       ├── customer: {                         # Embedded object
│       │   ├── name: string
│       │   ├── address: string
│       │   └── phone: string
│       │ }
│       └── items: [                            # Embedded array
│           {
│             name: string,
│             productId: string,
│             customization: string,
│             size: string,
│             quantity: number,
│             thumbnailUrl: string,
│             version: string
│           }
│         ]
│
├── settings/{settingId}                        # App-wide settings
│   └── tracking: {
│       ├── url: string                         # Webhook URL (Cloud Function reads)
│       └── webhookUrl: string                  # Webhook URL (Server Action reads)
│     }
│
└── metrics/profit-stats                        # Single document - profit analytics
    ├── periodLabel: string                     # e.g., "Last 30 dias"
    ├── currency: "EUR"
    ├── totalRevenue: number
    ├── expenses: {                             # Embedded expense categories
    │   ├── metaAds: { label, base, extra, color?, recurring? }
    │   ├── tiktokAds: { label, base, extra, color?, recurring? }
    │   ├── klaviyo: { label, base, extra, color?, recurring? }
    │   ├── collaborators: { label, base, extra, color?, recurring? }
    │   └── variableCosts: { label, base, extra, color?, recurring? }
    │ }
    └── dailyNetProfit: [                       # Array of daily data points
        { date: string, net: number }
      ]
```

---

## 3. Entity Definitions

### 3.1 User

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | Yes | Matches Firebase Auth UID |
| `displayName` | string | Yes | User's display name |
| `email` | string | Yes | Email address |
| `role` | string | Yes | "ADMIN", "BASIC", or "FORNECEDOR" |
| `createdAt` | string | Yes | ISO8601 timestamp |

**Write patterns:**
- Created during signup via Server Action (`signUp()`)
- Updated by user via settings page (displayName only)

**Read patterns:**
- Read by owner only (Firestore rules enforce)

---

### 3.2 Order

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `orderId` | string | Yes | Shopify order ID |
| `date` | Timestamp/string | Yes | Order date |
| `status` | string | Yes | "Pending Production" or "Shipped" |
| `trackingNumber` | string | No | Tracking code (triggers webhook when added) |
| `note` | string | No | Internal notes |
| `customer` | object | Yes | Embedded: name, address, phone |
| `items` | array | Yes | Embedded: product details |

**Write patterns:**
- Created externally (Shopify import — mechanism unclear)
- Updated via Server Action (`updateOrderDetails()`)
- Update triggers Cloud Function webhook when tracking added

**Read patterns:**
- Real-time collection listener (all orders per country)
- All authenticated users can read/write

---

### 3.3 Product (embedded in Order.items[])

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | Yes | Product name |
| `productId` | string | Yes | Shopify product ID |
| `customization` | string | Yes | Customization text |
| `size` | string | Yes | Product size |
| `quantity` | number | Yes | Item quantity |
| `thumbnailUrl` | string | Yes | Product image URL |
| `version` | string | Yes | Product version |

---

### 3.4 Customer (embedded in Order.customer)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | Yes | Customer full name |
| `address` | string | Yes | Delivery address (single string) |
| `phone` | string | Yes | Phone number (spaces stripped on save) |

---

### 3.5 ProfitStats (single document)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `periodLabel` | string | Yes | Period description |
| `currency` | string | Yes | Always "EUR" |
| `totalRevenue` | number | Yes | Total revenue for period |
| `expenses` | object | Yes | 5 expense categories (embedded) |
| `dailyNetProfit` | array | Yes | Daily data points: { date, net } |

**Write patterns:**
- Initialized with dummy data if not exists (client-side)
- Updated via client-side Firestore SDK (admin only)

**Read patterns:**
- Single document read via `getDoc()` (not real-time)

---

## 4. Data Access Patterns

| Pattern | Collection | Method | Where |
|---------|-----------|--------|-------|
| Real-time list | orders/{cc}/orders | `onSnapshot` (useCollection) | Orders page |
| Single doc read | metrics/profit-stats | `getDoc` | Profit stats page |
| Single doc read | settings/tracking | `getDoc` | Settings page, Cloud Function |
| Server write | users/{uid} | Admin SDK `set()` | signUp action |
| Server write | orders/{cc}/orders/{id} | Admin SDK `update()` | updateOrderDetails action |
| Client write | metrics/profit-stats | `setDoc`/`updateDoc` | Profit stats page |
| Trigger read | orders/{cc}/orders/{id} | Cloud Function `onDocumentUpdated` | Webhook function |

---

## 5. Authentication & Authorization (Data Layer)

### Firebase Auth Custom Claims
| Claim | Values | Set By |
|-------|--------|--------|
| `role` | "ADMIN", "BASIC" | Admin SDK during signup |

### Role Duplication Problem
Roles are stored in **three places**:
1. **Firebase Auth custom claims** (`role` claim) — source of truth for auth
2. **Firestore `/users/{uid}`** (`role` field) — denormalized for display
3. **Firestore `/roles_admin/{uid}`** (existence check) — legacy admin lookup

This creates a **sync risk**: if one is updated, the others may become stale.

---

## 6. Webhook Data Field Inconsistency

The `settings/tracking` document has **two different field names** depending on who reads it:

| Consumer | Field Read | File |
|----------|-----------|------|
| Cloud Function | `settings/tracking.url` | `functions/src/index.ts:30` |
| Server Action | `settings/tracking.webhookUrl` | `actions.ts:56` |

**Risk:** If only one field is set, the other consumer silently fails.

---

## 7. Proposed Supabase Schema (PostgreSQL)

If migrating to Supabase (`Mistertuga_Master`), here is the equivalent relational schema:

```sql
-- =============================================
-- USERS
-- =============================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'BASIC' CHECK (role IN ('ADMIN', 'BASIC', 'FORNECEDOR')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- COUNTRIES (normalize country codes)
-- =============================================
CREATE TABLE public.countries (
  code TEXT PRIMARY KEY,           -- e.g., 'PT', 'UK', 'FR'
  name TEXT NOT NULL
);

-- =============================================
-- CUSTOMERS
-- =============================================
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- ORDERS
-- =============================================
CREATE TABLE public.orders (
  id TEXT PRIMARY KEY,              -- Shopify order ID
  country_code TEXT NOT NULL REFERENCES public.countries(code),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  status TEXT NOT NULL DEFAULT 'Pending Production'
    CHECK (status IN ('Pending Production', 'Shipped')),
  tracking_number TEXT,
  note TEXT,
  order_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_country ON public.orders(country_code);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_customer ON public.orders(customer_id);

-- =============================================
-- PRODUCTS (catalog)
-- =============================================
CREATE TABLE public.products (
  id TEXT PRIMARY KEY,              -- Shopify product ID
  name TEXT NOT NULL,
  thumbnail_url TEXT,
  version TEXT
);

-- =============================================
-- ORDER ITEMS (junction)
-- =============================================
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id),
  customization TEXT,
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order ON public.order_items(order_id);

-- =============================================
-- EXPENSE CATEGORIES
-- =============================================
CREATE TABLE public.expense_categories (
  id TEXT PRIMARY KEY,              -- e.g., 'metaAds', 'tiktokAds'
  label TEXT NOT NULL,
  color TEXT,
  recurring BOOLEAN NOT NULL DEFAULT true
);

-- =============================================
-- PROFIT PERIODS
-- =============================================
CREATE TABLE public.profit_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_label TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  total_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- EXPENSES (per period)
-- =============================================
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.profit_periods(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES public.expense_categories(id),
  base_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  extra_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  UNIQUE(period_id, category_id)
);

-- =============================================
-- DAILY NET PROFIT
-- =============================================
CREATE TABLE public.daily_net_profit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.profit_periods(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  net NUMERIC(12,2) NOT NULL DEFAULT 0,
  UNIQUE(period_id, date)
);

CREATE INDEX idx_daily_profit_period ON public.daily_net_profit(period_id);

-- =============================================
-- APP SETTINGS (key-value)
-- =============================================
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_profit_periods_updated_at BEFORE UPDATE ON public.profit_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_app_settings_updated_at BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Entity Relationship Diagram (ASCII)

```
┌──────────┐       ┌──────────────┐       ┌───────────┐
│  users   │       │   orders     │───────▶│ countries │
│──────────│       │──────────────│       └───────────┘
│ id (PK)  │       │ id (PK)      │
│ role     │       │ country_code │       ┌────────────┐
│ email    │       │ customer_id  │──────▶│ customers  │
└──────────┘       │ status       │       └────────────┘
                   │ tracking_no  │
                   └──────┬───────┘
                          │ 1:N
                   ┌──────┴───────┐       ┌───────────┐
                   │ order_items  │──────▶│ products  │
                   └──────────────┘       └───────────┘

┌─────────────────┐       ┌────────────┐       ┌─────────────────────┐
│ profit_periods  │──1:N─▶│  expenses  │──────▶│ expense_categories  │
│                 │       └────────────┘       └─────────────────────┘
│                 │──1:N─▶┌──────────────────┐
└─────────────────┘       │ daily_net_profit │
                          └──────────────────┘

┌───────────────┐
│ app_settings  │  (key-value store for webhook URLs, etc.)
└───────────────┘
```

---

## 8. Migration Mapping (Firestore → Supabase)

| Firestore | Supabase | Notes |
|-----------|----------|-------|
| `users/{uid}` | `public.users` | Link to `auth.users` via FK |
| `roles_admin/{uid}` | `users.role = 'ADMIN'` | Eliminate separate collection |
| `orders/{cc}/orders/{id}` | `public.orders` + `public.order_items` | Normalize embedded data |
| `orders.customer` (embedded) | `public.customers` | Extract to own table |
| `orders.items[]` (embedded) | `public.order_items` + `public.products` | Normalize array |
| `settings/tracking` | `public.app_settings` | Key-value pattern |
| `metrics/profit-stats` | `profit_periods` + `expenses` + `daily_net_profit` | Normalize single doc |
| Firebase Auth | Supabase Auth | Built-in, email/password |
| Custom claims (`role`) | `users.role` + RLS policies | Database-level enforcement |
| Cloud Function (webhook) | Supabase Database Webhook or Edge Function | Trigger on order update |

---

*Generated by @data-engineer (Dara) — Brownfield Discovery Phase 2*
