/**
 * Shared Ad Spend Sync Logic — Story 2.5
 *
 * Used by both the server action (manual sync) and the cron API route (daily sync).
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchGoogleAdsSpend,
  fetchMetaAdsSpend,
  type AdPlatform,
  type DailySpend,
} from '@/lib/ad-clients';

export type SyncResult = {
  success: boolean;
  synced?: number;
  error?: string;
};

export async function syncAccountSpend(
  supabase: SupabaseClient,
  accountId: string,
  platform: AdPlatform,
  externalAccountId: string,
  days: number = 7
): Promise<SyncResult> {
  // Mark as pending
  await supabase
    .from('ad_accounts')
    .update({ last_sync_status: 'pending', last_sync_error: null, updated_at: new Date().toISOString() })
    .eq('id', accountId);

  // Calculate date range
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  // Fetch from platform API
  let result: { success: boolean; data: DailySpend[]; error?: string };

  if (platform === 'google_ads') {
    result = await fetchGoogleAdsSpend(externalAccountId, startDate, endDate);
  } else if (platform === 'meta_ads') {
    result = await fetchMetaAdsSpend(externalAccountId, startDate, endDate);
  } else {
    result = { success: false, data: [], error: 'Unknown platform.' };
  }

  if (!result.success || result.data.length === 0) {
    await supabase
      .from('ad_accounts')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'error',
        last_sync_error: result.error || 'No data returned.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId);
    return { success: false, error: result.error || 'No data returned.' };
  }

  // Upsert spend data (idempotent via UNIQUE constraint)
  const rows = result.data.map((d) => ({
    ad_account_id: accountId,
    date: d.date,
    spend: d.spend,
    impressions: d.impressions,
    clicks: d.clicks,
    conversions: d.conversions,
    currency: d.currency,
    fetched_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await supabase
    .from('ad_spend')
    .upsert(rows, { onConflict: 'ad_account_id,date' });

  if (upsertError) {
    await supabase
      .from('ad_accounts')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'error',
        last_sync_error: upsertError.message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId);
    return { success: false, error: upsertError.message };
  }

  // Mark success
  await supabase
    .from('ad_accounts')
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'success',
      last_sync_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId);

  return { success: true, synced: result.data.length };
}
