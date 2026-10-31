# Brightloop Software - Subscription Management System
## Implementation Checklist & Phased Roadmap

This checklist tracks the implementation progress for the Brightloop Subscription Management System across hackathon stages. Each phase builds incrementally on verified work.

---

### Phase 1: Foundation, Architecture & Data Modeling (Completed)
- [x] Inspect repository state (empty repository verified)
- [x] Create project `.gitignore` covering environment files, dependencies, and build artifacts
- [x] Create `.env.example` with safe placeholders for MySQL, Brevo, and JWT secrets
- [x] Design initial MySQL schema (`database/schema.sql`) covering all 11 core tables
- [x] Create comprehensive `README.md` with system overview, architecture, and setup instructions
- [x] Document staged implementation plan and unresolved decisions

---

### Phase 2: Frontend Foundation & Navigation Shell (Completed)
- [x] Initialize frontend application: React 18+, TypeScript, Vite, Tailwind CSS, Lucide React icons
- [x] Build responsive SaaS layout system:
  - [x] Persistent desktop sidebar with route highlighting and status indicators
  - [x] Responsive mobile slide-over navigation drawer
  - [x] Global app header with quick search, notification badge, and role indicator
- [x] Create reusable UI design system:
  - [x] `Badge`, `Button`, `Card`, `EmptyState`, `ErrorAlert`, `LoadingSpinner`, `PageHeader`
- [x] Build Dashboard Overview:
  - [x] 4 Key metrics cards (Active subscriptions, Revenue received, Outstanding balance, Overdue invoices)
  - [x] Recent invoices table and recent subscription activity feed
  - [x] Date range filter control and demo-data/empty-state toggle
- [x] Create navigable page shells for future modules:
  - [x] Customers (`/customers`)
  - [x] Products & Variants (`/products`)
  - [x] Subscription Plans (`/plans`)
  - [x] Quotation Templates (`/quotations`)
  - [x] Subscriptions Lifecycle (`/subscriptions`)
  - [x] Invoices & Billing (`/invoices`)
  - [x] Payments & Collections (`/payments`)
  - [x] Discounts Rules (`/discounts`)
  - [x] Revenue Reports (`/reports`)
  - [x] Settings & Taxes (`/settings`)
- [x] Build Customer Self-Service Portal entry point (`/portal`):
  - [x] Isolated portal layout with return link to internal dashboard
  - [x] Sign-in placeholder with authentication-boundary security notices
  - [x] Protected placeholder sections for customer subscriptions and invoices
- [x] Isolated demo data module (`src/data/demoData.ts`) clearly labeled as sample data
- [x] Verified TypeScript type safety and Vite production bundling (`npm run build`) with zero errors

---

### Phase 3: MySQL Database Foundation & Server-Side API Layer (Completed)
- [x] Refine normalized MySQL schema (`database/schema.sql`) covering:
  - [x] Users, roles, and status
  - [x] Customers (with optional user_id link)
  - [x] Products and variants (with decimal price adjustments)
  - [x] Billing plans (daily, weekly, monthly, yearly cycles)
  - [x] Taxes, quotation templates, and template lines
  - [x] Subscriptions and subscription lines (with decimal amounts and indexes)
  - [x] Discounts and discount usage ledger
  - [x] Invoices and invoice lines (with billing period start/end and discount columns)
  - [x] Payments (with financial history preservation and update timestamps)
- [x] Create initial development seed data (`database/seed.sql`)
- [x] Create automated database migration and seeding runner script (`scripts/migrate.js`) with npm scripts (`npm run db:migrate`, `npm run db:seed`)
- [x] Configure Netlify Functions directory (`netlify/functions/`) and `netlify.toml` with API URL rewriting
- [x] Build serverless database connection pool module (`netlify/functions/_shared/db.ts`) with SSL support and non-sensitive error reporting
- [x] Implement standardized JSON envelope and CORS helpers (`netlify/functions/_shared/response.ts`)
- [x] Implement serverless read API endpoints:
  - [x] `GET /api/health` — API status and live MySQL ping test
  - [x] `GET /api/products` — Active software, addon, and service catalog with variants
  - [x] `GET /api/plans` — Active recurring billing tiers and lifecycle policies
  - [x] `GET /api/customers` — Parameterized search and bounded pagination (`?page=1&limit=10&search=...`)
- [x] Connect frontend screens (`ProductsPage`, `PlansPage`, `CustomersPage`, and `Header`) to Netlify Functions API:
  - [x] Display live MySQL data when connected
  - [x] Provide graceful fallback to labeled demo preview when offline
  - [x] Include clear error alerts and manual "Sync DB" refresh controls
- [x] Verified full production build (`npm run build`) and type check with zero errors

---

