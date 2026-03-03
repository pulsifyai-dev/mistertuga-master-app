'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/supabase/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { batchCalculateOrderCosts } from '@/lib/cost-engine';
import { costRuleSchema, type CostRule, type CostRuleInput } from './types';

const PATH = '/cost-rules';

export async function listCostRules() {
  try {
    await requireAdmin();
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('cost_rules')
      .select('*')
      .order('country_code', { ascending: true })
      .order('rule_type', { ascending: true });

    if (error) {
      return { success: false as const, error: error.message, rules: [] as CostRule[] };
    }
    return { success: true as const, rules: (data ?? []) as CostRule[] };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg, rules: [] as CostRule[] };
  }
}

export async function createCostRule(data: CostRuleInput) {
  const validation = costRuleSchema.safeParse(data);
  if (!validation.success) {
    return { success: false as const, error: 'Invalid input.' };
  }

  try {
    const { user } = await requireAdmin();
    const rl = rateLimit(`costRule:${user.id}`, 20, 60_000);
    if (!rl.success) {
      return { success: false as const, error: 'Too many requests.' };
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from('cost_rules').insert(validation.data);

    if (error) {
      console.error('Error creating cost rule:', error);
      return { success: false as const, error: 'Failed to create cost rule.' };
    }

    revalidatePath(PATH);
    return { success: true as const };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg };
  }
}

export async function updateCostRule(id: string, data: CostRuleInput) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { success: false as const, error: 'Invalid ID.' };
  }
  const validation = costRuleSchema.safeParse(data);
  if (!validation.success) {
    return { success: false as const, error: 'Invalid input.' };
  }

  try {
    const { user } = await requireAdmin();
    const rl = rateLimit(`costRule:${user.id}`, 20, 60_000);
    if (!rl.success) {
      return { success: false as const, error: 'Too many requests.' };
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('cost_rules')
      .update({ ...validation.data, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error updating cost rule:', error);
      return { success: false as const, error: 'Failed to update cost rule.' };
    }

    revalidatePath(PATH);
    return { success: true as const };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg };
  }
}

export async function recalculateAllCosts() {
  try {
    const { user } = await requireAdmin();
    const rl = rateLimit(`batchCost:${user.id}`, 2, 60_000);
    if (!rl.success) {
      return { success: false as const, error: 'Too many requests. Wait before recalculating.' };
    }

    const supabase = createServiceClient();
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id')
      .is('deleted_at', null);

    if (error) {
      return { success: false as const, error: error.message };
    }

    const orderIds = (orders ?? []).map((o: { id: string }) => o.id);
    const result = await batchCalculateOrderCosts(orderIds);

    revalidatePath('/master-shopify-orders');
    revalidatePath(PATH);
    return { success: true as const, ...result };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg };
  }
}

export async function deleteCostRule(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { success: false as const, error: 'Invalid ID.' };
  }
  try {
    const { user } = await requireAdmin();
    const rl = rateLimit(`costRule:${user.id}`, 20, 60_000);
    if (!rl.success) {
      return { success: false as const, error: 'Too many requests.' };
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('cost_rules')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting cost rule:', error);
      return { success: false as const, error: 'Failed to delete cost rule.' };
    }

    revalidatePath(PATH);
    return { success: true as const };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg };
  }
}
