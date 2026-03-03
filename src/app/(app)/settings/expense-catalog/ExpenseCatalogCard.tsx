'use client';

import { useState, useEffect, useCallback } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Loader2, Package } from 'lucide-react';
import {
  listExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  type ExpenseCategory,
} from '@/app/(app)/expenses/expense-actions';
import { formatCurrency } from '@/lib/format';

const CATEGORY_TYPES = [
  { value: 'software', label: 'Software' },
  { value: 'service', label: 'Service' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'other', label: 'Other' },
];

export function ExpenseCatalogCard() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formCost, setFormCost] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const result = await listExpenseCategories();
    if (result.success) setCategories(result.categories);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const resetForm = () => {
    setEditing(null);
    setFormName('');
    setFormCategory('');
    setFormCost('');
    setFormNotes('');
  };

  const openNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (cat: ExpenseCategory) => {
    setEditing(cat);
    setFormName(cat.name);
    setFormCategory(cat.category ?? '');
    setFormCost(cat.fixed_monthly_cost != null ? String(cat.fixed_monthly_cost) : '');
    setFormNotes(cat.notes ?? '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Name is required.' });
      return;
    }

    setSaving(true);
    const costParsed = formCost ? parseFloat(formCost.replace(',', '.')) : null;
    if (formCost && (costParsed === null || isNaN(costParsed))) {
      toast({ variant: 'destructive', title: 'Error', description: 'Invalid cost value.' });
      setSaving(false);
      return;
    }

    const payload = {
      name: formName.trim(),
      category: formCategory || undefined,
      fixed_monthly_cost: costParsed,
      notes: formNotes.trim() || undefined,
    };

    const result = editing
      ? await updateExpenseCategory(editing.id, payload)
      : await createExpenseCategory(payload);

    if (result.success) {
      toast({ title: editing ? 'Category Updated' : 'Category Created' });
      setDialogOpen(false);
      resetForm();
      fetchCategories();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this expense category?')) return;
    const result = await deleteExpenseCategory(id);
    if (result.success) {
      toast({ title: 'Category Deleted' });
      fetchCategories();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    const result = await updateExpenseCategory(id, { is_active: isActive });
    if (result.success) {
      fetchCategories();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Expense Catalog
          </CardTitle>
          <CardDescription>Manage services and software with recurring costs.</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Category' : 'New Expense Category'}</DialogTitle>
              <DialogDescription>
                Track recurring services, software, and subscriptions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="cat-name">Name</Label>
                <Input
                  id="cat-name"
                  placeholder="e.g. Klaviyo, Shopify, Vercel"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-cost">Fixed Monthly Cost (EUR, optional)</Label>
                <Input
                  id="cat-cost"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={formCost}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '' || /^\d*[.,]?\d*$/.test(raw)) setFormCost(raw);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-notes">Notes (optional)</Label>
                <Input
                  id="cat-notes"
                  placeholder="Any additional details..."
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
                {editing ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : categories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No expense categories yet. Add services and software to track costs.
          </p>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-3"
              >
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{cat.name}</span>
                    {cat.category && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">
                        {cat.category}
                      </span>
                    )}
                  </div>
                  {cat.fixed_monthly_cost != null && (
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(cat.fixed_monthly_cost)}/month
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={cat.is_active}
                    onCheckedChange={(checked) => handleToggle(cat.id, checked)}
                    aria-label={`Toggle ${cat.name}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(cat)}
                    aria-label={`Edit ${cat.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-400 hover:text-red-300"
                    onClick={() => handleDelete(cat.id)}
                    aria-label={`Delete ${cat.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
