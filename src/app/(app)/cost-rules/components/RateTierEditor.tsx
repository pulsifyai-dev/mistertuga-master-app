'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import type { RateTier } from '../types';

interface RateTierEditorProps {
  tiers: RateTier[];
  onChange: (tiers: RateTier[]) => void;
}

export function RateTierEditor({ tiers, onChange }: RateTierEditorProps) {
  const addTier = () => {
    const lastMax = tiers.length > 0 ? tiers[tiers.length - 1].max_qty + 1 : 1;
    onChange([...tiers, { min_qty: lastMax, max_qty: lastMax + 49, rate: 0 }]);
  };

  const removeTier = (index: number) => {
    onChange(tiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: keyof RateTier, value: number) => {
    const updated = tiers.map((tier, i) =>
      i === index ? { ...tier, [field]: value } : tier
    );
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Rate Tiers</span>
        <Button type="button" variant="outline" size="sm" onClick={addTier} className="h-7 text-xs">
          <Plus className="h-3 w-3 mr-1" />
          Add Tier
        </Button>
      </div>

      {tiers.length === 0 && (
        <p className="text-xs text-muted-foreground py-2">
          No tiers configured. The base rate will be used for all quantities.
        </p>
      )}

      {tiers.length > 0 && (
        <div className="space-y-1">
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs text-muted-foreground px-1">
            <span>Min Qty</span>
            <span>Max Qty</span>
            <span>Rate (USD)</span>
            <span className="w-7" />
          </div>
          {tiers.map((tier, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
              <Input
                type="number"
                min={0}
                value={tier.min_qty}
                onChange={(e) => updateTier(index, 'min_qty', parseInt(e.target.value) || 0)}
                className="h-8 text-sm"
              />
              <Input
                type="number"
                min={1}
                value={tier.max_qty}
                onChange={(e) => updateTier(index, 'max_qty', parseInt(e.target.value) || 1)}
                className="h-8 text-sm"
              />
              <Input
                type="number"
                min={0}
                step={0.01}
                value={tier.rate}
                onChange={(e) => updateTier(index, 'rate', parseFloat(e.target.value) || 0)}
                className="h-8 text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeTier(index)}
                className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
