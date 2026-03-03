# End-to-End Test Plan — EPIC-1 Migration Validation

**Story:** 1.8
**Date:** 2026-03-03
**Author:** @qa (Quinn)

---

## 1. Overview

This test plan validates the complete Firebase → Supabase migration. All application flows must work correctly on the new backend before deploying to production.

**Scope:** All user-facing functionality, real-time updates, accessibility, data integrity, error handling, and performance.

**Out of Scope:** Profit stats page (still on Firebase, deferred to EPIC-2 Story 2.7).

---

## 2. Test Environment

- **App URL:** `http://localhost:9002` (dev) or Vercel preview
- **Database:** Supabase (zpjpekjpszqwpnpkczgy, eu-north-1)
- **Browser:** Chrome latest (primary), Firefox, Safari
- **Mobile:** Chrome DevTools device emulation (375px, 768px)

---

## 3. Test Accounts

| Role | Email | Countries | Capabilities |
|------|-------|-----------|-------------|
| ADMIN | bruno@pulsifyai.com | PT, ES, DE | Full access |
| FORNECEDOR | (create test account) | PT only | Read-only orders for assigned countries |

---

## 4. Test Scenarios

### 4.1 ADMIN User Flows (AC1)

| # | Scenario | Steps | Expected Result | Status |
|---|----------|-------|-----------------|--------|
| A1 | Login | Navigate to /login, enter ADMIN credentials | Redirect to /profit-stats | [ ] |
| A2 | View all orders | Navigate to /master-shopify-orders | Orders load with country tabs (All, PT, ES, DE) | [ ] |
| A3 | Filter by country | Click PT tab | Only PT orders shown, count matches | [ ] |
| A4 | Search orders | Type customer name in search | Results filter in real-time | [ ] |
| A5 | Toggle order details | Click eye icon on order card | Details expand/collapse | [ ] |
| A6 | Edit order | Click pencil icon, modify fields, save | Changes persist after refresh | [ ] |
| A7 | Add tracking number | Enter tracking number, save | Status changes to "fulfilled", webhook fires | [ ] |
| A8 | Reset tracking | Click reset button on tracked order | Tracking cleared, status reverts to "open" | [ ] |
| A9 | Export PDF | Click PDF export button | PDF downloads with correct order data | [ ] |
| A10 | View profit stats | Navigate to /profit-stats | Chart and expense cards render | [ ] |
| A11 | Add extra expense | Click + on expense card, enter value | Expense total updates | [ ] |
| A12 | View settings | Navigate to /settings | Profile and webhook forms shown | [ ] |
| A13 | Update webhook URL | Enter valid HTTPS URL, save | Success toast, URL persisted | [ ] |
| A14 | Invalid webhook URL | Enter http://localhost:3000, save | Error: "Only HTTPS URLs are allowed" | [ ] |
| A15 | Update profile | Change name, save | Success toast, name updated | [ ] |
| A16 | Logout | Click Logout in sidebar | Redirect to /login, session destroyed | [ ] |

### 4.2 FORNECEDOR User Flows (AC2)

| # | Scenario | Steps | Expected Result | Status |
|---|----------|-------|-----------------|--------|
| F1 | Login | Enter FORNECEDOR credentials | Redirect to /master-shopify-orders | [ ] |
| F2 | View assigned orders | View orders page | Only assigned country orders visible | [ ] |
| F3 | No edit capability | Check order cards | No pencil/edit icons shown | [ ] |
| F4 | No profit stats | Try navigating to /profit-stats | Access denied or redirect | [ ] |
| F5 | No settings webhook | Navigate to /settings | "Restricted Access" card shown instead of webhook | [ ] |
| F6 | Logout | Click Logout | Redirect to /login | [ ] |

### 4.3 Real-Time Updates (AC3)

| # | Scenario | Steps | Expected Result | Status |
|---|----------|-------|-----------------|--------|
| R1 | Order update sync | Open 2 browser windows. Update order in window 1 | Window 2 reflects change within 2s | [ ] |
| R2 | Tracking update sync | Add tracking number in window 1 | Window 2 shows updated status within 2s | [ ] |
| R3 | New tab sync | Open new tab after making changes | New tab shows current data | [ ] |

### 4.4 Accessibility (AC4)

| # | Scenario | Steps | Expected Result | Status |
|---|----------|-------|-----------------|--------|
| X1 | Lighthouse audit | Run Lighthouse on /master-shopify-orders | Accessibility score > 90 | [ ] |
| X2 | axe-core scan | Run axe browser extension | 0 critical or serious violations | [ ] |
| X3 | Skip navigation | Press Tab on page load | Skip link appears, focuses main content | [ ] |
| X4 | Keyboard nav | Tab through all interactive elements | All buttons, links, inputs reachable | [ ] |
| X5 | Screen reader | Navigate with VoiceOver (macOS) | All content reads meaningfully | [ ] |
| X6 | Empty states | Filter to 0 results | Descriptive empty state with icon shown | [ ] |

### 4.5 Data Integrity (AC5)

| # | Scenario | Steps | Expected Result | Status |
|---|----------|-------|-----------------|--------|
| D1 | Spot-check 20 orders | Compare 20 random orders with Firestore originals | All fields match | [ ] |
| D2 | Customer data | Check customer names, addresses, phones | Match original records | [ ] |
| D3 | Order counts | Compare total counts per country | PT: 219, ES: 349, DE: 8 = 576 total | [ ] |
| D4 | No orphans | Check for orders without customers | 0 orphaned records | [ ] |

### 4.6 Error Handling (AC6)

| # | Scenario | Steps | Expected Result | Status |
|---|----------|-------|-----------------|--------|
| E1 | Network error | Disable network, interact with app | Error boundary with retry button | [ ] |
| E2 | Auth expired | Delete auth cookie, interact | Redirect to /login | [ ] |
| E3 | Empty data | View page with no orders for a country | Empty state with suggestion | [ ] |
| E4 | Rate limit | Rapidly submit 15+ updates | "Too many requests" message after 10 | [ ] |

### 4.7 Performance (AC7)

| # | Metric | Target | Actual | Status |
|---|--------|--------|--------|--------|
| P1 | Initial page load | < 3s | | [ ] |
| P2 | Order list load | < 1s | | [ ] |
| P3 | Real-time latency | < 2s | | [ ] |
| P4 | PDF export (100 orders) | < 5s | | [ ] |
| P5 | Memory (10min session) | No growth | | [ ] |

---

## 5. Bug Tracking

| # | Severity | Description | AC | Status |
|---|----------|-------------|----|--------|
| | | | | |

---

## 6. Sign-Off

| Gate Check | Result |
|-----------|--------|
| All ADMIN flows pass | |
| All FORNECEDOR flows pass | |
| Real-time updates work | |
| Lighthouse a11y > 90 | |
| axe-core 0 critical | |
| Data integrity verified | |
| No P0/P1 bugs open | |

**Gate Decision:** _______________
