
-- Add position column to product_categories for ordering
ALTER TABLE public.product_categories ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

-- Set initial positions based on name order
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY name) - 1 AS pos
  FROM public.product_categories
)
UPDATE public.product_categories SET position = ranked.pos FROM ranked WHERE product_categories.id = ranked.id;
