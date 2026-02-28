-- Allow tenant members to update (soft-delete) their own payments
CREATE POLICY "Tenant members update payments"
ON public.sale_payments
FOR UPDATE
USING (tenant_id = get_app_user_tenant_id(auth.uid()));

-- Also allow superadmins
CREATE POLICY "Superadmin update payments"
ON public.sale_payments
FOR UPDATE
USING (is_superadmin(auth.uid()));

-- Create trigger to recalculate financial status on payment UPDATE (not just INSERT)
CREATE OR REPLACE FUNCTION public.update_sale_financial_status_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _total_paid numeric;
  _sale_total numeric;
  _new_status text;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO _total_paid
  FROM public.sale_payments
  WHERE sale_id = NEW.sale_id AND active = true;

  SELECT valor_total INTO _sale_total
  FROM public.sales
  WHERE id = NEW.sale_id;

  IF _total_paid >= _sale_total THEN
    _new_status := 'paid';
  ELSIF _total_paid > 0 THEN
    _new_status := 'partial';
  ELSE
    _new_status := 'pending';
  END IF;

  UPDATE public.sales
  SET financial_status = _new_status
  WHERE id = NEW.sale_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER update_sale_financial_on_payment_update
AFTER UPDATE ON public.sale_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_sale_financial_status_on_update();