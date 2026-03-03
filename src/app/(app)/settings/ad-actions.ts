'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/supabase/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import {
  testAdConnection,
  type AdPlatform,
} from '@/lib/ad-clients';
import { syncAccountSpend } from '@/lib/ad-sync';

// --- Types ---

export type AdAccount = {
  id: string;
  platform: AdPlatform;
  account_id: string;
  account_name: string | null;
  is_active: boolean;
  config: Record<string, unknown> | null;
  last_sync_at: string | null;
  last_sync_status: 'success' | 'error' | 'pending' | null;
  last_sync_error: string | null;
  created_at: string;
};

export type AdSpendRow = {
  id: string;
  date: string;
  spend: number;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  currency: string;
};

// --- CRUD ---

export async function listAdAccounts() {
  try {
    await requireAdmin();
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('ad_accounts')
      .select('*')
      .order('platform', { ascending: true });

    if (error) return { success: false as const, error: error.message, accounts: [] as AdAccount[] };
    return { success: true as const, accounts: (data ?? []) as AdAccount[] };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg, accounts: [] as AdAccount[] };
  }
}

export async function createAdAccount(data: {
  platform: AdPlatform;
  account_id: string;
  account_name?: string;
}) {
  try {
    const { user } = await requireAdmin();
    const rl = rateLimit(`adAccount:${user.id}`, 10, 60_000);
    if (!rl.success) return { success: false as const, error: 'Too many requests.' };

    const supabase = createServiceClient();
    const { error } = await supabase.from('ad_accounts').insert({
      platform: data.platform,
      account_id: data.account_id,
      account_name: data.account_name || null,
    });

    if (error) return { success: false as const, error: error.message };
    revalidatePath('/settings');
    return { success: true as const };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg };
  }
}

export async function deleteAdAccount(id: string) {
  try {
    const { user } = await requireAdmin();
    const rl = rateLimit(`adAccount:${user.id}`, 10, 60_000);
    if (!rl.success) return { success: false as const, error: 'Too many requests.' };

    const supabase = createServiceClient();
    const { error } = await supabase.from('ad_accounts').delete().eq('id', id);

    if (error) return { success: false as const, error: error.message };
    revalidatePath('/settings');
    return { success: true as const };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg };
  }
}

export async function toggleAdAccount(id: string, isActive: boolean) {
  try {
    const { user } = await requireAdmin();
    const rl = rateLimit(`adAccount:${user.id}`, 20, 60_000);
    if (!rl.success) return { success: false as const, error: 'Too many requests.' };

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('ad_accounts')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return { success: false as const, error: error.message };
    revalidatePath('/settings');
    return { success: true as const };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg };
  }
}

// --- Connection Test ---

export async function testAdAccountConnection(id: string) {
  try {
    await requireAdmin();
    const supabase = createServiceClient();

    const { data: account, error } = await supabase
      .from('ad_accounts')
      .select('platform, account_id')
      .eq('id', id)
      .single();

    if (error || !account) return { success: false as const, error: 'Account not found.' };

    const result = await testAdConnection(account.platform as AdPlatform, account.account_id);
    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg };
  }
}

// --- Sync ---

export async function syncAdAccountSpend(id: string, days: number = 7) {
  try {
    const { user } = await requireAdmin();
    const rl = rateLimit(`adSync:${user.id}`, 5, 60_000);
    if (!rl.success) return { success: false as const, error: 'Too many sync requests.' };

    const supabase = createServiceClient();

    // Get account details
    const { data: account, error: fetchError } = await supabase
      .from('ad_accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !account) return { success: false as const, error: 'Account not found.' };

    const result = await syncAccountSpend(
      supabase,
      id,
      account.platform as AdPlatform,
      account.account_id,
      days
    );

    if (result.success) {
      revalidatePath('/settings');
      revalidatePath('/profit-stats');
    }

    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg };
  }
}

// --- Aggregation for Profit Dashboard ---

export async function getAdSpendByDateRange(startDate: string, endDate: string) {
  try {
    await requireAdmin();
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('ad_spend')
      .select(`
        date, spend, currency,
        ad_accounts!inner (platform, account_name, is_active)
      `)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) return { success: false as const, error: error.message, data: [] };

    // Aggregate by platform
    const byPlatform: Record<string, number> = {};
    const byDate: Record<string, Record<string, number>> = {};

    for (const row of data ?? []) {
      const platform = (row.ad_accounts as unknown as { platform: string })?.platform ?? 'unknown';
      byPlatform[platform] = (byPlatform[platform] ?? 0) + Number(row.spend);

      if (!byDate[row.date]) byDate[row.date] = {};
      byDate[row.date][platform] = (byDate[row.date][platform] ?? 0) + Number(row.spend);
    }

    return {
      success: true as const,
      data: data ?? [],
      byPlatform,
      byDate,
      total: Object.values(byPlatform).reduce((s, v) => s + v, 0),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg, data: [] };
  }
}
