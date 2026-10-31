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
6. [Environment Variables](#environment-variables)
7. [Production Deployment (Netlify & Remote MySQL)](#production-deployment-netlify--remote-mysql)
8. [Project Roadmap & Next Steps](#project-roadmap--next-steps)

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

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/api/health` | `GET` | Reports API service health and performs a live database ping test without exposing credentials. |
| `/api/products` | `GET` | Fetches active catalog products with nested variants and price adjustments. |
| `/api/plans` | `GET` | Returns active billing plans (daily, weekly, monthly, yearly) and lifecycle policies. |
| `/api/customers` | `GET` | Returns paginated customer records (`?page=1&limit=10&search=...`) with safe bounds. |

---

## Environment Variables

Copy `.env.example` to `.env`. The system expects the following variables:

| Variable | Description | Local Dev Example | Production Target |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Environment mode | `development` | `production` |
| `APP_URL` | Public application URL | `http://localhost:8888` | `https://your-app.netlify.app` |
| `DB_HOST` | MySQL hostname | `127.0.0.1` | Remote cloud DB host |
| `DB_PORT` | MySQL port | `3306` | `3306` |
| `DB_USER` | Database username | `root` | Cloud DB username |
| `DB_PASSWORD` | Database password | *local password* | Cloud DB password |
| `DB_NAME` | Database schema name | `brightloop_subscriptions` | `brightloop_subscriptions` |
| `DB_SSL` | Enable SSL for DB connection | `false` | `true` |
| `DATABASE_URL` | Optional URI connection string | *optional* | `mysql://user:pass@host:3306/db?ssl=true` |
| `JWT_SECRET` | Secret key for JWT signing | *32+ char random string* | Secure production secret |
| `JWT_EXPIRES_IN` | Token expiration | `7d` | `7d` |
| `BREVO_API_KEY` | Brevo API key for transactional email | *placeholder* | `xkeysib-...` |
| `BREVO_SENDER_EMAIL` | Sender email address | `noreply@brightloop.com` | Verified domain email |
| `BREVO_SENDER_NAME` | Sender display name | `Brightloop Software` | `Brightloop Software` |

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

## Project Roadmap & Next Steps

See [`TASKS.md`](file:///Users/harshthakur/Odoo_Hackathon/TASKS.md) for the detailed step-by-step implementation checklist.

**Upcoming Step (Phase 4):**
- Authentication & RBAC: User login, registration, JWT session issuance, password strength enforcement, and route protection.
- Initialize React + TypeScript + Vite frontend scaffolding with Tailwind CSS.
- Configure Netlify Functions structure (`netlify/functions/`) and MySQL connection pool.
- Implement base API router and database health-check endpoint.
