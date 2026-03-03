# EPIC 2: Post-Migration New Features

**Project:** MisterTuga Insights
**Epic ID:** EPIC-2
**Author:** @pm (Morgan)
**Date:** 2026-03-02
**Status:** IN PROGRESS (7/8 stories Done)
**Blocked By:** Story 2.8 deferred (P3/future)

**Source PRD:** `docs/product/mistertuga_master.md`
**Schema Blueprint:** `docs/architecture/schema-blueprint.md` (Phase 2 tables)

---

## 1. Epic Summary

Add new operational modules to MisterTuga Insights: Exchanges/Returns management, Supplier cost tracking with Excel exports, Google Ads + Meta Ads integrations, expense catalog, and daily revenue dashboard. These features transform the app from an order viewer into a complete operations platform.

### Business Justification

- **Exchanges/Returns** — Currently handled manually via email. AI-powered automation saves ~2h/day
- **Supplier Costs** — Currently done in Electron app + Google Drive. Consolidation eliminates manual export steps
- **Ad Spend Tracking** — Currently checked in separate dashboards. Integration gives unified profit view
- **Daily Revenue** — Currently calculated by n8n workflow. In-app calculation is faster and more reliable

### Success Metrics

| Metric | Before (EPIC-1 complete) | Target (EPIC-2 complete) |
|--------|-------------------------|--------------------------|
| Modules | 3 (Orders, Profit, Settings) | 7 (+ Exchanges, Suppliers, Ads, Revenue) |
| Manual processes | 4 (exchanges, exports, ad check, revenue calc) | 0 (all automated/in-app) |
| External tools needed | 3 (Electron, Google Drive, n8n for revenue) | 0 (all consolidated) |
| Profit accuracy | Shopify + manual expenses only | Full (+ Google Ads + Meta Ads + costs) |

---

## 2. Timeline Overview

```
EPIC 2 — POST-MIGRATION NEW FEATURES
════════════════════════════════════════════════════════════

Sprint 4: Core Modules (after EPIC-1 go-live)
├── Story 2.1: Exchanges Schema + n8n Integration ──────── 3 days
├── Story 2.2: Exchanges UI + Email Templates ──────────── 2 days
├── Story 2.3: Supplier Cost Engine ────────────────────── 3 days
└── Story 2.4: Supplier Excel Export ───────────────────── 2 days

Sprint 5: Integrations & Dashboard
├── Story 2.5: Google Ads + Meta Ads Integration ──────── 2 days
├── Story 2.6: Expense Catalog + Manual Expenses ──────── 1.5 days
├── Story 2.7: Daily Revenue Dashboard ────────────────── 2 days
└── Story 2.8: Supplier Reconciliation ────────────────── 2 days (P3)

TOTAL: 17.5 working days (~3.5 weeks)
```

---

## 3. Wave Structure

### Wave 4: Operational Modules (Sprint 4)
| Story | Description | Effort | Agent | Blockers |
|-------|-------------|--------|-------|----------|
| **2.1** | Exchanges: schema + n8n webhook integration | 3d | @data-engineer + @dev | EPIC-1 complete |
| **2.2** | Exchanges: UI table + email templates + sending | 2d | @dev + @ux-design-expert | Story 2.1 |
| **2.3** | Supplier cost calculation engine + cost rules | 3d | @dev + @data-engineer | EPIC-1 complete |
| **2.4** | Supplier Excel export with embedded images | 2d | @dev | Story 2.3 |

> Stories 2.1 and 2.3 can start in parallel — they are independent modules.

### Wave 5: Integrations (Sprint 5)
| Story | Description | Effort | Agent | Blockers |
|-------|-------------|--------|-------|----------|
| **2.5** | Google Ads + Meta Ads API integration | 2d | @dev | EPIC-1 complete |
| **2.6** | Services/software expense catalog + manual expenses | 1.5d | @dev | EPIC-1 complete |
| **2.7** | Daily revenue dashboard (replaces n8n workflow) | 2d | @dev | EPIC-1 complete |
| **2.8** | Supplier document reconciliation | 2d | @dev | Story 2.4 (P3 — future) |

> Stories 2.5, 2.6, and 2.7 are independent and can run in parallel.

---

## 4. Dependency Graph

