-- Story 1.7 AC1: Webhook trigger for tracking number updates
-- Replaces Firebase Cloud Function with Supabase database trigger
-- Requires pg_net extension (enabled by default in Supabase)

-- Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function: fires when tracking_number changes from NULL to a value
CREATE OR REPLACE FUNCTION notify_tracking_added()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
BEGIN
  IF OLD.tracking_number IS NULL AND NEW.tracking_number IS NOT NULL THEN
    -- Read webhook URL from settings table (key = 'webhook_url', value is JSON { url: "..." })
    SELECT (value ->> 'url')::TEXT INTO webhook_url
    FROM public.settings WHERE key = 'webhook_url';

    IF webhook_url IS NOT NULL AND webhook_url != '' THEN
      PERFORM net.http_post(
        url := webhook_url,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'event', 'tracking_added',
          'orderId', NEW.order_number,
          'countryCode', NEW.country_code,
          'trackingNumber', NEW.tracking_number,
          'status', NEW.status,
          'updatedAt', now()
        )::text
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: fires after UPDATE on orders table
DROP TRIGGER IF EXISTS trg_tracking_webhook ON public.orders;
CREATE TRIGGER trg_tracking_webhook
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION notify_tracking_added();
