-- Migration: Seed initial cost rules
-- Part of Story 2.3 Task 11: Seed from current rate tables
-- Production ~$3-5/item, shipping varies by country
-- Admin can adjust these via the Cost Rules UI

INSERT INTO cost_rules (name, country_code, rule_type, base_rate, rate_tiers, is_active) VALUES
-- Production rules (same for all countries — Chinese supplier)
('PT Production', 'PT', 'production', 3.50,
 '[{"min_qty": 1, "max_qty": 50, "rate": 4.00}, {"min_qty": 51, "max_qty": 200, "rate": 3.50}, {"min_qty": 201, "max_qty": 99999, "rate": 3.00}]'::jsonb,
 true),

('ES Production', 'ES', 'production', 3.50,
 '[{"min_qty": 1, "max_qty": 50, "rate": 4.00}, {"min_qty": 51, "max_qty": 200, "rate": 3.50}, {"min_qty": 201, "max_qty": 99999, "rate": 3.00}]'::jsonb,
 true),

('DE Production', 'DE', 'production', 3.50,
 '[{"min_qty": 1, "max_qty": 50, "rate": 4.00}, {"min_qty": 51, "max_qty": 200, "rate": 3.50}, {"min_qty": 201, "max_qty": 99999, "rate": 3.00}]'::jsonb,
 true),

-- Shipping rules (vary by destination country)
('PT Shipping', 'PT', 'shipping', 1.80,
 '[{"min_qty": 1, "max_qty": 30, "rate": 2.00}, {"min_qty": 31, "max_qty": 100, "rate": 1.80}, {"min_qty": 101, "max_qty": 99999, "rate": 1.50}]'::jsonb,
 true),

('ES Shipping', 'ES', 'shipping', 1.80,
 '[{"min_qty": 1, "max_qty": 30, "rate": 2.00}, {"min_qty": 31, "max_qty": 100, "rate": 1.80}, {"min_qty": 101, "max_qty": 99999, "rate": 1.50}]'::jsonb,
 true),

('DE Shipping', 'DE', 'shipping', 2.20,
 '[{"min_qty": 1, "max_qty": 30, "rate": 2.50}, {"min_qty": 31, "max_qty": 100, "rate": 2.20}, {"min_qty": 101, "max_qty": 99999, "rate": 1.80}]'::jsonb,
 true);
