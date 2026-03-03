# EPIC 1: Firebase → Supabase Quality Migration

**Project:** MisterTuga Insights
**Epic ID:** EPIC-1
**Author:** @pm (Morgan) — Brownfield Discovery Phase 10
**Date:** 2026-03-02
**Status:** IN PROGRESS (9/11 Done, 1 InProgress, 1 Ready)
**Scenario:** B (Quality Migration)

**Source:** `docs/architecture/technical-debt-assessment.md` (Phase 8 FINAL)
**Executive Brief:** `docs/architecture/TECHNICAL-DEBT-REPORT.md` (Phase 9)

---

## 1. Epic Summary

Migrate MisterTuga Insights from Firebase (Auth + Firestore + Cloud Functions + Hosting) to Supabase (Auth + PostgreSQL + Realtime + Edge Functions), while simultaneously decomposing the monolithic orders page, fixing accessibility compliance, and improving UX quality.

### Business Justification

- **9 critical security/accessibility issues** actively exploitable
- **Zero data backups** — one bad operation = permanent data loss
- **Zero test coverage** — changes ship without safety net
- **Architectural ceiling** — Firestore subcollection pattern blocks cross-country queries and customer analytics
- **0% WCAG compliance** — zero ARIA attributes app-wide

### Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Security vulnerabilities | 9 critical | 0 |
| WCAG compliance | 0% Level A | Level AA |
| Orders page complexity | 1,704 lines / 23 useState | ~250 lines / 4 useState |
| Data backup strategy | None | Automatic (Supabase managed) |
| Audit trail | None | Full audit log (orders, users, settings) |
| Empty states | 0 | All data views covered |

---

## 2. Timeline Overview

```
EPIC 1 — QUALITY MIGRATION TIMELINE
════════════════════════════════════════════════════════════

Sprint 0: Pre-Migration (Day 0)
└── Story 1.0: Critical Security Fixes ──────────── 5.5h

Sprint 1: Foundation (Days 1-7)
├── Story 1.1: Supabase Schema + Audit Log ──────── 2 days
├── Story 1.2: Auth Migration + RLS Policies ────── 2 days
└── Story 1.3: Data Migration (ETL + Verify) ────── 3 days

Sprint 2: Application Rewrite (Days 8-17)
├── Story 1.4: Orders Page Decomposition ────────── 3-4 days
├── Story 1.5: Firebase → Supabase Hooks ────────── 2 days
├── Story 1.6: Accessibility + UX Polish ────────── 2 days
└── Story 1.7: Webhook + Language + Auth ────────── 1 day

Sprint 3: Validation & Launch (Days 18-25)
├── Story 1.8: End-to-End Testing ───────────────── 1.5 days
├── Story 1.9: Firebase Cleanup + Deploy ────────── 1 day
└── Story 1.10: Go-Live + 48h Monitoring ────────── 0.5 day + monitoring

TOTAL: 21-25.5 working days (~5 weeks)
```

---

## 3. Wave Structure

Stories are organized in dependency waves. Stories within the same wave can be parallelized with 2+ developers.

### Wave 0: Security Hardening (Day 0)
| Story | Description | Effort | Agent | Blockers |
|-------|-------------|--------|-------|----------|
| **1.0** | Fix critical security vulnerabilities | 5.5h | @dev | None |

### Wave 1: Infrastructure (Days 1-7)
| Story | Description | Effort | Agent | Blockers |
|-------|-------------|--------|-------|----------|
| **1.1** | Supabase schema + audit log + migrations | 2d | @data-engineer + @dev | Story 1.0 |
| **1.2** | Auth migration + RLS policies + middleware | 2d | @data-engineer + @dev | Story 1.1 |
| **1.3** | Data export, transform, load, verify | 3d | @data-engineer + @dev | Story 1.1 |

> Stories 1.2 and 1.3 can start in parallel once 1.1 schema is in place.

