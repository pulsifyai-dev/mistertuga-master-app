import { z } from 'zod';

// --- Rate Tier ---

export const rateTierSchema = z.object({
  min_qty: z.number().int().min(0),
  max_qty: z.number().int().min(1),
  rate: z.number().min(0),
});

export type RateTier = z.infer<typeof rateTierSchema>;

// --- Cost Rule ---

export const costRuleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  country_code: z.string().min(2).max(3),
  rule_type: z.enum(['production', 'shipping']),
  base_rate: z.number().min(0).nullable(),
  rate_tiers: z.array(rateTierSchema).nullable(),
  is_active: z.boolean().default(true),
  effective_from: z.string().nullable(),
  effective_to: z.string().nullable(),
});

export type CostRuleInput = z.infer<typeof costRuleSchema>;

export type CostRule = CostRuleInput & {
  id: string;
  created_at: string;
  updated_at: string;
};
