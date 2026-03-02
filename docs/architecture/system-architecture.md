# System Architecture — MisterTuga Insights

**Phase:** Brownfield Discovery - Phase 1
**Author:** @architect (Aria)
**Date:** 2026-03-02
**Status:** Draft

---

## 1. System Overview

**MisterTuga Insights** is an e-commerce operations dashboard built for managing Shopify orders, tracking shipments, and analyzing profit metrics. Originally scaffolded with **Google AI Studio (IDX)**, it runs on a **Next.js 14 + Firebase** stack deployed to Firebase App Hosting in Europe (europe-west1).

### Business Domain
- Shopify order management (multi-country)
- Shipment tracking with webhook notifications
- Profit analytics and expense tracking
- Role-based access (ADMIN / FORNECEDOR)

### Primary Users
| Role | Access | Key Features |
|------|--------|-------------|
| **ADMIN** | Full access | Profit stats, settings, webhook config, all orders |
| **FORNECEDOR** | Limited | Order management, mistake handling |

---

## 2. Technology Stack

### Current Stack (as-built)

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| **Framework** | Next.js (App Router) | 14.2.6 | Server Components + Server Actions |
| **Language** | TypeScript | 5.x | Strict mode enabled |
| **UI Library** | shadcn/ui (Radix) | Latest | 42 components |
| **Styling** | Tailwind CSS | 3.4.1 | Dark mode, custom design tokens |
| **Auth** | Firebase Authentication | 11.x | Email/password + custom claims |
| **Database** | Firestore | 11.x | NoSQL, real-time listeners |
| **Cloud Functions** | Firebase Functions | Node.js 20 | Webhook trigger on order update |
| **AI** | Genkit + Gemini 2.5 Flash | 1.20.0 | Scaffolded, not yet implemented |
| **Hosting** | Firebase App Hosting | - | europe-west1 |
| **Charts** | Recharts | 2.15.1 | Area/line charts |
| **Export** | html2canvas + jspdf + xlsx | - | PDF and Excel export |

### Linked Services
| Service | Project | Region |
|---------|---------|--------|
| Firebase | gen-lang-client-0378123449 | europe-west1 |
| Supabase | Mistertuga_Master (zpjpekjpszqwpnpkczgy) | North EU (Stockholm) |
| GitHub | pulsifyai-dev/mistertuga-master-app | - |

---

## 3. Architecture Diagram (ASCII)

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                      │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │  Login    │  │  Orders      │  │  Profit Stats      │    │
│  │  Page     │  │  Dashboard   │  │  (Admin Only)      │    │
│  └────┬─────┘  └──────┬───────┘  └────────┬───────────┘    │
│       │               │                    │                 │
│  ┌────┴───────────────┴────────────────────┴──────────┐     │
│  │              React Context Providers                │     │
│  │  AuthProvider │ FirebaseProvider │ SidebarProvider   │     │
│  └────────────────────────┬────────────────────────────┘     │
│                           │                                  │
│  ┌────────────────────────┴────────────────────────────┐     │
│  │           Real-time Firestore Hooks                  │     │
│  │      useDoc() │ useCollection() │ useAuth()          │     │
│  └────────────────────────┬────────────────────────────┘     │
└───────────────────────────┼──────────────────────────────────┘
                            │ HTTPS
