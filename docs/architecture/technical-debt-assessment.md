# Technical Debt Assessment — FINAL

**Project:** MisterTuga Insights
**Phase:** Brownfield Discovery - Phase 8 (Final Compilation)
**Author:** @architect (Aria)
**Date:** 2026-03-02
**Status:** FINAL — QA Gate APPROVED (Phase 7)

**Sources:**
- Phase 1: `system-architecture.md` (@architect)
- Phase 2: `SCHEMA.md` + `DB-AUDIT.md` (@data-engineer)
- Phase 3: `frontend-spec.md` (@ux-design-expert)
- Phase 4: `technical-debt-DRAFT.md` (@architect)
- Phase 5: `db-specialist-review.md` (@data-engineer) — 12 amendments
- Phase 6: `ux-specialist-review.md` (@ux-design-expert) — 16 amendments
- Phase 7: `qa-review.md` (@qa) — APPROVED, 10 recommendations

---

## 1. Executive Summary

MisterTuga Insights is an e-commerce operations dashboard (Shopify order management + profit analytics) built with **Next.js 14 + Firebase** and scaffolded via Google AI Studio. The codebase is functional and production-deployed but carries **critical security debt**, **zero accessibility**, and **architectural limitations** that require immediate attention before the planned Supabase migration.

### Assessment Scores (by domain)

| Domain | Agent | Score | Verdict |
|--------|-------|-------|---------|
| System Architecture | @architect | 6/10 | Functional but fragile |
| Database Security | @data-engineer | 4/10 | CRITICAL issues |
| Data Integrity | @data-engineer | 3/10 | Multiple consistency risks |
| Database Operations | @data-engineer | 2/10 | No migrations/backups/monitoring |
| Schema Design | @data-engineer | 4/10 | Normalization issues |
| Frontend Quality | @ux-design-expert | 8.1/10 | Strong, optimization opportunities |
| Design System | @ux-design-expert | 9/10 | Excellent token coverage |
| Accessibility | @ux-design-expert | 3/10 | CRITICAL — zero ARIA attributes |
| Responsiveness | @ux-design-expert | 8/10 | Good mobile, weak tablet |

### Weighted Overall: **5.3/10** — Functional but not production-safe

*(Revised down from 5.7 in draft after Phase 6 accessibility findings)*

### Debt Distribution

```
TECHNICAL DEBT DISTRIBUTION (45 items)
═════════════════════════════════════════════════════════
Security          ████████████████████  31% (8 items)
Accessibility     ██████████████        20% (6 items)  ← NEW CATEGORY
Data Integrity    ██████████            13% (6 items)
Operations        ████████              11% (5 items)
Maintainability   ██████                 9% (4 items)
UX/Usability      █████                  7% (3 items)
Performance       ████                   7% (4 items)
Consistency       ███                    4% (3 items)
```

---

## 2. Consolidated Debt Registry

All 45 items with final severities after specialist review and QA validation.

### CRITICAL (9 items) — Must fix before any new development

| ID | Debt | Final Severity | Domain | Effort | Source |
|----|------|---------------|--------|--------|--------|
| **TD-C1** | Firestore orders writable by any authenticated user | CRITICAL | Security | 30min | DB-AUDIT S1 |
| **TD-C2** | Firestore settings writable by any authenticated user | CRITICAL | Security | 30min | DB-AUDIT S2 |
| **TD-C3** | Server Actions have no auth verification | CRITICAL | Security | 3h | DB-AUDIT S3 |
| **TD-C4** | No middleware auth protection | CRITICAL | Security | 3h | Arch C1 |
| **TD-C5** | Build errors suppressed in next.config.js | CRITICAL | Quality | 15min | Arch C2 |
| **TD-C6** | Webhook field name inconsistency (url vs webhookUrl) | CRITICAL | Data Integrity | 30min | DB-AUDIT D2 |
| **TD-C8** | No backup strategy | CRITICAL | Operations | 15min | DB-AUDIT O2 |
| **TD-C9** | **Zero accessibility — no ARIA attributes in entire app** | CRITICAL | Accessibility | 6-8h | FE-Spec 7, **Phase 6 upgrade from HIGH** |
| **TD-C10** | **No empty states anywhere (orders, search, filters, charts)** | CRITICAL | UX | 3h | FE-Spec 8, **Phase 6 upgrade from HIGH** |

