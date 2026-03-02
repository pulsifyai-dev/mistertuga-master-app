# UX Specialist Review — Technical Debt DRAFT

**Phase:** Brownfield Discovery - Phase 6
**Author:** @ux-design-expert (Uma)
**Date:** 2026-03-02
**Reviewing:** `technical-debt-DRAFT.md` (Phase 4, @architect)
**Status:** Complete

---

## 1. Review Verdict

**APPROVED WITH AMENDMENTS** — The draft accurately captures the major frontend/UX debts. I'm adding severity refinements, missing items from a UX perspective, concrete decomposition strategy, and accessibility-specific corrections based on deep code review.

---

## 2. Severity Adjustments

### Upgrades (should be higher severity)

| ID | Current | Proposed | Rationale |
|----|---------|----------|-----------|
| **TD-H8** | HIGH | **CRITICAL** | Zero `aria-*` attributes across the entire application. Not a single `aria-label`, `aria-live`, or `aria-describedby` exists in any page. This is a WCAG 2.1 Level A failure — the most basic accessibility tier. Screen reader users are completely blocked. For an e-commerce operations tool, this means any team member using assistive technology cannot work. |
| **TD-H9** | HIGH | **CRITICAL** | Empty states aren't just missing for orders — they're missing for search results, filtered views, and chart data. When a user filters orders and gets zero results, there is absolute silence. No feedback, no guidance. This breaks the fundamental UX principle of system visibility (Nielsen's Heuristic #1). |
| **TD-L5** | LOW | **MEDIUM** | The inline `style={{}}` overrides aren't just a consistency issue. In `profit-stats/page.tsx`, dynamic border colors use inline styles that bypass the Tailwind token system entirely. When migrating to Supabase and potentially redesigning the UI, these hardcoded values become invisible technical debt. They should use CSS custom properties or Tailwind's arbitrary value syntax. |

### Downgrades (can be lower severity)

| ID | Current | Proposed | Rationale |
|----|---------|----------|-----------|
| **TD-M9** | MEDIUM | **LOW** | Unused shadcn/ui components (~8-10) add minimal bundle impact because shadcn/ui components are local copies, not imported from a monolithic package. Tree-shaking handles most of this. The real cost is developer confusion, not bundle size. Estimate ~20-30KB impact, not 50-100KB as stated. |
| **TD-L4** | LOW | **COSMETIC** | Login button gradient vs solid primary is a deliberate design choice for the hero CTA. The gradient (`from-purple-900 to-purple-700`) creates visual hierarchy — it makes the login/signup buttons stand out from standard buttons. This is actually good UX. Keep it intentional, just document the decision. |

### Confirmed (severity is correct)

| ID | Severity | Note |
|----|----------|------|
| **TD-H1** | HIGH | Confirmed critical — 1,704 lines, 23 `useState` hooks, 133 className attributes. Detailed decomposition plan below. |
| **TD-H7** | HIGH | Correct — zero error boundaries. A Firebase connection failure crashes the entire app. |
| **TD-M10** | MEDIUM | Correct — `jspdf` (~500KB) + `xlsx` (~300KB) loaded eagerly. Should lazy-load with `dynamic(() => import(...))`. |
| **TD-M11** | MEDIUM | Correct — confirmed mixed Portuguese/English. Profit-stats is 50/50, sidebar has "Sair / Logout", settings has "Acesso Restrito". Worse than draft suggested. |
| **TD-L6** | LOW | Correct — custom shadows not tokenized, but limited to profit-stats page. |
| **TD-L7** | LOW | Correct — no `useMemo`/`useCallback`. With 23 `useState` hooks in orders page, re-renders cascade on every state change. |

---

## 3. Effort Estimate Corrections

| ID | Draft Estimate | Revised | Rationale |
|----|---------------|---------|-----------|
| **TD-H1** | 1-2 days | **3-4 days** | Decomposing a 1,704-line component with 23 state hooks is complex. Need to extract ~9 components + 3 custom hooks, rewire state management, and test each extraction doesn't break real-time updates. This is the riskiest frontend change. |
| **TD-H8** | 4h | **6-8h** | Accessibility fixes span every page and every interactive element. Need: aria-labels on ~30+ icon buttons, aria-live regions on all toast notifications, aria-current on navigation, aria-describedby on all form fields, role attributes on data tables and charts. |
| **TD-H9** | 2h | **3h** | Empty states needed for: orders list (0 orders), search results (0 matches), filtered views (0 in country), chart data ("No data for this period"), AND loading-to-empty transitions. Each needs design + implementation. |
| **TD-M10** | 2h | **1h** | Next.js dynamic imports are straightforward: `const PdfExport = dynamic(() => import('./ExportPdf'))`. The export buttons just need to trigger lazy loading on click. |
| **TD-M11** | 2h | **4-6h** | Mixed language is worse than estimated. Found hardcoded strings in 5+ files across both languages. Proper fix requires: (1) decide language, (2) extract ALL strings to constants file or i18n system, (3) update every page. If i18n is chosen, add `next-intl` or similar — that's a half-day alone. |
| **TD-L7** | 2h | **1h** | Memoization is targeted: wrap `useMemo` around sidebar menu filtering, chart data calculations, and expensive order list transformations. Quick wins. |

---

## 4. Missing Debt Items (not in draft)

### 4.1 NEW: TD-H11 — No Skip Navigation Link

**Severity:** HIGH
**Source:** Direct code review of `layout.tsx` and `sidebar.tsx`
**Domain:** Accessibility (WCAG 2.4.1 — Level A)
**Impact:** Keyboard-only users must Tab through the entire sidebar (logo, user profile, 3+ nav items, settings, logout = 8+ tab stops) before reaching main content on every page navigation.
**Effort:** 30min

**Fix:**
```tsx
// In src/app/(app)/layout.tsx, add as first child of body
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
>
  Skip to main content
</a>

// Then on <main> element:
<main id="main-content" tabIndex={-1}>
```

---

### 4.2 NEW: TD-H12 — Charts Have No Accessible Description

**Severity:** HIGH
**Source:** `profit-stats/page.tsx` — Recharts `AreaChart` component
**Domain:** Accessibility (WCAG 1.1.1 — Level A)
**Impact:** Screen reader users receive zero information about the daily net profit chart. The chart is pure visual — no `role="img"`, no `aria-label`, no text alternative describing the trend.
**Effort:** 1h

**Fix:**
```tsx
<div role="img" aria-label={`Daily net profit chart showing ${dailyData.length} data points. Trend: ${trendDirection}.`}>
  <ResponsiveContainer>
    <AreaChart data={dailyData} aria-hidden="true">
      {/* ... */}
    </AreaChart>
  </ResponsiveContainer>
</div>
```

---

### 4.3 NEW: TD-M15 — No Loading Skeletons

**Severity:** MEDIUM
**Source:** All pages use generic spinner loaders
**Domain:** UX / Perceived Performance
**Impact:** Users see a blank page with a spinning icon, then content suddenly appears. No visual preview of content structure. This increases perceived load time and causes layout shift when content renders.
**Effort:** 4h

**Recommendation:** Replace spinner-only loading states with skeleton screens that mirror the actual content layout:
- Orders page: skeleton table rows with pulsing cells
- Profit stats: skeleton chart area + skeleton cards
- Settings: skeleton form fields

shadcn/ui already includes a `Skeleton` component — it's installed but unused.

---

### 4.4 NEW: TD-M16 — No Mobile-Optimized Table View

**Severity:** MEDIUM
**Source:** `master-shopify-orders/page.tsx`
**Domain:** Responsiveness / UX
**Impact:** The orders data table renders identically on mobile and desktop. On screens < 768px, the table overflows horizontally requiring horizontal scrolling. With 8+ columns (thumbnail, product, size, qty, version, customization, tracking, actions), this is unusable on mobile.
**Effort:** 4h (during orders page decomposition)

**Recommendation:** Implement a card-based layout for mobile that stacks order information vertically:
```
Mobile (< 768px):  Card stack layout (one order per card)
Tablet (768px+):   Condensed table (hide optional columns)
Desktop (1024px+): Full table with all columns
```

---

### 4.5 NEW: TD-L9 — Typo in Production Copy

**Severity:** LOW
**Source:** `profit-stats/page.tsx:156`
**Domain:** Content Quality
**Impact:** "No avaiable daily Net Profit data." — "avaiable" should be "available". Minor but visible to users.
**Effort:** 1min

---

### 4.6 NEW: TD-L10 — Toast Notifications Not Announced to Screen Readers

**Severity:** HIGH (upgrading from what would be LOW visibility)
**Source:** All pages using `useToast()`
**Domain:** Accessibility (WCAG 4.1.3 — Level AA)
**Impact:** Toast notifications are the PRIMARY feedback mechanism for success/error states across the entire app. None have `aria-live` regions. Screen reader users never know if their action succeeded or failed.
**Effort:** 2h (fix in toast component once, applies globally)

**Fix:** The shadcn/ui `Toaster` component likely needs `role="status"` and `aria-live="polite"` added. If already present in the component library, verify it's not being overridden.

---

## 5. Orders Page Decomposition Strategy

The 1,704-line monolithic orders page is the single biggest frontend debt. Here's the concrete extraction plan based on actual code analysis:

### 5.1 Proposed Component Architecture (Atomic Design)

```
src/app/(app)/master-shopify-orders/
├── page.tsx                    # Orchestrator (~250 lines)
├── components/
│   ├── OrdersTable.tsx         # Organism — table rendering + pagination (~300 lines)
│   ├── OrderRow.tsx            # Molecule — single order row (~150 lines)
│   ├── OrderEditDialog.tsx     # Organism — edit form modal (~200 lines)
│   ├── OrderFilters.tsx        # Molecule — search + date + status filters (~150 lines)
│   ├── CountryTabs.tsx         # Molecule — country tab navigation (~80 lines)
│   ├── ExportControls.tsx      # Molecule — PDF + Excel buttons (~100 lines)
│   ├── OrderStatusBadge.tsx    # Atom — status chip rendering (~30 lines)
│   ├── TrackingInput.tsx       # Atom — inline tracking number edit (~60 lines)
│   └── OrderEmptyState.tsx     # Atom — zero results message (~40 lines)
├── hooks/
│   ├── useOrders.ts            # Data fetching + real-time sync (~100 lines)
│   ├── useOrderFilters.ts      # Filter state + logic (~80 lines)
│   ├── usePdfExport.ts         # PDF generation (~120 lines)
│   └── useExcelExport.ts       # Excel generation (~80 lines)
└── types.ts                    # Shared types (~40 lines)
```

### 5.2 State Management After Decomposition

Current: 23 `useState` hooks in one component.

Proposed reduction:

| Hook Group | Current Location | Target Location | Count |
|-----------|-----------------|----------------|-------|
| Filter state (search, date, status) | page.tsx | `useOrderFilters` | 6 → 1 hook |
| Export state (loading, progress) | page.tsx | `usePdfExport` / `useExcelExport` | 4 → 2 hooks |
| Table state (sort, page, selection) | page.tsx | `OrdersTable` local state | 5 → 0 in page |
| Edit dialog state (open, data) | page.tsx | `OrderEditDialog` local state | 4 → 0 in page |
| Data state (orders, loading) | page.tsx | `useOrders` | 3 → 1 hook |
| **Total in page.tsx** | **23** | **~4** | **83% reduction** |

### 5.3 Extraction Order (dependency-safe)

```
Step 1: Extract types.ts (0 dependencies)
Step 2: Extract atoms (OrderStatusBadge, TrackingInput, OrderEmptyState)
Step 3: Extract hooks (useOrders, useOrderFilters)
Step 4: Extract molecules (OrderRow, OrderFilters, CountryTabs)
Step 5: Extract organisms (OrdersTable, OrderEditDialog, ExportControls)
Step 6: Rewrite page.tsx as orchestrator
Step 7: Verify real-time updates still work end-to-end
```

---

## 6. Accessibility Comprehensive Assessment

### 6.1 Current State: WCAG 2.1 Compliance

| Level | Criterion | Status | Details |
|-------|-----------|--------|---------|
| **A** | 1.1.1 Non-text Content | FAIL | Charts have no alt text, icon buttons unlabeled |
| **A** | 1.3.1 Info and Relationships | FAIL | Tables lack semantic markup, forms lack aria-describedby |
| **A** | 2.1.1 Keyboard | PARTIAL | Tab works, but no skip link, no visible focus on all elements |
| **A** | 2.4.1 Bypass Blocks | FAIL | No skip navigation link |
| **A** | 4.1.2 Name, Role, Value | FAIL | Icon buttons, form fields, modals lack programmatic names |
| **AA** | 1.4.3 Contrast | PASS | Text contrast ~18.5:1, accent ~8:1 — excellent |
| **AA** | 2.4.7 Focus Visible | PASS | `focus-visible:ring-2` on interactive elements |
| **AA** | 4.1.3 Status Messages | FAIL | Toasts not announced via aria-live |

**Current WCAG Score: ~40% Level A compliance, ~60% Level AA compliance**

### 6.2 Accessibility Fix Priority

| Priority | Fix | Pages Affected | Effort |
|----------|-----|---------------|--------|
| 1 | Add `aria-live="polite"` to Toaster component | ALL pages | 30min |
| 2 | Add skip navigation link to root layout | ALL pages | 30min |
| 3 | Add `aria-label` to all icon-only buttons | Sidebar, Orders, Profit Stats | 2h |
| 4 | Add `aria-describedby` to form validation messages | Login, Settings, Orders | 1h |
| 5 | Add `role="img"` + `aria-label` to charts | Profit Stats | 30min |
| 6 | Add `aria-current="page"` to active nav item | Sidebar | 15min |
| 7 | Add `role="table"` + semantic headers to orders table | Orders | 1h |
| 8 | Add `aria-busy="true"` to loading containers | ALL pages | 30min |

**Total accessibility effort: ~6-8 hours** (up from 4h in draft)

---

## 7. Internationalization (i18n) Assessment

### 7.1 Current Language Distribution

| File | English | Portuguese | Mixed |
|------|---------|-----------|-------|
| `login/page.tsx` | 100% | 0% | - |
| `master-shopify-orders/page.tsx` | 100% | 0% | - |
| `profit-stats/page.tsx` | ~50% | ~50% | YES |
| `settings/page.tsx` | ~95% | ~5% | YES |
| `sidebar.tsx` | ~80% | ~20% | YES |
| `mistake-handling/page.tsx` | 100% | 0% | - |

### 7.2 Portuguese Strings Found

| Location | String | Context |
|----------|--------|---------|
| `sidebar.tsx:91` | "Usuário" | Fallback display name |
| `sidebar.tsx:151` | "Sair / Logout" | Logout button |
| `profit-stats:306` | "Erro a carregar profit-stats:" | Console error |
| `profit-stats:386` | "Valor inválido" | Toast title |
| `profit-stats:386` | "Insere um valor numérico válido." | Toast message |
| `profit-stats:417` | "Extra aplicado" | Toast title |
| `profit-stats:417` | "Despesa atualizada com sucesso." | Toast message |
| `profit-stats:427` | "Erro ao guardar" | Toast title |
| `profit-stats:429` | "Não foi possível guardar o ajuste de despesa." | Toast message |
| `settings:200` | "Acesso Restrito" | Restricted access card title |

### 7.3 Recommendation

**Decision needed (TD-M11):** Standardize to ONE language before migration.

| Option | Effort | Recommendation |
|--------|--------|---------------|
| **All English** | 2h | Good if team is international |
| **All Portuguese** | 4h | Good if all users are Portuguese-speaking |
| **i18n system** (`next-intl`) | 1-2 days | Best long-term but adds migration complexity |

**My recommendation:** Standardize to **English** first (2h effort), add i18n as a post-migration optimization. During the Supabase migration, all user-facing strings will be rewritten anyway — that's the natural moment to introduce i18n if needed.

---

## 8. Design System Health Check

### 8.1 Token Coverage

| Category | Tokenized? | Issues |
|----------|-----------|--------|
| Colors (background, foreground, accent) | YES | Excellent HSL-based system |
| Typography (font families, weights) | YES | Inter + Space Grotesk properly configured |
| Spacing | PARTIAL | Tailwind defaults used, but no custom spacing scale |
| Border radius | YES | `--radius: 0.5rem` with lg/md/sm variants |
| Shadows | NO | Custom shadows hardcoded in profit-stats |
| Animations | YES | Tailwind animate plugin configured |
| Breakpoints | YES | Default Tailwind breakpoints (sm/md/lg/xl) |

### 8.2 Design Consistency Score: 8.5/10

**Consistent patterns:**
- Card containers: `bg-black/40 border-white/10` — used everywhere
- Spacing: `gap-6` between major sections
- Primary action: purple (`bg-primary`)
- Highlight: teal (`text-accent`)
- Feedback: Toast notifications (consistent pattern)
- Icons: Lucide React, `h-4 w-4` standard

**Inconsistencies confirmed:**
- Login gradient vs solid primary (intentional — document, don't fix)
- Inline `style={{}}` in profit-stats (dynamic border colors — refactor to CSS vars)
- `text-[11px]` arbitrary value in sidebar/charts (create `text-2xs` token)

---

## 9. Migration Impact — UX Perspective

### 9.1 Components That Change During Supabase Migration

| Component | What Changes | UX Risk | Mitigation |
|-----------|-------------|---------|------------|
| Orders page (real-time) | `useCollection` → Supabase Realtime | HIGH — users expect instant updates | Test Supabase Realtime latency matches Firestore |
| Profit stats (read) | `getDoc` → Supabase `.select()` | LOW — one-time reads | Straightforward swap |
| Auth flow | Firebase Auth → Supabase Auth | HIGH — users must reset passwords | Clear communication, smooth reset flow |
| Loading states | No change in mechanism | MEDIUM — good time to add skeletons | Add skeleton loaders during migration |
| Sidebar (role check) | Custom claims → `users.role` query | LOW — same logic, different source | Verify role check doesn't flash wrong menu |

### 9.2 Recommended UX Improvements During Migration

| Improvement | Why During Migration | Effort |
|------------|---------------------|--------|
| Decompose orders page | Natural break point — hooks are being rewritten anyway | 3-4 days |
| Add empty states | New data source = new edge cases | 3h |
| Add skeleton loaders | New loading patterns for Supabase queries | 4h |
| Fix all accessibility | Fresh components = right time to build accessible | 6-8h |
| Standardize language | Rewriting all user-facing strings anyway | 2h |

**Total UX improvement during migration: ~5-6 additional days**

---

## 10. Summary of Amendments to Draft

| # | Amendment | Impact |
|---|-----------|--------|
| 1 | Upgrade TD-H8 (accessibility) to CRITICAL | Zero ARIA attributes = WCAG Level A failure |
| 2 | Upgrade TD-H9 (empty states) to CRITICAL | Violates Nielsen's visibility heuristic |
| 3 | Upgrade TD-L5 (inline styles) to MEDIUM | Blocks design system consistency during migration |
| 4 | Downgrade TD-M9 (unused components) to LOW | shadcn/ui is local copies, minimal bundle impact |
| 5 | Downgrade TD-L4 (login gradient) to COSMETIC | Intentional design hierarchy, document don't fix |
| 6 | Add TD-H11: Skip navigation link | New — WCAG 2.4.1 Level A requirement |
| 7 | Add TD-H12: Charts have no accessible description | New — WCAG 1.1.1 Level A requirement |
| 8 | Add TD-M15: No loading skeletons | New — UX perceived performance |
| 9 | Add TD-M16: No mobile table view | New — orders table unusable on mobile |
| 10 | Add TD-L9: Typo in production copy | New — "avaiable" → "available" |
| 11 | Add TD-L10 (→ actually HIGH): Toasts not announced | New — WCAG 4.1.3 Level AA requirement |
| 12 | Revise TD-H1 effort to 3-4 days | Orders decomposition is riskier than estimated |
| 13 | Revise TD-H8 effort to 6-8h | Accessibility fixes span entire app |
| 14 | Revise TD-M11 effort to 4-6h | Language mixing worse than estimated |
| 15 | Concrete orders decomposition plan | 9 components + 4 hooks + extraction order |
| 16 | Recommend UX improvements during migration | 5-6 additional days for quality UX |

---

## 11. Next Phase

**Phase 7 → @qa (Quinn):** QA Gate — review all specialist amendments and produce `qa-review.md` with verdict (APPROVED | NEEDS WORK).

Activate with: `@qa`

---

*Generated by @ux-design-expert (Uma) — Brownfield Discovery Phase 6*
*— Uma, desenhando com empatia 💝*
