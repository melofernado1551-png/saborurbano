
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to send push notification when sale status changes
CREATE OR REPLACE FUNCTION public.notify_sale_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _changed_op boolean := false;
  _changed_fin boolean := false;
  _payload jsonb;
  _supabase_url text;
  _service_key text;
BEGIN
  -- Check if operational or financial status actually changed
  IF OLD.operational_status IS DISTINCT FROM NEW.operational_status THEN
    _changed_op := true;
  END IF;
  
  IF OLD.financial_status IS DISTINCT FROM NEW.financial_status THEN
    _changed_fin := true;
  END IF;
  
  -- Only proceed if something changed
  IF NOT _changed_op AND NOT _changed_fin THEN
    RETURN NEW;
  END IF;
  
  -- Build payload
  _payload := jsonb_build_object(
    'sale_id', NEW.id,
    'customer_id', NEW.customer_id,
    'sale_number', NEW.sale_number,
    'operational_status', CASE WHEN _changed_op THEN NEW.operational_status ELSE NULL END,
    'financial_status', CASE WHEN _changed_fin THEN NEW.financial_status ELSE NULL END
  );
  
  -- Get Supabase URL from environment  
  SELECT value INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT value INTO _service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  
  -- Call edge function via pg_net
  PERFORM extensions.http_post(
    url := _supabase_url || '/functions/v1/push-notification?action=notify',
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key,
      'apikey', _service_key
    )
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER trigger_sale_status_push_notification
AFTER UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.notify_sale_status_change();
