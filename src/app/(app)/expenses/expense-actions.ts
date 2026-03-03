'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/supabase/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

// --- Types ---

export type ExpenseCategory = {
  id: string;
  name: string;
  category: 'software' | 'service' | 'subscription' | 'other' | null;
  fixed_monthly_cost: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
};

export type ManualExpense = {
  id: string;
  category_id: string | null;
  description: string;
  amount: number;
  date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  expense_categories?: { name: string; category: string | null } | null;
};

// --- Expense Categories CRUD ---

export async function listExpenseCategories() {
  try {
    await requireAdmin();
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('expense_categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) return { success: false as const, error: error.message, categories: [] as ExpenseCategory[] };
    return { success: true as const, categories: (data ?? []) as ExpenseCategory[] };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg, categories: [] as ExpenseCategory[] };
  }
}

export async function createExpenseCategory(data: {
  name: string;
  category?: string;
  fixed_monthly_cost?: number | null;
  notes?: string;
}) {
  try {
    const { user } = await requireAdmin();
    const rl = rateLimit(`expenseCat:${user.id}`, 10, 60_000);
    if (!rl.success) return { success: false as const, error: 'Too many requests.' };

    const supabase = createServiceClient();
    const { error } = await supabase.from('expense_categories').insert({
      name: data.name,
      category: data.category || null,
      fixed_monthly_cost: data.fixed_monthly_cost ?? null,
      notes: data.notes || null,
      created_by: user.id,
    });

    if (error) return { success: false as const, error: error.message };
    revalidatePath('/settings');
    revalidatePath('/expenses');
    return { success: true as const };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg };
  }
}

export async function updateExpenseCategory(
  id: string,
  data: { name?: string; category?: string; fixed_monthly_cost?: number | null; notes?: string; is_active?: boolean }
) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { success: false as const, error: 'Invalid ID.' };
  }
  try {
    const { user } = await requireAdmin();
    const rl = rateLimit(`expenseCat:${user.id}`, 10, 60_000);
    if (!rl.success) return { success: false as const, error: 'Too many requests.' };

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('expense_categories')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return { success: false as const, error: error.message };
    revalidatePath('/settings');
    revalidatePath('/expenses');
    return { success: true as const };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg };
  }
}

export async function deleteExpenseCategory(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { success: false as const, error: 'Invalid ID.' };
  }
  try {
    const { user } = await requireAdmin();
    const rl = rateLimit(`expenseCat:${user.id}`, 10, 60_000);
    if (!rl.success) return { success: false as const, error: 'Too many requests.' };

    const supabase = createServiceClient();
    const { error } = await supabase.from('expense_categories').delete().eq('id', id);

    if (error) return { success: false as const, error: error.message };
    revalidatePath('/settings');
    revalidatePath('/expenses');
    return { success: true as const };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg };
  }
}

// --- Manual Expenses CRUD ---

export async function listManualExpenses(filters?: {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
}) {
  try {
    await requireAdmin();
    const supabase = createServiceClient();
    let query = supabase
      .from('manual_expenses')
      .select('*, expense_categories(name, category)')
      .order('date', { ascending: false });

    if (filters?.startDate) query = query.gte('date', filters.startDate);
    if (filters?.endDate) query = query.lte('date', filters.endDate);
    if (filters?.categoryId) query = query.eq('category_id', filters.categoryId);

    const { data, error } = await query;

    if (error) return { success: false as const, error: error.message, expenses: [] as ManualExpense[] };
    return { success: true as const, expenses: (data ?? []) as ManualExpense[] };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg, expenses: [] as ManualExpense[] };
  }
}

export async function createManualExpense(data: {
  description: string;
  amount: number;
  date: string;
  category_id?: string | null;
  notes?: string;
}) {
  try {
    const { user } = await requireAdmin();
    const rl = rateLimit(`expense:${user.id}`, 20, 60_000);
    if (!rl.success) return { success: false as const, error: 'Too many requests.' };

    const supabase = createServiceClient();
    const { error } = await supabase.from('manual_expenses').insert({
      description: data.description,
      amount: data.amount,
      date: data.date,
      category_id: data.category_id || null,
      notes: data.notes || null,
      created_by: user.id,
    });

    if (error) return { success: false as const, error: error.message };
    revalidatePath('/expenses');
    revalidatePath('/profit-stats');
    return { success: true as const };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg };
  }
}

export async function updateManualExpense(
  id: string,
  data: { description?: string; amount?: number; date?: string; category_id?: string | null; notes?: string }
) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { success: false as const, error: 'Invalid ID.' };
  }
  try {
    const { user } = await requireAdmin();
    const rl = rateLimit(`expense:${user.id}`, 20, 60_000);
    if (!rl.success) return { success: false as const, error: 'Too many requests.' };

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('manual_expenses')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return { success: false as const, error: error.message };
    revalidatePath('/expenses');
    revalidatePath('/profit-stats');
    return { success: true as const };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg };
  }
}

export async function deleteManualExpense(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { success: false as const, error: 'Invalid ID.' };
  }
  try {
    const { user } = await requireAdmin();
    const rl = rateLimit(`expense:${user.id}`, 20, 60_000);
    if (!rl.success) return { success: false as const, error: 'Too many requests.' };

    const supabase = createServiceClient();
    const { error } = await supabase.from('manual_expenses').delete().eq('id', id);

    if (error) return { success: false as const, error: error.message };
    revalidatePath('/expenses');
    revalidatePath('/profit-stats');
    return { success: true as const };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg };
  }
}

// --- Aggregation for Profit Dashboard ---

export async function getExpenseSummary(startDate: string, endDate: string) {
  try {
    await requireAdmin();
    const supabase = createServiceClient();

    // Fetch manual expenses in range
    const { data: expenses, error: expError } = await supabase
      .from('manual_expenses')
      .select('amount, date, expense_categories(name, category)')
      .gte('date', startDate)
      .lte('date', endDate);

    if (expError) return { success: false as const, error: expError.message };

    // Fetch active categories with fixed monthly costs
    const { data: rawCategories, error: catError } = await supabase
      .from('expense_categories')
      .select('name, category, fixed_monthly_cost')
      .eq('is_active', true)
      .not('fixed_monthly_cost', 'is', null);

    if (catError) return { success: false as const, error: catError.message };

    const categories = (rawCategories ?? []) as Array<{ name: string; category: string | null; fixed_monthly_cost: number | null }>;

    // Aggregate manual expenses by category
    const byCategory: Record<string, number> = {};
    let manualTotal = 0;

    for (const exp of expenses ?? []) {
      const catName = (exp.expense_categories as unknown as { name: string } | null)?.name ?? 'Uncategorized';
      byCategory[catName] = (byCategory[catName] ?? 0) + Number(exp.amount);
      manualTotal += Number(exp.amount);
    }

    // Calculate fixed monthly costs total
    let fixedMonthlyTotal = 0;
    for (const c of categories) {
      fixedMonthlyTotal += Number(c.fixed_monthly_cost ?? 0);
    }

    const fixedCosts = categories.map((c) => ({
      name: c.name,
      category: c.category,
      amount: Number(c.fixed_monthly_cost),
    }));

    return {
      success: true as const,
      manualTotal: Math.round(manualTotal * 100) / 100,
      fixedMonthlyTotal: Math.round(fixedMonthlyTotal * 100) / 100,
      total: Math.round((manualTotal + fixedMonthlyTotal) * 100) / 100,
      byCategory,
      fixedCosts,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return { success: false as const, error: msg };
  }
}
