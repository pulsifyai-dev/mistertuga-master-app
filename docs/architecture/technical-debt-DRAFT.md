# Technical Debt Assessment — DRAFT

**Project:** MisterTuga Insights
**Phase:** Brownfield Discovery - Phase 4 (Draft Compilation)
**Author:** @architect (Aria)
**Date:** 2026-03-02
**Status:** DRAFT — Pending specialist review (Phases 5-7)

**Sources:**
- Phase 1: `system-architecture.md` (@architect)
- Phase 2: `SCHEMA.md` + `DB-AUDIT.md` (@data-engineer)
- Phase 3: `frontend-spec.md` (@ux-design-expert)

---

## 1. Executive Summary

MisterTuga Insights is an e-commerce operations dashboard (Shopify order management + profit analytics) built with **Next.js 14 + Firebase** and scaffolded via Google AI Studio. The codebase is functional and production-deployed but carries **significant security debt** and **architectural limitations** that will block scaling and the planned Supabase migration.

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
| Accessibility | @ux-design-expert | 7.5/10 | Good foundation, gaps |
| Responsiveness | @ux-design-expert | 8/10 | Good mobile, weak tablet |

### Weighted Overall: **5.7/10** — Functional but not production-safe

---

## 2. Debt Registry

All identified debts consolidated from Phases 1-3, organized by severity.

### CRITICAL (Must fix before any new development)

| ID | Debt | Source | Domain | Impact | Effort |
|----|------|--------|--------|--------|--------|
| **TD-C1** | Firestore orders writable by any authenticated user | DB-AUDIT S1 | Security | Data corruption, fraud | 1h |
| **TD-C2** | Firestore settings writable by any authenticated user | DB-AUDIT S2 | Security | Webhook redirect attack (data exfiltration) | 1h |
| **TD-C3** | Server Actions have no auth verification | DB-AUDIT S3, Arch C1 | Security | Bypass Firestore rules via Admin SDK | 2h |
| **TD-C4** | No middleware auth protection | Arch C1 | Security | Unauthorized route/API access | 3h |
| **TD-C5** | Build errors suppressed in next.config.js | Arch C2 | Quality | Hidden bugs ship to production | 15min |
| **TD-C6** | Webhook field name inconsistency (url vs webhookUrl) | DB-AUDIT D2 | Data Integrity | One consumer silently fails | 30min |
| **TD-C7** | No database migration system | DB-AUDIT O1 | Operations | Schema changes untracked, irreversible | 2h |
| **TD-C8** | No backup strategy | DB-AUDIT O2 | Operations | Permanent data loss risk | 1h |

**Total Critical Effort Estimate: ~11 hours**

---

### HIGH (Fix within first sprint)

| ID | Debt | Source | Domain | Impact | Effort |
|----|------|--------|--------|--------|--------|
| **TD-H1** | Orders page is 1,704 lines (monolithic) | FE-Spec 4.2 | Maintainability | Unmaintainable, slow loads, hard to test | 1-2 days |
| **TD-H2** | Duplicate Firebase initialization (src/lib/firebase vs src/firebase) | Arch H2 | Architecture | Double init risk, developer confusion | 4h |
| **TD-H3** | Zero test coverage | Arch H4 | Quality | No regression protection | Ongoing |
| **TD-H4** | Role stored in 3 places (Auth claims, users collection, roles_admin) | DB-AUDIT S4 | Data Integrity | Role sync failures | 4h |
| **TD-H5** | Cloud Function deployed to us-central1 (data in europe-west1) | DB-AUDIT P3 | Performance | Cross-region latency on every order update | 30min |
| **TD-H6** | Admin self-registration via environment variable code | DB-AUDIT S5 | Security | Code leak = privilege escalation | 4h |
| **TD-H7** | No error boundary components | Arch H3 | UX | Unhandled errors crash entire app | 2h |
| **TD-H8** | Missing accessibility: skip link, aria-labels, aria-busy | FE-Spec 7 | Accessibility | Screen reader users blocked | 4h |
| **TD-H9** | No empty states for orders and search results | FE-Spec 8 | UX | Silent failure, confused users | 2h |
| **TD-H10** | No monitoring or alerting | DB-AUDIT O3 | Operations | Silent failures in production | 4h |

---

### MEDIUM (Plan for migration sprint)

