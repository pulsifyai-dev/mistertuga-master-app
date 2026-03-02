# DB-AUDIT.md — Database Security & Quality Audit

**Phase:** Brownfield Discovery - Phase 2
**Author:** @data-engineer (Dara)
**Date:** 2026-03-02
**Status:** Draft

---

## 1. Audit Summary

| Category | Score | Verdict |
|----------|-------|---------|
| **Security** | 4/10 | CRITICAL issues found |
| **Data Integrity** | 3/10 | Multiple consistency risks |
| **Performance** | 5/10 | Acceptable for current scale |
| **Schema Design** | 4/10 | Significant normalization issues |
| **Operations** | 2/10 | No migrations, no backups, no monitoring |
| **Overall** | 3.6/10 | NEEDS SIGNIFICANT WORK |

---

## 2. Security Findings

### CRITICAL

#### S1: Orders collection — any authenticated user can write any order
**Location:** `firestore.rules:71-73`
```
match /orders/{countryCode}/orders/{orderId} {
  allow read, write: if isSignedIn();
}
```
**Risk:** Any authenticated user (including FORNECEDOR) can modify, delete, or create orders for any country. There is no ownership model, no role check, and no field-level validation.

**Impact:** Data corruption, unauthorized modifications, potential fraud.

**Recommendation:**
- Restrict write to ADMIN role or implement field-level validation
- At minimum, add audit fields (updatedBy, updatedAt) enforced by rules
- Consider read restrictions per country code for FORNECEDOR role

---

#### S2: Settings collection — any authenticated user can write
**Location:** `firestore.rules:93-95`
```
match /settings/{settingId} {
  allow read, write: if isSignedIn();
}
```
**Risk:** A FORNECEDOR user can change the webhook URL to redirect order data to a malicious endpoint. Settings should be ADMIN-only write.

**Impact:** Data exfiltration via webhook redirect.

**Recommendation:**
```
allow read: if isSignedIn();
allow write: if isSignedIn() && get(/databases/$(database)/documents/roles_admin/$(request.auth.uid)).data != null;
```

---

#### S3: No server-side auth verification on Server Actions
**Location:** `src/app/(app)/master-shopify-orders/actions.ts`

The `updateOrderDetails()` server action does not verify the caller's authentication or role. Anyone who can call the endpoint can modify orders.

**Impact:** Unauthorized data modification bypassing Firestore rules (since Admin SDK bypasses rules).

**Recommendation:** Add `auth()` check at the top of every server action:
```typescript
const session = await getServerSession();
if (!session) throw new Error('Unauthorized');
```

---

### HIGH

#### S4: Role stored in three places — sync risk
**Locations:**
1. Firebase Auth custom claims (`role`)
2. Firestore `users/{uid}.role`
3. Firestore `roles_admin/{uid}` (existence)

**Risk:** If one source is updated without the others, authorization can become inconsistent. For example, removing a user from `roles_admin` doesn't revoke their custom claim.

**Recommendation:** Single source of truth — use Supabase `users.role` column with RLS policies (eliminates this entirely).

---

#### S5: Admin registration code in environment variable
**Location:** `src/app/login/actions.ts:22`
```typescript
const adminRegistrationCode = process.env.ADMIN_REGISTRATION_CODE;
```
**Risk:** Simple string comparison for admin elevation. If the code leaks, anyone can register as admin.

**Recommendation:** Remove self-service admin registration. Admins should be promoted by existing admins via a protected admin panel.

---

### MEDIUM

#### S6: No rate limiting on authentication
**Risk:** Brute-force attacks on login and admin code.

#### S7: Webhook URL not validated
**Location:** `actions.ts:78` — `fetch(webhookUrl)` with no URL validation.
**Risk:** SSRF (Server-Side Request Forgery) if webhook URL is set to internal network addresses.

#### S8: No audit logging
**Risk:** No trail of who changed what and when. Critical for e-commerce operations.

