'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ArrowUpRight, ArrowDownRight, Plus, Check, X as XIcon } from 'lucide-react';

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

type ExpenseKey =
  | 'metaAds'
  | 'tiktokAds'
  | 'klaviyo'
  | 'collaborators'
  | 'variableCosts';

interface ExpenseItem {
  label: string;
  base: number;
  extra: number;
}

interface DailyNetPoint {
  date: string; // "2025-12-01"
  net: number;
}

interface ProfitStatsDoc {
  periodLabel: string;
  currency: 'EUR';
  totalRevenue: number;
  expenses: Record<ExpenseKey, ExpenseItem>;
  dailyNetProfit?: DailyNetPoint[];
}

// ----- Dummy inicial (grava se não existir) -----
const dummyProfitDoc: ProfitStatsDoc = {
  periodLabel: 'Últimos 30 dias',
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
      label: 'Colaboradores / Equipa',
      base: 13500,
      extra: 0,
      color: '#38bdf8',
      recurring: true,
    },
    variableCosts: {
      label: 'Custos Variáveis (embalagens, portes, etc.)',
      base: 8900,
      extra: 0,
      color: '#f97316',
      recurring: true,
    },
  },
};

const expenseAccentColors: Record<ExpenseKey, string> = {
  metaAds: "#a855f7",        // roxo
  tiktokAds: "#ec4899",      // rosa
  klaviyo: "#22c55e",        // verde
  collaborators: "#38bdf8",  // azul
  variableCosts: "#f59e0b",  // laranja
};

function formatCurrency(value: number, currency: string = 'EUR') {
  return value.toLocaleString('pt-PT', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Gráfico de linha suave, minimal, ao estilo do dashboard do Shopify.
 */
function NetProfitLineChart({ points }: { points?: DailyNetPoint[] }) {
  if (!Array.isArray(points) || points.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-[11px] text-muted-foreground">
        Sem dados diários de net profit.
      </div>
    );
  }

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const values = sorted.map((p) => p.net);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const n = sorted.length;

  const getX = (idx: number) => (n === 1 ? 50 : (idx / (n - 1)) * 100);
  const getY = (value: number) => {
    const norm = (value - min) / range;
    const top = 15;
    const bottom = 90;
    return bottom - norm * (bottom - top);
  };

  const pathD = sorted
    .map((p, idx) => {
      const x = getX(idx);
      const y = getY(p.net);
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <div className="mt-3 h-28 w-full">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <defs>
          <linearGradient id="netProfitLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
          <linearGradient id="netProfitFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(168,85,247,0.28)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0)" />
          </linearGradient>
        </defs>

        {/* Área */}
        <path
          d={`${pathD} L 100 100 L 0 100 Z`}
          fill="url(#netProfitFill)"
          stroke="none"
        />

        {/* Linha */}
        <path
          d={pathD}
          fill="none"
          stroke="url(#netProfitLine)"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Pontos */}
        {sorted.map((p, idx) => {
          const x = getX(idx);
          const y = getY(p.net);
          return (
            <circle
              key={p.date}
              cx={x}
              cy={y}
              r={1.3}
              fill="#020617"
              stroke="#22d3ee"
              strokeWidth={0.5}
            />
          );
        })}
      </svg>
    </div>
  );
}

// cores para barra vertical de cada despesa (tipo cor do país nas orders)
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

  // --------- Load Firestore ----------
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
          await setDoc(ref, dummyProfitDoc);
          if (!cancelled) setData(dummyProfitDoc);
        } else {
          const raw = snap.data() as ProfitStatsDoc;
          if (!cancelled) setData(raw);
        }
      } catch (err) {
        console.error('Erro a carregar profit-stats:', err);
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
      <div className="flex h-[300px] w-full items-center justify-center text-sm text-muted-foreground">
        A carregar métricas de lucro…
      </div>
    );
  }

  const { currency, periodLabel, totalRevenue, expenses } = data;

  const rawDaily = (data as any).dailyNetProfit;
  const dailyNetProfit: DailyNetPoint[] = Array.isArray(rawDaily)
    ? rawDaily
    : [];

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

  // --------- Extras ----------
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
        title: 'Valor inválido',
        description: 'Insere um valor numérico válido.',
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
        title: 'Extra aplicado',
        description: 'Despesa atualizada com sucesso.',
      });

      setEditingKey(null);
      setTempExtra('');
    } catch (error: any) {
      console.error('Erro a guardar extra:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao guardar',
        description:
          error?.message || 'Não foi possível guardar o ajuste de despesa.',
      });
    } finally {
      setSavingExtra(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* HEADER (minimal, igual vibe ao Shopify Orders) */}
      <div className="pt-1">
        <h1 className="font-headline text-3xl md:text-4xl font-bold tracking-tight">
          Profit Stats
        </h1>
        <p className="text-muted-foreground max-w-xl text-sm mt-1">
          Snapshot financeiro da MisterTuga · {periodLabel}
        </p>
      </div>

      {/* CARD PRINCIPAL NET PROFIT + GRÁFICO */}
      <Card
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
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-muted-foreground">
                {netMargin.toFixed(1)}%
              </span>
            </div>

            <div className="flex gap-4 text-[11px] text-muted-foreground">
              <span>{formatCurrency(totalRevenue, currency)} revenue</span>
              <span>{formatCurrency(totalExpenses, currency)} despesas</span>
            </div>
          </div>

          <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-[11px]">
            {trendPositive ? (
              <>
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-300">Saudável</span>
              </>
            ) : (
              <>
                <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
                <span className="text-red-300">Atenção</span>
              </>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <NetProfitLineChart points={dailyNetProfit} />
        </CardContent>
      </Card>

      {/* DESPESAS – CADA UMA NUM CARD COMO AS ORDERS */}
      <div className="flex flex-col gap-3">
        {(Object.keys(expenses) as ExpenseKey[]).map((key) => {
          const item = expenses[key];
          const total = item.base + item.extra;
          const color = EXPENSE_COLORS[key] ?? '#64748b';
          const isEditing = editingKey === key;

          return (
            <Card
              key={key}
              className="flex flex-col gap-2 rounded-2xl px-3.5 py-3
              md:flex-row md:items-center md:justify-between
              border bg-black/5 border-white/15
              backdrop-blur-md shadow-[0_18px_30px_rgba(0,0,0,0.25)]"              
              style={{
                borderLeftWidth: 3,
                borderLeftColor: expenseAccentColors[key],
              }}
            >
              <CardContent className="flex items-center justify-between gap-3 p-3.5">
                <div className="flex flex-col">
                <span className="text-sm font-medium">{item.label}</span>                  
                <span className="text-xs text-muted-foreground">
                    {formatCurrency(total, currency)}
                  </span>
                </div>

                {/* Zona direita super minimal: botão + ou modo edição */}
                {isEditing ? (
                  <div className="flex items-center gap-1">
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

                        // apenas dígitos e um separador decimal
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
                      onClick={() => handleSaveExtra(key)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      type="button"
                      onClick={handleCancelEditExtra}
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 rounded-full border-dashed border-white/30 bg-black/30"
                    onClick={() => handleStartEditExtra(key)}
                  >
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}