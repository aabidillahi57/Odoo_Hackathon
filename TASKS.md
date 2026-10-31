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

### Phase 4: Authentication, Security & Role-Based Access Control (RBAC) — **Completed**
- [x] **Database schema** extended with `user_sessions`, `password_reset_tokens`, and `auth_rate_limits` tables (already included in `schema.sql` and `database/migrations/002_auth_sessions.sql`)
- [x] **Shared auth helpers** (`netlify/functions/_shared/auth.ts`):
  - [x] Email normalization and validation
  - [x] Password complexity validation (>8 chars, uppercase, lowercase, special character)
  - [x] bcrypt (salt factor 12) password hashing and verification
  - [x] SHA-256 token hashing for sessions and reset tokens
  - [x] Cryptographically random token generation
  - [x] Server-managed opaque session creation and revocation (HttpOnly cookie)
  - [x] `getAuthenticatedUser()` — validates session against DB for every protected request
  - [x] `revokeSession()` and `revokeAllUserSessions()` — logout and post-reset revocation
  - [x] `checkRateLimit()` and `clearRateLimit()` — DB-backed brute-force protection
- [x] **Brevo email service** (`netlify/functions/_shared/brevo.ts`):
  - [x] `sendPasswordResetEmail()` via Brevo REST API v3 (HTTPS, server-side only)
  - [x] Dev-mode fallback when `BREVO_API_KEY` is unconfigured (logs simulated URL, returns `devMode: true`)
  - [x] `isBrevoConfigured()` — rejects placeholder/stub keys
- [x] **Netlify Function endpoints** (all using DB-backed opaque sessions, no JWTs):
  - [x] `POST /api/auth/register` — Customer self-signup with email uniqueness check, bcrypt hash, customer record linkage, session cookie
  - [x] `POST /api/auth/login` — Credential verification, rate limiting, session cookie
  - [x] `POST /api/auth/logout` — Session revocation and cookie clearance
  - [x] `GET /api/auth/me` — Returns authenticated user profile from session cookie
  - [x] `POST /api/auth/forgot-password` — Generic response, rate-limited, single-use reset token stored hashed, Brevo email dispatch
  - [x] `POST /api/auth/reset-password` — Token validation, password policy, bcrypt update, all sessions revoked
  - [x] `POST /api/auth/create-staff` — Admin-only staff account creation with role enforcement
- [x] **Route routing fixes**:
  - [x] `netlify.toml` — explicit redirect rules for `/api/auth/*` → `auth-*` function names (before generic rule)
  - [x] `vite.config.ts` — matching dev proxy rules for all auth routes
- [x] **Frontend auth screens** (all connected to real API, no demo data):
  - [x] `LoginPage` — redirects by role (admin/staff → `/`, customer → `/portal`)
  - [x] `SignupPage` — with interactive password policy feedback, confirms password
  - [x] `ForgotPasswordPage` — generic success message, dev-mode reset URL display
  - [x] `ResetPasswordPage` — token from URL params, policy feedback, revokes all sessions on success
- [x] **AuthContext** — `login`, `register`, `logout`, `refreshUser`, `clearError`; session probed via `GET /api/auth/me` on mount; credentials: include on all requests
- [x] **ProtectedRoute** — blocks unauthenticated access, role check with customer redirect
- [x] **Role-aware Sidebar** — Discounts item hidden from Staff role (Admin-only); role label in footer
- [x] **CustomerPortalPage** — connected to live auth; shows authenticated view with profile banner
- [x] **SettingsPage** — Staff Accounts tab with Admin-only Create Staff form (client role check for UX; server enforces)
- [x] **Header** — shows role badge, user name/email, logout button when authenticated
- [x] **Password policy utility** (`src/utils/passwordPolicy.ts`) — shared frontend rule evaluation
- [x] **Admin bootstrap script** (`scripts/bootstrap-admin.js` / `npm run admin:bootstrap`) — interactive secure prompt, no hard-coded credentials, supports `--email` and `--password` args
- [x] **TypeScript build** — zero errors (`npm run build`)

---

### Phase 5: Customers & Quotation Templates (Issuance Dependencies Implemented)
- [x] Customer retrieval & search with RBAC isolation (`GET /api/customers`)
- [x] Quotation Templates backend endpoint (`GET /api/quotation-templates`, `GET /api/quotation-templates/:id`, `POST /api/quotation-templates/:id/issue`)
- [x] Preset quotation template lines schema & development seed data (`quotation_template_lines`)
- [x] Quotation template proposal issuance workflow connected to subscription creation
- [ ] Full standalone Admin CRUD for quotation templates (create/edit/archive template definitions — deferred)

