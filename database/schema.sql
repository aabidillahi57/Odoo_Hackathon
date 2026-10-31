-- =============================================================================
-- Brightloop Software - Subscription Management System
-- Normalized Relational Database Schema (MySQL 8.0+)
-- =============================================================================

-- Drop tables in reverse dependency order if re-initializing
-- DROP TABLE IF EXISTS payments;
-- DROP TABLE IF EXISTS invoice_lines;
-- DROP TABLE IF EXISTS invoices;
-- DROP TABLE IF EXISTS discount_usages;
-- DROP TABLE IF EXISTS subscription_lines;
-- DROP TABLE IF EXISTS subscriptions;
-- DROP TABLE IF EXISTS quotation_template_lines;
-- DROP TABLE IF EXISTS quotation_templates;
-- DROP TABLE IF EXISTS discounts;
-- DROP TABLE IF EXISTS plans;
-- DROP TABLE IF EXISTS product_variants;
-- DROP TABLE IF EXISTS products;
-- DROP TABLE IF EXISTS taxes;
-- DROP TABLE IF EXISTS customers;
-- DROP TABLE IF EXISTS users;

-- -----------------------------------------------------------------------------
-- 1. Users and Authentication
-- Supports Admin, Internal Staff, and Customer portal users.
-- One email can belong to only one account.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'staff', 'customer') NOT NULL DEFAULT 'customer',
    first_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_role (role),
    INDEX idx_users_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 1b. Server-Managed User Sessions
-- Opaque random tokens stored hashed (SHA-256) in DB, delivered in HttpOnly cookie.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_sessions_token (token_hash),
    INDEX idx_sessions_user (user_id),
    INDEX idx_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 1c. Single-Use Password Reset Tokens
-- Cryptographically random token hashed with SHA-256 with short expiration.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_reset_token (token_hash),
    INDEX idx_reset_user (user_id),
    INDEX idx_reset_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 1d. Lightweight Rate Limiting
