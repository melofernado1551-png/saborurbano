
-- Enable unaccent
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA extensions;

-- Slug generator function
CREATE OR REPLACE FUNCTION public.generate_tag_slug()
RETURNS TRIGGER
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
  WHILE EXISTS (SELECT 1 FROM public.tags WHERE slug = final_slug AND id IS DISTINCT FROM NEW.id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$;

-- Tags table
CREATE TABLE public.tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Product tags table
CREATE TABLE public.product_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(product_id, tag_id)
);

-- Slug trigger
CREATE TRIGGER trigger_generate_tag_slug
BEFORE INSERT OR UPDATE OF name ON public.tags
FOR EACH ROW
EXECUTE FUNCTION public.generate_tag_slug();

-- RLS
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active tags" ON public.tags FOR SELECT USING (active = true);
CREATE POLICY "Superadmin read all tags" ON public.tags FOR SELECT USING (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin insert tags" ON public.tags FOR INSERT WITH CHECK (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin update tags" ON public.tags FOR UPDATE USING (is_superadmin(auth.uid()));
CREATE POLICY "Superadmin delete tags" ON public.tags FOR DELETE USING (is_superadmin(auth.uid()));

CREATE POLICY "Public read active product_tags" ON public.product_tags FOR SELECT USING (active = true);
CREATE POLICY "Members insert product_tags" ON public.product_tags FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM products WHERE products.id = product_tags.product_id AND products.tenant_id = get_user_tenant_id()));
CREATE POLICY "Members delete product_tags" ON public.product_tags FOR DELETE USING (EXISTS (SELECT 1 FROM products WHERE products.id = product_tags.product_id AND products.tenant_id = get_user_tenant_id()));
CREATE POLICY "Members update product_tags" ON public.product_tags FOR UPDATE USING (EXISTS (SELECT 1 FROM products WHERE products.id = product_tags.product_id AND products.tenant_id = get_user_tenant_id()));

-- Initial data
INSERT INTO public.tags (name, emoji) VALUES
  ('Mais pedido', '🔥'),
  ('Destaque', '⭐'),
  ('Promoção', '💥'),
  ('Novidade', '🆕'),
  ('Entrega rápida', '⚡'),
  ('Combo', '🎁'),
  ('Favorito', '❤️'),
  ('Vegetariano', '🌱');
