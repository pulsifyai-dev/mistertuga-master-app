'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/supabase/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { calculateDateRange } from '@/lib/revenue-engine';

// --- Types ---

export type DailyRevenuePoint = {
  date: string;
  total_revenue: number;
  total_tax: number;
  total_shipping: number;
  order_count: number;
  item_count: number;
  country_code: string | null;
};

export type CountryRevenue = {
  country_code: string;
  total_revenue: number;
  order_count: number;
  item_count: number;
};

export type ProfitSummary = {
  revenue: number;
  adSpend: number;
  manualExpenses: number;
  fixedCosts: number;
  totalExpenses: number;
  profit: number;
  margin: number;
  orderCount: number;
  itemCount: number;
  dailyRevenue: DailyRevenuePoint[];
  byCountry: CountryRevenue[];
};

// --- Fetch Daily Revenue ---

export async function getDailyRevenue(
  startDate: string,
  endDate: string,
  countryCode?: string
) {
  try {
    await requireAdmin();
    const supabase = createServiceClient();

    let query = supabase
      .from('daily_revenue')
      .select('date, total_revenue, total_tax, total_shipping, order_count, item_count, country_code')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (countryCode) {
      query = query.eq('country_code', countryCode);
    } else {
      query = query.is('country_code', null); // Aggregate rows
    }

    const { data, error } = await query;
    if (error) return { success: false as const, error: error.message, data: [] as DailyRevenuePoint[] };
    return { success: true as const, data: (data ?? []) as DailyRevenuePoint[] };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg, data: [] as DailyRevenuePoint[] };
  }
}

// --- Revenue by Country ---

export async function getRevenueByCountry(startDate: string, endDate: string) {
  try {
    await requireAdmin();
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('daily_revenue')
      .select('country_code, total_revenue, order_count, item_count')
      .gte('date', startDate)
      .lte('date', endDate)
      .not('country_code', 'is', null);

    if (error) return { success: false as const, error: error.message, data: [] as CountryRevenue[] };

    // Aggregate by country
    const byCountry = new Map<string, CountryRevenue>();
    for (const row of data ?? []) {
      const code = row.country_code as string;
      const existing = byCountry.get(code);
      if (existing) {
        existing.total_revenue += Number(row.total_revenue ?? 0);
        existing.order_count += Number(row.order_count ?? 0);
        existing.item_count += Number(row.item_count ?? 0);
      } else {
        byCountry.set(code, {
          country_code: code,
          total_revenue: Number(row.total_revenue ?? 0),
          order_count: Number(row.order_count ?? 0),
          item_count: Number(row.item_count ?? 0),
        });
      }
    }

    return { success: true as const, data: Array.from(byCountry.values()) };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg, data: [] as CountryRevenue[] };
  }
}

// --- Recalculate Revenue (manual trigger) ---

export async function recalculateRevenue(startDate: string, endDate: string) {
  try {
    const { user } = await requireAdmin();
    const rl = rateLimit(`revenueCalc:${user.id}`, 3, 60_000);
    if (!rl.success) return { success: false as const, error: 'Too many requests. Wait a moment.' };

    const supabase = createServiceClient();
    const result = await calculateDateRange(supabase, startDate, endDate);

    if (result.success) {
      revalidatePath('/profit-stats');
    }

    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, calculated: 0, error: msg };
  }
}

// --- Unified Profit Summary ---

export async function getProfitSummary(
  startDate: string,
  endDate: string,
  countryCode?: string
): Promise<{ success: boolean; data?: ProfitSummary; error?: string }> {
  try {
    await requireAdmin();
    const supabase = createServiceClient();

    // 1. Revenue from daily_revenue
    let revQuery = supabase
      .from('daily_revenue')
      .select('date, total_revenue, total_tax, total_shipping, order_count, item_count, country_code')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (countryCode) {
      revQuery = revQuery.eq('country_code', countryCode);
    } else {
      revQuery = revQuery.is('country_code', null);
    }

    const { data: revenueRows } = await revQuery;
    const dailyRevenue = (revenueRows ?? []) as DailyRevenuePoint[];

    let revenue = 0;
    let orderCount = 0;
    let itemCount = 0;
    for (const r of dailyRevenue) {
      revenue += Number(r.total_revenue ?? 0);
      orderCount += Number(r.order_count ?? 0);
      itemCount += Number(r.item_count ?? 0);
    }

    // 2. Ad spend from ad_spend
    const { data: adRows } = await supabase
      .from('ad_spend')
      .select('spend')
      .gte('date', startDate)
      .lte('date', endDate);

    let adSpend = 0;
    for (const row of adRows ?? []) {
      adSpend += Number((row as { spend: number }).spend ?? 0);
    }

    // 3. Manual expenses
    const { data: expRows } = await supabase
      .from('manual_expenses')
      .select('amount')
      .gte('date', startDate)
      .lte('date', endDate);

    let manualExpenses = 0;
    for (const row of expRows ?? []) {
      manualExpenses += Number((row as { amount: number }).amount ?? 0);
    }

    // 4. Fixed monthly costs (from active expense categories)
    const { data: catRows } = await supabase
      .from('expense_categories')
      .select('fixed_monthly_cost')
      .eq('is_active', true)
      .not('fixed_monthly_cost', 'is', null);

    let fixedCosts = 0;
    for (const row of catRows ?? []) {
      fixedCosts += Number((row as { fixed_monthly_cost: number }).fixed_monthly_cost ?? 0);
    }

    // 5. Revenue by country
    const { data: countryRows } = await supabase
      .from('daily_revenue')
      .select('country_code, total_revenue, order_count, item_count')
      .gte('date', startDate)
      .lte('date', endDate)
      .not('country_code', 'is', null);

    const byCountryMap = new Map<string, CountryRevenue>();
    for (const row of countryRows ?? []) {
      const code = row.country_code as string;
      const existing = byCountryMap.get(code);
      if (existing) {
        existing.total_revenue += Number(row.total_revenue ?? 0);
        existing.order_count += Number(row.order_count ?? 0);
        existing.item_count += Number(row.item_count ?? 0);
      } else {
        byCountryMap.set(code, {
          country_code: code,
          total_revenue: Number(row.total_revenue ?? 0),
          order_count: Number(row.order_count ?? 0),
          item_count: Number(row.item_count ?? 0),
        });
      }
    }

    // Calculate profit
    revenue = Math.round(revenue * 100) / 100;
    adSpend = Math.round(adSpend * 100) / 100;
    manualExpenses = Math.round(manualExpenses * 100) / 100;
    fixedCosts = Math.round(fixedCosts * 100) / 100;
    const totalExpenses = Math.round((adSpend + manualExpenses + fixedCosts) * 100) / 100;
    const profit = Math.round((revenue - totalExpenses) * 100) / 100;
    const margin = revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : 0;

    return {
      success: true,
      data: {
        revenue,
        adSpend,
        manualExpenses,
        fixedCosts,
        totalExpenses,
        profit,
        margin,
        orderCount,
        itemCount,
        dailyRevenue,
        byCountry: Array.from(byCountryMap.values()),
      },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false, error: msg };
  }
}
