# Database Specialist Review — Technical Debt DRAFT

**Phase:** Brownfield Discovery - Phase 5
**Author:** @data-engineer (Dara)
**Date:** 2026-03-02
**Reviewing:** `technical-debt-DRAFT.md` (Phase 4, @architect)
**Status:** Complete

---

## 1. Review Verdict

**APPROVED WITH AMENDMENTS** — The draft accurately represents the database-layer debt. I'm adding refinements to severity, effort estimates, and schema design corrections.

---

## 2. Severity Adjustments

### Upgrades (should be higher severity)

| ID | Current | Proposed | Rationale |
|----|---------|----------|-----------|
| **TD-M4** | MEDIUM | **HIGH** | Audit logging is critical for e-commerce. Without it, there's no way to investigate order disputes, unauthorized changes, or financial discrepancies. For a business handling real money and real shipments, this is not optional. |
| **TD-M12** | MEDIUM | **HIGH** | No staging environment means every Supabase migration runs directly against production data. One bad migration = irreversible data loss. Must have staging before migration begins. |

### Downgrades (can be lower severity)

| ID | Current | Proposed | Rationale |
|----|---------|----------|-----------|
| **TD-C7** | CRITICAL | **HIGH** | No migration system is a real problem, but since we're migrating to Supabase (which has built-in migrations), spending time setting up a Firestore migration system is waste. This resolves itself during migration. |
| **TD-M14** | MEDIUM | **LOW** | Firestore auto-creates indexes for most queries. Only relevant if users report query failures, which they haven't. And it becomes irrelevant after Supabase migration. |

### Confirmed (severity is correct)

| ID | Severity | Note |
|----|----------|------|
| **TD-C1** | CRITICAL | Correct — any user can corrupt order data right now |
| **TD-C2** | CRITICAL | Correct — webhook redirect is a real exfiltration vector |
| **TD-C3** | CRITICAL | Correct — Admin SDK bypasses all Firestore rules |
| **TD-C6** | CRITICAL | Correct — one webhook consumer is silently broken |
| **TD-C8** | CRITICAL | Correct — Firestore has no automatic backups by default |
| **TD-H4** | HIGH | Correct — triple role storage is a ticking time bomb |
| **TD-H5** | HIGH | Correct — trivial fix, immediate latency improvement |

---

## 3. Effort Estimate Corrections

| ID | Draft Estimate | Revised | Rationale |
|----|---------------|---------|-----------|
| **TD-C1** | 1h | **30min** | Simple Firestore rules change, one line |
| **TD-C2** | 1h | **30min** | Same — add admin check to settings rules |
| **TD-C3** | 2h | **3h** | Need to add auth checks to ALL Server Actions + test each one |
| **TD-C8** | 1h | **15min** | Firestore scheduled backups: `gcloud firestore export gs://bucket` via console or CLI |
| **TD-H4** | 4h | **2h (in Firebase)** or **0h (skip to Supabase)** | If migrating soon, don't fix — Supabase eliminates this entirely |
| **TD-M5** | 4h | **0h (skip)** | Don't fix in Firestore. Supabase schema already normalizes this. |
| **TD-M6** | 4h | **0h (skip)** | Same — Supabase customers table resolves this. |

**Revised Critical Effort: ~7 hours** (down from 11h — skip TD-C7 migration system, faster on rules/backup)

---

## 4. Schema Design Review

### 4.1 Proposed Schema Validation (from SCHEMA.md §7)

**Overall: SOLID** — The proposed Supabase schema is well-designed. I'm adding corrections and enhancements.

#### Corrections

| Table | Issue | Fix |
|-------|-------|-----|
| `customers` | No deduplication mechanism. Same customer ordering twice creates two rows. | Add `UNIQUE(phone)` or `UNIQUE(name, phone)` composite constraint. Phone is the most reliable dedup key for e-commerce. |
| `products` | Missing `created_at` and `updated_at` columns. | Add standard audit columns per our principles. |
| `orders.id` | TEXT primary key (Shopify ID). No validation. | Add `CHECK (id ~ '^\d+$')` if Shopify IDs are always numeric, or at minimum `CHECK (length(id) > 0)`. |
| `expense_categories` | TEXT primary key (`metaAds`). Fragile if renamed. | Consider UUID PK with `slug TEXT UNIQUE` for the identifier. Keeps FK references stable. |

#### Enhancements

| Enhancement | Table(s) | SQL |
|-------------|---------|-----|
| Customer deduplication | `customers` | `CREATE UNIQUE INDEX idx_customers_phone ON public.customers(phone);` |
| Order search index | `orders` | `CREATE INDEX idx_orders_date ON public.orders(order_date DESC);` |
| Profit period lookup | `profit_periods` | `CREATE INDEX idx_profit_periods_label ON public.profit_periods(period_label);` |
| Full-text search on orders | `orders` + `customers` | Consider `tsvector` column for order/customer search (post-migration optimization) |
| Soft delete on orders | `orders` | Add `deleted_at TIMESTAMPTZ` — orders should never be hard-deleted for audit trail |

