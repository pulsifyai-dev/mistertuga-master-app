-- Migration: Set custom JWT claim for user_role on login
-- Part of Story 1.2: Auth Migration
-- Populates user_role in JWT claims from users.role column

-- Function to set user_role claim in JWT metadata
CREATE OR REPLACE FUNCTION public.handle_auth_user_role()
RETURNS TRIGGER AS $$
DECLARE
  _role TEXT;
  _assigned_countries TEXT[];
BEGIN
  -- Look up user role and assigned countries from public.users
  SELECT role, assigned_countries
  INTO _role, _assigned_countries
  FROM public.users
  WHERE id = NEW.id;

  -- If user exists in public.users, set the claim
  IF _role IS NOT NULL THEN
    NEW.raw_app_meta_data = jsonb_set(
      COALESCE(NEW.raw_app_meta_data, '{}'::jsonb),
      '{user_role}',
      to_jsonb(_role)
    );
    NEW.raw_app_meta_data = jsonb_set(
      NEW.raw_app_meta_data,
      '{assigned_countries}',
      to_jsonb(_assigned_countries)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users to inject role into JWT on token refresh
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  BEFORE UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_role();

COMMENT ON FUNCTION public.handle_auth_user_role() IS 'Injects user_role and assigned_countries from public.users into JWT app_metadata on auth token refresh';