---

### Phase 6: Subscriptions & Lifecycle Management — **Completed**
- [x] **Database Schema & Migrations**:
  - [x] `subscription_sequences` table for concurrency-safe atomic sequence tracking
  - [x] `subscription_history` table for immutable audit logging (previous status, new status, actor, action, reason, metadata, timestamp)
  - [x] `subscriptions` table updated with `billing_interval`, `billing_interval_count`, `paused_at`, `resumed_at`, `closed_at`, `cancellation_reason`, `created_by`, `updated_by`
  - [x] `subscription_lines` updated with `description` and `tax_rate` snapshots
  - [x] Repeatable migration `003_subscriptions_lifecycle.sql`, updated `schema.sql`, and resilient `scripts/migrate.js`
- [x] **Concurrency-Safe Subscription Number Sequence**:
  - [x] Server-side atomic number generator (`SUB-YYYY-XXXX`) using database row-level locking (`FOR UPDATE`) within active transaction
  - [x] Strict persistence: numbers are never reused upon subscription closure or deletion
  - [x] Never trusts client-supplied numbers; rollover across calendar years
- [x] **Subscription API Endpoints** (`netlify/functions/subscriptions.ts`):
  - [x] `GET /api/subscriptions` — Paginated list with search, status filters, plan filters; strictly isolates customer role to own records
  - [x] `POST /api/subscriptions` — Staff/Admin creation of Draft/Quotation with server-validated customer, plan, dates, terms, and lines
  - [x] `GET /api/subscriptions/:id` — Detail view with lines, customer, plan, and Staff-only audit history; IDOR protected
  - [x] `PUT /api/subscriptions/:id` — Staff/Admin editing restricted to Draft/Quotation status; immutable terms for confirmed/active
  - [x] `POST /api/subscriptions/:id/transitions` — Lifecycle state machine transition with plan policy enforcement and audit history logging
  - [x] `POST /api/subscriptions/:id/renew` — Active subscription renewal extending contract cycle by plan interval with audit log
- [x] **Lifecycle State Machine & Plan Policies** (`netlify/functions/_shared/lifecycle.ts`):
  - [x] Valid transitions: `Draft` → `Quotation` → `Confirmed` → `Active` → `Closed`; `Draft`/`Quotation` → `Closed`
  - [x] `Active` → `Paused` (enforces `plan.pause_allowed`); `Paused` → `Active` (resume); `Paused` → `Closed`
  - [x] Early termination policy enforcement (`plan.early_close_policy`: 'allowed', 'fee_applies', 'not_allowed')
  - [x] Role enforcement: Customers prevented from confirming, activating, or closing subscriptions directly; customer self-service pause/resume permitted when plan allows
- [x] **Quotation-to-Subscription Issuance Workflow** (`netlify/functions/quotation-templates.ts`):
  - [x] Staff/Admin selects customer and active template
  - [x] System loads default plan and lines from database
  - [x] User reviews and adjusts quantities, terms, start date, and validity days
  - [x] Server calculates quotation expiry date and authoritative product, variant, and tax calculations
  - [x] Atomic creation in single transaction: `SUB-YYYY-XXXX` generated, line snapshots stored, initial history recorded in Quotation status
- [x] **Frontend User Interfaces**:
  - [x] `SubscriptionsPage` (`/subscriptions`): Directory with search, status filter tabs with count badges, plan filter, pagination, quick actions
  - [x] Subscription Creation Modal: Customer selection, plan selection, product/variant line builder with live calculations, review summary
  - [x] Subscription Detail Modal: Complete contract cards, line items table, authorized lifecycle action bar, staff-only audit timeline
  - [x] Quotation Issuance Modal (`/quotations`): Template cards, preset lines display, customer selection, validity calculation, issuance to subscription
  - [x] Customer Self-Service Portal (`/portal`): Live subscriptions ledger, customer-friendly detail modal (hides internal notes/audit logs), self-service pause & resume

---