**Total Critical Effort: ~14-18 hours** (one focused sprint)

> **Note:** TD-C9 and TD-C10 were TD-H8 and TD-H9 in the draft. Renumbered to reflect their CRITICAL status after Phase 6 specialist review confirmed zero ARIA attributes app-wide and zero empty states across all data views.

---

### HIGH (14 items) — Fix within first sprint

| ID | Debt | Final Severity | Domain | Effort | Source |
|----|------|---------------|--------|--------|--------|
| **TD-H1** | Orders page is 1,704 lines (monolithic, 23 useState hooks) | HIGH | Maintainability | 3-4 days | FE-Spec 4.2, **Phase 6 effort revision** |
| **TD-H2** | Duplicate Firebase initialization (src/lib/firebase vs src/firebase) | HIGH | Architecture | 4h | Arch H2 |
| **TD-H3** | Zero test coverage | HIGH | Quality | Ongoing | Arch H4 |
| **TD-H4** | Role stored in 3 places (Auth claims, users, roles_admin) | HIGH | Data Integrity | 2h (Firebase) or 0h (skip to Supabase) | DB-AUDIT S4, **Phase 5 effort revision** |
| **TD-H5** | Cloud Function deployed to us-central1 (data in europe-west1) | HIGH | Performance | 30min | DB-AUDIT P3 |
| **TD-H6** | Admin self-registration via environment variable code | HIGH | Security | 4h | DB-AUDIT S5 |
| **TD-H7** | No error boundary components | HIGH | UX | 2h | Arch H3 |
| **TD-H10** | No monitoring or alerting | HIGH | Operations | 4h | DB-AUDIT O3 |
| **TD-H11** | **No skip navigation link (WCAG 2.4.1 Level A)** | HIGH | Accessibility | 30min | **Phase 6 — NEW** |
| **TD-H12** | **Charts have no accessible description (WCAG 1.1.1 Level A)** | HIGH | Accessibility | 1h | **Phase 6 — NEW** |
| **TD-H13** | **Toast notifications not announced to screen readers (WCAG 4.1.3)** | HIGH | Accessibility | 2h | **Phase 6 — NEW** |
| **TD-H14** | No database migration system | HIGH | Operations | 0h (Supabase resolves) | DB-AUDIT O1, **Phase 5 downgrade from CRITICAL** |
| **TD-H15** | **No audit logging for e-commerce operations** | HIGH | Operations | 4h | DB-AUDIT S8, **Phase 5 upgrade from MEDIUM** |
| **TD-H16** | **No staging environment — migrations run against production** | HIGH | Operations | 4h | DB-AUDIT O5, **Phase 5 upgrade from MEDIUM** |

> **Note:** TD-H11, H12, H13 are new items from Phase 6 UX review. TD-H14 (was TD-C7) downgraded by Phase 5 — Supabase resolves this. TD-H15 (was TD-M4) and TD-H16 (was TD-M12) upgraded by Phase 5.

---

### MEDIUM (13 items) — Plan for migration sprint

