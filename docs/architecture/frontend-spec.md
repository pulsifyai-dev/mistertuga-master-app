# Frontend Specification — MisterTuga Insights

**Phase:** Brownfield Discovery - Phase 3
**Author:** @ux-design-expert (Uma)
**Date:** 2026-03-02
**Status:** Draft

---

## 1. Frontend Overview

| Aspect | Detail |
|--------|--------|
| **Framework** | Next.js 14.2.6 (App Router) |
| **Language** | TypeScript 5 (strict mode) |
| **UI Library** | shadcn/ui (Radix primitives) — 38 components |
| **Styling** | Tailwind CSS 3.4.1 (dark mode forced) |
| **Forms** | React Hook Form + Zod validation |
| **Charts** | Recharts 2.15.1 |
| **Icons** | Lucide React |
| **State** | React Context (Auth, Firebase, Sidebar) |
| **Fonts** | Inter (body), Space Grotesk (headlines) |

**Overall Frontend Quality: 8.1/10** — Production-ready with optimization opportunities.

---

## 2. Design System Assessment

### 2.1 Design Tokens (CSS Custom Properties)

**Token Coverage: 9/10** — Excellent dark mode system.

| Token Category | Count | Notes |
|---------------|-------|-------|
| Background colors | 6 | background, card, popover, muted, sidebar-bg, etc. |
| Foreground colors | 6 | foreground, muted-fg, card-fg, sidebar-fg, etc. |
| Brand colors | 3 | primary (#624CAB), accent (#30D5C8), destructive (red) |
| Chart colors | 5 | purple, pink, green, cyan, orange |
| Sidebar tokens | 5 | Dedicated sidebar color system |
| Border radius | 3 | lg (8px), md (6px), sm (4px) |
| Typography | 3 | Inter, Space Grotesk, monospace |

**Dark Mode:** Forced globally via `className="dark"` on `<html>`. No light mode toggle exists.

### 2.2 Color Palette

```
Primary:     hsl(258 39% 52%)  — Deep purple (#624CAB)
Background:  hsl(0 0% 13%)    — Dark gray (#212121)
Accent:      hsl(175 67% 51%) — Teal (#30D5C8)
Destructive: hsl(0 62.8% 30.6%) — Dark red
Foreground:  hsl(0 0% 98%)    — Off-white
Muted:       hsl(0 0% 15%)    — Subtle gray
Border:      hsl(0 0% 20%)    — Dark border
```

### 2.3 Typography Scale

| Style | Font | Weight | Usage |
|-------|------|--------|-------|
| Headlines | Space Grotesk | 400/500/700 | Page titles, card headers |
| Body | Inter | 400/500/600/700 | All UI text |
| Code | System monospace | 400 | Code blocks |
| Micro | Inter 11px | 400 | Sidebar role label, chart labels |

---

## 3. Component Inventory

### 3.1 Atomic Design Classification

**Atoms (22 components):**
Button, Input, Textarea, Label, Badge, Separator, Checkbox, RadioGroup, Switch, Progress, Slider, Skeleton, Alert, Tooltip, Popover, Logo, Spinner, ScrollArea, Collapsible, Calendar

**Molecules (16 components):**
Card (header+content+footer), Form (label+input+message), Toast, AlertDialog, Dialog, Tabs, Accordion, Avatar, Breadcrumb, Sheet, Select, DropdownMenu, Menubar, Carousel

**Organisms (6 components):**
- `DashboardSidebar` — Role-aware navigation (157 lines)
- `DashboardHeader` — Sticky breadcrumb header (42 lines)
- `ProfitChart` — Recharts area chart (53 lines)
- `AuthProvider` — Auth context manager (75 lines)
- `FirebaseErrorListener` — Global error handler (39 lines)
- `Logo` — SVG brand mark (21 lines)

### 3.2 Component Health

| Metric | Value | Verdict |
|--------|-------|---------|
| Total components | 44 | Healthy |
| Custom components | 6 | Lean |
| shadcn/ui components | 38 | Rich library |
| Avg component size | 88 lines | Well-focused |
| Largest component | 1,704 lines | CRITICAL — needs decomposition |
| Unused components | ~8-10 estimated | Could prune (carousel, menubar, slider) |

---

## 4. Page Analysis

### 4.1 Page Inventory

| Page | Route | Lines | Complexity | Role |
|------|-------|-------|-----------|------|
| Login/Signup | `/login` | 277 | High | Public |
| Home | `/` | 32 | Low | Redirect |
| Shopify Orders | `/master-shopify-orders` | 1,704 | **EXTREME** | All users |
| Profit Stats | `/profit-stats` | 600 | Very High | Admin only |
| Mistake Handling | `/mistake-handling` | 32 | Low | Placeholder |
| Settings | `/settings` | 209 | High | All users |

**Total page code: 2,854 lines**

### 4.2 Critical Page: Master Shopify Orders (1,704 lines)

This page is the heart of the application and the biggest technical debt:

**Features crammed into one file:**
- Real-time order list with Firestore listeners
- Country tab filtering with flag emojis
- Date range filtering
- Search across customer name, order ID, tracking
- Inline editing (customer info, tracking, notes)
- Status transitions (Pending → Shipped)
- PDF export (multi-page, chunked, with progress bar)
- Excel export (XLSX)
- Order detail modal dialogs
- Image thumbnail previews
- Checkbox selection for bulk actions
- Sorting and ordering

**Decomposition recommendation (Atomic Design):**

| Extracted Component | Type | Est. Lines |
|--------------------|------|-----------|
| `OrderTable` | Organism | 300 |
| `OrderRow` | Molecule | 150 |
| `OrderEditDialog` | Organism | 200 |
| `OrderFilters` (search + date + country) | Molecule | 150 |
| `ExportActions` (PDF + Excel) | Molecule | 200 |
| `CountryTabs` | Molecule | 80 |
| `OrderStatusBadge` | Atom | 30 |
| `useOrders` hook | Hook | 100 |
| `useOrderFilters` hook | Hook | 80 |
| `useExport` hook | Hook | 150 |
| Remaining page orchestrator | Page | ~250 |

---

## 5. UX Flow Analysis

### 5.1 Authentication Flow

```
/login
├── Tab: Login
│   ├── Email input
│   ├── Password input
│   ├── Submit → Firebase signInWithEmailAndPassword
│   ├── Success → getIdToken(true) → redirect /
│   └── Error → Toast notification
│
└── Tab: Sign Up
    ├── Name input
    ├── Email input
    ├── Password input (min 6)
    ├── Confirm password (match validation)
    ├── Admin code (optional)
    ├── Submit → Server Action signUp()
    ├── Success → auto-login → redirect /
    └── Error → Toast notification

/ (Home)
└── Role check → redirect
    ├── ADMIN → /profit-stats
    └── Other → /master-shopify-orders
```

### 5.2 Navigation Structure

```
Sidebar (persistent, collapsible on mobile)
├── User Profile Card (avatar, name, role)
├── Navigation Items:
│   ├── 📊 Profit Stats (admin only, requiresAdmin: true)
│   ├── 📦 Shopify Orders (all users)
│   └── ⚠️ Mistake Handling (all users)
├── ⚙️ Settings
└── 🚪 Logout
```

**Role-based filtering:** Menu items with `requiresAdmin: true` are hidden for non-admin users.

### 5.3 Data Interaction Patterns

| Pattern | Pages | Implementation |
|---------|-------|---------------|
| Real-time lists | Orders | `useCollection()` → Firestore `onSnapshot` |
| Single doc read | Profit Stats | `getDoc()` (not real-time) |
| Inline editing | Orders, Profit Stats | Local state → Server Action / `updateDoc` |
| Form submission | Login, Settings | React Hook Form → Firebase / Server Action |
| Export | Orders | `html2canvas` + `jspdf` (PDF), `xlsx` (Excel) |

---

## 6. Responsive Design Assessment

**Score: 8/10** — Good mobile support, tablet gaps.

### Breakpoint Usage

| Breakpoint | Instances | Usage |
|-----------|-----------|-------|
| `sm` (640px) | Minimal | Mobile sidebar toggle |
| `md` (768px) | 12+ | Primary responsive break — layout, padding, visibility |
| `lg` (1024px) | 12+ | Grid columns, extra padding |
| `xl` (1280px) | Minimal | Underutilized |

### Layout Pattern
```
Mobile (< 768px):  Single column, collapsible sidebar, p-4
Tablet (768px+):   2-column grids, expanded sidebar, p-6
Desktop (1024px+): Max-width 6xl (1152px), centered, p-8
```

### Gaps
- No tablet-specific optimizations between md and lg
- Complex order table may overflow on small screens
- Touch targets not consistently 44x44px minimum
- No landscape mobile consideration

---

## 7. Accessibility Assessment

**Score: 7.5/10** — Good foundation, needs polish.

### Strengths
| Area | Status | Details |
|------|--------|---------|
| Focus indicators | ✅ | `focus-visible:ring-2` on all interactive elements |
| Semantic HTML | ✅ | Proper headings, form labels, button types |
| Color contrast | ✅ | Text on dark: ~18.5:1 (AAA), accent: ~8:1 (AA) |
| Keyboard nav | ✅ | Tab, Escape, Enter, Arrow keys supported |
| Form validation | ✅ | Zod + error messages linked via aria-describedby |

### Gaps (Priority Order)
| # | Issue | Severity | Location |
|---|-------|----------|----------|
| A1 | No "skip to main content" link | High | Root layout |
| A2 | Missing `aria-label` on sidebar trigger icon | High | Header |
| A3 | Loading spinners lack `role="status"` and `aria-busy` | High | App layout, pages |
| A4 | Charts have no `role="img"` or accessible description | High | ProfitChart |
| A5 | Empty states missing for "0 results" scenarios | Medium | Orders page |
| A6 | Very small text (`text-[11px]`) may fail readability | Medium | Sidebar, charts |
| A7 | No `aria-expanded` on collapsible sections | Medium | Sidebar, accordion |
| A8 | Breadcrumb separators not labeled for screen readers | Low | Header |

---

## 8. State Management & UX Patterns

### Loading States

| Context | Implementation | Quality |
|---------|---------------|---------|
| Auth loading | Full-screen spinner | ⚠ No aria-busy |
| Page data loading | Inline text + spinner | ✅ Clear feedback |
| Button loading | Spinner + disabled state | ✅ Good pattern |
| Webhook loading | Centered spinner | ✅ Contained |

### Error States

| Context | Implementation | Quality |
|---------|---------------|---------|
| Auth errors | Toast (destructive) | ✅ Clear message |
| Server action errors | Toast (destructive) | ✅ Consistent |
| Permission errors | Error emitter → global handler | ✅ Sophisticated |
| Access denied | Lock icon + message card | ✅ Visual + text |

### Empty States

| Context | Implementation | Quality |
|---------|---------------|---------|
| No profit data | Text message | ⚠ Minimal |
| Under construction | Card with icon | ✅ Informative |
| No orders | **MISSING** | ❌ Gap |
| No search results | **MISSING** | ❌ Gap |

---

## 9. Design Consistency Analysis

**Score: 8.5/10** — Strong visual language with minor inconsistencies.

### Consistent Patterns
- Card containers with `bg-black/40 border-white/10` backgrounds
- `gap-6` spacing between major sections
- Purple accent for primary actions
- Teal accent for highlights/metrics
- Toast notifications for all user feedback
- Lucide icons consistently sized (h-4 w-4 standard)

### Inconsistencies Found

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| I1 | Login button uses gradient (`from-purple-900 to-purple-700`) while rest of app uses solid `bg-primary` | Login page | Standardize to one button style |
| I2 | Inline `style={{}}` props override Tailwind system | Orders page (border colors) | Use Tailwind classes or CSS variables |
| I3 | Custom shadow values (`shadow-[0_14px_35px...]`) not tokenized | Profit stats | Create shadow tokens |
| I4 | Mixed Portuguese/English text in UI | Throughout | Standardize to one language |
| I5 | `text-[11px]` arbitrary value used instead of token | Sidebar, charts | Create `text-2xs` token |

---

## 10. Performance Observations

### Bundle Size Risks
- 38 shadcn/ui components — estimated 8-10 unused (carousel, menubar, slider, etc.)
- `html2canvas` + `jspdf` loaded for PDF export (heavy, ~500KB)
- `xlsx` library for Excel export (~300KB)

### Rendering Optimization Gaps
- No `useMemo` / `useCallback` in heavy components
- Sidebar menu items re-filtered on every render
- Profit chart recalculates on every state change
- Firebase real-time listeners not lazy-loaded

### Recommendations
- Lazy-load PDF/Excel export libraries (`dynamic(() => import(...))`)
- Memoize sidebar menu filtering
- Extract chart data calculations into `useMemo`
- Audit and remove unused shadcn/ui components

---

## 11. Migration Impact (Firebase → Supabase)

### Components That Must Change

| Component/Hook | Current (Firebase) | Target (Supabase) | Effort |
|---------------|-------------------|-------------------|--------|
| `AuthProvider` | Firebase Auth + custom claims | Supabase Auth + `users.role` | High |
| `useCollection()` | Firestore `onSnapshot` | Supabase Realtime channels | High |
| `useDoc()` | Firestore `onSnapshot` | Supabase `.select().single()` + Realtime | High |
| `FirebaseProvider` | Firebase SDK init | Supabase client init | Medium |
| `signUp()` action | Admin SDK + custom claims | Supabase Auth + insert into users | Medium |
| `updateOrderDetails()` | Admin SDK Firestore | Supabase service role client | Medium |
| `profit-stats/page.tsx` | Direct Firestore `getDoc/setDoc` | Supabase `.select()` / `.upsert()` | Medium |
| `settings/page.tsx` | Direct Firestore ops | Supabase client ops | Low |
| Cloud Function webhook | Firebase trigger | Supabase Database Webhook / Edge Function | Medium |

### Components That Stay Unchanged
- All shadcn/ui components (pure UI)
- Tailwind configuration and design tokens
- Layout structure and routing
- Form validation (Zod schemas)
- PDF/Excel export logic
- All page layouts and visual design

---

## 12. Recommended Improvements (Priority Order)

### Quick Wins (1-2 hours each)
1. Add "skip to main content" link in root layout
2. Add `aria-label` to sidebar trigger and icon buttons
3. Add `role="status"` to loading spinners
4. Add empty state for orders table ("No orders found")
5. Fix Cloud Function region (us-central1 → europe-west1)
6. Standardize login button to solid `bg-primary`

### Medium Effort (half day each)
7. Decompose orders page into atomic components
8. Extract custom hooks (`useOrders`, `useOrderFilters`, `useExport`)
9. Lazy-load PDF/Excel export libraries
10. Add `useMemo` to heavy calculations
11. Audit and remove unused shadcn/ui components
12. Standardize UI language (Portuguese or English, not both)

### Significant Effort (1-2 days each)
13. Rewrite Firebase hooks to Supabase client
14. Migrate AuthProvider to Supabase Auth
15. Implement proper empty/error states across all pages
16. Add comprehensive WCAG AA audit and fixes

---

## 13. Next Phase

**Phase 4 → @architect (Aria):** Compile all Phase 1-3 findings into `technical-debt-DRAFT.md`.

Activate with: `@architect`

---

*Generated by @ux-design-expert (Uma) — Brownfield Discovery Phase 3*
*— Uma, desenhando com empatia 💝*
