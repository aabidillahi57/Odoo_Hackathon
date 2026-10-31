-- =============================================================================
-- Migration 005: Discounts Engine, Manual Payment Recording & Audited Ledger
-- Brightloop Subscription Management System - Part 8
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Payment Number Sequences
-- Concurrency-safe atomic sequence tracking for PAY-YYYY-XXXX identifiers.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_sequences (
    sequence_year INT PRIMARY KEY,
    last_number INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Extend Discounts Table
-- Adds optional descriptive name and soft-archive timestamp.
-- -----------------------------------------------------------------------------
-- Handled idempotently in scripts/migrate.js:
-- ALTER TABLE discounts ADD COLUMN IF NOT EXISTS name VARCHAR(255) NULL;
-- ALTER TABLE discounts ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL;

-- -----------------------------------------------------------------------------
-- 3. Extend Discount Usages Table
-- Adds reservation status lifecycle: reserved -> redeemed -> released.
-- -----------------------------------------------------------------------------
-- Handled idempotently in scripts/migrate.js:
-- ALTER TABLE discount_usages ADD COLUMN IF NOT EXISTS status ENUM('reserved', 'redeemed', 'released') NOT NULL DEFAULT 'redeemed';
-- ALTER TABLE discount_usages ADD COLUMN IF NOT EXISTS released_at DATETIME NULL;

-- -----------------------------------------------------------------------------
-- 4. Extend Payments Table
-- Adds void/reversal tracking, operator audit reference, and completion status.
-- -----------------------------------------------------------------------------
-- Handled idempotently in scripts/migrate.js:
-- ALTER TABLE payments ADD COLUMN IF NOT EXISTS status ENUM('completed', 'voided') NOT NULL DEFAULT 'completed';
-- ALTER TABLE payments ADD COLUMN IF NOT EXISTS recorded_by INT NULL;
-- ALTER TABLE payments ADD COLUMN IF NOT EXISTS voided_at DATETIME NULL;
-- ALTER TABLE payments ADD COLUMN IF NOT EXISTS voided_by INT NULL;
-- ALTER TABLE payments ADD COLUMN IF NOT EXISTS void_reason TEXT NULL;