| ID | Debt | Source | Domain | Impact | Effort |
|----|------|--------|--------|--------|--------|
| **TD-M1** | Client-side only route protection | Arch M2, DB-AUDIT | Security | Auth depends on JS execution | 3h |
| **TD-M2** | No API rate limiting on Server Actions | DB-AUDIT S6 | Security | Brute-force risk | 2h |
| **TD-M3** | Webhook URL not validated (SSRF risk) | DB-AUDIT S7 | Security | Internal network access | 1h |
| **TD-M4** | No audit logging | DB-AUDIT S8 | Operations | No trail of changes | 4h |
| **TD-M5** | Profit stats in single Firestore document | DB-AUDIT D5, SD1 | Scalability | 1MB limit, no history, concurrent edit conflicts | 4h |
| **TD-M6** | Customer data embedded, not normalized | DB-AUDIT D6, SD2 | Data Quality | Duplicates, no cross-query capability | 4h |
| **TD-M7** | Date handling inconsistency (ISO, Timestamp, Unix) | DB-AUDIT D4 | Data Integrity | Sort/compare errors, timezone bugs | 3h |
| **TD-M8** | No caching strategy | Arch M3 | Performance | Redundant Firestore reads | 4h |
| **TD-M9** | ~10 unused shadcn/ui components | FE-Spec 3.2 | Bundle Size | ~50-100KB unnecessary JS | 1h |
| **TD-M10** | PDF/Excel libraries loaded eagerly (~800KB) | FE-Spec 10 | Performance | Slower initial page load | 2h |
| **TD-M11** | Mixed Portuguese/English UI text | FE-Spec 9 | UX Consistency | Confusing for users | 2h |
| **TD-M12** | No staging environment | DB-AUDIT O5 | Operations | Testing in production | 4h |
| **TD-M13** | Role naming inconsistency (BASIC vs FORNECEDOR) | DB-AUDIT SD4 | Data Integrity | Authorization ambiguity | 1h |
| **TD-M14** | No composite Firestore indexes declared | DB-AUDIT P2 | Performance | Complex queries fail at runtime | 1h |

---

### LOW (Address during normal development)

| ID | Debt | Source | Domain | Impact | Effort |
|----|------|--------|--------|--------|--------|
| **TD-L1** | Package name mismatch ("nextn" vs "mistertuga") | Arch L1 | DX | Developer confusion | 5min |
| **TD-L2** | Empty AI flows file (unused Genkit dependency) | Arch L2 | Bundle Size | Dead weight | 15min |
| **TD-L3** | Placeholder images utility (dead code) | Arch L3 | Cleanliness | Unused code | 5min |
| **TD-L4** | Login button gradient differs from rest of app | FE-Spec 9 | Consistency | Minor visual inconsistency | 15min |
| **TD-L5** | Inline style={{}} overrides Tailwind system | FE-Spec 9 | Consistency | Breaks token system | 30min |
| **TD-L6** | Custom shadows not tokenized | FE-Spec 9 | Design System | Not centralized | 30min |
| **TD-L7** | No memoization in heavy components | FE-Spec 10 | Performance | Unnecessary re-renders | 2h |
| **TD-L8** | Supabase linked but unused | Arch M6 | Clarity | Unclear migration intent | 0 (decision) |

---

## 3. Debt by Domain (Treemap View)

```
TECHNICAL DEBT DISTRIBUTION
═══════════════════════════════════════════════════════

Security          ████████████████████  35% (8 items: C1-C4, H6, M1-M3)
Data Integrity    ██████████████        22% (6 items: C6, H4, M5-M7, M13)
Operations        ██████████            17% (5 items: C7-C8, H10, M4, M12)
Maintainability   ██████                10% (3 items: H1-H2, H3)
UX/Accessibility  █████                  9% (3 items: H8-H9, M11)
Performance       ████                   7% (4 items: H5, M8-M10, M14)
```

**Security is the dominant debt category** — 35% of all identified issues are security-related.

---

## 4. Migration Roadmap (Firebase → Supabase)

The planned migration to Supabase is the primary strategic driver. All debt should be evaluated against whether it's worth fixing in Firebase or better addressed during migration.

### Pre-Migration (Fix in Firebase NOW)
These items prevent data loss or security breaches regardless of migration:

| ID | Action | Why Now |
|----|--------|---------|
| TD-C1 | Restrict Firestore orders rules | Active security vulnerability |
| TD-C2 | Restrict Firestore settings rules | Data exfiltration risk |
| TD-C3 | Add auth to Server Actions | Admin SDK bypasses rules |
| TD-C5 | Remove ignoreBuildErrors | Catch bugs before deploy |
| TD-C6 | Fix webhook field name | Silent failures |
| TD-C8 | Enable Firestore backups | Data loss prevention |
| TD-H5 | Fix Cloud Function region | Quick win, reduces latency |

### During Migration (Address as part of Supabase move)
These debts are eliminated or restructured by the migration itself:

| ID | How Migration Resolves |
|----|----------------------|
| TD-C4 | Supabase middleware + RLS replaces client-side auth |
| TD-C7 | Supabase migrations system (built-in) |
| TD-H2 | Single Supabase client replaces dual Firebase init |
| TD-H4 | Single `users.role` column + RLS (no triple storage) |
| TD-M1 | Supabase Auth middleware (server-side) |
| TD-M5 | Normalized tables replace single document |
| TD-M6 | Customers table replaces embedded objects |
| TD-M7 | PostgreSQL TIMESTAMPTZ standardizes dates |
| TD-M13 | Clean role enum in database schema |

