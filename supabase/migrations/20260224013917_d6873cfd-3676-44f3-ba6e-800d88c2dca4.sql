
-- Fix RLS policies for featured_products_tenant to support tenant_admin via profiles table
DROP POLICY IF EXISTS "Members insert tenant featured" ON public.featured_products_tenant;
CREATE POLICY "Members insert tenant featured" ON public.featured_products_tenant
  FOR INSERT WITH CHECK (
    tenant_id = get_user_tenant_id() OR tenant_id = get_app_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "Members update tenant featured" ON public.featured_products_tenant;
CREATE POLICY "Members update tenant featured" ON public.featured_products_tenant
  FOR UPDATE USING (
    tenant_id = get_user_tenant_id() OR tenant_id = get_app_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "Members delete tenant featured" ON public.featured_products_tenant;
CREATE POLICY "Members delete tenant featured" ON public.featured_products_tenant
  FOR DELETE USING (
    tenant_id = get_user_tenant_id() OR tenant_id = get_app_user_tenant_id(auth.uid())
  );