| ID | Debt | Final Severity | Domain | Effort | Source |
|----|------|---------------|--------|--------|--------|
| **TD-M1** | Client-side only route protection | MEDIUM | Security | 3h | Arch M2 |
| **TD-M2** | No API rate limiting on Server Actions | MEDIUM | Security | 2h | DB-AUDIT S6 |
| **TD-M3** | Webhook URL not validated (SSRF risk) | MEDIUM | Security | 1h | DB-AUDIT S7 |
| **TD-M5** | Profit stats in single Firestore document | MEDIUM | Scalability | 0h (Supabase resolves) | DB-AUDIT D5 |
| **TD-M6** | Customer data embedded, not normalized | MEDIUM | Data Quality | 0h (Supabase resolves) | DB-AUDIT D6 |
| **TD-M7** | Date handling inconsistency (ISO, Timestamp, Unix) | MEDIUM | Data Integrity | 0h (Supabase TIMESTAMPTZ) | DB-AUDIT D4 |
| **TD-M8** | No caching strategy | MEDIUM | Performance | 4h | Arch M3 |
| **TD-M10** | PDF/Excel libraries loaded eagerly (~800KB) | MEDIUM | Performance | 1h | FE-Spec 10, **Phase 6 effort revision** |
| **TD-M11** | Mixed Portuguese/English UI text | MEDIUM | UX Consistency | 4-6h | FE-Spec 9, **Phase 6 effort revision** |
| **TD-M13** | Role naming inconsistency (BASIC vs FORNECEDOR) | MEDIUM | Data Integrity | 1h | DB-AUDIT SD4 |
| **TD-M14** | **Inline style={{}} overrides Tailwind token system** | MEDIUM | Design System | 2h | FE-Spec 9, **Phase 6 upgrade from LOW** |
| **TD-M15** | **No loading skeletons — spinner-only UX** | MEDIUM | UX | 4h | **Phase 6 — NEW** |
| **TD-M16** | **No mobile-optimized table view for orders** | MEDIUM | Responsiveness | 4h | **Phase 6 — NEW** |

---

### LOW (8 items) — Address during normal development

| ID | Debt | Final Severity | Domain | Effort | Source |
|----|------|---------------|--------|--------|--------|
| **TD-L1** | Package name mismatch ("nextn" vs "mistertuga") | LOW | DX | 5min | Arch L1 |
| **TD-L2** | Empty AI flows file (unused Genkit dependency) | LOW | Bundle Size | 15min | Arch L2 |
| **TD-L3** | Placeholder images utility (dead code) | LOW | Cleanliness | 5min | Arch L3 |
| **TD-L6** | Custom shadows not tokenized | LOW | Design System | 30min | FE-Spec 9 |
| **TD-L7** | No memoization in heavy components | LOW | Performance | 1h | FE-Spec 10, **Phase 6 effort revision** |
| **TD-L8** | Supabase linked but unused | LOW | Clarity | 0 (decision) | Arch M6 |
| **TD-L9** | **Typo: "avaiable" → "available" in production** | LOW | Content | 1min | **Phase 6 — NEW** |
| **TD-L10** | **No composite Firestore indexes declared** | LOW | Performance | 0h (irrelevant post-migration) | DB-AUDIT P2, **Phase 5 downgrade from MEDIUM** |

### COSMETIC (1 item)

| ID | Debt | Final Severity | Domain | Effort | Source |
|----|------|---------------|--------|--------|--------|
| **TD-X1** | Login button gradient differs from rest of app | COSMETIC | Design | 0h (intentional) | FE-Spec 9, **Phase 6 downgrade — deliberate design choice** |

### Unused shadcn/ui components (~8-10)

Downgraded from MEDIUM to informational. shadcn/ui components are local copies — tree-shaking handles unused code. Impact is ~20-30KB, not the 50-100KB originally estimated. Address opportunistically during development.

---

## 3. Migration Roadmap (Firebase → Supabase)

### 3.1 Strategic Decision: Migration IS the Fix

Many debts resolve themselves during migration. The following items should NOT be fixed in Firebase:

| ID | Why Skip in Firebase | How Supabase Resolves |
|----|---------------------|----------------------|
| TD-H4 | Triple role storage | Single `users.role` column + RLS |
| TD-H14 | No migration system | Supabase built-in migrations |
| TD-M1 | Client-side only auth | Supabase middleware + RLS |
| TD-M5 | Single document profit stats | Normalized tables (3 tables) |
| TD-M6 | Embedded customer data | Normalized `customers` table |
| TD-M7 | Date inconsistency | PostgreSQL `TIMESTAMPTZ` everywhere |
| TD-M13 | Role naming inconsistency | Clean `CHECK` constraint enum |
| TD-L10 | Missing Firestore indexes | PostgreSQL indexes by design |

### 3.2 Pre-Migration Critical Fixes (DO NOW — ~5.5 hours)

These must be fixed BEFORE migration begins. They are active security vulnerabilities.

| # | ID | Action | Effort |
|---|-----|--------|--------|
| 1 | TD-C1 | Restrict Firestore orders write to ADMIN | 30min |
| 2 | TD-C2 | Restrict Firestore settings write to ADMIN | 30min |
| 3 | TD-C3 | Add auth verification to ALL Server Actions | 3h |
| 4 | TD-C5 | Remove `ignoreBuildErrors` from next.config.js | 15min |
| 5 | TD-C6 | Standardize webhook field name | 30min |
| 6 | TD-C8 | Enable Firestore scheduled backups | 15min |
| 7 | TD-H5 | Fix Cloud Function region to europe-west1 | 30min |
| 8 | TD-L9 | Fix "avaiable" typo | 1min |

### 3.3 Migration Phases (Revised with Phase 5 + Phase 6 amendments)

Two scenarios validated by QA (Phase 7):

| Scenario | Scope | Duration | Risk |
|----------|-------|----------|------|
| **A: Minimum Viable Migration** | Functional parity only | 17-20 days | Carries forward UX debt, orders page rewrite risky at 1,704 lines |
| **B: Quality Migration** (recommended) | Migration + decomposition + accessibility + UX | 21-25.5 days | Ships with improved quality, lower post-migration debt |

> **QA recommendation:** Scenario B is the realistic choice. The orders page decomposition (3-4 days) is practically required — rewriting 1,704 lines of Firestore hooks to Supabase hooks in a single monolithic file is higher risk than decomposing first.

#### Phase A: Foundation + Auth (4 days)

```
[PREREQUISITE: Pre-migration critical fixes complete (~5.5h)]

├── Set up Supabase Auth (email/password)
├── Create users table with auth.users FK
├── Set up Supabase schema (from SCHEMA.md §7)
│   ├── Apply Phase 5 schema corrections:
│   │   ├── Add UNIQUE(phone) on customers table
│   │   ├── Add created_at/updated_at on products
│   │   ├── Add CHECK constraint on orders.id
│   │   └── Consider UUID PK for expense_categories
│   └── Add audit_log table (Phase 5 addition — see Appendix A)
├── Configure RLS policies
│   ├── Use JWT-based role helper function (Phase 5 recommendation)
│   ├── Split settings FOR ALL → FOR INSERT + FOR UPDATE
│   ├── Add missing policies: order_items, products, customers
│   └── Test every policy with test users per role
├── Create Supabase migration scripts
└── Test RLS with real auth tokens
```

#### Phase B: Data Migration (3 days)

```
[DEPENDS ON: Phase A complete]

├── Export Firestore collections to JSON
│   └── CRITICAL: Verify ALL country subcollections are exported
│       (Firestore exports can miss subcollections — Phase 5 risk)
├── Transform JSON → PostgreSQL format
│   ├── Flatten embedded objects (customer → customers table)
│   ├── Normalize arrays (items[] → order_items rows)
│   ├── Standardize dates to TIMESTAMPTZ
│   ├── Deduplicate customers by phone number
│   │   └── Build dedup script with manual review for ambiguous matches
│   └── Map Firestore document IDs to PostgreSQL IDs
├── Load into Supabase
│   └── Dependency order: countries → customers → products → orders → order_items
├── Verify data integrity (row counts, checksums)
└── Set up Supabase Realtime on orders table
```