---

## 3. Data Integrity Findings

### CRITICAL

#### D1: No schema validation on Firestore writes (client-side)
The profit stats page writes directly to Firestore from the client:
```typescript
await setDoc(profitRef, dummyProfitDoc);  // No validation
await updateDoc(profitRef, { ... });       // No validation
```
**Risk:** Malformed data, type mismatches, missing fields.

---

#### D2: Webhook field name inconsistency
| Consumer | Field | File |
|----------|-------|------|
| Cloud Function | `settings/tracking.url` | `functions/src/index.ts:30` |
| Server Action | `settings/tracking.webhookUrl` | `actions.ts:56` |

**Risk:** One consumer silently fails if only the other field is populated.

**Recommendation:** Standardize to a single field name.

---

### HIGH

#### D3: No foreign key enforcement (Firestore limitation)
- Orders reference customers by embedded object (no ID)
- Products are embedded in order items (no separate catalog)
- No referential integrity between collections

**Impact:** Orphaned data, inconsistent references.

---

#### D4: Date handling inconsistency
| Location | Format |
|----------|--------|
| `users.createdAt` | ISO8601 string (`new Date().toISOString()`) |
| `orders.date` | Firestore Timestamp OR string (inconsistent) |
| `profit-stats.dailyNetProfit[].date` | Date string ("2025-12-01") |
| `webhook.updatedAt` (CF) | Unix timestamp (`Date.now()`) |
| `webhook.updatedAt` (SA) | ISO8601 string |

**Risk:** Comparison and sorting errors, timezone ambiguity.

**Recommendation:** Standardize on ISO8601 with timezone (or Supabase `TIMESTAMPTZ`).

---

### MEDIUM

#### D5: Profit stats is a single document
All profit data lives in one Firestore document (`metrics/profit-stats`). As the business grows:
- Document size limit (1MB) will be reached
- No historical periods support
- Concurrent edits can overwrite each other

#### D6: Customer data embedded, not normalized
Same customer ordering multiple times creates duplicate data with no linking. No way to query "all orders for customer X" across countries.

---

## 4. Performance Findings

### MEDIUM

#### P1: No pagination on orders collection
The orders page loads ALL orders for a country in one listener. As order volume grows, this will cause:
- High bandwidth usage
- Slow initial load
- Memory pressure on client

**Recommendation:** Implement cursor-based pagination with `limit()` and `startAfter()`.

---

#### P2: No composite indexes declared
Firestore may auto-create indexes, but there are no explicit index declarations in `firebase.json` or a `firestore.indexes.json` file. Complex queries may fail at runtime.

---

#### P3: Cloud Function in wrong region
**Location:** `functions/src/index.ts:56`
```typescript
region: "us-central1"
```
But the Firestore and App Hosting are in `europe-west1`. Cross-region function execution adds latency.

**Recommendation:** Change to `region: "europe-west1"`.

---

## 5. Schema Design Findings

### HIGH

#### SD1: Denormalized single-document design for profit stats
Everything in one document prevents:
- Historical period tracking
- Per-expense querying
- Multi-currency support
- Concurrent editing

The proposed Supabase schema (see SCHEMA.md §7) normalizes this into 3 tables.

---

#### SD2: Subcollection pattern for orders adds complexity
`orders/{countryCode}/orders/{orderId}` — the subcollection pattern requires knowing the country code to access an order. Cross-country queries are impossible without collection group queries.

**In Supabase:** Flat `orders` table with `country_code` column + index. Simple `WHERE country_code = ?` or no filter for all orders.

---

#### SD3: No `updated_at` timestamps on most entities
Only the webhook payload adds `updatedAt`. Firestore documents have no built-in tracking.

**In Supabase:** `updated_at` column with automatic trigger on all tables.

---

### MEDIUM

