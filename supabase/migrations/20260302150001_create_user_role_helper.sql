-- Migration: Create user_role() helper function
-- Part of Story 1.2: Auth Migration
-- Reads role from JWT claim first (fast path), falls back to users table

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'user_role',
    (SELECT role FROM public.users WHERE id = auth.uid())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.user_role() IS 'Returns user role from JWT claim (fast) or users table (fallback). Used by RLS policies.';
