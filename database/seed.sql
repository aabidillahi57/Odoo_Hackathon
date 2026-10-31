-- =============================================================================
-- Brightloop Software - Subscription Management System
-- Initial Seed Data for Local Development
-- (Notice: Admin accounts are bootstrapped securely via `npm run admin:bootstrap`,
--  preventing hard-coded credentials in the repository)
-- =============================================================================

-- 1. Tax Rates
INSERT INTO taxes (id, name, rate_percentage, is_active)
VALUES 
    (1, 'GST Standard', 18.00, TRUE),
    (2, 'Zero-Rated / Export', 0.00, TRUE)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 3. Products
INSERT INTO products (id, name, type, sales_price, cost_price, notes, is_active)
VALUES 
    (1, 'Brightloop Core License', 'software', 450.00, 80.00, 'Base seat license with access to all standard workflows', TRUE),
    (2, 'High-Throughput API Gateway', 'addon', 150.00, 25.00, 'Dedicated rate-limit bypass with 1M calls/month', TRUE),
    (3, 'Dedicated Technical Account Manager', 'service', 800.00, 350.00, 'Monthly enterprise SLA with 1-hour response time guarantee', TRUE)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 4. Product Variants
INSERT INTO product_variants (id, product_id, attribute_name, attribute_value, price_adjustment, sku, is_active)
VALUES
    (1, 1, 'Brand Edition', 'Standard', 0.00, 'CORE-STD', TRUE),
    (2, 1, 'Brand Edition', 'Odoo Compatible', 560.00, 'CORE-ODOO-560', TRUE)
ON DUPLICATE KEY UPDATE attribute_value=VALUES(attribute_value);

-- 5. Subscription Plans
INSERT INTO plans (id, name, billing_interval, billing_interval_count, price, min_quantity, auto_close, early_close_policy, pause_allowed, renewal_policy, is_active)
VALUES
    (1, 'Enterprise Cloud Yearly', 'yearly', 1, 1850.00, 5, FALSE, 'fee_applies', TRUE, 'auto_renew', TRUE),
    (2, 'Pro Tier Monthly', 'monthly', 1, 420.00, 1, FALSE, 'allowed', TRUE, 'auto_renew', TRUE),
    (3, 'Starter Weekly Pilot', 'weekly', 1, 95.00, 1, TRUE, 'allowed', FALSE, 'expire_on_end', TRUE)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 6. Customers
INSERT INTO customers (id, user_id, name, company_name, email, phone, city, state, country, notes)
VALUES
    (1, NULL, 'Sarah Connor', 'Acme Technologies Inc.', 'sarah.connor@acmetech.example.com', '+1 (555) 019-2834', 'San Francisco', 'CA', 'United States', 'Enterprise annual agreement'),
    (2, NULL, 'Marcus Brody', 'Global Logistics Partners', 'mbrody@globallogistics.example.com', '+44 20 7946 0912', 'London', 'Greater London', 'United Kingdom', 'Fleet tracking operations'),
    (3, NULL, 'Elena Rostova', 'Vertex Dynamics Ltd.', 'elena@vertexdynamics.example.com', '+49 30 1234567', 'Berlin', 'Berlin', 'Germany', 'Pilot evaluation team'),
    (4, NULL, 'David Vance', 'Nova FinTech Solutions', 'david.vance@novafintech.example.com', '+1 (555) 392-1094', 'New York', 'NY', 'United States', 'Financial services client')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 7. Quotation Templates
INSERT INTO quotation_templates (id, name, plan_id, validity_days, notes, is_active)
VALUES
    (1, 'Standard Enterprise Annual Bundle', 1, 30, 'Includes Core Software + Odoo Variant + 1 Year Account Manager', TRUE),
    (2, 'Growth Startup Monthly Package', 2, 14, 'Pro Monthly Plan with High-Throughput API Gateway Addon', TRUE)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 7b. Quotation Template Lines
INSERT INTO quotation_template_lines (id, template_id, product_id, variant_id, quantity, unit_price, tax_id)
VALUES
    (1, 1, 1, 2, 5, 1010.00, 1),
    (2, 1, 3, NULL, 1, 800.00, 1),
    (3, 2, 1, 1, 2, 450.00, 1),
    (4, 2, 2, NULL, 1, 150.00, 1)
ON DUPLICATE KEY UPDATE unit_price=VALUES(unit_price);

-- 8. Subscription Sequences
INSERT INTO subscription_sequences (sequence_year, last_number)
VALUES (2026, 4)
ON DUPLICATE KEY UPDATE last_number=VALUES(last_number);

