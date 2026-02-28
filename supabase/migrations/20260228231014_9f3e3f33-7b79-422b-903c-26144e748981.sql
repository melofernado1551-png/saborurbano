
-- Update trigger to use "Venda App" for app sales
CREATE OR REPLACE FUNCTION public.auto_create_revenue_on_paid_sale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _revenue_type_id uuid;
  _already_exists boolean;
  _customer_name text;
BEGIN
  IF NEW.financial_status = 'paid' AND (OLD.financial_status IS DISTINCT FROM 'paid') THEN
    SELECT EXISTS(
      SELECT 1 FROM public.revenues WHERE sale_id = NEW.id AND active = true
    ) INTO _already_exists;

    IF _already_exists THEN
      RETURN NEW;
    END IF;

    SELECT name INTO _customer_name
    FROM public.customers
    WHERE id = NEW.customer_id AND active = true;

    -- Prefer "Venda App" for app sales (sales with a customer/chat), fallback to "Venda balcão"
    SELECT id INTO _revenue_type_id
    FROM public.revenue_types
    WHERE tenant_id = NEW.tenant_id AND active = true AND name = 'Venda App'
    LIMIT 1;

    IF _revenue_type_id IS NULL THEN
      SELECT id INTO _revenue_type_id
      FROM public.revenue_types
      WHERE tenant_id = NEW.tenant_id AND active = true AND name = 'Venda balcão'
      LIMIT 1;
    END IF;

    IF _revenue_type_id IS NULL THEN
      SELECT id INTO _revenue_type_id
      FROM public.revenue_types
      WHERE tenant_id = NEW.tenant_id AND active = true
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;

    IF _revenue_type_id IS NULL THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.revenues (tenant_id, revenue_type_id, amount, date, description, sale_id)
    VALUES (
      NEW.tenant_id,
      _revenue_type_id,
      NEW.valor_total,
      CURRENT_DATE,
      'Venda #' || COALESCE(NEW.sale_number::text, NEW.id::text) || COALESCE(' - ' || _customer_name, ''),
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Also add "Venda App" to auto-created financial types for new tenants
CREATE OR REPLACE FUNCTION public.auto_create_financial_types()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.revenue_types (tenant_id, name) VALUES
    (NEW.id, 'Venda App'),
    (NEW.id, 'Venda balcão'),
    (NEW.id, 'Venda externa'),
    (NEW.id, 'Ajuste de caixa'),
    (NEW.id, 'Outros');

  INSERT INTO public.expense_types (tenant_id, name) VALUES
    (NEW.id, 'Aluguel'),
    (NEW.id, 'Insumos'),
    (NEW.id, 'Energia'),
    (NEW.id, 'Internet'),
    (NEW.id, 'Funcionários'),
    (NEW.id, 'Marketing'),
    (NEW.id, 'Outros');

  RETURN NEW;
END;
$function$;