┌───────────────────────────┼──────────────────────────────────┐
│                    NEXT.JS SERVER                             │
│  ┌────────────────────────┴────────────────────────────┐     │
│  │              Server Actions ('use server')           │     │
│  │   signUp() │ updateOrderDetails() │ updateProfile()  │     │
│  └────────────────────────┬────────────────────────────┘     │
│                           │                                  │
│  ┌────────────────────────┴────────────────────────────┐     │
│  │            Firebase Admin SDK (server.ts)            │     │
│  │         Auth Admin │ Firestore Admin                 │     │
│  └────────────────────────┬────────────────────────────┘     │
└───────────────────────────┼──────────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────────┐
│                    FIREBASE PLATFORM                          │
│                           │                                  │
│  ┌────────────┐  ┌───────┴───────┐  ┌──────────────────┐    │
│  │   Auth     │  │  Firestore    │  │  Cloud Functions  │    │
│  │  (Users +  │  │  (Orders,     │  │  (Webhook on      │    │
│  │   Claims)  │  │   Profits,    │  │   tracking add)   │    │
│  │            │  │   Settings)   │  │                   │    │
│  └────────────┘  └───────────────┘  └────────┬─────────┘    │
│                                               │              │
│  ┌──────────────────┐                         │              │
│  │  App Hosting     │                         │              │
│  │  (europe-west1)  │                         │              │
│  └──────────────────┘                         │              │
└───────────────────────────────────────────────┼──────────────┘
                                                │ POST
                                    ┌───────────┴───────────┐
                                    │  External Webhook      │
                                    │  (Tracking Service)    │
                                    └────────────────────────┘
```

---

## 4. Data Architecture

### Firestore Collections

```
firestore/
├── users/{userId}                          # User profiles
│   └── { id, displayName, email, role, createdAt }
│
├── roles_admin/{userId}                    # Admin role lookup (existence = admin)
│   └── { }
│
├── orders/{countryCode}/orders/{orderId}   # Shopify orders (subcollection by country)
│   └── { orderId, customer, items[], status, trackingNumber, note, date }
│
├── settings/{settingId}                    # App-wide settings
│   └── tracking: { url: "https://..." }
│
└── metrics/profit-stats                    # Profit analytics
    └── { periodLabel, currency, totalRevenue, expenses{}, dailyNetProfit[] }
```

### Data Flow Patterns

| Pattern | Usage | Implementation |
|---------|-------|---------------|
| **Real-time reads** | Orders list, profit stats | Client-side Firestore listeners (useDoc/useCollection) |
| **Server writes** | User creation, order updates | Next.js Server Actions → Admin SDK |
| **Event-driven** | Tracking webhook | Cloud Function trigger on Firestore write |
| **Cached reads** | Webhook URL | In-memory cache in Cloud Function |

### Security Rules Summary

| Collection | Read | Write |
|-----------|------|-------|
| `/users/{userId}` | Owner only | Owner only |
| `/orders/{cc}/orders/{id}` | All authenticated | All authenticated |
| `/roles_admin/{userId}` | All authenticated | None (admin-set) |
| `/settings/{id}` | All authenticated | All authenticated |

---

## 5. Authentication & Authorization

### Auth Flow

```
User → Login Page → Firebase Auth (email/password)
                          │
                          ▼
                    Custom Claims Check
                    (getIdTokenResult)
                          │
                    ┌─────┴─────┐
                    │           │
                 ADMIN     FORNECEDOR
                    │           │
              Full Access   Limited Access
              (all routes)  (orders only)
```

### Role Assignment
- **ADMIN:** Set via `ADMIN_REGISTRATION_CODE` during signup → Admin SDK sets custom claims
- **FORNECEDOR:** Default role for all other signups
- **Claims stored in:** Firebase Auth custom claims (NOT Firestore)
- **Verified via:** `getIdTokenResult().claims.role` on client

### Protected Route Strategy
- App layout (`(app)/layout.tsx`) checks auth state
- Redirects to `/login` if unauthenticated
- Sidebar conditionally renders admin-only links
- No middleware-level protection (client-side only)

---

## 6. Frontend Architecture

### Component Hierarchy

```
RootLayout (app/layout.tsx)
├── AuthProvider
├── Toaster
└── (app)/layout.tsx [Protected]
    ├── SidebarProvider
    ├── Sidebar (role-aware navigation)
    ├── Header
    └── Page Content
        ├── /master-shopify-orders (complex table + modals)
        ├── /profit-stats (charts + expense editor)
        ├── /mistake-handling (placeholder)
        └── /settings (profile + webhook config)
