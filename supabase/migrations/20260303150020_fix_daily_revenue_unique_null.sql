-- Fix UNIQUE(date, country_code) for NULL country_code rows (QA CRITICAL)
-- PostgreSQL: NULL != NULL, so UNIQUE(date, country_code) allows duplicate NULL rows.
-- Add a partial unique index to enforce uniqueness for aggregate rows.

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_revenue_date_null_country
  ON daily_revenue(date) WHERE country_code IS NULL;