#### Missing Table: Audit Log

For e-commerce, an audit log is not optional. Add:

```sql
CREATE TABLE public.audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_table ON public.audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_user ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);
```

With a trigger function:
```sql
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_log (table_name, record_id, action, old_data, new_data, user_id)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id::TEXT, OLD.id::TEXT),
    TG_OP,
    CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Apply to critical tables:
```sql
CREATE TRIGGER audit_orders AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_settings AFTER INSERT OR UPDATE OR DELETE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
```

---

### 4.2 RLS Policy Review

The proposed RLS policies in DB-AUDIT.md §9 are functional but need refinements:

| Policy | Issue | Fix |
|--------|-------|-----|
| `orders_insert_admin` | Subquery to users table on every INSERT. | Cache role in JWT: `(auth.jwt() ->> 'role') = 'ADMIN'`. Faster, no extra query. Requires Supabase Auth hook to set custom claims. |
| `orders_update_admin` | Same subquery issue. | Same fix — use JWT claim. |
| `settings_write_admin` | Uses `FOR ALL` which includes DELETE. | Split into `FOR INSERT`, `FOR UPDATE`. Settings should probably not be deletable. |
| Missing | No policy for `order_items`. | Add: cascades from orders, but still needs RLS. `FOR SELECT` if order is readable, `FOR INSERT/UPDATE` if parent order is writable. |
| Missing | No policy for `products`. | Products are reference data. `FOR SELECT` to all authenticated. `FOR INSERT/UPDATE` to ADMIN only. |
| Missing | No policy for `customers`. | `FOR SELECT` to all authenticated. `FOR INSERT/UPDATE` to ADMIN only. |

**Recommended approach:** Use JWT-based role check instead of subquery for performance:

```sql
-- Helper function (reusable)
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'user_role',
    (SELECT role FROM public.users WHERE id = auth.uid())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Then policies become:
CREATE POLICY "orders_write_admin" ON public.orders
  FOR ALL USING (public.user_role() = 'ADMIN');
```

---

## 5. Migration Roadmap Review

### Phase Ordering: AGREED with one amendment

The draft proposes: Foundation → Data Layer → Auth → Validation.

**Amendment:** Move Auth to Phase A (before Data Layer). Reason: Supabase RLS depends on `auth.uid()`. If Auth isn't set up first, you can't test RLS policies during schema creation. Without RLS working, the data layer has no security.

**Revised order:**

```
Phase A: Foundation + Auth (4 days)
├── Set up Supabase Auth (email/password)
├── Create users table with auth.users FK
├── Set up Supabase schema (remaining tables)
├── Configure RLS policies
├── Create migration scripts
└── Test RLS with real auth tokens

Phase B: Data Migration (3 days)
├── Export Firestore data (JSON)
├── Transform and load into PostgreSQL
├── Verify data integrity (counts, checksums)
└── Set up Supabase Realtime on orders table

Phase C: Application Layer (3 days)
├── Rewrite useDoc/useCollection → Supabase hooks
├── Rewrite Server Actions → Supabase client
├── Replace Cloud Function → DB Webhook or Edge Function
├── Update AuthProvider
└── Implement Next.js middleware

Phase D: Validation & Cleanup (2-3 days)
├── End-to-end testing
├── Remove Firebase dependencies
├── Update environment variables
├── Deploy and verify
└── Monitor for 48h before decommissioning Firebase
```

### Data Migration Strategy (new — missing from draft)

The draft mentions migration but doesn't specify HOW to move Firestore data. Here's the approach:

```
Step 1: Export Firestore collections to JSON
  $ gcloud firestore export gs://mistertuga-backup/pre-migration

Step 2: Transform JSON to CSV/SQL
  - Flatten embedded objects (customer → customers table)
  - Normalize arrays (items[] → order_items rows)
  - Standardize dates to ISO8601/TIMESTAMPTZ
  - Deduplicate customers by phone number
  - Map Firestore document IDs to PostgreSQL IDs

Step 3: Load into Supabase
  - Use Supabase Dashboard import or psql COPY
  - Load in dependency order: countries → customers → products → orders → order_items
  - Verify row counts match

Step 4: User Migration
  - Export Firebase Auth users (firebase-admin listUsers)
  - Create Supabase Auth users (supabase auth admin createUser)
  - Users must reset passwords (Firebase hashes incompatible)
  - Send password reset emails to all users