```

### State Management
- **Auth state:** React Context (AuthProvider)
- **Firebase services:** React Context (FirebaseProvider)
- **Sidebar:** React Context (SidebarProvider)
- **Server state:** Firestore real-time listeners (no React Query/SWR)
- **Form state:** React Hook Form + Zod validation
- **No global store** (Redux, Zustand, etc.)

### Key Design Patterns
| Pattern | Where Used |
|---------|-----------|
| Server Components | Layouts, static content |
| Client Components | Interactive pages ('use client') |
| Server Actions | signUp, updateOrderDetails |
| Real-time listeners | useDoc(), useCollection() hooks |
| Context providers | Auth, Firebase, Sidebar, Toast |
| Compound components | shadcn/ui (Dialog, Sheet, etc.) |

---

## 7. Backend Architecture

### Server Actions (Next.js)

| Action | File | Purpose |
|--------|------|---------|
| `signUp()` | `login/actions.ts` | Create user + set role claims |
| `updateOrderDetails()` | `master-shopify-orders/actions.ts` | Update order in Firestore |

### Cloud Functions (Firebase)

| Function | Trigger | Purpose |
|----------|---------|---------|
| `sendTrackingWebhookOnOrderUpdate` | Firestore onUpdate `/orders/{cc}/orders/{id}` | POST webhook when tracking number added |

### API Surface
- **No REST/GraphQL API** — all communication via Firestore SDK (client) and Server Actions (mutations)
- **External integration:** Outbound webhook only (no inbound API)

---

## 8. Infrastructure & Deployment

### Current Deployment
```
Firebase App Hosting (europe-west1)
├── Next.js SSR (Server-side rendering)
├── Static assets (CDN)
└── Cloud Functions (Node.js 20)

Firestore (Global)
├── Auto-scaling
└── Real-time sync
```

### Environment Configuration
| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_FIREBASE_*` (6 vars) | Client | Firebase SDK config |
| `FIREBASE_PROJECT_ID` | Server | Admin SDK |
| `FIREBASE_CLIENT_EMAIL` | Server | Admin SDK |
| `FIREBASE_PRIVATE_KEY` | Server | Admin SDK (secret) |
| `ADMIN_REGISTRATION_CODE` | Server | Admin signup validation |

---

## 9. AI Integration (Genkit)

### Current State
- **Genkit SDK** initialized with Google Gemini 2.5 Flash model
- **No flows implemented** — `dev.ts` is empty
- **Infrastructure ready** — Genkit dev server configured in package.json

### Potential Use Cases (from codebase signals)
- Order data summarization
- Profit trend analysis
- Automated customer communication
- Anomaly detection in expenses

---

## 10. Identified Architectural Concerns

### Critical

| # | Concern | Impact | Location |
|---|---------|--------|----------|
| C1 | **No middleware auth protection** | Unauthorized API access possible | Missing `middleware.ts` |
| C2 | **Build errors suppressed** | Hidden bugs ship to production | `next.config.js` (ignoreBuildErrors) |
| C3 | **Firestore rules too permissive on orders** | Any authenticated user can write any order | `firestore.rules` |

### High

| # | Concern | Impact | Location |
|---|---------|--------|----------|
| H1 | **79KB monolithic orders page** | Maintenance difficulty, slow loads | `master-shopify-orders/page.tsx` |
| H2 | **Duplicate Firebase initialization** | Confusion, potential double init | `src/lib/firebase/` vs `src/firebase/` |
| H3 | **No error boundary components** | Unhandled errors crash entire app | All pages |
| H4 | **No tests** | Zero test coverage | `tests/` empty |

### Medium

| # | Concern | Impact | Location |
|---|---------|--------|----------|
| M1 | **No API rate limiting** | Abuse potential on server actions | Server actions |
| M2 | **Client-side only route protection** | Security depends on JS execution | `(app)/layout.tsx` |
| M3 | **No caching strategy** | Redundant Firestore reads | All pages |
| M4 | **Hardcoded port 9002** | Dev environment conflicts | `package.json` |
| M5 | **No loading/error states** | Poor UX on slow connections | Most pages |
| M6 | **Supabase linked but unused** | Unclear migration intent | `supabase/` directory |

### Low

