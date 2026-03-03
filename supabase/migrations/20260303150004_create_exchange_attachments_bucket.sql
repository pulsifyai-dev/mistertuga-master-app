-- Migration: Create Supabase Storage bucket for exchange attachments
-- Part of Story 2.1: Exchanges Schema + n8n Webhook Integration

INSERT INTO storage.buckets (id, name, public)
VALUES ('exchange-attachments', 'exchange-attachments', false);

-- Admin can upload files
CREATE POLICY "exchange_attachments_admin_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'exchange-attachments'
    AND public.user_role() = 'ADMIN'
  );

-- Admin can read/download files
CREATE POLICY "exchange_attachments_admin_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'exchange-attachments'
    AND public.user_role() = 'ADMIN'
  );

-- Admin can update files
CREATE POLICY "exchange_attachments_admin_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'exchange-attachments'
    AND public.user_role() = 'ADMIN'
  )
  WITH CHECK (
    bucket_id = 'exchange-attachments'
    AND public.user_role() = 'ADMIN'
  );

-- Admin can delete files
CREATE POLICY "exchange_attachments_admin_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'exchange-attachments'
    AND public.user_role() = 'ADMIN'
  );