### Phase 7: Tax Rules, Invoicing & Recurring Billing Engine — **Completed**
- [x] **Tax Rules Management & Snapshots**:
  - [x] Admin CRUD endpoints for tax rules (`GET /api/taxes`, `POST /api/taxes`, `PUT /api/taxes/:id`)
  - [x] Non-tax-inclusive pricing: tax percentages applied to pre-tax prices
  - [x] Staff accounts granted view-only permissions; Admin accounts manage rates and deactivations
  - [x] Invoice line items persist immutable snapshots of `tax_name` and `tax_rate` to protect past invoices against rate edits
- [x] **Database Schema & Migrations**:
  - [x] `invoice_sequences` table for concurrency-safe atomic sequence tracking (`INV-YYYY-XXXX`)
  - [x] `billing_runs` audit ledger table recording run numbers, as-of dates, operators, itemized results, and status
  - [x] `invoices` table updated with `delivery_status`, `delivery_error`, `cancellation_reason`, `confirmed_at`, `cancelled_at`, `created_by`
  - [x] Database unique constraint `uq_invoice_subscription_period (subscription_id, billing_period_start, billing_period_end)` guaranteeing engine-level duplicate prevention
  - [x] Repeatable migration `004_invoices_billing.sql`, updated `schema.sql`, and incremental migrations in `scripts/migrate.js`
- [x] **Concurrency-Safe Invoice Number Sequence**:
  - [x] Server-side atomic number generator (`INV-YYYY-XXXX`) using database row-level locking (`FOR UPDATE`) within active transaction
  - [x] Strict persistence: sequence numbers are permanently consumed; cancelled or deleted invoices do not cause reuse
- [x] **Recurring Billing Engine** (`netlify/functions/billing-run.ts`):
  - [x] Server-side endpoint `POST /api/billing/run` (Admin and Staff only; 403 Forbidden for Customers)
  - [x] Selects due `Active` subscriptions where `next_billing_date <= as_of_date` and `expiry_date >= as_of_date`
  - [x] Excludes Draft, Quotation, Confirmed, Paused, Closed, and expired subscriptions
  - [x] Bounded batch execution with per-subscription transaction isolation
  - [x] Robust calendar month-end clamping (e.g. Jan 31 -> Feb 28/29, Mar 31 -> Apr 30) preventing billing interval date skips
  - [x] Creates confirmed invoices containing customer details, subscription lines, unit prices, tax snapshots, due date, subtotal, and total
  - [x] Advances `next_billing_date` only after invoice creation transaction commits
  - [x] Safe retry guarantee: completely immune to duplicate invoice creation across retries
  - [x] Resilient per-subscription error handling: rollback failed subscription and continue processing remaining batch
  - [x] Execution metadata and itemized breakdown logged to `billing_runs` table
- [x] **Invoices API & Lifecycle Actions** (`netlify/functions/invoices.ts`):
  - [x] `GET /api/invoices` — Search, status filters, dynamic `isOverdue` calculation; customer role strictly scoped to own records
  - [x] `GET /api/invoices/:id` — Full invoice detail with customer contact info, billing period, and line items; IDOR protected
  - [x] `POST /api/invoices` — Manual invoice creation with line items and tax calculation
  - [x] `POST /api/invoices/:id/confirm` — Transitions Draft invoice to Confirmed with timestamp
  - [x] `POST /api/invoices/:id/cancel` — Cancels invoice with required audit reason; validates no payments collected
  - [x] `POST /api/invoices/:id/send` — Transactional invoice dispatch via Brevo REST API v3
- [x] **Brevo Transactional Invoice Email Integration** (`netlify/functions/_shared/brevo.ts`):
  - [x] `sendInvoiceEmail()` — Branded transactional invoice template with itemized table, total, due date, and Customer Portal link
  - [x] Safe local development fallback when `BREVO_API_KEY` is unset or simulated
- [x] **Frontend User Interfaces**:
  - [x] `InvoicesPage` (`/invoices`): Live database connection, status tabs, search, overdue toggle/badges, quick actions
  - [x] "Run Billing Engine" Modal: As-of date selector, execution summary (processed, created, skipped, failed, total amount), itemized breakdown
  - [x] Invoice Detail Modal: Itemized charges table with tax snapshots, delivery metadata, lifecycle action bar (confirm, cancel with reason, send via Brevo, print)
  - [x] Browser Print Statement: CSS `@media print` formatting rendering clean, branded printable invoice statements
  - [x] `SettingsPage` (`/settings`): Live Tax Rules tab with Admin CRUD modal and Staff view-only access
  - [x] Customer Portal (`/portal`): Live "My Invoices & Receipts" with statement detail modal and printable receipts
