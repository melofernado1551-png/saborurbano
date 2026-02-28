
-- Trigger function: auto-create revenue when a sale becomes "paid"
CREATE OR REPLACE FUNCTION public.auto_create_revenue_on_paid_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _revenue_type_id uuid;
  _already_exists boolean;
BEGIN
  -- Only fire when financial_status transitions TO 'paid'
  IF NEW.financial_status = 'paid' AND (OLD.financial_status IS DISTINCT FROM 'paid') THEN
    -- Check if a revenue already exists for this sale
    SELECT EXISTS(
      SELECT 1 FROM public.revenues WHERE sale_id = NEW.id AND active = true
    ) INTO _already_exists;

    IF _already_exists THEN
      RETURN NEW;
    END IF;

    -- Find a revenue type for this tenant (prefer "Venda balcão", fallback to first)
    SELECT id INTO _revenue_type_id
    FROM public.revenue_types
    WHERE tenant_id = NEW.tenant_id AND active = true AND name = 'Venda balcão'
    LIMIT 1;

    IF _revenue_type_id IS NULL THEN
      SELECT id INTO _revenue_type_id
      FROM public.revenue_types
      WHERE tenant_id = NEW.tenant_id AND active = true
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;

    -- If no revenue type exists, skip
    IF _revenue_type_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Insert revenue
    INSERT INTO public.revenues (tenant_id, revenue_type_id, amount, date, description, sale_id)
    VALUES (
      NEW.tenant_id,
      _revenue_type_id,
      NEW.valor_total,
      CURRENT_DATE,
      'Venda #' || COALESCE(NEW.sale_number::text, NEW.id::text),
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger on sales table
CREATE TRIGGER auto_revenue_on_paid_sale
  AFTER UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_revenue_on_paid_sale();
