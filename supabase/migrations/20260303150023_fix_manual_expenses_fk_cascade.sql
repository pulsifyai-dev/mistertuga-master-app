-- Fix FK constraint on manual_expenses.category_id (QA CONCERN)
-- Default RESTRICT prevents deleting categories with linked expenses.
-- Change to SET NULL so deleting a category nullifies the reference.

ALTER TABLE manual_expenses
  DROP CONSTRAINT IF EXISTS manual_expenses_category_id_fkey;

ALTER TABLE manual_expenses
  ADD CONSTRAINT manual_expenses_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES expense_categories(id)
    ON DELETE SET NULL;
