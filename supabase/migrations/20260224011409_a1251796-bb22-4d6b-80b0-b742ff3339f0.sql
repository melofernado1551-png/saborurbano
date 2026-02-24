-- Add RLS policy for tenant_admin users to update their own tenant via profiles table
CREATE POLICY "Tenant admin update own tenant"
ON public.tenants
FOR UPDATE
USING (id = get_app_user_tenant_id(auth.uid()));