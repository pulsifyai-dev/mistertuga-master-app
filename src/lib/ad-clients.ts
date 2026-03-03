/**
 * Ad Platform API Clients — Story 2.5
 *
 * Real implementations for Google Ads REST API v17 and Meta Marketing API v21.0.
 * All calls use native fetch(). No npm dependencies required.
 *
 * Required environment variables:
 *   Google Ads: GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID,
 *               GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN
 *   Meta Ads:   META_ADS_ACCESS_TOKEN
 */

export type DailySpend = {
  date: string; // YYYY-MM-DD
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  currency: string;
};

export type AdPlatform = 'google_ads' | 'meta_ads';

type ApiResult = { success: boolean; data: DailySpend[]; error?: string };

// ---------------------------------------------------------------------------
// Google Ads — OAuth2 token refresh
// ---------------------------------------------------------------------------

async function getGoogleAdsAccessToken(): Promise<{ token?: string; error?: string }> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return { error: 'Missing GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, or GOOGLE_ADS_REFRESH_TOKEN.' };
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { error: `OAuth2 token refresh failed (${res.status}): ${body}` };
  }

  const json = await res.json();
  return { token: json.access_token };
}

// ---------------------------------------------------------------------------
// Google Ads — Fetch daily spend
// ---------------------------------------------------------------------------

