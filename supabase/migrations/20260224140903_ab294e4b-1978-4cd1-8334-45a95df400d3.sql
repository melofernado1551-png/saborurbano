-- Fix customers RLS: "Members read/update customers" uses wrong function
-- get_user_tenant_id() queries system_users (empty), should use get_app_user_tenant_id()

DROP POLICY IF EXISTS "Members read customers" ON public.customers;
CREATE POLICY "Members read customers" ON public.customers
  FOR SELECT USING (tenant_id = get_app_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Members update customers" ON public.customers;
CREATE POLICY "Members update customers" ON public.customers
  FOR UPDATE USING (tenant_id = get_app_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Members insert customers" ON public.customers;
CREATE POLICY "Members insert customers" ON public.customers
  FOR INSERT WITH CHECK (tenant_id = get_app_user_tenant_id(auth.uid()));