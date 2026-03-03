-- Migration: Auto-calculate costs on new order INSERT
-- Part of Story 2.3 AC4: Automatic cost calculation on new orders
-- When n8n inserts a new order, this trigger calculates production + shipping costs

CREATE OR REPLACE FUNCTION calculate_order_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_production_rule RECORD;
  v_shipping_rule RECORD;
  v_total_qty INT;
  v_prod_rate NUMERIC(10,2) := 0;
  v_ship_rate NUMERIC(10,2) := 0;
  v_prod_cost NUMERIC(10,2) := 0;
  v_ship_cost NUMERIC(10,2) := 0;
  v_tier RECORD;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Calculate total quantity from order_items
  SELECT COALESCE(SUM(quantity), 0) INTO v_total_qty
  FROM public.order_items
  WHERE order_id = NEW.id;

  -- Skip if no items
  IF v_total_qty = 0 THEN
    RETURN NEW;
  END IF;

  -- Find active production rule for this country
  SELECT * INTO v_production_rule
  FROM public.cost_rules
  WHERE country_code = NEW.country_code
    AND rule_type = 'production'
    AND is_active = true
    AND (effective_from IS NULL OR effective_from <= v_today)
    AND (effective_to IS NULL OR effective_to >= v_today)
  LIMIT 1;

  -- Find active shipping rule for this country
  SELECT * INTO v_shipping_rule
  FROM public.cost_rules
  WHERE country_code = NEW.country_code
    AND rule_type = 'shipping'
    AND is_active = true
    AND (effective_from IS NULL OR effective_from <= v_today)
    AND (effective_to IS NULL OR effective_to >= v_today)
  LIMIT 1;

  -- Skip if no rules configured
  IF v_production_rule IS NULL AND v_shipping_rule IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate production rate from tiers or base_rate
  IF v_production_rule IS NOT NULL THEN
    IF v_production_rule.rate_tiers IS NOT NULL AND jsonb_array_length(v_production_rule.rate_tiers) > 0 THEN
      SELECT rate INTO v_prod_rate
      FROM jsonb_to_recordset(v_production_rule.rate_tiers) AS t(min_qty INT, max_qty INT, rate NUMERIC)
      WHERE v_total_qty >= min_qty AND v_total_qty <= max_qty
      LIMIT 1;
      -- Fallback to last tier if qty exceeds all
      IF v_prod_rate IS NULL OR v_prod_rate = 0 THEN
        SELECT rate INTO v_prod_rate
        FROM jsonb_to_recordset(v_production_rule.rate_tiers) AS t(min_qty INT, max_qty INT, rate NUMERIC)
        ORDER BY max_qty DESC
        LIMIT 1;
      END IF;
    END IF;
    IF v_prod_rate IS NULL OR v_prod_rate = 0 THEN
      v_prod_rate := COALESCE(v_production_rule.base_rate, 0);
    END IF;
    v_prod_cost := v_prod_rate * v_total_qty;
  END IF;

  -- Calculate shipping rate from tiers or base_rate
  IF v_shipping_rule IS NOT NULL THEN
    IF v_shipping_rule.rate_tiers IS NOT NULL AND jsonb_array_length(v_shipping_rule.rate_tiers) > 0 THEN
      SELECT rate INTO v_ship_rate
      FROM jsonb_to_recordset(v_shipping_rule.rate_tiers) AS t(min_qty INT, max_qty INT, rate NUMERIC)
      WHERE v_total_qty >= min_qty AND v_total_qty <= max_qty
      LIMIT 1;
      IF v_ship_rate IS NULL OR v_ship_rate = 0 THEN
        SELECT rate INTO v_ship_rate
        FROM jsonb_to_recordset(v_shipping_rule.rate_tiers) AS t(min_qty INT, max_qty INT, rate NUMERIC)
        ORDER BY max_qty DESC
        LIMIT 1;
      END IF;
    END IF;
    IF v_ship_rate IS NULL OR v_ship_rate = 0 THEN
      v_ship_rate := COALESCE(v_shipping_rule.base_rate, 0);
    END IF;
    v_ship_cost := v_ship_rate * v_total_qty;
  END IF;

  -- Upsert into order_costs
  INSERT INTO public.order_costs (order_id, production_cost, shipping_cost, total_cost, currency, cost_rule_id, calculated_at)
  VALUES (
    NEW.id,
    ROUND(v_prod_cost, 2),
    ROUND(v_ship_cost, 2),
    ROUND(v_prod_cost + v_ship_cost, 2),
    'USD',
    COALESCE(v_production_rule.id, v_shipping_rule.id),
    now()
  )
  ON CONFLICT (order_id) DO UPDATE SET
    production_cost = EXCLUDED.production_cost,
    shipping_cost = EXCLUDED.shipping_cost,
    total_cost = EXCLUDED.total_cost,
    cost_rule_id = EXCLUDED.cost_rule_id,
    calculated_at = EXCLUDED.calculated_at;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: fires after INSERT on orders table
-- Uses AFTER INSERT so order_items are already present (n8n inserts items first or in same transaction)
-- Also fires on UPDATE to recalculate when order is modified
DROP TRIGGER IF EXISTS trg_calculate_order_cost ON public.orders;
CREATE TRIGGER trg_calculate_order_cost
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION calculate_order_cost();
