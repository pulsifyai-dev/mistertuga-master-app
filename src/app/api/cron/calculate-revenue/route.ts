import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { calculateDailyRevenue } from '@/lib/revenue-engine';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Calculate yesterday's revenue (cron runs at 23:59, so "today" is still current)
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  // Get all active country codes
  const { data: countries } = await supabase.from('countries').select('code');
  const countryRows = (countries ?? []) as Array<{ code: string }>;
  const countryCodes = countryRows.map((c) => c.code);

  const results = [];

  // Calculate for each date (yesterday + today for safety)
  for (const date of [yesterday, today]) {
    // Per country
    for (const code of countryCodes) {
      const result = await calculateDailyRevenue(supabase, date, code);
      results.push({ date, country: code, ...result });
    }

    // Aggregate (null country_code)
    const aggResult = await calculateDailyRevenue(supabase, date);
    results.push({ date, country: 'ALL', ...aggResult });
  }

  const successCount = results.filter((r) => r.success).length;

  return NextResponse.json({
    calculated: successCount,
    total: results.length,
    dates: [yesterday, today],
  });
}
