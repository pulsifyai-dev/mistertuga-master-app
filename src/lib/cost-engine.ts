/**
 * Cost Calculation Engine — Story 2.3
 *
 * Calculates production and shipping costs for orders based on
 * configurable rate tiers stored in cost_rules table.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { findTierRate } from '@/lib/cost-utils';
import type { RateTier } from '@/lib/cost-utils';

// Re-export shared types and functions for backward compatibility
export { findTierRate };
export type { RateTier };

// --- Types ---

export type CostRule = {
  id: string;
  name: string;
  country_code: string | null;
  rule_type: 'production' | 'shipping';
  base_rate: number | null;
  rate_tiers: RateTier[] | null;
  is_active: boolean;
  effective_from: string | null;
  effective_to: string | null;
};

export type CostResult = {
  production_cost: number;
  shipping_cost: number;
  total_cost: number;
  currency: string;
  production_rule_id: string | null;
  shipping_rule_id: string | null;
};

export type OrderForCost = {
  id: string;
  country_code: string;
  items: Array<{ quantity: number }>;
};

// --- Core Calculation ---

/**
 * Calculate costs for a single order given applicable rules.
 */
export function calculateCosts(
  order: OrderForCost,
  productionRule: CostRule | null,
  shippingRule: CostRule | null
): CostResult {
  const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);

  // Production cost: rate * total quantity
  let productionCost = 0;
  if (productionRule) {
    const rate = findTierRate(
      productionRule.rate_tiers,
      productionRule.base_rate,
      totalQuantity
    );
    productionCost = rate * totalQuantity;
  }

  // Shipping cost: rate * total quantity
  let shippingCost = 0;
  if (shippingRule) {
    const rate = findTierRate(
      shippingRule.rate_tiers,
      shippingRule.base_rate,
      totalQuantity
    );
    shippingCost = rate * totalQuantity;
  }

  const totalCost = productionCost + shippingCost;

  return {
    production_cost: Math.round(productionCost * 100) / 100,
    shipping_cost: Math.round(shippingCost * 100) / 100,
    total_cost: Math.round(totalCost * 100) / 100,
    currency: 'USD',
    production_rule_id: productionRule?.id ?? null,
    shipping_rule_id: shippingRule?.id ?? null,
  };
}

// --- Database Operations ---

/**
 * Find active cost rules for a given country and date.
 */
async function findActiveRules(countryCode: string) {
  const supabase = createServiceClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: rules, error } = await supabase
    .from('cost_rules')
    .select('*')
    .eq('country_code', countryCode)
    .eq('is_active', true)
    .or(`effective_from.is.null,effective_from.lte.${today}`)
    .or(`effective_to.is.null,effective_to.gte.${today}`);

  if (error) {
    console.error('Error fetching cost rules:', error);
    return { productionRule: null, shippingRule: null };
  }

  const productionRule = (rules as CostRule[]).find((r) => r.rule_type === 'production') ?? null;
  const shippingRule = (rules as CostRule[]).find((r) => r.rule_type === 'shipping') ?? null;

  return { productionRule, shippingRule };
}

/**
 * Calculate and store costs for a single order.
 * Returns the cost result or null if no rules are configured.
 */
export async function calculateOrderCosts(orderId: string): Promise<CostResult | null> {
  const supabase = createServiceClient();

  // Fetch order with items
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, country_code, order_items(quantity)')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    console.error('Order not found for cost calculation:', orderId);
    return null;
  }

  const { productionRule, shippingRule } = await findActiveRules(order.country_code);

  if (!productionRule && !shippingRule) {
    console.warn(`No cost rules configured for country ${order.country_code}`);
    return null;
  }

  const result = calculateCosts(
    {
      id: order.id,
      country_code: order.country_code,
      items: (order.order_items as Array<{ quantity: number }>) ?? [],
    },
    productionRule,
    shippingRule
  );

  // Upsert into order_costs (one cost record per order)
  const { error: upsertError } = await supabase
    .from('order_costs')
    .upsert(
      {
        order_id: orderId,
        production_cost: result.production_cost,
        shipping_cost: result.shipping_cost,
        total_cost: result.total_cost,
        currency: result.currency,
        cost_rule_id: result.production_rule_id || result.shipping_rule_id,
        calculated_at: new Date().toISOString(),
      },
      { onConflict: 'order_id' }
    );

  if (upsertError) {
    console.error('Error storing order cost:', upsertError);
    return null;
  }

  return result;
}

/**
 * Batch calculate costs for multiple orders.
 * Returns count of successful calculations.
 */
export async function batchCalculateOrderCosts(
  orderIds: string[]
): Promise<{ calculated: number; skipped: number; errors: number }> {
  let calculated = 0;
  let skipped = 0;
  let errors = 0;

  for (const orderId of orderIds) {
    try {
      const result = await calculateOrderCosts(orderId);
      if (result) {
        calculated++;
      } else {
        skipped++;
      }
    } catch {
      errors++;
    }
  }

  return { calculated, skipped, errors };
}
