-- =============================================================================
-- Migration 004: Invoicing, Recurring Billing Engine & Tax Rules Management
-- Brightloop Subscription Management System - Part 7
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Invoice Number Sequences
-- Concurrency-safe atomic sequence tracking for INV-YYYY-XXXX identifiers.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_sequences (
    sequence_year INT PRIMARY KEY,
    last_number INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Recurring Billing Runs Ledger
-- Records execution metadata, as-of dates, operators, and itemized results.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing_runs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    run_number VARCHAR(50) NOT NULL UNIQUE,
    as_of_date DATE NOT NULL,
    status ENUM('completed', 'failed', 'partial') NOT NULL DEFAULT 'completed',
    processed_count INT NOT NULL DEFAULT 0,
    created_count INT NOT NULL DEFAULT 0,
    skipped_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    total_invoiced_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    triggered_by INT NULL,
    details JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_billing_runs_user FOREIGN KEY (triggered_by) REFERENCES users (id) ON DELETE SET NULL,
    INDEX idx_billing_runs_date (as_of_date),
    INDEX idx_billing_runs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. Extend Taxes Table
-- Add optional descriptive field for invoice itemization / tax rules.
-- -----------------------------------------------------------------------------
-- Note: Handled idempotently in scripts/migrate.js. Standard SQL:
-- ALTER TABLE taxes ADD COLUMN IF NOT EXISTS description VARCHAR(255) NULL;

-- -----------------------------------------------------------------------------
-- 4. Extend Invoices Table
-- Safe idempotency constraints and lifecycle tracking columns.
-- -----------------------------------------------------------------------------
-- Note: Handled idempotently in scripts/migrate.js.
-- Adds: delivery_status, delivery_error, cancellation_reason, confirmed_at, cancelled_at, created_by
-- Adds: UNIQUE KEY uq_invoice_subscription_period (subscription_id, billing_period_start, billing_period_end)

-- -----------------------------------------------------------------------------
-- 5. Extend Invoice Lines Table
-- Tax name snapshot preservation for immutable historical record keeping.
-- -----------------------------------------------------------------------------
-- Note: Handled idempotently in scripts/migrate.js.
-- Adds: tax_name VARCHAR(100) NULL
