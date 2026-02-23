
-- Add missing columns to product_categories
ALTER TABLE public.product_categories 
ADD COLUMN IF NOT EXISTS emoji text DEFAULT '🍽️',
ADD COLUMN IF NOT EXISTS slug text,
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone NOT NULL DEFAULT now();

-- Generate slugs for existing categories
UPDATE public.product_categories SET slug = lower(regexp_replace(regexp_replace(trim(name), '\s+', '-', 'g'), '[^a-z0-9-]', '', 'g')) WHERE slug IS NULL;

-- Add unique constraint for slug per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_tenant_slug ON public.product_categories(tenant_id, slug) WHERE active = true;

-- Make slug NOT NULL after populating
ALTER TABLE public.product_categories ALTER COLUMN slug SET NOT NULL;

-- Add superadmin access to product_categories
CREATE POLICY "Superadmin insert categories" ON public.product_categories FOR INSERT WITH CHECK (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin update categories" ON public.product_categories FOR UPDATE USING (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin delete categories" ON public.product_categories FOR DELETE USING (is_superadmin(auth.uid()));

-- Add superadmin access to product_category_relations
CREATE POLICY "Superadmin insert relations" ON public.product_category_relations FOR INSERT WITH CHECK (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin delete relations" ON public.product_category_relations FOR DELETE USING (is_superadmin(auth.uid()));

-- Auto-generate slug trigger for product_categories
CREATE OR REPLACE FUNCTION public.generate_product_category_slug()
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
  WHILE EXISTS (SELECT 1 FROM public.product_categories WHERE slug = final_slug AND tenant_id = NEW.tenant_id AND id IS DISTINCT FROM NEW.id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_product_category_slug
BEFORE INSERT OR UPDATE OF name ON public.product_categories
FOR EACH ROW
EXECUTE FUNCTION public.generate_product_category_slug();

-- Auto-create default categories when a tenant is created
CREATE OR REPLACE FUNCTION public.auto_create_tenant_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.product_categories (tenant_id, name, emoji) VALUES
    (NEW.id, 'Hambúrgueres', '🍔'),
    (NEW.id, 'Pizzas', '🍕'),
    (NEW.id, 'Lanches', '🌭'),
    (NEW.id, 'Porções', '🍟'),
    (NEW.id, 'Bebidas', '🥤'),
    (NEW.id, 'Sobremesas', '🍰'),
    (NEW.id, 'Combos', '🌮'),
    (NEW.id, 'Saudáveis', '🥗'),
    (NEW.id, 'Pratos Executivos', '🍛'),
    (NEW.id, 'Promoções', '🔥');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_create_tenant_categories
AFTER INSERT ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_tenant_categories();