```
EPIC-1 (Complete)
 │
 ├──→ 2.1 (Exchanges Schema) ──→ 2.2 (Exchanges UI)
 │
 ├──→ 2.3 (Cost Engine) ──→ 2.4 (Excel Export) ──→ 2.8 (Reconciliation)
 │
 ├──→ 2.5 (Ad Integrations)
 │
 ├──→ 2.6 (Expense Catalog)
 │
 └──→ 2.7 (Daily Revenue)
```

---

## 5. Story Index

| Story | Title | Status | Sprint | Priority |
|-------|-------|--------|--------|----------|
| [2.1](../stories/2.1.story.md) | Exchanges/Returns: Schema + n8n Integration | Done | 4 | P1 |
| [2.2](../stories/2.2.story.md) | Exchanges/Returns: UI + Email Templates | Done | 4 | P1 |
| [2.3](../stories/2.3.story.md) | Supplier Cost Calculation Engine | Done | 4 | P1 |
| [2.4](../stories/2.4.story.md) | Supplier Excel Export with Embedded Images | Done | 4 | P1 |
| [2.5](../stories/2.5.story.md) | Google Ads + Meta Ads Integration | Done | 5 | P2 |
| [2.6](../stories/2.6.story.md) | Expense Catalog + Manual Expenses | Done | 5 | P2 |
| [2.7](../stories/2.7.story.md) | Daily Revenue Dashboard | Done | 5 | P2 |
| [2.8](../stories/2.8.story.md) | Supplier Document Reconciliation | Draft | 5 | P3 |

---

## 6. New Tables Per Story

| Story | Tables Created | Migration Scripts |
|-------|---------------|-------------------|
| 2.1 | exchanges, exchange_attachments | 011, 012 |
| 2.2 | email_templates, exchange_email_log | 013, 014 |
| 2.3 | cost_rules, order_costs | 015, 016 |
| 2.4 | supplier_exports, supplier_export_items | 017, 018 |
| 2.5 | ad_accounts, ad_spend | 019, 020 |
| 2.6 | expense_categories, manual_expenses | 021, 022 |
| 2.7 | daily_revenue, daily_revenue_breakdown | 023, 024 |
| 2.8 | — (uses existing tables) | — |

**Total new tables: 14** (see `docs/architecture/schema-blueprint.md` for full DDL)

---

## 7. External Integration Points

| Integration | Story | Type | Notes |
|-------------|-------|------|-------|
| n8n → Supabase | 2.1 | Webhook (inbound) | n8n AI agent writes exchange records via API |
| Shopify → Cost calc | 2.3 | Event-driven | New orders trigger cost calculation |
| App → Excel | 2.4 | Export (outbound) | ExcelJS with embedded images |
| Google Ads API | 2.5 | API (inbound) | Daily ad spend fetch |
| Meta Ads API | 2.5 | API (inbound) | Daily ad spend fetch |
| App → Email | 2.2 | Email (outbound) | Exchange response emails |

---

## 8. Agent Assignments

| Agent | Stories | Focus |
|-------|---------|-------|
| @dev (Dex) | 2.1-2.8 | Primary implementer |
| @data-engineer (Dara) | 2.1, 2.3 | Schema design, migrations, cost calculation logic |
| @ux-design-expert (Uma) | 2.2 | Exchange UI, email template editor |
| @qa (Quinn) | — | QA gate per story |
| @devops (Gage) | — | Deployment after each sprint |

---

## 9. Risk Register

| Risk | Probability | Impact | Mitigation | Story |
|------|------------|--------|------------|-------|
| n8n webhook reliability | Medium | High | Retry logic + dead letter queue | 2.1 |
| Image embedding in Excel performance | Medium | Medium | Batch processing, size limits | 2.4 |
| Ad API rate limits | Low | Medium | Cache daily, fetch once/day | 2.5 |
| Cost calculation accuracy | Medium | High | Reconciliation feature validates | 2.3, 2.8 |
| Email deliverability | Low | Medium | Use established email service (Resend, SendGrid) | 2.2 |

---

*Generated by @pm (Morgan) — Product Feature Planning*
*Source: docs/product/mistertuga_master.md + n8n workflow analysis*
*— Morgan, planejando o futuro 📊*
