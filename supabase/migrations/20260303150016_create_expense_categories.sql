-- Migration: Create expense_categories table
-- Part of Story 2.6: Expense Catalog + Manual Expenses
-- Services/Software catalog for expense tracking

CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT CHECK (category IN ('software', 'service', 'subscription', 'other')),
  fixed_monthly_cost NUMERIC(10,2),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_categories_admin_all" ON expense_categories;
CREATE POLICY "expense_categories_admin_all" ON expense_categories
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');
