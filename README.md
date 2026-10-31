# Brightloop Software — Subscription Management System

> Built for the Odoo Hackathon

A unified, modern web platform designed for **Brightloop Software** to manage recurring subscription billing, dynamic product catalogs and variants, customer lifecycles, automated invoicing, discount campaigns, payment tracking, and executive finance reporting.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack & Architecture](#technology-stack--architecture)
3. [User Roles & Access Control](#user-roles--access-control)
4. [Database & Entity Relationships](#database--entity-relationships)
5. [Local Development Setup](#local-development-setup)
6. [Serverless API Layer](#serverless-api-layer-netlify-functions)
7. [Authentication & Security](#authentication--security)
8. [First Admin Account Bootstrap](#first-admin-account-bootstrap)
9. [Brevo Email Service Setup](#brevo-email-service-setup)
10. [Environment Variables](#environment-variables)
11. [Production Deployment (Netlify & Remote MySQL)](#production-deployment-netlify--remote-mysql)
12. [Project Roadmap & Next Steps](#project-roadmap--next-steps)

---

## Project Overview

Brightloop Software sells cloud software subscriptions with flexible recurring billing models, optional add-ons, and brand/tier product variants.

### Key Capabilities:
- **Flexible Billing Cycles:** Daily, weekly, monthly, and yearly recurring subscriptions with configurable lifecycle policies (auto-close, early close, pause, auto-renewal).
- **Product Catalog & Variants:** Products categorized by type (software, service, add-on) with price-adjusting attributes (e.g. brand selection adding fixed price deltas).
- **Quotation Templates:** Accelerates sales workflow with pre-configured plans and line items.
- **Subscription Lifecycle:** Transparent progression: `Draft` → `Quotation` → `Confirmed` → `Active` → `Closed` (with pausing support).
- **Recurring Invoicing Engine:** Automated billing based on due dates, calculating taxes, line totals, and applicable discounts without duplicate or skipped billing.
- **Discounts Engine:** Admin-configured fixed or percentage promotions with date ranges, minimum purchase thresholds, and maximum usage caps.
- **Payment Reconciliation:** Record payments against invoices with real-time balance tracking (`paid`, `partially paid`, `overdue`).
- **Finance Reporting Dashboard:** Real-time visibility into MRR/ARR, total collections, outstanding receivables, and aging overdue invoices.
- **Customer Self-Service Portal:** Safe customer portal to view personal subscriptions, invoices, and perform permitted adjustments.

---

## Technology Stack & Architecture

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 18+, TypeScript, Vite | Fast, typed, modern Single Page Application (SPA) |
| **Styling** | Tailwind CSS | Utility-first, responsive, clean enterprise UI |
| **Icons** | Lucide React | Consistent, lightweight iconography |
| **Serverless Backend** | Netlify Functions (Node.js / TypeScript) | Secure server-side API endpoints & business logic |
| **Database** | MySQL (8.0+) | Relational storage with ACID guarantees & foreign key integrity |
| **Email Service** | Brevo (formerly Sendinblue) | Transactional emails (password reset, invoice notifications) |
| **Hosting** | Netlify | Continuous deployment, serverless functions, edge routing |

### Architectural & Security Principles

```
  ┌─────────────────────────┐
  │   React + Vite Client   │
  │  (Runs in User Browser) │
  └────────────┬────────────┘
               │ HTTPS / JSON API
               ▼
  ┌─────────────────────────┐
  │    Netlify Functions    │  <--- Serverless API Layer
  │ (Auth, RBAC, Validation)│
  └────────────┬────────────┘
               │ SQL Queries (Server-Side Only)
               ▼
  ┌─────────────────────────┐
  │     MySQL Database      │  <--- Local (Dev) or Cloud Managed (Prod)
  │ (InnoDB, Foreign Keys)  │
  └─────────────────────────┘
```

1. **Strict Server-Side Data Access:** The browser **never** connects directly to the MySQL database. All database queries, transaction handling, and credential management reside entirely within backend Netlify Functions.
2. **Dual-Mode Database Architecture:**
   - **Local Development:** Connects to a local MySQL instance (e.g. `127.0.0.1:3306`).
   - **Netlify Production:** Connects to a remote, cloud-accessible MySQL database (e.g., Aiven, PlanetScale, AWS RDS) using SSL encryption (`DB_SSL=true`). Netlify serverless functions cannot reach a developer's private localhost.
3. **No Secrets in Frontend or Git:** All sensitive keys (database passwords, JWT secret, Brevo API key) are injected via server-side environment variables and excluded via `.gitignore`.
4. **Backend-Enforced Role-Based Access Control:** Frontend routes are protected for user experience, but permissions are strictly verified on the server for every API request using signed JSON Web Tokens (JWT).

---

## User Roles & Access Control

| Feature / Action | Admin | Internal Staff | Customer (Portal) |
| :--- | :---: | :---: | :---: |
| Self-service portal (own subscriptions/invoices) | ✅ | ✅ | ✅ (Own records only) |
| Manage customers, subscriptions & invoices | ✅ | ✅ | ❌ |
| Record customer payments | ✅ | ✅ | ❌ |
| View finance metrics & revenue reports | ✅ | ✅ | ❌ |
| Create & configure Products, Plans & Taxes | ✅ | ❌ | ❌ |
| Create Discount Rules | ✅ | ❌ | ❌ |
| Create & manage Internal Staff accounts | ✅ | ❌ | ❌ |

---

## Database & Entity Relationships

The relational model is declared in [`database/schema.sql`](file:///Users/harshthakur/Odoo_Hackathon/database/schema.sql).

### Core Entities:
- **`users`**: Authentication credentials, password hash, role (`admin`, `staff`, `customer`), and password reset tokens.
- **`customers`**: CRM record, billing details, optionally linked 1-to-1 to a `users` account for self-service portal access.
- **`taxes`**: Admin-configured tax rates applied to line items.
- **`products`**: Software licenses, services, or add-ons with base sales and cost prices.
- **`product_variants`**: Attribute adjustments (e.g. `Brand: Odoo` adding +560.00 to sales price).
- **`plans`**: Billing frequency (`daily`, `weekly`, `monthly`, `yearly`), pricing, minimum quantities, and lifecycle policies.
- **`quotation_templates` & `quotation_template_lines`**: Presets for rapid quote creation.
- **`discounts` & `discount_usages`**: Admin discount codes (fixed/percentage), validity constraints, and audit trail of redemptions.
- **`subscriptions` & `subscription_lines`**: Core recurring agreements with status tracking (`draft`, `quotation`, `confirmed`, `active`, `paused`, `closed`).
- **`invoices` & `invoice_lines`**: Generated billing documents reflecting customer information, line items, taxes, discounts, and payments.
- **`payments`**: Payment records reconciling invoice balances (`amount_paid` and `balance_due`).

---

## Local Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended; v24 is tested)
- [npm](https://www.npmjs.com/) (v9 or higher)
- [MySQL Server](https://dev.mysql.com/downloads/mysql/) (v8.0+ running locally or in Docker)
- [Netlify CLI](https://docs.netlify.com/cli/get-started/) (`npm install -g netlify-cli`) for running local functions

### Starting Local MySQL

- **macOS via Homebrew:**
  ```bash
  brew install mysql
  brew services start mysql
  ```
- **Docker (Instant containerized setup):**
  ```bash
  docker run -d --name brightloop-mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=brightloop_subscriptions mysql:8.0
  ```

### Step-by-Step Setup

1. **Clone or open the repository:**
   ```bash
   cd /Users/harshthakur/Odoo_Hackathon
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Open `.env` in your text editor and fill in your local MySQL database credentials (`DB_USER`, `DB_PASSWORD`, `DB_NAME`).

3. **Install project dependencies:**
   ```bash
   npm install
   ```

4. **Initialize schema & seed sample development data:**
   ```bash
   # Applies database/schema.sql automatically
   npm run db:migrate

   # Optional: Seeds sample catalog products, plans, and customers
   npm run db:seed
   ```

5. **Start full-stack local server (Vite + Netlify Functions):**
   ```bash
   netlify dev
   ```
   The application will be served at `http://localhost:8888`:
   - Frontend UI: `http://localhost:8888/`
   - Serverless API Routes: `http://localhost:8888/api/*` (e.g. `/api/health`, `/api/products`, `/api/plans`, `/api/customers`)

6. **Frontend-only development mode (with demo preview fallback):**
   ```bash
   npm run dev
   ```
   Served at `http://localhost:5173`. If Netlify Functions or MySQL are not running, the UI gracefully defaults to safe demo preview mode.

7. **Production build check:**
   ```bash
   npm run build
   ```

---

## Serverless API Layer (Netlify Functions)

All database operations execute server-side in `netlify/functions/`:

### Authentication Endpoints

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/api/auth/register` | `POST` | Customer self-registration. Creates user + linked customer record, returns session cookie. |
| `/api/auth/login` | `POST` | Credential verification with rate limiting. Returns HttpOnly session cookie on success. |
| `/api/auth/logout` | `POST` | Revokes server-side session. Clears browser cookie. |
| `/api/auth/me` | `GET` | Returns authenticated user profile from current session cookie. |
| `/api/auth/forgot-password` | `POST` | Creates single-use hashed reset token, sends Brevo email (generic response whether email exists or not). |
| `/api/auth/reset-password` | `POST` | Validates reset token, updates bcrypt password hash, revokes all active sessions. |
| `/api/auth/create-staff` | `POST` | **Admin only.** Creates an internal staff account. |

### Core Data & Subscription Endpoints

| Endpoint | Method | Role | Description |
| :--- | :---: | :---: | :--- |
| `/api/health` | `GET` | Public | Reports API service health and performs a live database ping test without exposing credentials. |
| `/api/products` | `GET` | Public/Auth | Fetches active catalog products with nested variants and price adjustments. |
| `/api/plans` | `GET` | Public/Auth | Returns active billing plans (daily, weekly, monthly, yearly) and lifecycle policies. |
| `/api/customers` | `GET` | Staff/Customer | Returns paginated customer records. Customer accounts are strictly isolated to their own record. |
| `/api/quotation-templates` | `GET` | Staff/Admin | Lists active quotation templates with preset product lines, plan details, and validity windows. |
| `/api/quotation-templates/:id` | `GET` | Staff/Admin | Returns single template specification with full product, variant, and tax lines. |
| `/api/quotation-templates/:id/issue` | `POST` | Staff/Admin | Issues a new subscription in `quotation` status using authoritative server pricing in a single transaction. |
| `/api/subscriptions` | `GET` | Staff/Customer | Lists paginated subscriptions with status/customer/plan filters. Customers receive strictly their own agreements. |
| `/api/subscriptions` | `POST` | Staff/Admin | Creates a new Draft or Quotation subscription with atomic `SUB-YYYY-XXXX` sequence generation. |
| `/api/subscriptions/:id` | `GET` | Staff/Customer | Full subscription detail with lines and totals. Staff/Admin receive audit history; customer view hides internal notes. |
| `/api/subscriptions/:id` | `PUT` | Staff/Admin | Modifies editable Draft/Quotation subscription lines and terms. Confirmed/Active subscriptions are immutable. |
| `/api/subscriptions/:id/transitions` | `POST` | Staff/Customer | Executes state machine lifecycle transition with plan-policy validation and immutable audit history logging. |
| `/api/subscriptions/:id/renew` | `POST` | Staff/Admin | Renews an active subscription for another billing cycle, advancing expiry and next billing dates with audit trail. |

---

## Subscription Lifecycle & Management (Part 6)

### 1. Subscription Data Model

- **`subscriptions`**:
  - `subscription_number`: Unique readable identifier (`SUB-YYYY-XXXX`).
  - `customer_id`: Foreign key reference to `customers(id)`.
  - `plan_id`: Optional foreign key reference to `plans(id)`.
  - `template_id`: Optional foreign key reference to source `quotation_templates(id)` for proposal traceability.
  - `status`: ENUM (`draft`, `quotation`, `confirmed`, `active`, `paused`, `closed`).
  - `start_date` & `expiry_date`: Contract validity period.
  - `next_billing_date`: Anticipated schedule date for subsequent recurring invoice generation.
  - `payment_terms`: Invoice payment window terms (e.g., `Immediate Payment`, `Net 15`, `Net 30`, `Net 60`).
  - `billing_interval` & `billing_interval_count`: Snapshot of plan recurring cycle (`daily`, `weekly`, `monthly`, `yearly`).
  - `subtotal_amount`, `tax_amount`, `total_recurring_amount`: Authoritative monetary totals stored as `DECIMAL(12, 2)`.
  - `paused_at`, `resumed_at`, `closed_at`, `cancellation_reason`: Detailed transition timestamps and termination reasons.
  - `created_by` & `updated_by`: Foreign keys to `users(id)` for operational attribution.
- **`subscription_lines`**:
  - `subscription_id`: Foreign key reference cascading on parent delete.
  - `product_id` & optional `variant_id`: References to catalog items.
  - `description`: Text snapshot of product name and variant attributes at time of agreement.
  - `quantity`: Positive integer (>= 1).
  - `unit_price`: Authoritative base sales price + variant adjustment snapshot (`DECIMAL(12, 2)`).
  - `tax_id` & `tax_rate`: Reference to configured tax and snapshot of tax percentage (`DECIMAL(5, 2)`).
  - `tax_amount`, `subtotal_amount`, `total_amount`: Authoritative line totals (`DECIMAL(12, 2)`).
- **`subscription_history`**:
  - Immutable audit trail recording every state change, actor user reference, action name, optional reason, metadata JSON snapshot, and timestamp. Never exposed to customer portal users.

### 2. Concurrency-Safe Subscription Number Generator

- **Format:** `SUB-YYYY-XXXX` (e.g., `SUB-2026-0001`).
- **Generation Strategy:**
  - Numbers are generated strictly on the server in `netlify/functions/_shared/sequence.ts`.
  - Uses a database table `subscription_sequences (sequence_year PRIMARY KEY, last_number INT)`.
  - Employs an exclusive row-level lock (`SELECT ... FOR UPDATE`) within an active MySQL transaction.
  - Strictly avoids race conditions caused by naive `MAX(id) + 1` queries.
  - Sequence numbers are permanently consumed; closing or deleting a contract never reuses an issued number.
  - Automatically resets sequence counting for each new calendar year.

### 3. Lifecycle State Machine Matrix

```
       ┌──────────┐
       │  Draft   │───────┐
       └────┬─────┘       │
            │             │
            ▼             │
     ┌─────────────┐      │
     │  Quotation  │──────┤
     └──────┬──────┘      │
            │             │
            ▼             │
     ┌─────────────┐      │
     │  Confirmed  │──────┤
     └──────┬──────┘      │
            │             │
            ▼             ▼
     ┌─────────────┐ ──► ┌────────┐
 ┌───│   Active    │     │ Closed │ (Terminal)
 │   └─────────────┘ ──► └────────┘
 │       ▲     │              ▲
 │Resume │     │ Pause        │
 │       │     ▼              │
 └───┌─────────────┐          │
     │   Paused    │──────────┘
     └─────────────┘
```

- **Valid Transitions:**
  - `Draft` → `Quotation` (Issue proposal to client) or `Closed` (Discard draft)
  - `Quotation` → `Confirmed` (Client approves proposal) or `Closed` (Proposal declined/expired)
  - `Confirmed` → `Active` (Commence recurring service) or `Closed` (Cancel prior to start)
  - `Active` → `Paused` (Only if `plan.pause_allowed = TRUE`)
  - `Paused` → `Active` (Resume regular billing cycle) or `Closed`
  - `Active` → `Closed` (Evaluates `plan.early_close_policy`; blocks if `not_allowed`, records notes if `fee_applies`)
  - **Renewal:** Active contracts can be renewed, extending `expiry_date` by the plan interval count and logging a dedicated `renewed` event in `subscription_history`.
- **Role Permissions:**
  - **Admin & Staff:** Authorized to perform all business transitions and view full audit logs.
  - **Customer:** Permitted to pause and resume their own active subscriptions (when plan allows). Cannot confirm, activate, or terminate contracts unilaterally.

### 4. Quotation-to-Subscription Issuance Workflow

1. Staff or Admin selects an active customer and an active quotation template.
2. Server loads template specifications and preset line items.
3. Sales staff can review start dates, validity periods (e.g., 30 days), and permitted quantities.
4. Server recalculates authoritative product base prices, variant adjustments, and tax rates (client prices are not trusted).
5. Expiry date is calculated from `startDate + validityDays`.
6. Atomic database transaction creates the subscription in `quotation` status with generated `SUB-YYYY-XXXX` identifier, line item snapshots, and initial audit event referencing the template ID.

---

## Environment Variables

Copy `.env.example` to `.env`. The system expects the following variables:

| Variable | Description | Local Dev Example | Production Target |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Environment mode | `development` | `production` |
| `APP_BASE_URL` | Public app URL — used in reset link emails | `http://localhost:8888` | `https://your-app.netlify.app` |
| `APP_URL` | Public application URL | `http://localhost:8888` | `https://your-app.netlify.app` |
| `DB_HOST` | MySQL hostname | `127.0.0.1` | Remote cloud DB host |
| `DB_PORT` | MySQL port | `3306` | `3306` |
| `DB_USER` | Database username | `root` | Cloud DB username |
| `DB_PASSWORD` | Database password | *local password* | Cloud DB password |
| `DB_NAME` | Database schema name | `brightloop_subscriptions` | `brightloop_subscriptions` |
| `DB_SSL` | Enable SSL for DB connection | `false` | `true` |
| `DATABASE_URL` | Optional URI connection string | *optional* | `mysql://user:pass@host:3306/db?ssl=true` |
| `BREVO_API_KEY` | Brevo API key for transactional email | *placeholder* | `xkeysib-...` |
| `BREVO_SENDER_EMAIL` | Sender email address (must be verified in Brevo) | `noreply@brightloop.com` | Verified domain email |
| `BREVO_SENDER_NAME` | Sender display name | `Brightloop Software` | `Brightloop Software` |

> [!CAUTION]
> Never paste real API keys, passwords, or session tokens in chat, source code, or Git commits. Use `.env` locally and Netlify environment variables in production.

---

## Authentication & Security

### Session Design

- Sessions use **opaque, randomly generated 64-byte tokens** (not JWTs).
- The raw token is sent to the browser in an **HttpOnly, SameSite=Lax, Secure (production)** cookie named `session_token`.
- Only the **SHA-256 hash** of the token is stored in the `user_sessions` table — the raw token is never persisted.
- Logout revokes the session row in the database.
- All sessions for a user are revoked after a successful password reset.
- Expired or revoked sessions are rejected at the `getAuthenticatedUser()` helper level on every request.

### Password Policy

All passwords must:
- Be **longer than 8 characters** (minimum 9)
- Contain at least **one uppercase letter** (A-Z)
- Contain at least **one lowercase letter** (a-z)
- Contain at least **one special character** (`!@#$%^&*` etc.)

Validated client-side (UX feedback) **and** server-side (security). Passwords are stored only as bcrypt hashes (salt factor 12).

### Rate Limiting

Login and password-reset endpoints are protected by a database-backed rate limiter (`auth_rate_limits` table):
- **Login:** 5 attempts per 15-minute window per (IP + email); 15-minute lockout on breach.
- **Password Reset:** 4 attempts per 15-minute window per IP; 15-minute lockout on breach.

### Roles & Permissions

| Action | Admin | Staff | Customer |
| :--- | :---: | :---: | :---: |
| Sign up (public customer registration) | ✅ | — | ✅ |
| Login / logout | ✅ | ✅ | ✅ |
| View customer portal (own records only) | ✅ | ✅ | ✅ |
| Manage customers, subscriptions, invoices, payments | ✅ | ✅ | ❌ |
| View finance reports | ✅ | ✅ | ❌ |
| Create & configure products, plans, taxes | ✅ | ❌ | ❌ |
| Create discount rules | ✅ | ❌ | ❌ |
| Create staff accounts | ✅ | ❌ | ❌ |
| Bootstrap first Admin account | CLI only | — | — |

> [!IMPORTANT]
> Role checks in the frontend are **UX-only**. Every protected API endpoint verifies the session and role server-side via `getAuthenticatedUser(event)` in `netlify/functions/_shared/auth.ts`. Hiding a navigation link is not sufficient authorization.

### Protecting Future API Routes

For any new Netlify Function that requires authentication, add this pattern at the top of the handler:

```typescript
import { getAuthenticatedUser } from './_shared/auth';

const user = await getAuthenticatedUser(event);
if (!user) return jsonError('Unauthenticated.', 401, 'UNAUTHENTICATED', {}, origin);
if (user.role !== 'admin') return jsonError('Forbidden.', 403, 'FORBIDDEN', {}, origin);
// For customer-scoped data: always filter by user.customerId, never trust client-supplied IDs.
```

---

## First Admin Account Bootstrap

There is **no public Admin registration form**. The first Admin account is created via a secure local CLI script:

```bash
# Ensure your .env is configured with local MySQL credentials, then:
npm run admin:bootstrap
```

The script will interactively prompt for an email and password, validate the password policy, hash using bcrypt, and insert (or update) the Admin record. It never logs or stores the plain-text password.

You can also provide credentials non-interactively (useful for CI setup only — avoid passing passwords in shell history):

```bash
node scripts/bootstrap-admin.js --email=admin@yourcompany.com --first-name=System --last-name=Admin
# The script will prompt for the password interactively even with --email set.
```

> [!WARNING]
> This script requires a **running local MySQL** instance with the schema already applied. Run `npm run db:migrate` first.

---

## Brevo Email Service Setup

Brevo handles transactional password-reset emails. The browser **never** calls Brevo directly.

### 1. Create a Brevo Account

- Sign up at [https://app.brevo.com](https://app.brevo.com) (free tier available).

### 2. Verify Your Sender Email or Domain

- Go to **Senders & Domains** in Brevo.
- Add and verify the email address you'll use as `BREVO_SENDER_EMAIL`.

### 3. Generate an API Key

- Go to **Settings → API Keys** in Brevo.
- Create a new key with SMTP/Email permissions.
- Copy the key (starts with `xkeysib-`). **This is shown once — store it securely.**

### 4. Configure Environment Variables

**Local development — in your `.env` file (not committed to Git):**

```bash
BREVO_API_KEY=xkeysib-your-real-key-here
BREVO_SENDER_EMAIL=noreply@yourdomain.com
BREVO_SENDER_NAME=Brightloop Software
APP_BASE_URL=http://localhost:8888
```

**Netlify production — via Netlify dashboard:**
- Go to **Site configuration → Environment variables**.
- Add `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `APP_BASE_URL` (your production URL).
- After adding variables, **trigger a new deploy** (environment changes do not apply automatically).

### 5. Local Dev Without Brevo

If `BREVO_API_KEY` is unset or is a placeholder:
- The server logs a safe notice with a simulated reset URL.
- The API returns `devMode: true` and `devResetUrl` in the response body.
- The Forgot Password page displays a clickable dev link so you can test the full reset flow locally.
- The app continues to start normally — no crash or fake success.

---

## Production Deployment (Netlify & Remote MySQL)

1. **Cloud Database Provisioning:**
   - Deploy a managed MySQL 8 instance using a cloud provider (e.g., Aiven, PlanetScale, AWS RDS, DigitalOcean).
   - Run `database/schema.sql` against the cloud database.
   - Note the cloud host, username, password, port, and SSL certificate requirements (`DB_SSL=true`).
   - **Crucial Rule:** Netlify Functions cannot connect to `localhost` or private home networks. The database must be publicly accessible with secure SSL and credentials.

2. **Netlify Site Configuration:**
   - Link the GitHub repository to Netlify.
   - Set Build Command: `npm run build`
   - Set Publish Directory: `dist`
   - Set Functions Directory: `netlify/functions`

3. **Configure Netlify Environment Variables:**
   - In Netlify: **Site configuration > Environment variables**.
   - Add all production keys listed in `.env.example` (`DB_HOST`, `DB_PASSWORD`, `DB_SSL=true`, `JWT_SECRET`, `BREVO_API_KEY`, etc.).

---

## Invoicing, Tax Snapshots & Recurring Billing Engine (Part 7)

### 1. Concurrency-Safe Invoice Sequence Numbering
- **Format:** `INV-YYYY-XXXX` (e.g. `INV-2026-0001`, `INV-2026-0002`).
- **Generation Strategy:** Server-managed, database-backed sequence using MySQL table `invoice_sequences (sequence_year, last_number)`.
- **Atomic Concurrency Protection:** Generates numbers inside an active transaction via `SELECT last_number FROM invoice_sequences WHERE sequence_year = ? FOR UPDATE;`. This strictly avoids race conditions and collisions present in `MAX(id) + 1` patterns.
- **Permanent Consumption:** Numbers are permanently incremented and consumed. Cancelled, refunded, or deleted invoices never cause number reuse, maintaining strict accounting audit compliance.

### 2. Idempotency Key & Duplicate Prevention
- **Database Engine Guarantee:** Invoices enforce a unique constraint across subscription cycles:
  ```sql
  UNIQUE KEY uq_invoice_subscription_period (subscription_id, billing_period_start, billing_period_end)
  ```
- **Why this is resilient:** The engine prevents duplicate invoice creation at the database transaction layer. Unlike in-memory locks or client-side flags that fail under multiple serverless function instances or process restarts, this constraint guarantees absolute idempotency across network retries, parallel workers, and repeated manual billing runs.
- **Safe Retries:** When a billing run encounters a cycle that has already been generated, it records the subscription as `skipped` / `already_invoiced` without throwing unhandled exceptions or halting other subscriptions in the batch.

### 3. Billing Interval Calculation & Month-End Clamping Rules
The recurring billing engine calculates the active billing period `[periodStart, periodEnd]` and subsequent `nextBillingDate` based on subscription interval configuration:
- **Daily:** `periodEnd = periodStart`, `nextBillingDate = periodStart + 1 day`.
- **Weekly:** For interval count $N$, `periodEnd = periodStart + (7 \times N - 1) \text{ days}`, `nextBillingDate = periodStart + (7 \times N) \text{ days}`.
- **Monthly with Month-End Clamping:**
  - Standard JavaScript date manipulation (`setMonth(month + 1)`) causes subtle date skip bugs when originating on month-end dates (e.g., adding 1 month to January 31 results in March 3 in non-leap years because February lacks 31 days).
  - Brightloop implements **calendar month-end clamping**:
    $$\text{Target Day} = \min(\text{Start Day}, \text{Days in Target Month})$$
  - *Example 1:* Subscription starting on **January 31, 2026** (1 month interval):
    - Target month is February 2026 (28 days). Clamped day is $\min(31, 28) = 28$.
    - Billing Period: `2026-01-31` to `2026-02-27`.
    - Next Billing Date: `2026-02-28`.
  - *Example 2:* Leap Year handling on **January 31, 2024**:
    - Clamped day is $\min(31, 29) = 29$.
    - Billing Period: `2024-01-31` to `2024-02-28`.
    - Next Billing Date: `2024-02-29`.
- **Yearly:** Extends year by interval count $N$, with February 29 leap day clamping to February 28 on non-leap renewal years.

### 4. Tax Rules & Historical Snapshot Protection
- **Pre-Tax Calculation Model:** Brightloop applies taxes to pre-tax prices:
  $$\text{Line Subtotal} = \text{round}(\text{Quantity} \times \text{Unit Price}, 2)$$
  $$\text{Line Tax} = \text{round}(\text{Line Subtotal} \times (\text{Tax Rate} / 100), 2)$$
  $$\text{Line Total} = \text{Line Subtotal} + \text{Line Tax}$$
- **Snapshot Immutability:** When an invoice is created, `invoice_lines` saves an immutable snapshot of both `tax_name` (e.g., `"GST Standard"`) and `tax_rate` (e.g., `18.00`).
- **Protection Against Rate Changes:** If an Administrator later modifies or deactivates a tax rate (e.g., increasing GST from 18% to 20%), previously issued invoices retain their original snapshots. Historical financial records, tax audit reports, and customer receipts remain untouched and legally accurate.

---

## Project Roadmap & Next Steps

See [`TASKS.md`](file:///Users/harshthakur/Odoo_Hackathon/TASKS.md) for the detailed step-by-step implementation checklist.

**Completed Phases:**
- Phase 1: Foundation, Architecture & Data Modeling
- Phase 2: Frontend Foundation & Navigation Shell
- Phase 3: MySQL Database Foundation & Server-Side API Layer
- Phase 4: Authentication, Security & Role-Based Access Control (RBAC)
- Phase 5: Customers & Quotation Templates (Issuance Dependencies)
- Phase 6: Subscriptions & Lifecycle State Machine
- Phase 7: Tax Rules, Invoicing & Recurring Billing Engine

**Next Step (Phase 8): Payments Recording, Collections & Finance Dashboard**
- Payment collection recording (`POST /api/payments`) with methods (credit card, bank transfer, cash)
- Automatic reconciliation of `amount_paid`, `balance_due`, and transition to `Paid` status
- Finance Dashboard with ARR/MRR metrics, outstanding receivables, and aging indicators
