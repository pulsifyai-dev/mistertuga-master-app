'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Plus, Pencil, Trash2, Loader2, Lock, RefreshCw } from 'lucide-react';
import { listCostRules, createCostRule, updateCostRule, deleteCostRule, recalculateAllCosts } from './actions';
import { CostRuleDialog } from './components/CostRuleDialog';
import { CostPreview } from './components/CostPreview';
import type { CostRule, CostRuleInput } from './types';

export default function CostRulesPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [rules, setRules] = useState<CostRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CostRule | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  const fetchRules = useCallback(async () => {
    const result = await listCostRules();
    if (result.success) {
      setRules(result.rules);
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (!authLoading && isAdmin) fetchRules();
    else if (!authLoading) setLoading(false);
  }, [authLoading, isAdmin, fetchRules]);

  const handleCreate = async (data: CostRuleInput) => {
    const result = await createCostRule(data);
    if (result.success) {
      toast({ title: 'Cost rule created' });
      fetchRules();
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleUpdate = async (data: CostRuleInput) => {
    if (!editingRule) return;
    const result = await updateCostRule(editingRule.id, data);
    if (result.success) {
      toast({ title: 'Cost rule updated' });
      fetchRules();
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    const result = await recalculateAllCosts();
    if (result.success) {
      toast({ title: `Costs recalculated: ${result.calculated} orders, ${result.skipped} skipped` });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
    setRecalculating(false);
  };

  const handleDelete = async (id: string) => {
    const result = await deleteCostRule(id);
    if (result.success) {
      toast({ title: 'Cost rule deleted' });
      fetchRules();
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const openCreate = () => {
    setEditingRule(null);
    setDialogOpen(true);
  };

  const openEdit = (rule: CostRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-2">
        <Lock className="h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    );
  }

  const grouped = {
    production: rules.filter((r) => r.rule_type === 'production'),
    shipping: rules.filter((r) => r.rule_type === 'shipping'),
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-7 w-7 text-purple-400" />
            Cost Rules
          </h1>
          <p className="text-muted-foreground">
            Configure production and shipping cost rates per country.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRecalculate}
            disabled={recalculating}
          >
            {recalculating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Recalculate All
          </Button>
          <Button onClick={openCreate} className="bg-purple-600 text-white hover:bg-purple-500">
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
          </Button>
        </div>
      </div>

      {/* Cost Preview */}
      <Card className="border-white/10 bg-black/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cost Preview</CardTitle>
          <CardDescription>Estimate cost for a sample order.</CardDescription>
        </CardHeader>
        <CardContent>
          <CostPreview rules={rules} />
        </CardContent>
      </Card>

      {/* Production Rules */}
      <Card className="border-white/10 bg-black/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Production Rules</CardTitle>
          <CardDescription>Per-item manufacturing cost rates.</CardDescription>
        </CardHeader>
        <CardContent>
          {grouped.production.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No production rules configured.
            </p>
          ) : (
            <div className="space-y-2">
              {grouped.production.map((rule) => (
                <RuleRow key={rule.id} rule={rule} onEdit={openEdit} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shipping Rules */}
      <Card className="border-white/10 bg-black/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Shipping Rules</CardTitle>
          <CardDescription>Per-item shipping cost rates by country.</CardDescription>
        </CardHeader>
        <CardContent>
          {grouped.shipping.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No shipping rules configured.
            </p>
          ) : (
            <div className="space-y-2">
              {grouped.shipping.map((rule) => (
                <RuleRow key={rule.id} rule={rule} onEdit={openEdit} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CostRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editingRule}
        onSubmit={editingRule ? handleUpdate : handleCreate}
      />
    </div>
  );
}

function RuleRow({
  rule,
  onEdit,
  onDelete,
}: {
  rule: CostRule;
  onEdit: (rule: CostRule) => void;
  onDelete: (id: string) => void;
}) {
  const tierCount = rule.rate_tiers?.length ?? 0;

  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-3 hover:bg-white/[0.02] transition-colors">
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{rule.name}</span>
          <Badge variant="outline" className="text-[10px] h-5">
            {rule.country_code}
          </Badge>
          {!rule.is_active && (
            <Badge variant="secondary" className="text-[10px] h-5 text-yellow-400">
              Inactive
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          Base: ${rule.base_rate?.toFixed(2) ?? '—'}
          {tierCount > 0 && ` · ${tierCount} tier${tierCount > 1 ? 's' : ''}`}
          {rule.effective_from && ` · From ${rule.effective_from}`}
          {rule.effective_to && ` to ${rule.effective_to}`}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(rule)}
          className="h-8 w-8 hover:bg-purple-500/20"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(rule.id)}
          className="h-8 w-8 text-red-400 hover:bg-red-500/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
