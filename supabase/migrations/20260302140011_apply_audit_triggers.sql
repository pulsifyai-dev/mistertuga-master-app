-- Migration 011: Apply audit triggers to critical tables
-- Part of Story 1.1: Supabase Foundation

-- Orders audit (most critical — tracks all order changes)
CREATE TRIGGER audit_orders
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Users audit (role changes, profile updates)
CREATE TRIGGER audit_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Settings audit (webhook URL changes, config changes)
CREATE TRIGGER audit_settings
  AFTER INSERT OR UPDATE OR DELETE ON settings
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
