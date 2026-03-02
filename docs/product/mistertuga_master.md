# Mr. Tour Ops — Centralized Operations App (SPEC / PRD)

## 0) Product Goal
Build a centralized operations application for **Mr. Tour** that consolidates:
- **Profit dashboard** (revenue + expenses, automatic + manual)
- **Shopify Orders** management (multi-country tabs, search/filter, export/delete, item images)
- **Exchanges/Returns** workflow (AI via n8n + email, dynamic table, automated replies)
- **Suppliers & Shipping Cost Management** (cost calculations per order, periodic exports, future reconciliation)
- **Tracking number sync** between Shopify and the App

This document describes **what the app must do**, the **rules**, and the **features to implement/improve**, so an implementation system can build it accurately without assumptions.

---

## 1) Data Sources, Storage & Integrations (High Level)

### 1.1 Shopify (Revenue + Orders + Tracking)
- Shopify is the **only source of revenue**.
- Shopify provides **orders** (including line items and product images/links).
- Shopify is also a source and destination for **tracking numbers** (two-way sync with the app).

### 1.2 Google Ads (Expense only)
- Google Ads is **expense only** (ad spend).
- Integrate via API to fetch cost/spend data and reflect it in the profit dashboard.

### 1.3 Meta Ads (Expense only)
- Meta Ads is **expense only** (ad spend).
- Integrate via API to fetch cost/spend data and reflect it in the profit dashboard.

### 1.4 n8n + Email + AI (Exchanges/Returns ingestion)
- Exchanges/returns requests are detected via incoming emails.
- The **n8n workflow** hosts/uses an AI agent that:
  - detects exchange intent,
  - extracts structured data (customer/order/details),
  - writes records into the app’s **Exchanges** table/tab.

### 1.5 Current Storage: Firebase (existing) → Future: Supabase (planned)
- **Current state:** The app is storing orders (and related operational data, including tracking numbers) in **Firebase**.  
  - “We’re sending everything (orders) to Firebase.”
- **Planned migration:** Move/standardize to **Supabase** as the primary database, while keeping the app updated with the same information currently stored in Firebase.

**Important requirement:** Data ingestion and updates must be **idempotent** (no duplicates), regardless of whether the backend is Firebase or Supabase.

---

## 2) Module: Profit (Lucro)

### 2.1 What it shows
A profit dashboard that combines:
- **Revenue** (from Shopify)
- **Expenses**, including:
  - **automatic expenses** from APIs (Google Ads, Meta Ads, and other services where applicable),
  - **manual expenses** entered by authorized users.

### 2.2 Expenses: Services/Software list management
There is a concept of “Services/Softwares” that contribute to operational expenses (e.g., tools, subscriptions).

Requirements:
- In **Admin settings**, there must be an option/permission to:
  - **Add new services/software** to the expenses catalog.
  - Mark them active/inactive.
  - Include metadata (recommended):
    - name
    - category
    - fixed monthly cost (optional)
    - variable cost rules (optional)
    - notes
- Manual expense entry should allow:
  - selecting the service/software (or “other”)
  - amount
  - date
  - notes
  - optional categorization

### 2.3 Integration settings (Profit)
- Ability to connect/disconnect:
  - Shopify (revenue source)
  - Google Ads (expense)
  - Meta Ads (expense)
- Recommended settings:
  - currency
  - timezone
  - mapping for accounts (if multiple ad accounts exist)

---

## 3) Module: Orders (Encomendas) — Shopify Orders Listing

### 3.1 Core behavior
- The Orders tab lists **all Shopify orders** in a table/list.
- It must support:
  - **global search** (magnifying glass) across any relevant field
  - **column filters** (filter row) for structured filtering
  - pagination or virtualization for performance (if many orders)

### 3.2 Country-based automatic tabs (dynamic views)
Orders must be categorized by country, using Shopify `countryCode`:
- Example codes:
  - `PT` (Portugal)
  - `ES` (Spain)
  - `UK` (United Kingdom)

Rules:
- If the system receives an order with a `countryCode` that does not yet have a tab:
  - automatically **create a new country tab** for that country code,
  - show a **flag icon** corresponding to that country.
- Each tab is effectively a filtered view for that country.

### 3.3 Order row / order details requirements
For each order, the UI must show (at minimum):
- **Order ID** and/or **Order Number**
- Customer information:
  - name
  - contact info (email/phone when available)
- Full shipping address
- Financial summary (when available):
  - totals, item prices, taxes, shipping cost, etc.
- Items (each order can have multiple items):
  - item name / variant
  - quantity
  - price(s)
  - **item image/thumbnail**
