-- Migration: Create manual_expenses table
-- Part of Story 2.6: Expense Catalog + Manual Expenses
-- Manual expense entries linked to optional categories

CREATE TABLE IF NOT EXISTS manual_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES expense_categories(id),
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_manual_expenses_date ON manual_expenses(date DESC);

ALTER TABLE manual_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manual_expenses_admin_all" ON manual_expenses;
CREATE POLICY "manual_expenses_admin_all" ON manual_expenses
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');
