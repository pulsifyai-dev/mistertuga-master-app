-- Migration: Create exchange_attachments table
-- Part of Story 2.1: Exchanges Schema + n8n Webhook Integration

CREATE TABLE exchange_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id UUID NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_exchange_attachments_exchange ON exchange_attachments(exchange_id);

-- Enable RLS
ALTER TABLE exchange_attachments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE exchange_attachments IS 'File attachments for exchange/return requests — stored in Supabase Storage';
