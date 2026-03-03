-- Add missing UPDATE policy for supplier-exports storage bucket (QA CRITICAL)
-- Required for upsert: true in storage upload.

DROP POLICY IF EXISTS "supplier_exports_update" ON storage.objects;
CREATE POLICY "supplier_exports_update" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'supplier-exports' AND public.user_role() = 'ADMIN')
  WITH CHECK (bucket_id = 'supplier-exports' AND public.user_role() = 'ADMIN');
