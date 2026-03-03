-- Migration 005: Create customers table
-- Part of Story 1.1: Supabase Foundation

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  postal_code TEXT,
  country_code TEXT REFERENCES countries(code),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(email, phone)                   -- Dedup key for migration
);

CREATE INDEX idx_customers_country ON customers(country_code);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email);

COMMENT ON TABLE customers IS 'Normalized customer data — extracted from Firestore embedded customer objects';