export async function fetchGoogleAdsSpend(
  customerId: string,
  startDate: string,
  endDate: string
): Promise<ApiResult> {
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

  if (!devToken) {
    return {
      success: false,
      data: [],
      error: 'Google Ads credentials not configured. Set GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, and GOOGLE_ADS_REFRESH_TOKEN.',
    };
  }

  const { token: accessToken, error: tokenError } = await getGoogleAdsAccessToken();
  if (!accessToken) {
    return { success: false, data: [], error: tokenError ?? 'Failed to obtain access token.' };
  }

  try {
    // Strip dashes from customer ID (Google Ads expects: 1234567890 not 123-456-7890)
    const cleanId = customerId.replace(/-/g, '');

    // Validate date format before interpolation (defense-in-depth)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return { success: false, data: [], error: 'Invalid date format. Expected YYYY-MM-DD.' };
    }

    const query = `SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions FROM campaign WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`;

    // Use the non-streaming search endpoint (simpler response parsing)
    const url = `https://googleads.googleapis.com/v17/customers/${cleanId}/googleAds:search`;

    let allRows: Array<{ segments: { date: string }; metrics: { cost_micros: string; impressions: string; clicks: string; conversions: string } }> = [];
    let pageToken: string | undefined;

    // Paginate through results
    do {
      const body: Record<string, string> = { query };
      if (pageToken) body.pageToken = pageToken;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': devToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.text();
        return { success: false, data: [], error: `Google Ads API (${res.status}): ${errBody}` };
      }

      const json = await res.json();
      if (json.results) allRows = allRows.concat(json.results);
      pageToken = json.nextPageToken;
    } while (pageToken);

    // Aggregate by date (multiple campaigns → single daily totals)
    const byDate = new Map<string, DailySpend>();

    for (const row of allRows) {
      const date = row.segments.date; // YYYY-MM-DD
      const existing = byDate.get(date);
      const costMicros = Number(row.metrics.cost_micros || 0);
      const impressions = Number(row.metrics.impressions || 0);
      const clicks = Number(row.metrics.clicks || 0);
      const conversions = Number(row.metrics.conversions || 0);

      if (existing) {
        existing.spend += costMicros / 1_000_000;
        existing.impressions += impressions;
        existing.clicks += clicks;
        existing.conversions += conversions;
      } else {
        byDate.set(date, {
          date,
          spend: costMicros / 1_000_000,
          impressions,
          clicks,
          conversions,
          currency: 'EUR',
        });
      }
    }

    // Round spend to 2 decimals
    const data = Array.from(byDate.values()).map((d) => ({
      ...d,
      spend: Math.round(d.spend * 100) / 100,
    }));

    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, data: [], error: `Google Ads API error: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// Meta Ads — Fetch daily spend
// ---------------------------------------------------------------------------

export async function fetchMetaAdsSpend(
  accountId: string,
  startDate: string,
  endDate: string
): Promise<ApiResult> {
  const accessToken = process.env.META_ADS_ACCESS_TOKEN;

  if (!accessToken) {
    return {
      success: false,
      data: [],
      error: 'Meta Ads credentials not configured. Set META_ADS_ACCESS_TOKEN.',
    };
  }

  try {
    // Normalize account ID — strip 'act_' prefix if present
    const cleanId = accountId.replace(/^act_/, '');

    const params = new URLSearchParams({
      fields: 'spend,impressions,clicks,actions',
      time_range: JSON.stringify({ since: startDate, until: endDate }),
      time_increment: '1', // daily breakdown
      level: 'account',
      access_token: accessToken,
    });

    type MetaInsightEntry = { date_start: string; spend?: string; impressions?: string; clicks?: string; actions?: Array<{ action_type: string; value: string }> };
    let allEntries: MetaInsightEntry[] = [];
    let nextUrl: string | undefined = `https://graph.facebook.com/v21.0/act_${cleanId}/insights?${params}`;

    // Follow pagination
    while (nextUrl) {
      const res: Response = await fetch(nextUrl);

      if (!res.ok) {
        const errBody = await res.text();
        // Detect expired token
        if (res.status === 400 || res.status === 401 || errBody.includes('OAuthException')) {
          return { success: false, data: [], error: 'Meta Ads access token expired or invalid. Generate a new long-lived token in Meta Business Suite.' };
        }
        return { success: false, data: [], error: `Meta Ads API (${res.status}): ${errBody}` };
      }

      const json = await res.json();
      if (json.data) allEntries = allEntries.concat(json.data);
      nextUrl = json.paging?.next;
    }

    // Map to DailySpend
    const data: DailySpend[] = allEntries.map((entry) => {
      // Extract conversions from actions array (purchase events)
      const conversions = entry.actions?.reduce((sum, a) => {
        if (a.action_type === 'offsite_conversion.fb_pixel_purchase' || a.action_type === 'purchase') {
          return sum + Number(a.value || 0);
        }
        return sum;
      }, 0) ?? 0;

      return {
        date: entry.date_start,
        spend: Math.round(Number(entry.spend || 0) * 100) / 100,
        impressions: Number(entry.impressions || 0),
        clicks: Number(entry.clicks || 0),
        conversions,
        currency: 'EUR',
      };
    });

    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, data: [], error: `Meta Ads API error: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// Test Connection
// ---------------------------------------------------------------------------

export async function testAdConnection(
  platform: AdPlatform,
  accountId: string
): Promise<{ success: boolean; error?: string }> {
  if (platform === 'google_ads') {
    const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!devToken) return { success: false, error: 'GOOGLE_ADS_DEVELOPER_TOKEN not set.' };

    const { token: accessToken, error: tokenError } = await getGoogleAdsAccessToken();
    if (!accessToken) return { success: false, error: tokenError ?? 'Failed to get access token.' };

    try {
      const cleanId = accountId.replace(/-/g, '');
      const res = await fetch(
        `https://googleads.googleapis.com/v17/customers/${cleanId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'developer-token': devToken,
          },
        }
      );

      if (res.ok) return { success: true };
      const body = await res.text();
      return { success: false, error: `Google Ads (${res.status}): ${body}` };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: msg };
    }
  }

  if (platform === 'meta_ads') {
    const accessToken = process.env.META_ADS_ACCESS_TOKEN;
    if (!accessToken) return { success: false, error: 'META_ADS_ACCESS_TOKEN not set.' };

    try {
      const cleanId = accountId.replace(/^act_/, '');
      const res = await fetch(
        `https://graph.facebook.com/v21.0/act_${cleanId}?fields=name,account_status&access_token=${accessToken}`
      );

      if (!res.ok) {
        const body = await res.text();
        return { success: false, error: `Meta Ads (${res.status}): ${body}` };
      }

      const json = await res.json();
      if (json.account_status !== 1) {
        return { success: true, error: `Account connected but status is ${json.account_status} (1 = active). Name: ${json.name}` };
      }
      return { success: true };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: msg };
    }
  }

  return { success: false, error: 'Unknown platform.' };
}
