-- Migration: Create email_templates table
-- Part of Story 2.2: Exchanges/Returns UI + Email Templates
-- Supports {{placeholder}} syntax for dynamic content

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  template_type TEXT DEFAULT 'exchange',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- RLS: Admin full CRUD, Fornecedor no access
DROP POLICY IF EXISTS "email_templates_admin_all" ON email_templates;
CREATE POLICY "email_templates_admin_all" ON email_templates
  FOR ALL
  USING (public.user_role() = 'ADMIN')
  WITH CHECK (public.user_role() = 'ADMIN');
