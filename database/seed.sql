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

-- 8. Discounts
INSERT INTO discounts (id, code, description, discount_type, value, min_purchase_amount, min_quantity, max_uses, used_count, applies_to, is_active)
VALUES
    (1, 'EARLYBIRD2026', '15% off first annual contract', 'percentage', 15.00, 1000.00, 1, 50, 14, 'order', TRUE),
    (2, 'ODOOFEST500', 'Flat 500 discount on Odoo Brand Variant addon', 'fixed', 500.00, 560.00, 1, 20, 6, 'product', TRUE)
ON DUPLICATE KEY UPDATE code=VALUES(code);