### Post-Migration (Optimize after Supabase is live)
| ID | Action |
|----|--------|
| TD-H1 | Decompose orders page (can do anytime) |
| TD-H3 | Build test suite (against Supabase) |
| TD-M2 | Rate limiting (Supabase Edge Functions or middleware) |
| TD-M4 | Audit logging (Supabase audit tables) |
| TD-M8 | Caching strategy (React Query + Supabase cache) |
| TD-M12 | Staging environment (Supabase branching) |

---

## 5. Migration Effort Estimate

### Component Migration Matrix

| Component | Current | Target | Effort | Risk |
|-----------|---------|--------|--------|------|
| Auth | Firebase Auth + claims | Supabase Auth + users.role | 2 days | High (user migration) |
| Database | Firestore (NoSQL) | Supabase PostgreSQL | 3 days | High (schema change) |
| Real-time | Firestore onSnapshot | Supabase Realtime | 2 days | Medium |
| Server Actions | Firebase Admin SDK | Supabase service client | 1 day | Low |
| Cloud Function | Firestore trigger | Supabase DB Webhook / Edge Fn | 1 day | Medium |
| Frontend hooks | useDoc/useCollection | Supabase React hooks | 2 days | Medium |
| Hosting | Firebase App Hosting | Vercel or keep Firebase | 0.5 days | Low |
| Environment | Firebase env vars | Supabase env vars | 0.5 days | Low |

**Total estimated migration: 12-15 working days**

### Migration Phases (Recommended)

```
Phase A: Foundation (3 days)
├── Set up Supabase schema (from SCHEMA.md proposal)
├── Configure RLS policies (from DB-AUDIT.md proposal)
├── Create migration scripts
└── Set up Supabase Auth

Phase B: Data Layer (4 days)
├── Migrate Firestore data to PostgreSQL
├── Rewrite useDoc/useCollection → Supabase hooks
├── Rewrite Server Actions → Supabase client
└── Replace Cloud Function → DB Webhook

Phase C: Auth & Middleware (3 days)
├── Migrate users (Firebase Auth → Supabase Auth)
├── Implement Next.js middleware with Supabase
├── Update AuthProvider
└── Test role-based access

Phase D: Validation & Cleanup (2-3 days)
├── End-to-end testing
├── Remove Firebase dependencies
├── Update environment variables
├── Deploy and verify
└── Remove unused code (dual Firebase init, etc.)
```

---

## 6. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Data loss during migration | Medium | Critical | Export Firestore backup before migration |
| User password migration | High | High | Supabase can't import Firebase passwords — require password reset |
| Real-time feature regression | Medium | High | Test Supabase Realtime thoroughly before cutover |
| Webhook disruption | Low | Medium | Maintain Firebase Cloud Function until Supabase webhook verified |
| Performance regression | Low | Medium | Benchmark Supabase queries vs Firestore before cutover |
| Downtime during cutover | Medium | Medium | Plan maintenance window or blue-green deploy |

---

## 7. Recommended Decision Points

Before proceeding to Phase 5-7 reviews, the following decisions are needed:

| # | Decision | Options | Recommendation |
|---|----------|---------|---------------|
| D1 | **Fix Firebase security NOW or wait for migration?** | Fix now / Wait | **Fix now** — active vulnerabilities |
| D2 | **Migration timeline?** | Immediate / Next sprint / Future | **Next sprint** — after critical fixes |
| D3 | **User auth migration strategy?** | Password reset / Manual import / Dual auth period | **Password reset** — cleanest approach |
| D4 | **Keep Firebase hosting or move to Vercel?** | Firebase / Vercel / Railway | **Vercel** — better Next.js DX, free tier |
| D5 | **Decompose orders page before or during migration?** | Before / During / After | **During** — natural break point |
| D6 | **UI language standardization?** | English / Portuguese / i18n | **Decide based on user base** |

---

## 8. Phase Summary & Next Steps

### Brownfield Discovery Progress

| Phase | Agent | Deliverable | Status |
|-------|-------|-------------|--------|
| 1 | @architect | `system-architecture.md` | ✅ Complete |
| 2 | @data-engineer | `SCHEMA.md` + `DB-AUDIT.md` | ✅ Complete |
| 3 | @ux-design-expert | `frontend-spec.md` | ✅ Complete |
| 4 | @architect | `technical-debt-DRAFT.md` | ✅ This document |
| 5 | @data-engineer | `db-specialist-review.md` | ⬜ Next |
| 6 | @ux-design-expert | `ux-specialist-review.md` | ⬜ Next |
| 7 | @qa | `qa-review.md` (QA Gate) | ⬜ Pending |
| 8 | @architect | `technical-debt-assessment.md` (final) | ⬜ Pending |
| 9 | @analyst | `TECHNICAL-DEBT-REPORT.md` (executive) | ⬜ Pending |
| 10 | @pm | Epic + stories | ⬜ Pending |

### Next: Phase 5
Activate `@data-engineer` to review this draft from a database specialist perspective.

---

*Generated by @architect (Aria) — Brownfield Discovery Phase 4*
*— Aria, arquitetando o futuro 🏗️*
