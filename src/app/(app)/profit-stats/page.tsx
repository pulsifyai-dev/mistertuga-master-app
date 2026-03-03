'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ArrowUpRight, ArrowDownRight, Plus, Check, X as XIcon, AlertTriangle } from 'lucide-react';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { useFirebase } from '@/firebase';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

type ExpenseKey = 'metaAds' | 'tiktokAds' | 'klaviyo' | 'collaborators' | 'variableCosts';

interface ExpenseItem {
  label: string;
  base: number;
  extra: number;
  color?: string;
  recurring?: boolean;
}

// Daily data point type
interface DailyNetProfitPoint {
  date: string; // "2025-12-01"
  net: number;  // lucro líquido nesse dia
}

interface ProfitStatsDoc {
  periodLabel: string;
  currency: 'EUR';
  totalRevenue: number;
  expenses: Record<ExpenseKey, ExpenseItem>;
  dailyNetProfit?: DailyNetProfitPoint[];
}

// ----- Dummy initial data (created if not exists) -----
const dummyProfitDoc: ProfitStatsDoc = {
  periodLabel: 'Last 30 days',
  currency: 'EUR',
  totalRevenue: 48237.5,
  expenses: {
    metaAds: {
      label: 'Meta Ads (Facebook / Instagram)',
      base: 12500,
      extra: 0,
      color: '#a855f7',
      recurring: true,
    },
    tiktokAds: {
      label: 'TikTok Ads',
      base: 4200,
      extra: 0,
      color: '#ec4899',
      recurring: true,
    },
    klaviyo: {
      label: 'Klaviyo (Email / SMS)',
      base: 780,
      extra: 0,
      color: '#22c55e',
      recurring: true,
    },
    collaborators: {
      label: 'collaborators / Team',
      base: 13500,
      extra: 0,
      color: '#38bdf8',
      recurring: true,
    },
    variableCosts: {
      label: 'Variable Costs (packaging, shipping, etc.)',
      base: 8900,
      extra: 0,
      color: '#f97316',
      recurring: true,
    },
  },
};

function buildDummyDailyNetProfit(
  totalRevenue: number,
  expenses: Record<ExpenseKey, ExpenseItem>
): DailyNetProfitPoint[] {
  const totalExpenses = (Object.keys(expenses) as ExpenseKey[]).reduce(
    (acc, key) => acc + expenses[key].base + expenses[key].extra,
    0
  );

  const totalNet = totalRevenue - totalExpenses;

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  if (daysInMonth <= 0) return [];

  const basePerDay = totalNet / daysInMonth;

  const points: DailyNetProfitPoint[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const jitter = basePerDay * 0.35 * (Math.random() - 0.5) * 2;
    const value = Math.round((basePerDay + jitter) * 100) / 100;

    points.push({
      date: date.toISOString().slice(0, 10), // "YYYY-MM-DD"
      net: value,
    });
  }

  return points;
}

const expenseAccentColors: Record<ExpenseKey, string> = {
  metaAds: "#a855f7",
  tiktokAds: "#ec4899",
  klaviyo: "#22c55e",
  collaborators: "#38bdf8",
  variableCosts: "#f59e0b",
};