### Phase 4: Authentication, Security & Role-Based Access Control (RBAC)
- [ ] Backend CRUD for Tax Rules (Admin only)
- [ ] Backend CRUD for Products (software, services, add-ons) and Product Variants (e.g., brand/tier price adjustments)
- [ ] Backend CRUD for Billing Plans (daily, weekly, monthly, yearly cycles, min quantity, auto-close, pause rules)
- [ ] Admin UI screens:
  - [ ] Product & Variant catalog manager
  - [ ] Plans management screen
  - [ ] Taxes configuration table
- [ ] Robust client and server-side validation for currency amounts and percentage rates

---

### Phase 5: Customers & Quotation Templates
- [ ] Backend CRUD for Customers (searchable, filterable)
- [ ] Quotation Templates backend (presets with default plans, line items, and validity duration)
- [ ] Internal Staff UI:
  - [ ] Customer directory and detail view
  - [ ] Quotation templates manager
  - [ ] Quick quote generation from existing templates

---

### Phase 6: Subscriptions & Lifecycle Management
- [ ] Subscription number generator (e.g., `SUB-YYYY-XXXX`)
- [ ] Subscriptions backend endpoints:
  - [ ] Create, update, list, and filter subscriptions
  - [ ] Add/remove line items (products, variants, quantities, taxes)
  - [ ] Lifecycle state machine: `Draft` → `Quotation` → `Confirmed` → `Active` → `Closed` (with `Paused` support)
- [ ] Staff & Admin UI:
  - [ ] Subscription creation and editor with live price calculation
  - [ ] Subscription list view with status filters and search
  - [ ] Subscription detail view showing status transitions, dates, and line items

---

### Phase 7: Recurring Invoicing & Discount Rules Engine
- [ ] Admin CRUD for Discounts:
  - [ ] Fixed or percentage discounts
  - [ ] Constraints: min purchase amount, min quantity, start/end dates, max uses
  - [ ] Scope: order-level or specific product-level
- [ ] Billing & Invoice Generation Engine:
  - [ ] Automated generation of invoices from active subscriptions when billing is due
  - [ ] Tax calculations based on active tax rules
  - [ ] Discount validation and automatic application to invoice
  - [ ] Prevent skipped or duplicate billing cycles (`next_billing_date` progression)
- [ ] Invoices backend endpoints & lifecycle: `Draft` → `Confirmed` → `Paid` (or `Cancelled`)
- [ ] Staff UI for Invoicing:
  - [ ] Invoices list with status badges and due-date filters
  - [ ] Invoice detail view with line items, tax breakdown, and discount breakdown
  - [ ] Invoice actions: Confirm, Cancel, Send, Print/PDF export preview

---

### Phase 8: Payments Recording & Finance Dashboard
- [ ] Payments backend endpoints:
  - [ ] Record payment (payment method, amount, date, transaction reference, note)
  - [ ] Automatic invoice balance update (reconcile `amount_paid` and `balance_due`)
  - [ ] Automatic invoice status transition to `Paid` upon zero balance
- [ ] Finance Reporting Dashboard:
  - [ ] Active subscriptions counter & ARR/MRR metrics
  - [ ] Total revenue collected vs. total outstanding receivables
  - [ ] Overdue invoices breakdown with aging indicator
  - [ ] Filterable reports by date range, customer, and status
- [ ] Query optimization for fast dashboard load times under high data volume

---

### Phase 9: Customer Self-Service Portal
- [ ] Customer portal layout and navigation (isolated from Admin/Staff UI)
- [ ] Backend enforcement: customer endpoint filters strictly by authenticated user's `customer_id`
- [ ] Customer UI views:
  - [ ] "My Subscriptions" list and subscription detail
  - [ ] "My Invoices" list and status (Paid, Outstanding, Overdue)
  - [ ] Permitted self-service changes (e.g., pause subscription, update contact details)

---

### Phase 10: Brevo Email Integration & User Experience Polish
- [ ] Brevo API integration service (`BrevoClient` via official API v3):
  - [ ] Password reset email with secure token link
  - [ ] New invoice notification email with invoice breakdown
  - [ ] Payment confirmation notification email
- [ ] Graceful fallback when Brevo credentials are not yet configured (mock/log mode in dev)
- [ ] Comprehensive UI feedback: loading spinners, toast alerts, error boundaries, accessible modal dialogs
- [ ] Responsive design verification on desktop, tablet, and mobile breakpoints

---

### Phase 11: Production Verification & Deployment Preparation
- [ ] Verify production build (`npm run build`) without errors or warnings
- [ ] Test Netlify Functions locally via Netlify CLI (`netlify dev`)
- [ ] Configure remote cloud MySQL database (e.g. Aiven, PlanetScale, AWS RDS)
- [ ] Document production deployment procedure and Netlify environment variables