#### Phase C: Application Layer (5-7 days)

```
[DEPENDS ON: Phase A (auth) + Phase B (data)]

├── Decompose orders page (Phase 6 plan — see Appendix B)
│   ├── Extract 9 components + 4 hooks
│   ├── Reduce page.tsx from 23 useState to ~4
│   └── Follow 7-step extraction order
├── Rewrite Firebase hooks → Supabase
│   ├── useCollection() → Supabase Realtime channels
│   ├── useDoc() → Supabase .select().single() + Realtime
│   └── Server Actions: Admin SDK → Supabase service client
├── Replace Cloud Function → Database Webhook (Phase 5 SQL provided)
├── Fix accessibility (TD-C9, TD-H11, TD-H12, TD-H13)
│   ├── aria-live on Toaster component (global fix)
│   ├── Skip navigation link in root layout
│   ├── aria-label on all icon-only buttons (~30+)
│   ├── aria-describedby on form validation
│   ├── role="img" + aria-label on charts
│   └── aria-current="page" on active nav
├── Add empty states (TD-C10)
│   ├── Orders list (0 orders)
│   ├── Search results (0 matches)
│   ├── Filtered views (0 in country)
│   └── Chart data ("No data for this period")
├── Add skeleton loaders (TD-M15)
├── Standardize UI language to English (TD-M11)
├── Implement Next.js middleware with Supabase Auth
├── Update AuthProvider
└── Migrate users
    ├── Export Firebase Auth users
    ├── Create Supabase Auth users
    └── Send password reset emails to all users
```

#### Phase D: Validation & Cleanup (2-3 days)

```
[DEPENDS ON: Phase C]

├── End-to-end testing
│   ├── Test all user flows per role (ADMIN, FORNECEDOR)
│   ├── Test real-time order updates
│   ├── Test webhook trigger on tracking number
│   └── Test PDF/Excel export
├── Remove Firebase dependencies
│   ├── Remove firebase, firebase-admin packages
│   ├── Remove src/firebase/ and src/lib/firebase/ directories
│   ├── Remove functions/ directory
│   └── Remove Firebase environment variables
├── Update environment variables (Supabase)
├── Deploy to Vercel (recommended) or keep Firebase Hosting
├── Monitor for 48h using Phase 5 monitoring checklist (see §6)
└── Keep Firebase live for 2 weeks as rollback target
```

---

## 4. Risk Assessment (Consolidated)

| Risk | Probability | Impact | Source | Mitigation |
|------|------------|--------|--------|------------|
| **Data loss during migration** | Medium | Critical | Phase 4 | Firestore backup before migration, verify ALL subcollections exported |
| **Customer deduplication errors** | High | Medium | Phase 5 | Build dedup script with manual review for ambiguous matches |
| **Firestore subcollection data loss** | Medium | Critical | Phase 5 | Explicitly include all country subcollections in export |
| **User password migration** | High | High | Phase 4 | Supabase can't import Firebase hashes — require password reset |
| **RLS policy too restrictive** | Medium | High | Phase 5 | Test every policy with test users for each role before go-live |
| **Real-time feature regression** | Medium | High | Phase 4 | Test Supabase Realtime latency matches Firestore |
| **Supabase Realtime connection limits** | Low | Medium | Phase 5 | Free tier: 200 concurrent. Monitor during testing |
| **Order ID conflicts** | Low | High | Phase 5 | Verify no duplicate Shopify IDs in Firestore before migration |
| **Orders page decomposition breaks real-time** | Medium | High | Phase 6 | Verify real-time updates after each extraction step |
| **Webhook disruption** | Low | Medium | Phase 4 | Maintain Firebase Cloud Function until Supabase webhook verified |
| **Supabase free tier storage** | Low | Medium | QA Phase 7 | Verify current data fits within 500MB limit |
| **Downtime during cutover** | Medium | Medium | Phase 4 | Plan maintenance window or blue-green deploy |