- [x] **TypeScript Build**:
  - [x] Production build passes cleanly with zero errors (`npm run build`)

---

### Phase 8: Discount Rules, Automatic Discount Application, Payments & Reconciliation — **Completed**
- [x] **Database Schema & Migrations**:
  - [x] `payment_sequences` table for concurrency-safe atomic sequence tracking (`PAY-YYYY-XXXX`)
  - [x] Schema extensions in `discounts` (`name`, `archived_at`), `discount_usages` (`status` ENUM('reserved', 'redeemed', 'released'), `released_at`), and `payments` (`status` ENUM('completed', 'voided'), `recorded_by`, `voided_at`, `voided_by`, `void_reason`)
  - [x] Repeatable migration `005_discounts_payments.sql`, updated `schema.sql`, seed data in `seed.sql`, and incremental migrations in `scripts/migrate.js`
- [x] **Concurrency-Safe Payment Sequence Number Generator**:
  - [x] Server-side atomic number generator (`PAY-YYYY-XXXX`) using database row-level locking (`FOR UPDATE`) in active transaction
  - [x] Strict persistence: numbers are never reused upon voiding or reversal
- [x] **Discount Rules Management** (`netlify/functions/discounts.ts`):
  - [x] Admin-only CRUD and archiving endpoints (`GET /api/discounts`, `POST /api/discounts`, `PUT /api/discounts/:id`, `POST /api/discounts/:id/archive`)
  - [x] Staff view-only access; Customers blocked with 403 Forbidden
  - [x] Server-side validation: positive values, percentage $\le$ 100%, non-negative minimums, product existence
- [x] **Automatic Discount Engine & Quota Lifecycle** (`netlify/functions/_shared/discount-engine.ts`):
  - [x] Authoritative server-side evaluation: checks validity dates, active status, product vs order scope, minimum spend and quantity thresholds, and max usage limits
  - [x] Non-stacking deterministic rule: selects eligible discount yielding greatest dollar savings; ties broken by highest rule ID
  - [x] Pre-tax calculation order: discount deducted from pre-tax subtotal before tax computation
  - [x] Quota lifecycle: Draft invoice reserves usage slot; Confirming redeems usage; Cancelling releases usage and restores quota
  - [x] Seamless integration into automated recurring billing runs (`netlify/functions/billing-run.ts`) and manual invoice creation (`netlify/functions/invoices.ts`)
- [x] **Manual Payment Recording & Authoritative Reconciliation** (`netlify/functions/payments.ts`):
  - [x] Endpoints `GET /api/payments`, `POST /api/payments`, `POST /api/payments/:id/void`
  - [x] Overpayment protection: rejects payment amounts exceeding invoice balance due
  - [x] Partial payment support: records partial collections, updates balance due, retains `confirmed` status
  - [x] Zero-balance auto-transition: automatically transitions invoice to `paid` when balance due reaches zero
  - [x] Audited payment voiding: requires reason, restores invoice balance, reverts status from `paid` to `confirmed`
  - [x] Authoritative reconciliation function `reconcileInvoiceBalance()` computing `SUM(amount)` over active completed payments
- [x] **Live Executive Metrics & Finance Reporting** (`netlify/functions/dashboard.ts`):
  - [x] Endpoint `GET /api/dashboard/metrics` computing live MySQL aggregates: active subscriptions count, total revenue collected, outstanding receivables, overdue amounts, and recent activity
- [x] **Frontend User Interfaces**:
  - [x] `DiscountsPage` (`/discounts`): Live DB list, status tabs, search, Admin create/edit modal with full field validation, remaining quota display, archive action
  - [x] `PaymentsPage` (`/payments`): Live ledger, method/status filters, "Record Payment" modal with invoice selector and balance check, audited Void modal
  - [x] `InvoicesPage` (`/invoices`): Payment transactions table inside invoice detail modal, "Record Payment" action button for confirmed invoices with balance due, applied discount badges
  - [x] `CustomerPortalPage` (`/portal`): Live "My Payment Receipts" ledger strictly scoped to authenticated customer
  - [x] `OverviewPage` (`/`): Live Executive Overview connected to database metrics with toggleable demo sandbox mode
- [x] **TypeScript Build**:
  - [x] Production build passes cleanly with zero errors (`npm run build`)

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