| # | Concern | Impact | Location |
|---|---------|--------|----------|
| L1 | **Package name mismatch** | "nextn" vs "mistertuga" | `package.json` |
| L2 | **Empty AI flows** | Unused dependency weight | `src/ai/dev.ts` |
| L3 | **Placeholder images utility** | Dead code | `src/lib/placeholder-images.ts` |

---

## 11. Technology Migration Notes

### Firebase → Supabase (Potential)
The project has Supabase linked (`Mistertuga_Master`) alongside Firebase. This suggests a potential migration path:

| Firebase Service | Supabase Equivalent | Migration Complexity |
|-----------------|---------------------|---------------------|
| Firebase Auth | Supabase Auth | Medium (custom claims → RLS) |
| Firestore | Supabase PostgreSQL | High (NoSQL → SQL, real-time → Realtime) |
| Cloud Functions | Supabase Edge Functions | Medium (triggers → database webhooks) |
| App Hosting | Vercel / Railway | Low |

**Decision needed:** Is the intent to migrate to Supabase, or use both? This affects all future architecture decisions.

---

## 12. File Map

```
src/
├── app/
│   ├── layout.tsx                  # Root layout (AuthProvider, fonts, metadata)
│   ├── page.tsx                    # Home redirect based on role
│   ├── globals.css                 # Global styles + Tailwind + design tokens
│   ├── login/
│   │   ├── page.tsx                # Login/SignUp UI (Firebase Auth)
│   │   └── actions.ts              # signUp() server action
│   └── (app)/
│       ├── layout.tsx              # Protected layout (sidebar + header)
│       ├── master-shopify-orders/
│       │   ├── page.tsx            # Orders dashboard (COMPLEX - 79KB)
│       │   └── actions.ts          # updateOrderDetails() server action
│       ├── profit-stats/
│       │   └── page.tsx            # Profit analytics (admin only)
│       ├── mistake-handling/
│       │   └── page.tsx            # Error management (placeholder)
│       └── settings/
│           └── page.tsx            # Profile + webhook settings
├── components/
│   ├── auth-provider.tsx           # AuthContext (user, role, isAdmin)
│   ├── FirebaseErrorListener.tsx   # Global error handler
│   ├── dashboard/
│   │   ├── sidebar.tsx             # Role-aware navigation
│   │   ├── header.tsx              # Dashboard header bar
│   │   └── profit-chart.tsx        # Recharts profit visualization
│   ├── icons/logo.tsx              # Logo SVG component
│   └── ui/                         # shadcn/ui (42 components)
├── hooks/
│   ├── use-auth.ts                 # Auth context hook
│   ├── use-toast.ts                # Toast notification hook
│   └── use-mobile.tsx              # Mobile detection hook
├── lib/
│   ├── utils.ts                    # cn() utility
│   ├── placeholder-images.ts       # Dummy images
│   └── firebase/
│       ├── config.ts               # Firebase config from env
│       ├── client.ts               # Client SDK init
│       └── server.ts               # Admin SDK init
├── firebase/
│   ├── index.ts                    # Alt Firebase init
│   ├── config.ts                   # Alt config
│   ├── provider.tsx                # FirebaseProvider context
│   ├── client-provider.tsx         # Client provider wrapper
│   ├── firestore/
│   │   ├── use-collection.tsx      # Real-time collection hook
│   │   └── use-doc.tsx             # Real-time document hook
│   ├── non-blocking-login.tsx      # Deferred auth
│   ├── non-blocking-updates.tsx    # Deferred writes
│   ├── error-emitter.ts           # Error event system
│   └── errors.ts                   # Error types
└── ai/
    ├── genkit.ts                   # Genkit + Gemini 2.5 Flash init
    └── dev.ts                      # Empty flows file

functions/
├── src/index.ts                    # Webhook Cloud Function
├── package.json                    # Functions dependencies
└── tsconfig.json                   # Functions TS config
```

---

## 13. Next Phase

**Phase 2 → @data-engineer (Dara):** Deep dive into Firestore schema, security rules, data modeling, and potential Supabase migration assessment.

Activate with: `@data-engineer`

---

*Generated by @architect (Aria) — Brownfield Discovery Phase 1*
*— Aria, arquitetando o futuro 🏗️*