function formatCurrency(value: number, currency: string = 'EUR') {
  return value.toLocaleString('pt-PT', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Minimal smooth line chart, Shopify dashboard style. */
function NetProfitLineChart({ points }: { points?: DailyNetProfitPoint[] }) {
  if (!Array.isArray(points) || points.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-[11px] text-muted-foreground">
        No available daily Net Profit data.
      </div>
    );
  }

  // Sort by date and prepare chart data
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const chartData = sorted.map((p) => {
    const d = new Date(p.date);
    const dayLabel = d.getDate().toString().padStart(2, '0');
    return {
      day: dayLabel,
      net: p.net,
    };
  });

  return (
    <div className="mt-4 h-32 w-full md:h-40" role="img" aria-label={`Daily net profit chart for ${sorted.length} days. Values range from ${formatCurrency(Math.min(...sorted.map(p => p.net)), 'EUR')} to ${formatCurrency(Math.max(...sorted.map(p => p.net)), 'EUR')}.`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            {/* Line gradient */}
            <linearGradient id="netProfitStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>

            {/* Fill gradient */}
            <linearGradient id="netProfitFill" x1="0" y1="0" x2="0" y2="1">
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
            labelStyle={{
              fontSize: 10,
              color: '#94a3b8',
              marginBottom: 2,
            }}
            formatter={(value: any) => [
              formatCurrency(value as number, 'EUR'),
              'Net Profit',
            ]}
          />

          <Area
            type="monotone"
            dataKey="net"
            stroke="url(#netProfitStroke)"
            strokeWidth={2}
            fill="url(#netProfitFill)"
            dot={false}
            activeDot={{ r: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Vertical bar colors for each expense card
const EXPENSE_COLORS: Record<ExpenseKey, string> = {
  metaAds: '#38bdf8',
  tiktokAds: '#f97316',
  klaviyo: '#22c55e',
  collaborators: '#a855f7',
  variableCosts: '#eab308',
};

export default function ProfitStatsPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [data, setData] = useState<ProfitStatsDoc | null>(null);
  const [loading, setLoading] = useState(true);

  const [editingKey, setEditingKey] = useState<ExpenseKey | null>(null);
  const [tempExtra, setTempExtra] = useState('');
  const [savingExtra, setSavingExtra] = useState(false);

  // --------- Load data ----------
  useEffect(() => {
    if (!firestore) {
      setLoading(false);
      return;
    }
  
    let cancelled = false;
  
    const load = async () => {
      try {
        const ref = doc(firestore, 'metrics', 'profit-stats');
        const snap = await getDoc(ref);
  
        if (!snap.exists()) {
          // Document doesn't exist — create with dummy + dailyNetProfit
          const dailyNet = buildDummyDailyNetProfit(
            dummyProfitDoc.totalRevenue,
            dummyProfitDoc.expenses
          );
  
          const docToSave: ProfitStatsDoc = {
            ...dummyProfitDoc,
            dailyNetProfit: dailyNet,
          };
  
          await setDoc(ref, docToSave);
          if (!cancelled) {
            setData(docToSave);
          }
        } else {
          // Document exists — ensure it has dailyNetProfit
          const raw = snap.data() as any;
  
          if (!raw.dailyNetProfit || !Array.isArray(raw.dailyNetProfit)) {
            const dailyNet = buildDummyDailyNetProfit(
              raw.totalRevenue,
              raw.expenses
            );
  
            await updateDoc(ref, { dailyNetProfit: dailyNet });
            raw.dailyNetProfit = dailyNet;
          }
  
          if (!cancelled) {
            setData(raw as ProfitStatsDoc);
          }
        }
      } catch (error) {
        console.error('Error loading profit-stats:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
  
    load();
  
    return () => {
      cancelled = true;
    };
  }, [firestore]);

  if (loading || !data) {
    return (
      <div className="flex flex-col gap-6" role="status" aria-label="Loading profit stats">
        <div className="pt-1">
          <div className="h-10 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-64 mt-2 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/40 p-6 space-y-4">
          <div className="h-12 w-40 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
          <div className="h-32 w-full animate-pulse rounded-md bg-muted" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-2xl border border-white/15 bg-black/5 p-4 flex items-center gap-3 border-l-[3px]">
            <div className="flex flex-col gap-2 flex-1">
              <div className="h-4 w-32 animate-pulse rounded-md bg-muted" />
              <div className="h-3 w-20 animate-pulse rounded-md bg-muted" />
            </div>
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          </div>
        ))}
        <span className="sr-only">Loading profit statistics, please wait...</span>
      </div>
    );
  }

  const rawDaily = (data as any).dailyNetProfit;
  const dailyNetProfit: DailyNetProfitPoint[] = Array.isArray(rawDaily)
    ? rawDaily
    : [];

  const { currency, periodLabel, totalRevenue, expenses } = data;
  // Ensure the array exists and is sorted by date
  const safeDailyNet = Array.isArray(dailyNetProfit) ? dailyNetProfit : [];

  const sortedDailyNet = [...safeDailyNet].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // Final format for Recharts
  const chartData =
  sortedDailyNet.length === 0
    ? Array.from({ length: 10 }, (_, i) => ({
        day: (i + 1).toString().padStart(2, "0"),
        net: 0,
      }))
    : sortedDailyNet.map((point) => {
        const d = new Date(point.date);
        const dayLabel = d.getDate().toString().padStart(2, "0");
        return { day: dayLabel, net: point.net };
      });

  const totalExpenses = (Object.keys(expenses) as ExpenseKey[]).reduce(
    (acc, key) => {
      const item = expenses[key];
      return acc + item.base + item.extra;
    },
    0
  );

  const netProfit = totalRevenue - totalExpenses;
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const trendPositive = netProfit >= 0;

  // --------- Extra expenses ----------
  const handleStartEditExtra = (key: ExpenseKey) => {
    setEditingKey(key);
    setTempExtra('');
  };

  const handleCancelEditExtra = () => {
    setEditingKey(null);
    setTempExtra('');
  };

  const handleSaveExtra = async (key: ExpenseKey) => {
    if (!firestore || !data) return;

    const normalized = tempExtra.replace(',', '.');
    const parsed = parseFloat(normalized);

    if (isNaN(parsed)) {
      toast({
        variant: 'destructive',
        title: 'Invalid value',
        description: 'Please enter a valid numeric value.',
      });
      return;
    }

    const increment = parsed;
    const currentExtra = data.expenses[key]?.extra ?? 0;
    const newExtra = currentExtra + increment;

    setSavingExtra(true);
    try {
      const docRef = doc(firestore, 'metrics', 'profit-stats');
      await updateDoc(docRef, {
        [`expenses.${key}.extra`]: newExtra,
      });

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          expenses: {
            ...prev.expenses,
            [key]: {
              ...prev.expenses[key],
              extra: newExtra,
            },
          },
        };
      });

      toast({
        title: 'Extra applied',
        description: 'Expense updated successfully.',
      });

      setEditingKey(null);
      setTempExtra('');
    } catch (error: any) {
      console.error('Error saving extra:', error);
      toast({
        variant: 'destructive',
        title: 'Error saving',
        description:
          error?.message || 'Could not save the expense adjustment.',
      });
    } finally {
      setSavingExtra(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
            {/* HEADER */}
            <div className="pt-1">
        <div className="flex items-center gap-3">
          <h1 className="font-headline text-3xl md:text-4xl font-bold tracking-tight">
            Profit Stats
          </h1>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-yellow-400/60 bg-yellow-400/10 px-2.5 py-0.5">
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
            <span className="text-[11px] font-medium tracking-wide text-yellow-200">
              UNDER CONSTRUCTION
            </span>
          </div>
        </div>

        <p className="text-muted-foreground max-w-xl text-sm mt-1">
          Financial snapshot from MisterTuga · {periodLabel}
        </p>
      </div>

      {/* NET PROFIT CARD + CHART */}
      <Card
          aria-label={`Net profit: ${formatCurrency(netProfit, currency)}. Revenue: ${formatCurrency(totalRevenue, currency)}, Expenses: ${formatCurrency(totalExpenses, currency)}, Margin: ${netMargin.toFixed(1)}%`}
          className="relative overflow-hidden rounded-2xl border border-white/8 bg-black/40
             shadow-[0_14px_35px_rgba(0,0,0,0.55)]
             after:pointer-events-none after:absolute after:inset-x-8 after:-bottom-6
             after:h-8 after:rounded-full after:bg-purple-500/25 after:blur-2" >      
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-1">
          <div className="space-y-1">
            <CardDescription className="text-[11px] uppercase tracking-[0.18em] text-slate-300/80">
              Net Profit
            </CardDescription>
            <div className="flex items-baseline gap-2">
              <p className="text-4xl md:text-5xl font-semibold tabular-nums tracking-tight">
                {formatCurrency(netProfit, currency)}
              </p>

            </div>

            <div className="flex gap-4 text-[11px] text-muted-foreground">
              <span>{formatCurrency(totalRevenue, currency)} revenue</span>
              <span>{formatCurrency(totalExpenses, currency)} expenses</span>
            </div>
          </div>

          <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-[11px]">
          {trendPositive ? (
            <>
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-300">
                {netMargin.toFixed(1)}%
              </span>
            </>
          ) : (
            <>
              <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
              <span className="text-red-300">
                {netMargin.toFixed(1)}%
              </span>
            </>
          )}
        </div>
        </CardHeader>

        <CardContent className="pt-0">
          <NetProfitLineChart points={dailyNetProfit} />
        </CardContent>
      </Card>

      {/* EXPENSE CARDS */}
      <div className="flex flex-col gap-3">
        {(Object.keys(expenses) as ExpenseKey[]).map((key) => {
          const item = expenses[key];
          const total = item.base + item.extra;
          const color = EXPENSE_COLORS[key] ?? '#64748b';
          const isEditing = editingKey === key;

          return (
            <Card
            key={key}
            className="rounded-2xl border border-l-[3px] bg-black/5 border-white/15
                       backdrop-blur-md shadow-[0_18px_30px_rgba(0,0,0,0.25)]"
            style={{ borderLeftColor: expenseAccentColors[key] }}
          >
            <CardContent className="flex w-full items-center gap-3 p-3.5">
              {/* Expense info */}
              <div className="flex flex-col">
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(total, currency)}
                </span>
              </div>
    
              {/* Action buttons — right-aligned */}
              {isEditing ? (
                <div className="ml-auto flex items-center gap-1">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={tempExtra}
                    onChange={(e) => {
                      const raw = e.target.value;
    
                      if (raw === '') {
                        setTempExtra('');
                        return;
                      }
    
                      // Only digits and one decimal separator
                      const normalized = raw.replace(/,/g, '.');
                      const isValid = /^\d*\.?\d*$/.test(normalized);
    
                      if (isValid) {
                        setTempExtra(raw);
                      }
                    }}
                    className="h-8 w-24 text-xs bg-black/60"
                    placeholder="+0,00"
                    autoFocus
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    disabled={savingExtra}
                    type="button"
                    aria-label="Save extra expense"
                    onClick={() => handleSaveExtra(key)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    type="button"
                    aria-label="Cancel"
                    onClick={handleCancelEditExtra}
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="ml-auto">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 rounded-full border-dashed border-white/30 bg-black/30"
                    aria-label={`Add extra expense to ${item.label}`}
                    onClick={() => handleStartEditExtra(key)}
                  >
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          );
        })}
      </div>
    </div>
  );
}