### Wave 2: Application (Days 8-17)
| Story | Description | Effort | Agent | Blockers |
|-------|-------------|--------|-------|----------|
| **1.4** | Orders page decomposition (9 components + 4 hooks) | 3-4d | @dev | Story 1.0 (can start during Wave 1) |
| **1.5** | Rewrite Firebase hooks → Supabase + Realtime | 2d | @dev | Stories 1.3, 1.4 |
| **1.6** | WCAG AA accessibility + empty states + skeletons | 2d | @dev + @ux-design-expert | Story 1.4 |
| **1.7** | Webhook migration + language standardization + auth provider | 1d | @dev | Stories 1.2, 1.5 |

> Story 1.4 (decomposition) can start early — it's a refactor of the existing Firebase codebase.
> Stories 1.5 and 1.6 can run in parallel after 1.4 completes.

### Wave 3: Launch (Days 18-25)
| Story | Description | Effort | Agent | Blockers |
|-------|-------------|--------|-------|----------|
| **1.8** | End-to-end testing (all roles, all flows) | 1.5d | @qa + @dev | Stories 1.5, 1.6, 1.7 |
| **1.9** | Remove Firebase dependencies + deploy | 1d | @dev + @devops | Story 1.8 |
| **1.10** | Go-live + 48h monitoring + rollback readiness | 0.5d + monitoring | @devops | Story 1.9 |

---

## 4. Dependency Graph

```
1.0 (Security Fixes)
 │
 ├──→ 1.1 (Schema)
 │     │
 │     ├──→ 1.2 (Auth + RLS) ──────────────────┐
 │     │                                         │
 │     └──→ 1.3 (Data Migration) ───┐           │
 │                                   │           │
 ├──→ 1.4 (Decomposition) ──┐       │           │
 │                           │       │           │
 │                           ├──→ 1.5 (Hooks) ──┤
 │                           │                   │
 │                           └──→ 1.6 (A11y) ──→├──→ 1.7 (Integration)
 │                                               │         │
 │                                               │         │
 └───────────────────────────────────────────────┘         │
                                                           ↓
                                                      1.8 (Testing)
                                                           │
                                                      1.9 (Cleanup)
                                                           │
                                                      1.10 (Go-Live)
```

---

## 5. Owner Decisions (RESOLVED)

| # | Decision | Resolution | Date |
|---|----------|-----------|------|
| **D4** | Hosting platform | **Vercel** — owner already has Vercel account with multiple projects | 2026-03-02 |
| **D6** | UI language | **English first** — standardize all UI text to English | 2026-03-02 |
| **D7** | Migration scenario | **Scenario B (Quality Migration)** — full debt resolution + migration | 2026-03-02 |

> **Note:** Owner has Hetzner VPS for n8n workflows. App on Vercel, n8n stays on Hetzner, Supabase cloud DB.

---

## 6. Risk Register

| Risk | Probability | Impact | Mitigation | Story |
|------|------------|--------|------------|-------|
| Data loss during migration | Medium | Critical | Firestore backup before any changes, verify subcollections | 1.3 |
| Customer deduplication errors | High | Medium | Manual review for ambiguous phone matches | 1.3 |
| User disruption (password reset) | High | High | Plan communication, execute during low-traffic window | 1.2 |
| RLS policies too restrictive | Medium | High | Test every policy with test users per role | 1.2 |
| Realtime feature regression | Medium | High | Parallel test Supabase Realtime vs Firestore | 1.5 |
| Orders decomposition breaks features | Medium | High | Verify real-time after each extraction step | 1.4 |
| Supabase free tier limits | Low | Medium | Verify data fits 500MB, monitor connections | 1.1 |

---

## 7. Story Index