- Any other useful status fields (if available in Shopify):
  - fulfillment status
  - payment status
  - tracking info

### 3.4 Bulk actions
The Orders module must allow selecting one or multiple orders and:
- **Delete** selected orders (recommended: soft-delete; keep audit trail)
- **Export** selected orders (CSV/XLSX; images optional depending on format)
- Optional: export current filtered view

### 3.5 Tracking numbers (critical operational flow)
The app must support tracking numbers per order, including **two-way synchronization** with Shopify:

#### 3.5.1 Shopify → App (webhook-driven)
Workflow name (existing): **"update tracking number Shopify to app"**
- When a tracking code is added/updated in Shopify, Shopify triggers a webhook.
- That webhook calls this workflow.
- The workflow sends to the app (and database) the respective:
  - order identifier (order id / order number)
  - tracking number
  - country (countryCode)
- The app must update the correct order record in storage (currently Firebase; future Supabase).

#### 3.5.2 App → Shopify (app-driven)
Workflow name (existing / part of central pipeline): **"centralizando en comandos Shopify"**
- If a tracking number is inserted/updated in an order inside the app UI, the system updates Shopify directly.

**Rule:** Updates must be conflict-safe. If both sides update, define last-write-wins strategy OR keep an audit log and resolve by timestamp.

---

## 4) Module: Exchanges / Returns (Trocas)

### 4.1 Purpose
Create a dedicated “Exchanges” tab that operationalizes exchange/return requests captured via email.

### 4.2 Data ingestion (n8n + AI)
- The n8n AI agent monitors incoming email.
- When it detects an exchange/return request:
  - it extracts structured data,
  - writes a record into the Exchanges table/tab.

Each exchange record must include:
- **Order reference**
  - orderNumber (or Shopify order id)
- **Customer contact details**
  - name, email, phone (if present)
- **Customer address**
- **Original order details** (mirror what is shown in Orders):
  - items list
  - prices
  - thumbnails/images (same as Orders)
- **Received/Reported details** (extracted by AI from email):
  - what arrived / what they received
  - reason for exchange
  - any relevant text from email
  - attachments/images if present (or links to stored attachments)

Support fields (recommended):
- status (New / In review / Waiting customer / Approved / Rejected / Completed)
- createdAt / updatedAt
- internal notes

### 4.3 UI actions / buttons
The Exchanges table must support operational actions:
- Column “Notes” for internal notes
- Button/action: **Send email**
  - When clicked, the system sends an email automatically from the configured mailbox.
  - The email must use a **configurable template** (stored in Admin settings).
  - The message should support variables/placeholders such as:
    - {{customer_name}}
    - {{order_number}}
    - {{next_steps}}
    - {{address}}
    - etc.
- Optional quality-of-life actions:
  - open linked Shopify order
  - view email thread history

---

## 5) Module: Suppliers & Shipping Management (Custos Produção + Shipping)

### 5.1 Current state + migration goal
Currently, calculations are being done in an Electron-based flow and some exports are generated via Google Drive.
Goal: **reframe and rebuild this inside the app** so exports are generated directly from the app database and download is immediate (no Google Drive dependency).

### 5.2 Per-order cost calculation & persistence
For each new Shopify order:
- store the order in the database
- calculate:
  - **production cost**
  - **shipping cost**
- calculations are based on official rate tables from:
  - the producer/manufacturer
  - the shipping provider

The database must store:
- order identifiers (orderNumber / orderId)
- computed cost components
- total computed cost
- timestamps
- export checkpoint markers (see below)

### 5.3 Export generation (Excel) — “Send articles to supplier”
Existing workflow reference: **"fluxo para enviar artigos para o supplier"**
- Current behavior (today):
  - works for **two countries**,
  - reads a database field that stores the **last extraction** (or last order),
  - pulls all orders after that checkpoint,
  - creates a document in Google Drive,
  - updates it and calculates costs.
- Target behavior (new app):
  - country-agnostic (works for any country),
  - uses app database checkpoints,
  - pulls orders directly from the database,
  - calculates production/shipping costs from stored rules,
  - generates the Excel file immediately in-app,
  - exposes a direct **download** link.

Critical rule: **Never export the same order twice**
- Exports must start from the **last exported order** (or checkpoint timestamp/id).
- The system must persist last export state in the database.

### 5.4 Image embedding for Shopify links (thumbnails)
- Shopify data may provide image URLs/links.
- During export, the system must convert image URLs into **embedded thumbnails inside the Excel** (not just links).
- This can be done via a Python conversion step (or equivalent), so the output Excel contains actual embedded images.