#### SD4: Role naming inconsistency
| Location | Values |
|----------|--------|
| `signUp()` action | "ADMIN", "BASIC" |
| `auth-provider.tsx` | "ADMIN", "FORNECEDOR" |
| `docs/backend.json` | "ADMIN", "BASIC" |

"BASIC" and "FORNECEDOR" may be the same role or different. This is unclear and inconsistent.

---

## 6. Operations Findings

### CRITICAL

#### O1: No migration system
No version-controlled database migrations. Schema changes happen ad-hoc via console or client code.

#### O2: No backup strategy
No automated Firestore backups configured. Data loss is permanent.

#### O3: No monitoring or alerting
No monitoring on:
- Cloud Function failures
- Webhook delivery failures
- Firestore quota usage
- Authentication anomalies

---

### HIGH

#### O4: No seed data or fixtures
Development relies on dummy data created by client code (profit stats page initializes with hardcoded values).

#### O5: No staging environment
Only one Firebase project detected. No staging/production separation.

---

## 7. Supabase Migration Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Real-time listeners → Supabase Realtime | Medium | Supabase supports real-time via channels, but API differs |
| Firebase Auth → Supabase Auth | Medium | User migration requires password reset or manual import |
| Firestore subcollections → flat tables | Low | Simplifies queries |
| Cloud Functions → Edge Functions/DB Webhooks | Medium | Different trigger model |
| Client SDK change | High | All `useDoc`/`useCollection` hooks must be rewritten |
| Admin SDK → Supabase service role | Low | Similar pattern |
| No existing migrations | Benefit | Clean start with proper migration system |

---

## 8. Recommended Priority Actions

### Immediate (before any new development)

| # | Action | Severity |
|---|--------|----------|
| 1 | Fix Firestore rules: restrict orders write to ADMIN | CRITICAL |
| 2 | Fix Firestore rules: restrict settings write to ADMIN | CRITICAL |
| 3 | Add auth verification to Server Actions | CRITICAL |
| 4 | Fix webhook field name inconsistency (url vs webhookUrl) | CRITICAL |
| 5 | Fix Cloud Function region (us-central1 → europe-west1) | HIGH |

### Before Supabase Migration

| # | Action |
|---|--------|
| 6 | Decide: migrate to Supabase or keep Firebase? |
| 7 | If migrating: design RLS policies (see proposed schema) |
| 8 | If migrating: plan user auth migration strategy |
| 9 | Set up Supabase migrations workflow |
| 10 | Create seed data from current Firestore data |

### Post-Migration

| # | Action |
|---|--------|
| 11 | Implement RLS policies on all tables |
| 12 | Set up database backups (Supabase does this automatically) |
| 13 | Rewrite Firestore hooks to Supabase client |
| 14 | Replace Cloud Function with Supabase Database Webhook |
| 15 | Set up monitoring and alerting |

---

## 9. Proposed RLS Policies (Supabase)

```sql
-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profit_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_net_profit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- USERS: owner can read/update own profile
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- ORDERS: all authenticated can read, only ADMIN can write
CREATE POLICY "orders_select_authenticated" ON public.orders
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "orders_insert_admin" ON public.orders
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );
CREATE POLICY "orders_update_admin" ON public.orders
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- APP SETTINGS: all can read, only ADMIN can write
CREATE POLICY "settings_select_authenticated" ON public.app_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "settings_write_admin" ON public.app_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- PROFIT: only ADMIN can read/write
CREATE POLICY "profit_admin_only" ON public.profit_periods
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );
CREATE POLICY "expenses_admin_only" ON public.expenses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );
CREATE POLICY "daily_profit_admin_only" ON public.daily_net_profit
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );
```

---

## 10. Next Phase

**Phase 3 → @ux-design-expert (Uma):** Frontend architecture assessment, component audit, and UX evaluation.

Activate with: `@ux-design-expert`

---

*Generated by @data-engineer (Dara) — Brownfield Discovery Phase 2*
*— Dara, arquitetando dados 🗄️*