---

## 5. Decision Points

| # | Decision | Options | Recommendation | Status |
|---|----------|---------|---------------|--------|
| D1 | Fix Firebase security NOW or wait? | Fix now / Wait | **Fix now** — active vulnerabilities | DECIDED |
| D2 | Migration timeline? | Immediate / Next sprint | **Next sprint** — after critical fixes | DECIDED |
| D3 | User auth migration strategy? | Password reset / Manual / Dual auth | **Password reset** — cleanest | DECIDED |
| D4 | Keep Firebase hosting or move? | Firebase / Vercel / Railway | **Vercel** — better Next.js DX | PENDING |
| D5 | Decompose orders page when? | Before / During / After migration | **During** — natural break point | DECIDED |
| D6 | UI language standardization? | English / Portuguese / i18n | **English first**, i18n post-migration | PENDING |
| D7 | Migration scenario? | A (minimum) / B (quality) | **Scenario B** — QA recommended | PENDING |

---

## 6. Post-Migration Monitoring Checklist

From Phase 5 (@data-engineer):

| Metric | Tool | Alert Threshold |
|--------|------|----------------|
| RLS policy denials | Supabase Logs | > 10/hour |
| Realtime connection count | Supabase Dashboard | > 150 (of 200 limit) |
| Query latency (p95) | Supabase Dashboard | > 500ms |
| Failed webhooks | Edge Function logs | Any failure |
| Auth failures | Supabase Auth logs | > 20/hour |
| Database size | Supabase Dashboard | > 400MB (of 500MB free tier) |

---

## 7. Rollback Strategy

Per QA recommendation (Phase 7, gap 7.2):

```
ROLLBACK PLAN
═════════════

Trigger: Any CRITICAL issue found within 48h of migration go-live

Step 1: Revert DNS/routing to Firebase Hosting
Step 2: Firebase remains fully functional (kept live for 2 weeks)
Step 3: Investigate Supabase issue
Step 4: Fix and re-attempt migration

Data Sync During Rollback Period:
- If orders were created in Supabase during live period,
  export and manually import back to Firestore
- Keep both systems in read-only during investigation

Timeline:
- Day 0: Go live on Supabase
- Day 0-2: Active monitoring (Phase 5 checklist)
- Day 2-14: Firebase kept as warm standby
- Day 14: If no issues, decommission Firebase
```

---

## 8. Brownfield Discovery Summary

### Phase Completion Record

| Phase | Agent | Deliverable | Status |
|-------|-------|-------------|--------|
| 1 | @architect (Aria) | `system-architecture.md` | COMPLETE |
| 2 | @data-engineer (Dara) | `SCHEMA.md` + `DB-AUDIT.md` | COMPLETE |
| 3 | @ux-design-expert (Uma) | `frontend-spec.md` | COMPLETE |
| 4 | @architect (Aria) | `technical-debt-DRAFT.md` | COMPLETE (superseded by this document) |
| 5 | @data-engineer (Dara) | `db-specialist-review.md` | COMPLETE — 12 amendments |
| 6 | @ux-design-expert (Uma) | `ux-specialist-review.md` | COMPLETE — 16 amendments |
| 7 | @qa (Quinn) | `qa-review.md` | COMPLETE — APPROVED (10/10 checks) |
| 8 | @architect (Aria) | `technical-debt-assessment.md` | COMPLETE — this document |
| 9 | @analyst | `TECHNICAL-DEBT-REPORT.md` | NEXT |
| 10 | @pm | Epic + stories | PENDING |

### Key Metrics

| Metric | Value |
|--------|-------|
| Total debt items | 45 |
| Critical items | 9 |
| Pre-migration fix effort | ~5.5 hours |
| Migration effort (Scenario B) | 21-25.5 working days |
| Documents produced | 8 |
| Specialist amendments | 28 |
| QA checks passed | 10/10 |
| Cross-review conflicts | 0 |