### 5.5 Download behavior
- After export generation, the file must be available for **direct download** in the app UI.

---

## 6) Central Orchestration Workflows (Existing reference pipelines)

### 6.1 Main pipeline: "centralizando en comandos Shopify"
Current scope:
- Works for **two countries** (Portugal and Spain) today.
Target:
- Refactor to support **any country** dynamically.

Contains two key behaviors:

#### (1) App → Shopify tracking update
- If a tracking number is added/updated inside the app, update Shopify directly.

#### (2) Shopify → App order ingestion ("update new order from Shopify into the app")
- A scheduled job (configurable frequency) fetches Shopify orders in a given time window (e.g., 15:00–15:15).
- It processes new orders and writes them to the database (**currently Firebase; planned Supabase**).
- It updates the app UI with the new orders.
- This ingestion is done per country and must be generalized to any country.

**Rule:** Ingestion must be idempotent (safe to run repeatedly without duplicates).

---

## 7) Future Feature: Supplier Document Upload & Reconciliation (Comparison)
Add a feature where:
- the supplier and/or shipping provider can upload their own cost document,
- the system compares:
  - supplier totals vs system totals,
  - per-order values vs system-computed values,
- the app displays a reconciliation table:
  - differences per order
  - total difference summary
  - flags for mismatches

This is a later phase, not required for MVP unless specified.

---

## 8) Admin / Settings (Permissions & Configuration)

### 8.1 Roles
Minimum roles:
- Admin
- Standard user

### 8.2 Admin-only capabilities
Admins can:
- add/edit/remove services/software in the expenses catalog
- configure integrations (Shopify, Google Ads, Meta Ads)
- configure email account used for sending exchange emails
- configure exchange email templates
- configure export settings (periodicity, columns mapping, checkpoint rules)
- manage cost tables/rules for production & shipping

### 8.3 Recommended audit logging
Track actions:
- who deleted orders
- who exported orders and when
- who sent exchange emails and content/template used
- changes to settings and cost rules
- tracking number updates (origin: Shopify vs App)

---

## 9) Non-functional Requirements (Important Rules)
- Do not duplicate/lose orders:
  - idempotent ingestion from Shopify
  - safe retries for API fetches
- Performance:
  - support large order lists via pagination/virtualization
- Reliability:
  - API failures must not corrupt state; retries should be safe
- Security:
  - protect API tokens, restrict Admin settings access

---

## 10) Implementation Notes / Assumptions
- Current app already has parts of Orders structured, but requires improvements per the requirements above.
- Exchanges tab is new and depends on n8n ingestion.
- Suppliers & Shipping module requires migration from Electron/Google Drive logic into the app’s codebase and database-backed checkpoints.
- Current storage is Firebase; plan is Supabase.

---

## 11) Supporting Materials (Recommended to provide to the implementation system)
To remove ambiguity, provide a folder containing:
1) Reference Excel/Sheet example for export (final column definitions/layout)
2) n8n workflow exports (JSON) for:
   - **"update tracking number Shopify to app"** (Shopify webhook → app update)
   - **"fluxo para enviar artigos para o supplier"** (current export logic)
   - **"centralizando en comandos Shopify"** (main orchestration)
   - internal sub-flow: **"update new order from Shopify into the app"**
   - **"FATURAMENTO E TACHAS DIÁRIO"** (daily Shopify revenue/taxes calculations)
3) Screenshots of current UI (Profit, Orders, any existing screens)
4) Sample anonymized Shopify orders (5+), with multiple items and different countries
5) Sample exchange emails (3+), including attachments if relevant
6) Official cost tables/rules for production and shipping
7) Notes on Firebase schema (current) and planned Supabase schema/mapping

The implementation should treat these documents as the source of truth for column names, mapping rules, and calculation logic.


### 6.2 Daily Revenue & Taxes Calculation (Existing workflow reference)
Existing workflow: **"FATURAMENTO E TACHAS DIÁRIO"**

Purpose (current):
- Pulls Shopify data and performs calculations to compute **daily revenue** (and related daily financial metrics such as taxes, if applicable) for each day.

Target (new app):
- Re-implement this logic **in code inside the app** (preferred), rather than relying on the workflow.
- The app should compute daily aggregates directly from stored Shopify orders (database as source of truth), enabling:
  - daily revenue charts/tables (by date range)
  - optional breakdowns by country, product, channel, etc.
  - consistency with profit dashboard (Shopify revenue + ad spend + other expenses)
- The workflow serves as a reference for business rules, but implementation should be improved/optimized in code.