-- 9. Subscriptions
INSERT INTO subscriptions (
    id, subscription_number, customer_id, plan_id, template_id, status,
    start_date, expiry_date, next_billing_date, payment_terms,
    billing_interval, billing_interval_count, subtotal_amount, tax_amount,
    discount_amount, total_recurring_amount, auto_renew, notes
)
VALUES
    (1, 'SUB-2026-0001', 1, 1, 1, 'active', '2026-01-01', '2027-01-01', '2027-01-01', 'Net 30', 'yearly', 1, 5850.00, 1053.00, 0.00, 6903.00, TRUE, 'Enterprise annual contract with SLA guarantee'),
    (2, 'SUB-2026-0002', 2, 2, 2, 'quotation', '2026-11-01', '2026-11-15', '2026-11-01', 'Immediate Payment', 'monthly', 1, 1050.00, 189.00, 0.00, 1239.00, TRUE, 'Growth proposal awaiting Marcus client review'),
    (3, 'SUB-2026-0003', 3, 3, NULL, 'draft', '2026-11-10', '2026-11-17', '2026-11-10', 'Immediate Payment', 'weekly', 1, 450.00, 81.00, 0.00, 531.00, FALSE, 'Pilot agreement draft under internal negotiation'),
    (4, 'SUB-2026-0004', 4, 2, NULL, 'paused', '2026-03-01', '2027-03-01', '2026-12-01', 'Net 15', 'monthly', 1, 950.00, 171.00, 0.00, 1121.00, TRUE, 'Paused temporarily during client corporate restructuring')
ON DUPLICATE KEY UPDATE subscription_number=VALUES(subscription_number);

-- 9b. Subscription Lines
INSERT INTO subscription_lines (
    id, subscription_id, product_id, variant_id, description, quantity,
    unit_price, tax_id, tax_rate, tax_amount, subtotal_amount, total_amount
)
VALUES
    (1, 1, 1, 2, 'Brightloop Core License (Odoo Compatible)', 5, 1010.00, 1, 18.00, 909.00, 5050.00, 5959.00),
    (2, 1, 3, NULL, 'Dedicated Technical Account Manager', 1, 800.00, 1, 18.00, 144.00, 800.00, 944.00),
    (3, 2, 1, 1, 'Brightloop Core License (Standard)', 2, 450.00, 1, 18.00, 162.00, 900.00, 1062.00),
    (4, 2, 2, NULL, 'High-Throughput API Gateway', 1, 150.00, 1, 18.00, 27.00, 150.00, 177.00),
    (5, 3, 1, 1, 'Brightloop Core License (Standard)', 1, 450.00, 1, 18.00, 81.00, 450.00, 531.00),
    (6, 4, 1, 1, 'Brightloop Core License (Standard)', 1, 450.00, 1, 18.00, 81.00, 450.00, 531.00),
    (7, 4, 3, NULL, 'Dedicated Technical Account Manager (Partial)', 1, 500.00, 1, 18.00, 90.00, 500.00, 590.00)
ON DUPLICATE KEY UPDATE unit_price=VALUES(unit_price);

-- 9c. Subscription Audit History
INSERT INTO subscription_history (
    id, subscription_id, from_status, to_status, actor_user_id, action, reason, created_at
)
VALUES
    (1, 1, NULL, 'draft', NULL, 'created', 'Initial subscription agreement created', '2026-01-01 09:00:00'),
    (2, 1, 'draft', 'quotation', NULL, 'quotation_issued', 'Issued quotation to Acme Technologies', '2026-01-01 10:30:00'),
    (3, 1, 'quotation', 'confirmed', NULL, 'status_transition', 'Signed contract received from Sarah Connor', '2026-01-01 14:00:00'),
    (4, 1, 'confirmed', 'active', NULL, 'status_transition', 'Activated enterprise subscription', '2026-01-01 14:05:00'),
    (5, 2, NULL, 'quotation', NULL, 'quotation_issued', 'Issued proposal from Growth Startup Monthly Package template', '2026-10-30 11:15:00'),
    (6, 3, NULL, 'draft', NULL, 'created', 'Drafted weekly pilot agreement', '2026-10-31 08:20:00'),
    (7, 4, 'active', 'paused', NULL, 'status_transition', 'Client requested temporary pause during corporate restructuring', '2026-10-25 16:45:00')
ON DUPLICATE KEY UPDATE action=VALUES(action);

-- 10. Discounts
INSERT INTO discounts (id, code, description, discount_type, value, min_purchase_amount, min_quantity, max_uses, used_count, applies_to, is_active)
VALUES
    (1, 'EARLYBIRD2026', '15% off first annual contract', 'percentage', 15.00, 1000.00, 1, 50, 14, 'order', TRUE),
    (2, 'ODOOFEST500', 'Flat 500 discount on Odoo Brand Variant addon', 'fixed', 500.00, 560.00, 1, 20, 6, 'product', TRUE)
ON DUPLICATE KEY UPDATE code=VALUES(code);
