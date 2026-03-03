import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { syncAccountSpend } from '@/lib/ad-sync';
import type { AdPlatform } from '@/lib/ad-clients';

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this automatically for cron routes)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Fetch all active ad accounts
  const { data: accounts, error } = await supabase
    .from('ad_accounts')
    .select('*')
    .eq('is_active', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!accounts?.length) {
    return NextResponse.json({ message: 'No active ad accounts', synced: 0 });
  }

  // Sync each account (last 3 days for safety — covers timezone differences)
  const results = [];

  for (const account of accounts) {
    const result = await syncAccountSpend(
      supabase,
      account.id,
      account.platform as AdPlatform,
      account.account_id,
      3
    );

    results.push({
      id: account.id,
      platform: account.platform,
      ...result,
    });
  }

  const successCount = results.filter((r) => r.success).length;

  return NextResponse.json({
    synced: successCount,
    total: results.length,
    results,
  });
}
