# Regression Test Checklist — MisterTuga Insights

Use this checklist before every deployment or after significant changes.

---

## Quick Smoke Test (5 minutes)

- [ ] App starts without errors (`npm run dev`)
- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] Production build succeeds (`npm run build`)
- [ ] Login works (ADMIN account)
- [ ] Orders page loads with data
- [ ] Country tabs filter correctly
- [ ] At least one order can be expanded

---

## Core Flows (15 minutes)

### Authentication
- [ ] ADMIN login → redirect to /profit-stats
- [ ] FORNECEDOR login → redirect to /master-shopify-orders
- [ ] Logout clears session → redirect to /login
- [ ] Expired session → redirect to /login
- [ ] Protected routes redirect unauthenticated users

### Orders Page
- [ ] All orders load with correct counts
- [ ] Country tabs show correct counts (All, PT, ES, DE)
- [ ] Search filters orders in real-time
- [ ] Pending/Shipped tabs work
- [ ] Order card expands/collapses
- [ ] Edit order saves changes
- [ ] Tracking number saves and changes status to "fulfilled"
- [ ] Reset tracking clears number and reverts to "open"
- [ ] PDF export downloads valid PDF
- [ ] Empty states show when no data matches

### Settings
- [ ] Webhook URL saves (valid HTTPS URL)
- [ ] Webhook URL rejects HTTP and localhost
- [ ] Profile name update works
- [ ] Password change works
- [ ] FORNECEDOR sees "Restricted Access" for webhook

### Profit Stats
- [ ] Page loads with chart and expense cards
- [ ] Extra expense can be added
- [ ] Invalid values show error toast

---

## Accessibility (5 minutes)

- [ ] Skip link visible on Tab
- [ ] All interactive elements reachable by keyboard
- [ ] Active navigation has aria-current="page"
- [ ] Empty states are descriptive
- [ ] Toasts are announced (aria-live)

---

## Real-Time (3 minutes)

- [ ] Open 2 tabs → update order in tab 1 → tab 2 reflects change

---

## Mobile (3 minutes)

- [ ] Orders page readable at 375px width
- [ ] Country tabs scroll horizontally
- [ ] Sidebar opens/closes on mobile
- [ ] Customer name visible in order card header

---

## Performance Baselines

| Metric | Threshold | How to Measure |
|--------|-----------|---------------|
| Initial load | < 3s | Browser DevTools Network tab |
| Order list load | < 1s | Supabase dashboard → API latency |
| Real-time sync | < 2s | Visual observation across 2 tabs |
| PDF export (100 orders) | < 5s | Console timing |
| Bundle: /master-shopify-orders | < 350 kB First Load JS | `npm run build` output |
| Bundle: /profit-stats | < 350 kB First Load JS | `npm run build` output |

---

## Build Health

| Check | Command | Expected |
|-------|---------|----------|
| TypeScript | `npm run typecheck` | 0 errors |
| Build | `npm run build` | Success, no warnings |
| Bundle size | Build output | No page > 400 kB First Load JS |

---

*Last updated: 2026-03-03 by @qa*