```

### Effort Estimate Review

| Component | Draft | Revised | Note |
|-----------|-------|---------|------|
| Auth | 2 days | **3 days** | User migration + password reset flow is more complex than estimated. Need to handle existing sessions gracefully. |
| Database | 3 days | **2 days** | Schema is already designed (SCHEMA.md). Mostly mechanical. |
| Real-time | 2 days | **1.5 days** | Supabase Realtime is simpler than Firestore listeners. Fewer edge cases. |
| Data migration | Not listed | **2 days** | Missing from draft. Firestore export → transform → load is non-trivial. |
| Everything else | 5 days | **4.5 days** | Agree with estimates. |

**Revised total: 13-16 working days** (was 12-15). Added data migration effort.

---

## 6. Risk Assessment Additions

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| **Customer deduplication errors** | High | Medium | Build dedup script with manual review for ambiguous matches before migration |
| **Firestore subcollection data loss** | Medium | Critical | Verify ALL country subcollections are exported. Firestore exports can miss subcollections if not explicitly included. |
| **RLS policy too restrictive** | Medium | High | Test every policy with `*test-as-user` before going live. Create test users for each role. |
| **Supabase Realtime connection limits** | Low | Medium | Free tier: 200 concurrent connections. Monitor during testing. |
| **Order ID conflicts** | Low | High | Shopify IDs are unique per store but verify no duplicates exist in Firestore before migration. |

---

## 7. Additional Recommendations

### 7.1 Add Database Webhook for Tracking (replaces Cloud Function)

```sql
-- Supabase Database Webhook (configured via Dashboard or SQL)
-- Trigger: UPDATE on orders WHERE tracking_number changes from NULL to non-NULL
-- Target: Edge Function that sends POST to webhook URL from app_settings

CREATE OR REPLACE FUNCTION notify_tracking_added()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
BEGIN
  IF OLD.tracking_number IS NULL AND NEW.tracking_number IS NOT NULL THEN
    SELECT (value ->> 'url')::TEXT INTO webhook_url
    FROM public.app_settings WHERE key = 'tracking';

    IF webhook_url IS NOT NULL THEN
      PERFORM net.http_post(
        url := webhook_url,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'event', 'tracking_added',
          'orderId', NEW.id,
          'countryCode', NEW.country_code,
          'trackingNumber', NEW.tracking_number,
          'status', NEW.status,
          'updatedAt', now()
        )::text
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_tracking_webhook
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION notify_tracking_added();
```

**Note:** Requires `pg_net` extension (enabled by default in Supabase).

### 7.2 Seed Data Script

Create a seed script from current Firestore data for development:

```sql
-- supabase/seed.sql
INSERT INTO public.countries (code, name) VALUES
  ('PT', 'Portugal'), ('UK', 'United Kingdom'), ('FR', 'France'),
  ('DE', 'Germany'), ('ES', 'Spain'), ('IT', 'Italy')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.expense_categories (id, label, color, recurring) VALUES
  ('metaAds', 'Meta Ads (Facebook / Instagram)', '#a855f7', true),
  ('tiktokAds', 'TikTok Ads', '#ec4899', true),
  ('klaviyo', 'Klaviyo (Email / SMS)', '#22c55e', true),
  ('collaborators', 'Collaborators / Team', NULL, true),
  ('variableCosts', 'Variable Costs', NULL, true)
ON CONFLICT (id) DO NOTHING;
```

### 7.3 Monitoring Checklist (Post-Migration)

| Metric | Tool | Alert Threshold |
|--------|------|----------------|
| RLS policy denials | Supabase Logs | > 10/hour |
| Realtime connection count | Supabase Dashboard | > 150 (of 200 limit) |
| Query latency (p95) | Supabase Dashboard | > 500ms |
| Failed webhooks | Edge Function logs | Any failure |
| Auth failures | Supabase Auth logs | > 20/hour |
| Database size | Supabase Dashboard | > 400MB (of 500MB free tier) |

---

## 8. Summary of Amendments to Draft

| # | Amendment | Impact |
|---|-----------|--------|
| 1 | Upgrade TD-M4 (audit logging) to HIGH | Changes priority order |
| 2 | Upgrade TD-M12 (staging) to HIGH | Must have before migration |
| 3 | Downgrade TD-C7 (migration system) to HIGH | Skip for Firebase, Supabase resolves |
| 4 | Downgrade TD-M14 (Firestore indexes) to LOW | Auto-created, irrelevant post-migration |
| 5 | Add audit_log table to proposed schema | New table (11th) |
| 6 | Add customer deduplication constraint | Schema correction |
| 7 | Move Auth to Phase A of migration | Reorder migration phases |
| 8 | Add data migration step (2 days) | Missing from draft |
| 9 | Revise total effort to 13-16 days | Up from 12-15 |
| 10 | Add JWT-based RLS helper function | Performance improvement |
| 11 | Add webhook trigger function | Replaces Cloud Function |
| 12 | Add monitoring checklist | Post-migration operations |

---

## 9. Next Phase

**Phase 6 → @ux-design-expert (Uma):** Review technical debt draft from frontend/UX perspective → produce `ux-specialist-review.md`.

Activate with: `@ux-design-expert`

---

*Generated by @data-engineer (Dara) — Brownfield Discovery Phase 5*
*— Dara, arquitetando dados 🗄️*
