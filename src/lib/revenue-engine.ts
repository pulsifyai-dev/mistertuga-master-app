/**
 * Revenue Calculation Engine — Story 2.7
 *
 * Aggregates daily revenue from the orders table and upserts into daily_revenue.
 * Replaces the n8n "Faturamento e Taxas (Diário)" workflow.
 */

import { SupabaseClient } from '@supabase/supabase-js';

/** Return the next calendar day as YYYY-MM-DD string. */
function nextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split('T')[0];
}

export type DailyRevenueRow = {
  id: string;
  date: string;
  country_code: string | null;
  total_revenue: number;
  total_tax: number;
  total_shipping: number;
  order_count: number;
  item_count: number;
  currency: string;
  calculated_at: string;
};

/**
 * Calculate and upsert daily revenue for a specific date and optional country.
 * Aggregates from the orders table, excluding soft-deleted orders.
 */
export async function calculateDailyRevenue(
  supabase: SupabaseClient,
  date: string,
  countryCode?: string
): Promise<{ success: boolean; row?: DailyRevenueRow; error?: string }> {
  try {
    // Build the aggregation query via RPC or manual aggregation
    // We query orders for the given date (using shopify_created_at for accuracy)
    let query = supabase
      .from('orders')
      .select('total_price, total_tax, total_shipping, country_code, id')
      .is('deleted_at', null)
      .gte('shopify_created_at', `${date}T00:00:00.000Z`)
      .lt('shopify_created_at', `${nextDay(date)}T00:00:00.000Z`);

    if (countryCode) {
      query = query.eq('country_code', countryCode);
    }

    const { data: orders, error: ordersError } = await query;

    if (ordersError) return { success: false, error: ordersError.message };

    const orderRows = orders ?? [];

    // Calculate aggregates
    let totalRevenue = 0;
    let totalTax = 0;
    let totalShipping = 0;

    for (const o of orderRows) {
      totalRevenue += Number(o.total_price ?? 0);
      totalTax += Number(o.total_tax ?? 0);
      totalShipping += Number(o.total_shipping ?? 0);
    }

    const orderCount = orderRows.length;

    // Get item count from order_items
    const orderIds = orderRows.map((o) => o.id);
    let itemCount = 0;

    if (orderIds.length > 0) {
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('quantity')
        .in('order_id', orderIds);

      if (!itemsError && items) {
        for (const item of items) {
          itemCount += Number(item.quantity ?? 1);
        }
      }
    }

    // Upsert into daily_revenue (idempotent via UNIQUE constraint)
    const row = {
      date,
      country_code: countryCode ?? null,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_tax: Math.round(totalTax * 100) / 100,
      total_shipping: Math.round(totalShipping * 100) / 100,
      order_count: orderCount,
      item_count: itemCount,
      currency: 'EUR',
      calculated_at: new Date().toISOString(),
    };

    const { data: upserted, error: upsertError } = await supabase
      .from('daily_revenue')
      .upsert(row, { onConflict: 'date,country_code' })
      .select()
      .single();

    if (upsertError) return { success: false, error: upsertError.message };

    return { success: true, row: upserted as DailyRevenueRow };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

/**
 * Calculate revenue for a date range. Processes each date × country combination.
 * Used for backfilling historical data and cron recalculation.
 */
export async function calculateDateRange(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
): Promise<{ success: boolean; calculated: number; error?: string }> {
  try {
    // Get all active country codes
    const { data: countries } = await supabase
      .from('countries')
      .select('code');

    const countryCodes = (countries ?? []).map((c) => (c as { code: string }).code);

    let calculated = 0;
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];

      // Calculate per country
      for (const code of countryCodes) {
        const result = await calculateDailyRevenue(supabase, dateStr, code);
        if (result.success) calculated++;
      }

      // Also calculate "all countries" aggregate (null country_code)
      const allResult = await calculateDailyRevenue(supabase, dateStr);
      if (allResult.success) calculated++;
    }

    return { success: true, calculated };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, calculated: 0, error: msg };
  }
}