-- Protects against brute-force login and password-reset abuse without Redis.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_rate_limits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    action ENUM('login', 'password_reset') NOT NULL,
    identifier VARCHAR(255) NOT NULL,
    attempts INT NOT NULL DEFAULT 1,
    first_attempt_at DATETIME NOT NULL,
    last_attempt_at DATETIME NOT NULL,
    locked_until DATETIME NULL,
    UNIQUE KEY uq_action_identifier (action, identifier),
    INDEX idx_rate_locked (locked_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Customers
-- Profiles for billing, CRM, and subscription assignment.
-- Optionally linked to a user account for customer self-service portal access.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NULL,
    address_line1 VARCHAR(255) NULL,
    address_line2 VARCHAR(255) NULL,
    city VARCHAR(100) NULL,
    state VARCHAR(100) NULL,
    postal_code VARCHAR(30) NULL,
    country VARCHAR(100) NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_customers_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    INDEX idx_customers_email (email),
    INDEX idx_customers_company (company_name),
    INDEX idx_customers_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. Tax Rates
-- Configurable tax rates managed by Admin.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    rate_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_taxes_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. Products & Variants
-- Products sold as software, services, or add-ons.
-- Variants adjust the base sales price (e.g. Odoo brand adds 560.00).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type ENUM('software', 'service', 'addon') NOT NULL DEFAULT 'software',
    sales_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    cost_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_products_type (type),
    INDEX idx_products_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_variants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    attribute_name VARCHAR(100) NOT NULL,
    attribute_value VARCHAR(100) NOT NULL,
    price_adjustment DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    sku VARCHAR(100) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_variants_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
    INDEX idx_variants_product (product_id),
    INDEX idx_variants_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. Plans
-- Defines recurring billing cycles and lifecycle policies.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    billing_interval ENUM('daily', 'weekly', 'monthly', 'yearly') NOT NULL,
    billing_interval_count INT NOT NULL DEFAULT 1,
    price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    min_quantity INT NOT NULL DEFAULT 1,
    available_from DATE NULL,
    available_to DATE NULL,
    auto_close BOOLEAN NOT NULL DEFAULT FALSE,
    early_close_policy ENUM('allowed', 'fee_applies', 'not_allowed') NOT NULL DEFAULT 'allowed',
    pause_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    renewal_policy ENUM('auto_renew', 'manual_renew', 'expire_on_end') NOT NULL DEFAULT 'auto_renew',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_plans_interval (billing_interval),
    INDEX idx_plans_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. Quotation Templates
-- Reusable presets for sales staff to accelerate quotation creation.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quotation_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    plan_id INT NULL,
    validity_days INT NOT NULL DEFAULT 30,
    notes TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_templates_plan FOREIGN KEY (plan_id) REFERENCES plans (id) ON DELETE SET NULL,
    INDEX idx_templates_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quotation_template_lines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    template_id INT NOT NULL,
    product_id INT NOT NULL,
    variant_id INT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tax_id INT NULL,
    CONSTRAINT fk_template_lines_parent FOREIGN KEY (template_id) REFERENCES quotation_templates (id) ON DELETE CASCADE,
    CONSTRAINT fk_template_lines_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
    CONSTRAINT fk_template_lines_variant FOREIGN KEY (variant_id) REFERENCES product_variants (id) ON DELETE SET NULL,
    CONSTRAINT fk_template_lines_tax FOREIGN KEY (tax_id) REFERENCES taxes (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. Discounts & Discount Usage Tracking
-- Admin-only rules for fixed or percentage savings with limits and validity.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS discounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255) NULL,
    discount_type ENUM('fixed', 'percentage') NOT NULL,
    value DECIMAL(12, 2) NOT NULL,
    min_purchase_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    min_quantity INT NOT NULL DEFAULT 1,
    start_date DATE NULL,
    end_date DATE NULL,
    max_uses INT NULL,
    used_count INT NOT NULL DEFAULT 0,
    applies_to ENUM('order', 'product') NOT NULL DEFAULT 'order',
    applicable_product_id INT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_discounts_product FOREIGN KEY (applicable_product_id) REFERENCES products (id) ON DELETE SET NULL,
    INDEX idx_discounts_code (code),
    INDEX idx_discounts_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS discount_usages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    discount_id INT NOT NULL,
    subscription_id INT NULL,
    invoice_id INT NULL,
    customer_id INT NOT NULL,
    amount_applied DECIMAL(12, 2) NOT NULL,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usage_discount FOREIGN KEY (discount_id) REFERENCES discounts (id) ON DELETE RESTRICT,
    CONSTRAINT fk_usage_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
    INDEX idx_discount_usages_discount (discount_id),
    INDEX idx_discount_usages_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. Subscriptions & Subscription Lines
-- Lifecycle: draft -> quotation -> confirmed -> active -> closed (or paused).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subscription_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id INT NOT NULL,
    plan_id INT NOT NULL,
    template_id INT NULL,
    status ENUM('draft', 'quotation', 'confirmed', 'active', 'paused', 'closed') NOT NULL DEFAULT 'draft',
    start_date DATE NOT NULL,
    expiry_date DATE NULL,
    next_billing_date DATE NOT NULL,
    payment_terms VARCHAR(100) NOT NULL DEFAULT 'Immediate Payment',
    discount_id INT NULL,
    subtotal_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_recurring_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_subscriptions_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
    CONSTRAINT fk_subscriptions_plan FOREIGN KEY (plan_id) REFERENCES plans (id) ON DELETE RESTRICT,
    CONSTRAINT fk_subscriptions_template FOREIGN KEY (template_id) REFERENCES quotation_templates (id) ON DELETE SET NULL,
    CONSTRAINT fk_subscriptions_discount FOREIGN KEY (discount_id) REFERENCES discounts (id) ON DELETE SET NULL,
    INDEX idx_subscriptions_customer (customer_id),
    INDEX idx_subscriptions_status (status),
    INDEX idx_subscriptions_billing (next_billing_date, status),
    INDEX idx_subscriptions_plan (plan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscription_lines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subscription_id INT NOT NULL,
    product_id INT NOT NULL,
    variant_id INT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(12, 2) NOT NULL,
    tax_id INT NULL,
    tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    subtotal_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_sub_lines_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions (id) ON DELETE CASCADE,
    CONSTRAINT fk_sub_lines_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
    CONSTRAINT fk_sub_lines_variant FOREIGN KEY (variant_id) REFERENCES product_variants (id) ON DELETE SET NULL,
    CONSTRAINT fk_sub_lines_tax FOREIGN KEY (tax_id) REFERENCES taxes (id) ON DELETE SET NULL,
    INDEX idx_sub_lines_subscription (subscription_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 9. Invoices & Invoice Lines
-- Generated recurringly from subscriptions or confirmed quotations.
-- Lifecycle: draft -> confirmed -> paid (or cancelled).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    subscription_id INT NULL,
    customer_id INT NOT NULL,
    status ENUM('draft', 'confirmed', 'paid', 'cancelled') NOT NULL DEFAULT 'draft',
    billing_period_start DATE NULL,
    billing_period_end DATE NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    payment_terms VARCHAR(100) NOT NULL DEFAULT 'Immediate Payment',
    subtotal_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    balance_due DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT NULL,
    sent_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_invoices_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions (id) ON DELETE SET NULL,
    CONSTRAINT fk_invoices_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
    INDEX idx_invoices_subscription (subscription_id),
    INDEX idx_invoices_customer (customer_id),
    INDEX idx_invoices_status (status),
    INDEX idx_invoices_due_date (due_date, status),
    INDEX idx_invoices_billing_period (billing_period_start, billing_period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_lines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    product_id INT NOT NULL,
    variant_id INT NULL,
    description VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(12, 2) NOT NULL,
    tax_id INT NULL,
    tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    subtotal_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_inv_lines_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
    CONSTRAINT fk_inv_lines_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
    CONSTRAINT fk_inv_lines_variant FOREIGN KEY (variant_id) REFERENCES product_variants (id) ON DELETE SET NULL,
    CONSTRAINT fk_inv_lines_tax FOREIGN KEY (tax_id) REFERENCES taxes (id) ON DELETE SET NULL,
    INDEX idx_inv_lines_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 10. Payments
-- Records payments against invoices; reconciles amount_paid and balance_due.
-- Financial history is strictly preserved (ON DELETE RESTRICT).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_number VARCHAR(50) NOT NULL UNIQUE,
    invoice_id INT NOT NULL,
    customer_id INT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    payment_method ENUM('credit_card', 'bank_transfer', 'cash', 'other') NOT NULL DEFAULT 'bank_transfer',
    payment_date DATE NOT NULL,
    transaction_reference VARCHAR(100) NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE RESTRICT,
    CONSTRAINT fk_payments_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
    INDEX idx_payments_invoice (invoice_id),
    INDEX idx_payments_customer (customer_id),
    INDEX idx_payments_date (payment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
