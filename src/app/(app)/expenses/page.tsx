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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Pencil, Trash2, Receipt, Filter } from 'lucide-react';
import {
  listExpenseCategories,
  listManualExpenses,
  createManualExpense,
  updateManualExpense,
  deleteManualExpense,
  type ExpenseCategory,
  type ManualExpense,
} from './expense-actions';
import { formatCurrency } from '@/lib/format';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Get current month date range
function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

export default function ExpensesPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();

  // Data state
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<ManualExpense[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [filterStartDate, setFilterStartDate] = useState(getCurrentMonthRange().startDate);
  const [filterEndDate, setFilterEndDate] = useState(getCurrentMonthRange().endDate);
  const [filterCategory, setFilterCategory] = useState('all');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ManualExpense | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formCategory, setFormCategory] = useState('none');
  const [formNotes, setFormNotes] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [catResult, expResult] = await Promise.all([
      listExpenseCategories(),
      listManualExpenses({
        startDate: filterStartDate,
        endDate: filterEndDate,
        categoryId: filterCategory !== 'all' ? filterCategory : undefined,
      }),
    ]);

    if (catResult.success) setCategories(catResult.categories);
    if (expResult.success) setExpenses(expResult.expenses);
    setLoading(false);
  }, [filterStartDate, filterEndDate, filterCategory]);

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin, fetchData]);

  const resetForm = () => {
    setEditingExpense(null);
    setFormDescription('');
    setFormAmount('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormCategory('none');
    setFormNotes('');
  };

  const openNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (exp: ManualExpense) => {
    setEditingExpense(exp);
    setFormDescription(exp.description);
    setFormAmount(String(exp.amount));
    setFormDate(exp.date);
    setFormCategory(exp.category_id ?? 'none');
    setFormNotes(exp.notes ?? '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formDescription.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Description is required.' });
      return;
    }

    const amountParsed = parseFloat(formAmount.replace(',', '.'));
    if (isNaN(amountParsed) || amountParsed <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Enter a valid positive amount.' });
      return;
    }

    if (!formDate) {
      toast({ variant: 'destructive', title: 'Error', description: 'Date is required.' });
      return;
    }

    setSaving(true);
    const payload = {
      description: formDescription.trim(),
      amount: Math.round(amountParsed * 100) / 100,
      date: formDate,
      category_id: formCategory !== 'none' ? formCategory : null,
      notes: formNotes.trim() || undefined,
    };

    const result = editingExpense
      ? await updateManualExpense(editingExpense.id, payload)
      : await createManualExpense(payload);

    if (result.success) {
      toast({ title: editingExpense ? 'Expense Updated' : 'Expense Added' });
      setDialogOpen(false);
      resetForm();
      fetchData();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this expense?')) return;
    const result = await deleteManualExpense(id);
    if (result.success) {
      toast({ title: 'Expense Deleted' });
      fetchData();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  };

  // Calculate totals
  const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const byCategory: Record<string, number> = {};
  for (const exp of expenses) {
    const catName = (exp.expense_categories as { name: string } | null)?.name ?? 'Uncategorized';
    byCategory[catName] = (byCategory[catName] ?? 0) + Number(exp.amount);
  }

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-center gap-2">
        <Receipt className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">Expense management is available to admins only.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground text-sm">Track manual expenses and recurring service costs.</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Add Expense
        </Button>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl border border-white/8 bg-black/40">
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-40 h-9 text-xs bg-black/60"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-40 h-9 text-xs bg-black/60"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Category</Label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-44 h-9 text-xs bg-black/60">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" className="h-9" onClick={fetchData}>
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            Apply
          </Button>
        </CardContent>
      </Card>

      {/* Totals */}
      {!loading && expenses.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-xl border border-white/8 bg-black/40">
            <CardContent className="pt-4 pb-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total</p>
              <p className="text-2xl font-semibold tabular-nums">{formatCurrency(totalAmount)}</p>
            </CardContent>
          </Card>
          {Object.entries(byCategory)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([name, amount]) => (
              <Card key={name} className="rounded-xl border border-white/8 bg-black/40">
                <CardContent className="pt-4 pb-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground truncate">{name}</p>
                  <p className="text-lg font-semibold tabular-nums">{formatCurrency(amount)}</p>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Expense List */}
      <Card className="rounded-2xl border border-white/8 bg-black/40">
        <CardHeader>
          <CardTitle className="text-base">Expense Records</CardTitle>
          <CardDescription className="text-xs">
            {expenses.length} expense{expenses.length !== 1 ? 's' : ''} in selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No expenses found for this period. Click &quot;Add Expense&quot; to create one.
            </p>
          ) : (
            <div className="space-y-2">
              {expenses.map((exp) => {
                const catName = (exp.expense_categories as { name: string } | null)?.name;
                return (
                  <div
                    key={exp.id}
                    className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-3"
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{exp.description}</span>
                        {catName && (
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded shrink-0">
                            {catName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatDate(exp.date)}</span>
                        {exp.notes && <span className="truncate max-w-[200px]">{exp.notes}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <span className="text-sm font-semibold tabular-nums">
                        {formatCurrency(Number(exp.amount))}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(exp)}
                        aria-label="Edit expense"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-300"
                        onClick={() => handleDelete(exp.id)}
                        aria-label="Delete expense"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
            <DialogDescription>
              Record a manual expense entry.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="exp-desc">Description</Label>
              <Input
                id="exp-desc"
                placeholder="e.g. Facebook Ad Campaign, Shopify plan"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="exp-amount">Amount (EUR)</Label>
                <Input
                  id="exp-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={formAmount}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '' || /^\d*[.,]?\d*$/.test(raw)) setFormAmount(raw);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-date">Date</Label>
                <Input
                  id="exp-date"
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Category (optional)</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {categories.filter((c) => c.is_active).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-notes">Notes (optional)</Label>
              <Textarea
                id="exp-notes"
                placeholder="Any additional details..."
                className="min-h-[60px]"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving} className="bg-purple-600 text-white hover:bg-purple-500">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingExpense ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
