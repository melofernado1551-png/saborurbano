
-- 1. Featured products per tenant
CREATE TABLE public.featured_products_tenant (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, product_id)
);

ALTER TABLE public.featured_products_tenant ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read tenant featured" ON public.featured_products_tenant
  FOR SELECT USING (active = true);

CREATE POLICY "Members insert tenant featured" ON public.featured_products_tenant
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Members update tenant featured" ON public.featured_products_tenant
  FOR UPDATE USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Members delete tenant featured" ON public.featured_products_tenant
  FOR DELETE USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Superadmin insert tenant featured" ON public.featured_products_tenant
  FOR INSERT WITH CHECK (is_superadmin(auth.uid()));

CREATE POLICY "Superadmin update tenant featured" ON public.featured_products_tenant
  FOR UPDATE USING (is_superadmin(auth.uid()));

CREATE POLICY "Superadmin delete tenant featured" ON public.featured_products_tenant
  FOR DELETE USING (is_superadmin(auth.uid()));

-- 2. Tenant sections (vitrine)
CREATE TABLE public.tenant_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read tenant sections" ON public.tenant_sections
  FOR SELECT USING (active = true);

CREATE POLICY "Members insert sections" ON public.tenant_sections
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Members update sections" ON public.tenant_sections
  FOR UPDATE USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Members delete sections" ON public.tenant_sections
  FOR DELETE USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Superadmin insert sections" ON public.tenant_sections
  FOR INSERT WITH CHECK (is_superadmin(auth.uid()));

CREATE POLICY "Superadmin update sections" ON public.tenant_sections
  FOR UPDATE USING (is_superadmin(auth.uid()));

CREATE POLICY "Superadmin delete sections" ON public.tenant_sections
  FOR DELETE USING (is_superadmin(auth.uid()));

-- 3. Section products
CREATE TABLE public.tenant_section_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_section_id UUID NOT NULL REFERENCES public.tenant_sections(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(tenant_section_id, product_id)
);

ALTER TABLE public.tenant_section_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read section products" ON public.tenant_section_products
  FOR SELECT USING (active = true);

CREATE POLICY "Members insert section products" ON public.tenant_section_products
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.tenant_sections WHERE id = tenant_section_products.tenant_section_id AND tenant_id = get_user_tenant_id()
  ));

CREATE POLICY "Members update section products" ON public.tenant_section_products
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.tenant_sections WHERE id = tenant_section_products.tenant_section_id AND tenant_id = get_user_tenant_id()
  ));

CREATE POLICY "Members delete section products" ON public.tenant_section_products
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.tenant_sections WHERE id = tenant_section_products.tenant_section_id AND tenant_id = get_user_tenant_id()
  ));

CREATE POLICY "Superadmin insert section products" ON public.tenant_section_products
  FOR INSERT WITH CHECK (is_superadmin(auth.uid()));

CREATE POLICY "Superadmin update section products" ON public.tenant_section_products
  FOR UPDATE USING (is_superadmin(auth.uid()));

CREATE POLICY "Superadmin delete section products" ON public.tenant_section_products
  FOR DELETE USING (is_superadmin(auth.uid()));
