'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { RateTierEditor } from './RateTierEditor';
import type { CostRule, CostRuleInput, RateTier } from '../types';

const COUNTRIES = [
  { code: 'PT', name: 'Portugal' },
  { code: 'ES', name: 'Spain' },
  { code: 'DE', name: 'Germany' },
];

interface CostRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: CostRule | null;
  onSubmit: (data: CostRuleInput) => Promise<void>;
}

export function CostRuleDialog({ open, onOpenChange, rule, onSubmit }: CostRuleDialogProps) {
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('PT');
  const [ruleType, setRuleType] = useState<'production' | 'shipping'>('production');
  const [baseRate, setBaseRate] = useState<string>('0');
  const [tiers, setTiers] = useState<RateTier[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setCountryCode(rule.country_code || 'PT');
      setRuleType(rule.rule_type);
      setBaseRate(rule.base_rate?.toString() ?? '0');
      setTiers(rule.rate_tiers ?? []);
      setIsActive(rule.is_active);
      setEffectiveFrom(rule.effective_from ?? '');
      setEffectiveTo(rule.effective_to ?? '');
    } else {
      setName('');
      setCountryCode('PT');
      setRuleType('production');
      setBaseRate('0');
      setTiers([]);
      setIsActive(true);
      setEffectiveFrom('');
      setEffectiveTo('');
    }
  }, [rule, open]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSubmit({
        name,
        country_code: countryCode,
        rule_type: ruleType,
        base_rate: parseFloat(baseRate) || null,
        rate_tiers: tiers.length > 0 ? tiers : null,
        is_active: isActive,
        effective_from: effectiveFrom || null,
        effective_to: effectiveTo || null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit Cost Rule' : 'Add Cost Rule'}</DialogTitle>
          <DialogDescription>
            {rule ? 'Update the cost rule configuration.' : 'Create a new production or shipping cost rule.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="rule-name">Name</Label>
            <Input
              id="rule-name"
              placeholder="e.g. PT Production Rate"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={ruleType} onValueChange={(v) => setRuleType(v as 'production' | 'shipping')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="shipping">Shipping</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="base-rate">Base Rate (USD)</Label>
            <Input
              id="base-rate"
              type="number"
              min={0}
              step={0.01}
              placeholder="0.00"
              value={baseRate}
              onChange={(e) => setBaseRate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Fallback rate when no tier matches. Used if no tiers are configured.
            </p>
          </div>

          <RateTierEditor tiers={tiers} onChange={setTiers} />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="effective-from">Effective From</Label>
              <Input
                id="effective-from"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="effective-to">Effective To</Label>
              <Input
                id="effective-to"
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="is-active" />
            <Label htmlFor="is-active">Active</Label>
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            className="bg-purple-600 text-white hover:bg-purple-500"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {rule ? 'Save Changes' : 'Create Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
