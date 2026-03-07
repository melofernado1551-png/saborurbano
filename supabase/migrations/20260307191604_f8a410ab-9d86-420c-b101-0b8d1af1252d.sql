
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS sale_number_counter integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.next_sale_number(_tenant_id uuid)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT GREATEST(
    COALESCE((SELECT MAX(sale_number) FROM public.sales WHERE tenant_id = _tenant_id AND active = true), 0),
    COALESCE((SELECT sale_number_counter FROM public.tenants WHERE id = _tenant_id), 0)
  ) + 1
$$;
