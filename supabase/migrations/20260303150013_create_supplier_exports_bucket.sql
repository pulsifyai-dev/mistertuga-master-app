-- Migration: Create Supabase Storage bucket for supplier exports
-- Part of Story 2.4: Supplier Excel Export with Embedded Images

INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier-exports', 'supplier-exports', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Admin only (insert, select, update, delete)
DROP POLICY IF EXISTS "supplier_exports_insert" ON storage.objects;
CREATE POLICY "supplier_exports_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'supplier-exports'
    AND public.user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "supplier_exports_select" ON storage.objects;
CREATE POLICY "supplier_exports_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'supplier-exports'
    AND public.user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "supplier_exports_delete" ON storage.objects;
CREATE POLICY "supplier_exports_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'supplier-exports'
    AND public.user_role() = 'ADMIN'
  );
