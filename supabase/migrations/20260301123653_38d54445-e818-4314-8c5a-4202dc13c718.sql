
-- Tabela de combos
CREATE TABLE public.combos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  description text,
  image_url text,
  price numeric NOT NULL DEFAULT 0,
  promo_price numeric,
  slug text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela de produtos do combo
CREATE TABLE public.combo_products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  combo_id uuid NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  active boolean NOT NULL DEFAULT true,
  UNIQUE(combo_id, product_id)
);

-- Relação combo-categorias
CREATE TABLE public.combo_category_relations (
  combo_id uuid NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.product_categories(id),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (combo_id, category_id)
);

-- RLS combos
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active combos" ON public.combos
  FOR SELECT USING (active = true);

CREATE POLICY "Members insert combos" ON public.combos
  FOR INSERT WITH CHECK (tenant_id = get_app_user_tenant_id(auth.uid()));

CREATE POLICY "Members update combos" ON public.combos
  FOR UPDATE USING (tenant_id = get_app_user_tenant_id(auth.uid()));

CREATE POLICY "Members delete combos" ON public.combos
  FOR DELETE USING (tenant_id = get_app_user_tenant_id(auth.uid()));

CREATE POLICY "Superadmin manage combos" ON public.combos
  FOR ALL USING (is_superadmin(auth.uid())) WITH CHECK (is_superadmin(auth.uid()));

-- RLS combo_products
ALTER TABLE public.combo_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active combo_products" ON public.combo_products
  FOR SELECT USING (active = true);

CREATE POLICY "Members insert combo_products" ON public.combo_products
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.combos WHERE id = combo_products.combo_id AND tenant_id = get_app_user_tenant_id(auth.uid())
  ));

CREATE POLICY "Members update combo_products" ON public.combo_products
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.combos WHERE id = combo_products.combo_id AND tenant_id = get_app_user_tenant_id(auth.uid())
  ));

CREATE POLICY "Members delete combo_products" ON public.combo_products
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.combos WHERE id = combo_products.combo_id AND tenant_id = get_app_user_tenant_id(auth.uid())
  ));

CREATE POLICY "Superadmin manage combo_products" ON public.combo_products
  FOR ALL USING (is_superadmin(auth.uid())) WITH CHECK (is_superadmin(auth.uid()));

-- RLS combo_category_relations
ALTER TABLE public.combo_category_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active combo_categories" ON public.combo_category_relations
  FOR SELECT USING (active = true);

CREATE POLICY "Members insert combo_categories" ON public.combo_category_relations
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.combos WHERE id = combo_category_relations.combo_id AND tenant_id = get_app_user_tenant_id(auth.uid())
  ));

CREATE POLICY "Members delete combo_categories" ON public.combo_category_relations
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.combos WHERE id = combo_category_relations.combo_id AND tenant_id = get_app_user_tenant_id(auth.uid())
  ));

CREATE POLICY "Superadmin manage combo_categories" ON public.combo_category_relations
  FOR ALL USING (is_superadmin(auth.uid())) WITH CHECK (is_superadmin(auth.uid()));

-- Slug auto-generation for combos
CREATE OR REPLACE FUNCTION public.generate_combo_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 1;
BEGIN
  base_slug := lower(extensions.unaccent(NEW.name));
  base_slug := regexp_replace(base_slug, '[^a-z0-9\s-]', '', 'g');
  base_slug := regexp_replace(trim(base_slug), '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.combos WHERE slug = final_slug AND tenant_id = NEW.tenant_id AND id IS DISTINCT FROM NEW.id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_combo_slug_trigger
BEFORE INSERT OR UPDATE OF name ON public.combos
FOR EACH ROW EXECUTE FUNCTION public.generate_combo_slug();
