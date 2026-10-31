-- =============================================================================
-- Migration 003: Subscriptions Lifecycle, Event History & Sequence Management
-- Brightloop Subscription Management System - Part 6
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Subscription Sequences
-- Concurrency-safe atomic sequence tracking for SUB-YYYY-XXXX identifiers.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_sequences (
    sequence_year INT PRIMARY KEY,
    last_number INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Subscription Audit History / Lifecycle Events
-- Immutable audit log recording every transition, actor, reason, and timestamp.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subscription_id INT NOT NULL,
    from_status ENUM('draft', 'quotation', 'confirmed', 'active', 'paused', 'closed') NULL,
    to_status ENUM('draft', 'quotation', 'confirmed', 'active', 'paused', 'closed') NOT NULL,
    actor_user_id INT NULL,
    action VARCHAR(50) NOT NULL DEFAULT 'status_change',
    reason TEXT NULL,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sub_history_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions (id) ON DELETE CASCADE,
    CONSTRAINT fk_sub_history_actor FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL,
    INDEX idx_sub_history_sub (subscription_id),
    INDEX idx_sub_history_actor (actor_user_id),
    INDEX idx_sub_history_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. Preset Quotation Template Lines (Minimum Part 5 Dependency for Issuance)
-- -----------------------------------------------------------------------------
INSERT INTO quotation_template_lines (id, template_id, product_id, variant_id, quantity, unit_price, tax_id)
VALUES
    (1, 1, 1, 2, 5, 1010.00, 1),
    (2, 1, 3, NULL, 1, 800.00, 1),
    (3, 2, 1, 1, 2, 450.00, 1),
    (4, 2, 2, NULL, 1, 150.00, 1)
ON DUPLICATE KEY UPDATE unit_price=VALUES(unit_price);

