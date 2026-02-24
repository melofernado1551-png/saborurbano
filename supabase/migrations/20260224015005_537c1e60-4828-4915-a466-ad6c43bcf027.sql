
-- Fix tenant_sections RLS for tenant_admin via profiles
DROP POLICY IF EXISTS "Members insert sections" ON public.tenant_sections;
CREATE POLICY "Members insert sections" ON public.tenant_sections
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id() OR tenant_id = get_app_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Members update sections" ON public.tenant_sections;
CREATE POLICY "Members update sections" ON public.tenant_sections
  FOR UPDATE USING (tenant_id = get_user_tenant_id() OR tenant_id = get_app_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Members delete sections" ON public.tenant_sections;
CREATE POLICY "Members delete sections" ON public.tenant_sections
  FOR DELETE USING (tenant_id = get_user_tenant_id() OR tenant_id = get_app_user_tenant_id(auth.uid()));

-- Fix tenant_section_products RLS for tenant_admin via profiles
DROP POLICY IF EXISTS "Members insert section products" ON public.tenant_section_products;
CREATE POLICY "Members insert section products" ON public.tenant_section_products
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM tenant_sections WHERE tenant_sections.id = tenant_section_products.tenant_section_id AND (tenant_sections.tenant_id = get_user_tenant_id() OR tenant_sections.tenant_id = get_app_user_tenant_id(auth.uid())))
  );

DROP POLICY IF EXISTS "Members update section products" ON public.tenant_section_products;
CREATE POLICY "Members update section products" ON public.tenant_section_products
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM tenant_sections WHERE tenant_sections.id = tenant_section_products.tenant_section_id AND (tenant_sections.tenant_id = get_user_tenant_id() OR tenant_sections.tenant_id = get_app_user_tenant_id(auth.uid())))
  );

DROP POLICY IF EXISTS "Members delete section products" ON public.tenant_section_products;
CREATE POLICY "Members delete section products" ON public.tenant_section_products
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM tenant_sections WHERE tenant_sections.id = tenant_section_products.tenant_section_id AND (tenant_sections.tenant_id = get_user_tenant_id() OR tenant_sections.tenant_id = get_app_user_tenant_id(auth.uid())))
  );

-- Fix product_categories RLS for tenant_admin via profiles
DROP POLICY IF EXISTS "Members insert categories" ON public.product_categories;
CREATE POLICY "Members insert categories" ON public.product_categories
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id() OR tenant_id = get_app_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Members update categories" ON public.product_categories;
CREATE POLICY "Members update categories" ON public.product_categories
  FOR UPDATE USING (tenant_id = get_user_tenant_id() OR tenant_id = get_app_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Members delete categories" ON public.product_categories;
CREATE POLICY "Members delete categories" ON public.product_categories
  FOR DELETE USING (tenant_id = get_user_tenant_id() OR tenant_id = get_app_user_tenant_id(auth.uid()));