| Story | Title | Status | Sprint |
|-------|-------|--------|--------|
| [1.0](../stories/1.0.story.md) | Pre-Migration: Critical Security Fixes | Done | 0 |
| [1.1](../stories/1.1.story.md) | Supabase Foundation: Schema + Audit Log | Done | 1 |
| [1.2](../stories/1.2.story.md) | Auth Migration: Supabase Auth + RLS Policies | Done | 1 |
| [1.3](../stories/1.3.story.md) | Data Migration: Export, Transform, Load, Verify | Done | 1 |
| [1.4](../stories/1.4.story.md) | Orders Page Decomposition | Done | 2 |
| [1.5](../stories/1.5.story.md) | Firebase → Supabase Hook Rewrite | Done | 2 |
| [1.6](../stories/1.6.story.md) | Accessibility + UX Polish | Done | 2 |
| [1.7](../stories/1.7.story.md) | Integration: Webhook + Language + Auth Provider | Done | 2 |
| [1.8](../stories/1.8.story.md) | End-to-End Testing | InProgress | 3 |
| [1.9](../stories/1.9.story.md) | Firebase Cleanup + Deployment | Done | 3 |
| [1.10](../stories/1.10.story.md) | Go-Live + Monitoring | Ready | 3 |

---

## 8. Debt Items Covered Per Story

| Story | Debt Items Resolved |
|-------|-------------------|
| 1.0 | TD-C1, TD-C2, TD-C3, TD-C5, TD-C6, TD-C8, TD-H5, TD-L9 |
| 1.1 | TD-H14, TD-H15, TD-H16, TD-M5 (partial), TD-M6 (partial), TD-M7, TD-M13, TD-L10 |
| 1.2 | TD-C4, TD-H4, TD-H6, TD-M1 |
| 1.3 | TD-M5 (complete), TD-M6 (complete) |
| 1.4 | TD-H1 |
| 1.5 | TD-H2 |
| 1.6 | TD-C9, TD-C10, TD-H7, TD-H11, TD-H12, TD-H13, TD-M15, TD-M16 |
| 1.7 | TD-M2, TD-M3, TD-M10, TD-M11, TD-M14 |
| 1.8 | TD-H3 (partial — test foundation) |
| 1.9 | TD-L1, TD-L2, TD-L3, TD-L6, TD-L7, TD-L8, TD-X1 |
| 1.10 | TD-H10, TD-M8 |

**Total: 45/45 debt items addressed**

---

## 9. Agent Assignments

| Agent | Stories | Focus |
|-------|---------|-------|
| @dev (Dex) | 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9 | Primary implementer |
| @data-engineer (Dara) | 1.1, 1.2, 1.3 | Schema, RLS, data migration |
| @ux-design-expert (Uma) | 1.6 | Accessibility, component design guidance |
| @qa (Quinn) | 1.8 | End-to-end testing, quality gate |
| @devops (Gage) | 1.9, 1.10 | Deployment, monitoring, Firebase decommission |
| @architect (Aria) | — | Consulted for architecture decisions |

---

## 10. Communication Plan

| Milestone | Communication | Audience | When |
|-----------|--------------|----------|------|
| Migration kick-off | Email: "System improvements coming" | All users | Day 1 |
| Password reset notice | Email: "You'll need to reset your password" | All users | Day 5 (during Phase A) |
| Maintenance window | Email: "Brief downtime for system upgrade" | All users | Day before go-live |
| Migration complete | Email: "New system is live + password reset link" | All users | Go-live day |

---

## 11. Related Epics

| Epic | Title | Relationship |
|------|-------|-------------|
| [EPIC-2](EPIC-2-new-features.md) | Post-Migration New Features | Blocked by EPIC-1 completion |

> EPIC-2 covers: Exchanges/Returns, Supplier Cost Management, Ad Platform Integrations, Expense Catalog, Daily Revenue Dashboard, Supplier Reconciliation. Full PRD in `docs/product/mistertuga_master.md`.

---

*Generated by @pm (Morgan) — Brownfield Discovery Phase 10*
*Updated: 2026-03-02 — Decisions D4/D6/D7 resolved, EPIC-2 reference added*
*Updated: 2026-03-03 — Story statuses synced (9/11 Done). Stories 1.0, 1.7, 1.9 closed. 1.10 Ready.*
*— Morgan, planejando o futuro 📊*