---

## Appendix A: Audit Log Table (Phase 5)

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

-- Trigger function
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

-- Apply to critical tables
CREATE TRIGGER audit_orders AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_settings AFTER INSERT OR UPDATE OR DELETE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
```

---

## Appendix B: Orders Page Decomposition Plan (Phase 6)

### Target Architecture

```
src/app/(app)/master-shopify-orders/
├── page.tsx                    # Orchestrator (~250 lines, 4 useState)
├── components/
│   ├── OrdersTable.tsx         # Organism — table + pagination (~300 lines)
│   ├── OrderRow.tsx            # Molecule — single order row (~150 lines)
│   ├── OrderEditDialog.tsx     # Organism — edit form modal (~200 lines)
│   ├── OrderFilters.tsx        # Molecule — search + date + status (~150 lines)
│   ├── CountryTabs.tsx         # Molecule — country tab navigation (~80 lines)
│   ├── ExportControls.tsx      # Molecule — PDF + Excel buttons (~100 lines)
│   ├── OrderStatusBadge.tsx    # Atom — status chip (~30 lines)
│   ├── TrackingInput.tsx       # Atom — inline tracking edit (~60 lines)
│   └── OrderEmptyState.tsx     # Atom — zero results message (~40 lines)
├── hooks/
│   ├── useOrders.ts            # Data fetching + real-time sync (~100 lines)
│   ├── useOrderFilters.ts      # Filter state + logic (~80 lines)
│   ├── usePdfExport.ts         # PDF generation (~120 lines)
│   └── useExcelExport.ts       # Excel generation (~80 lines)
└── types.ts                    # Shared types (~40 lines)
```

### State Reduction

| Hook Group | Current (page.tsx) | After Decomposition | Reduction |
|-----------|-------------------|--------------------|-----------|
| Filter state | 6 hooks | 1 (useOrderFilters) | -5 |
| Export state | 4 hooks | 2 (usePdfExport + useExcelExport) | -2 |
| Table state | 5 hooks | 0 (local to OrdersTable) | -5 |
| Edit dialog | 4 hooks | 0 (local to OrderEditDialog) | -4 |
| Data state | 3 hooks | 1 (useOrders) | -2 |
| Remaining | 1 hook | 1 | 0 |
| **Total** | **23** | **~4** | **83% reduction** |

### Extraction Order

1. Extract `types.ts` (0 dependencies)
2. Extract atoms (OrderStatusBadge, TrackingInput, OrderEmptyState)
3. Extract hooks (useOrders, useOrderFilters)
4. Extract molecules (OrderRow, OrderFilters, CountryTabs)
5. Extract organisms (OrdersTable, OrderEditDialog, ExportControls)
6. Rewrite page.tsx as orchestrator
7. Verify real-time updates end-to-end

---

## Appendix C: Webhook Trigger Function (Phase 5)

Replaces Firebase Cloud Function with Supabase database trigger:

```sql
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

Requires `pg_net` extension (enabled by default in Supabase).

---

## Appendix D: RLS Helper Function (Phase 5)

JWT-based role check for performant RLS policies:

```sql
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'user_role',
    (SELECT role FROM public.users WHERE id = auth.uid())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Usage in policies:
CREATE POLICY "orders_write_admin" ON public.orders
  FOR ALL USING (public.user_role() = 'ADMIN');
```

---

## Next Phase

**Phase 9 → @analyst (Alex):** Transform this assessment into the executive `TECHNICAL-DEBT-REPORT.md` with business impact analysis, cost quantification, and strategic recommendations.

Activate with: `@analyst`

---

*Generated by @architect (Aria) — Brownfield Discovery Phase 8*
*— Aria, arquitetando o futuro 🏗️*
