'use client';

import { useEffect, useState, useCallback } from 'react';
import { ArrowUpRight, ArrowDownRight, Loader2, RefreshCw, Globe } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import {
  getProfitSummary,
  recalculateRevenue,
  type ProfitSummary,
} from './revenue-actions';
import { formatCurrency } from '@/lib/format';

// --- Helpers ---

function getDateRange(preset: string) {
  const end = new Date();
  const endStr = end.toISOString().split('T')[0];
  let start: Date;

  switch (preset) {
    case '7d':
      start = new Date(Date.now() - 7 * 86400000);
      break;
    case '90d':
      start = new Date(Date.now() - 90 * 86400000);
      break;
    case 'month':
      start = new Date(end.getFullYear(), end.getMonth(), 1);
      break;
    case '30d':
    default:
      start = new Date(Date.now() - 30 * 86400000);
      break;
  }

  return { startDate: start.toISOString().split('T')[0], endDate: endStr };
}

const COUNTRY_FLAGS: Record<string, string> = {
  PT: '\u{1F1F5}\u{1F1F9}',
  ES: '\u{1F1EA}\u{1F1F8}',
  DE: '\u{1F1E9}\u{1F1EA}',
};

// --- Revenue Chart ---

function RevenueChart({ points }: { points: Array<{ date: string; total_revenue: number }> }) {
  if (points.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-[11px] text-muted-foreground">
        No revenue data. Click &quot;Recalculate&quot; to generate from orders.
      </div>
    );
  }

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const chartData = sorted.map((p) => ({
    day: new Date(p.date).getDate().toString().padStart(2, '0'),
    revenue: Number(p.total_revenue),
  }));

  return (
    <div className="mt-4 h-32 w-full md:h-40">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(168,85,247,0.35)" />
              <stop offset="100%" stopColor="rgba(168,85,247,0)" />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: '#64748b' }}
            padding={{ left: 4, right: 4 }}
          />
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Tooltip
            cursor={{ stroke: 'rgba(148,163,184,0.25)', strokeWidth: 1 }}
            contentStyle={{
              backgroundColor: 'rgba(15,23,42,0.95)',
              borderRadius: 8,
              border: '1px solid rgba(148,163,184,0.35)',
              padding: '6px 8px',
            }}
            labelStyle={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}
            formatter={(value: number) => [formatCurrency(value), 'Revenue']}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="url(#revStroke)"
            strokeWidth={2}
            fill="url(#revFill)"
            dot={false}
            activeDot={{ r: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// --- Main Page ---

export default function ProfitStatsPage() {
  const { toast } = useToast();
  const { isAdmin, loading: authLoading } = useAuth();

  const [data, setData] = useState<ProfitSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [preset, setPreset] = useState('30d');
  const [country, setCountry] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { startDate, endDate } = getDateRange(preset);
    const result = await getProfitSummary(
      startDate,
      endDate,
      country !== 'all' ? country : undefined
    );
    if (result.success && result.data) {
      setData(result.data);
    }
    setLoading(false);
  }, [preset, country]);

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin, fetchData]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    const { startDate, endDate } = getDateRange(preset);
    const result = await recalculateRevenue(startDate, endDate);
    if (result.success) {
      toast({ title: 'Revenue Recalculated', description: `${result.calculated} entries updated.` });
      fetchData();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setRecalculating(false);
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex flex-col gap-6" role="status">
        <div className="pt-1">
          <div className="h-10 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-64 mt-2 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/40 p-6 space-y-4">
          <div className="h-12 w-40 animate-pulse rounded-md bg-muted" />
          <div className="h-32 w-full animate-pulse rounded-md bg-muted" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-white/8 bg-black/40 animate-pulse" />
        ))}
      </div>
    );
  }

  const profit = data?.profit ?? 0;
  const revenue = data?.revenue ?? 0;
  const totalExpenses = data?.totalExpenses ?? 0;
  const margin = data?.margin ?? 0;
  const trendPositive = profit >= 0;

  const presetLabel = preset === '7d' ? 'Last 7 days' : preset === '30d' ? 'Last 30 days' : preset === '90d' ? 'Last 90 days' : 'This month';

  return (
    <div className="flex flex-col gap-6">
      {/* HEADER + FILTERS */}
      <div className="pt-1">
        <h1 className="font-headline text-3xl md:text-4xl font-bold tracking-tight">
          Profit Stats
        </h1>
        <p className="text-muted-foreground max-w-xl text-sm mt-1">
          Financial snapshot from MisterTuga &middot; {presetLabel}
        </p>
      </div>

      {/* FILTER ROW */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {(['7d', '30d', '90d', 'month'] as const).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={preset === p ? 'default' : 'outline'}
              className="h-8 text-xs"
              onClick={() => setPreset(p)}
            >
              {p === '7d' ? '7d' : p === '30d' ? '30d' : p === '90d' ? '90d' : 'Month'}
            </Button>
          ))}
        </div>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="w-36 h-8 text-xs bg-black/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Countries</SelectItem>
            <SelectItem value="PT">Portugal</SelectItem>
            <SelectItem value="ES">Spain</SelectItem>
            <SelectItem value="DE">Germany</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs ml-auto"
          onClick={handleRecalculate}
          disabled={recalculating}
        >
          {recalculating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
          Recalculate
        </Button>
      </div>

      {/* NET PROFIT CARD */}
      <Card
        className="relative overflow-hidden rounded-2xl border border-white/8 bg-black/40
          shadow-[0_14px_35px_rgba(0,0,0,0.55)]
          after:pointer-events-none after:absolute after:inset-x-8 after:-bottom-6
          after:h-8 after:rounded-full after:bg-purple-500/25 after:blur-2xl"
      >
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-1">
          <div className="space-y-1">
            <CardDescription className="text-[11px] uppercase tracking-[0.18em] text-slate-300/80">
              Net Profit
            </CardDescription>
            <p className="text-4xl md:text-5xl font-semibold tabular-nums tracking-tight">
              {formatCurrency(profit)}
            </p>
            <div className="flex gap-4 text-[11px] text-muted-foreground">
              <span>{formatCurrency(revenue)} revenue</span>
              <span>{formatCurrency(totalExpenses)} expenses</span>
            </div>
          </div>
          <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-[11px]">
            {trendPositive ? (
              <>
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-300">{margin.toFixed(1)}%</span>
              </>
            ) : (
              <>
                <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
                <span className="text-red-300">{margin.toFixed(1)}%</span>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <RevenueChart points={data?.dailyRevenue ?? []} />
        </CardContent>
      </Card>

      {/* BREAKDOWN CARDS */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl border border-white/8 bg-black/40">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Revenue</p>
            <p className="text-2xl font-semibold tabular-nums">{formatCurrency(revenue)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data?.orderCount ?? 0} orders &middot; {data?.itemCount ?? 0} items
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-white/8 bg-black/40">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Ad Spend</p>
            <p className="text-2xl font-semibold tabular-nums">{formatCurrency(data?.adSpend ?? 0)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-white/8 bg-black/40">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Expenses</p>
            <p className="text-2xl font-semibold tabular-nums">{formatCurrency((data?.manualExpenses ?? 0) + (data?.fixedCosts ?? 0))}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manual + fixed monthly
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-white/8 bg-black/40">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Net Profit</p>
            <p className={`text-2xl font-semibold tabular-nums ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(profit)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{margin.toFixed(1)}% margin</p>
          </CardContent>
        </Card>
      </div>

      {/* COUNTRY BREAKDOWN */}
      {(data?.byCountry ?? []).length > 0 && (
        <Card className="rounded-2xl border border-white/8 bg-black/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4 text-blue-400" />
              Revenue by Country
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(data?.byCountry ?? [])
                .sort((a, b) => b.total_revenue - a.total_revenue)
                .map((c) => {
                  const pct = revenue > 0 ? (c.total_revenue / revenue) * 100 : 0;
                  return (
                    <div key={c.country_code} className="flex items-center gap-3">
                      <span className="text-lg w-8">{COUNTRY_FLAGS[c.country_code] ?? c.country_code}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{c.country_code}</span>
                          <span className="text-sm tabular-nums">{formatCurrency(c.total_revenue)}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full bg-purple-500"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                          <span>{c.order_count} orders</span>
                          <span>{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
