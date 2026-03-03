'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { findTierRate } from '@/lib/cost-utils';
import type { CostRule } from '../types';

interface CostPreviewProps {
  rules: CostRule[];
}

export function CostPreview({ rules }: CostPreviewProps) {
  const [quantity, setQuantity] = useState<string>('10');
  const [country, setCountry] = useState('PT');

  const qty = parseInt(quantity) || 0;

  const productionRule = rules.find(
    (r) => r.country_code === country && r.rule_type === 'production' && r.is_active
  );
  const shippingRule = rules.find(
    (r) => r.country_code === country && r.rule_type === 'shipping' && r.is_active
  );

  const productionRate = productionRule
    ? findTierRate(productionRule.rate_tiers, productionRule.base_rate, qty)
    : 0;
  const shippingRate = shippingRule
    ? findTierRate(shippingRule.rate_tiers, shippingRule.base_rate, qty)
    : 0;

  const productionCost = Math.round(productionRate * qty * 100) / 100;
  const shippingCost = Math.round(shippingRate * qty * 100) / 100;
  const totalCost = Math.round((productionCost + shippingCost) * 100) / 100;

  const countries = [...new Set(rules.map((r) => r.country_code))].filter(Boolean);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Country</Label>
          <div className="flex gap-1">
            {(countries.length > 0 ? countries : ['PT', 'ES', 'DE']).map((c) => (
              <Button
                key={c}
                type="button"
                variant={country === c ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setCountry(c!)}
              >
                {c}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="preview-qty" className="text-xs">Quantity</Label>
          <Input
            id="preview-qty"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="h-7 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md border border-white/10 p-2">
          <p className="text-[10px] text-muted-foreground uppercase">Production</p>
          <p className="text-sm font-semibold">${productionCost.toFixed(2)}</p>
          {productionRule && (
            <p className="text-[10px] text-muted-foreground">${productionRate.toFixed(2)}/item</p>
          )}
          {!productionRule && (
            <p className="text-[10px] text-yellow-400">No rule</p>
          )}
        </div>
        <div className="rounded-md border border-white/10 p-2">
          <p className="text-[10px] text-muted-foreground uppercase">Shipping</p>
          <p className="text-sm font-semibold">${shippingCost.toFixed(2)}</p>
          {shippingRule && (
            <p className="text-[10px] text-muted-foreground">${shippingRate.toFixed(2)}/item</p>
          )}
          {!shippingRule && (
            <p className="text-[10px] text-yellow-400">No rule</p>
          )}
        </div>
        <div className="rounded-md border border-purple-500/30 bg-purple-500/5 p-2">
          <p className="text-[10px] text-muted-foreground uppercase">Total</p>
          <p className="text-sm font-bold text-purple-400">${totalCost.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">USD</p>
        </div>
      </div>
    </div>
  );
}
