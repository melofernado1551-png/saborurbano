
-- Add slug column to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug text;

-- Generate slugs for existing products
UPDATE public.products
SET slug = lower(
  regexp_replace(
    regexp_replace(
      translate(name, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiioooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'),
      '[^a-zA-Z0-9\s-]', '', 'g'
    ),
    '\s+', '-', 'g'
  )
)
WHERE slug IS NULL;

-- Handle duplicate slugs within same tenant by appending suffix
DO $$
DECLARE
  r RECORD;
  counter INT;
  new_slug TEXT;
BEGIN
  FOR r IN
    SELECT p.id, p.tenant_id, p.slug
    FROM products p
    INNER JOIN (
      SELECT tenant_id, slug
      FROM products
      WHERE slug IS NOT NULL
      GROUP BY tenant_id, slug
      HAVING count(*) > 1
    ) dupes ON p.tenant_id = dupes.tenant_id AND p.slug = dupes.slug
    ORDER BY p.tenant_id, p.slug, p.created_at
  LOOP
    -- Check if this slug already has the suffix
    SELECT count(*) INTO counter
    FROM products
    WHERE tenant_id = r.tenant_id AND slug = r.slug AND id != r.id;
    
    IF counter > 0 THEN
      new_slug := r.slug || '-' || (counter + 1);
      UPDATE products SET slug = new_slug WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- Make slug NOT NULL after populating
ALTER TABLE public.products ALTER COLUMN slug SET NOT NULL;

-- Create unique index for product slug within tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_slug ON public.products (tenant_id, slug);

-- Create unique index for tenant slug (if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants (slug);
