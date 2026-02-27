
-- Create customer_favorites table
CREATE TABLE public.customer_favorites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(customer_id, product_id)
);

-- Enable RLS
ALTER TABLE public.customer_favorites ENABLE ROW LEVEL SECURITY;

-- Customers can read their own favorites
CREATE POLICY "Customers read own favorites"
  ON public.customer_favorites FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = customer_favorites.customer_id
      AND customers.auth_id = auth.uid()
      AND customers.active = true
  ));

-- Customers can insert their own favorites
CREATE POLICY "Customers insert own favorites"
  ON public.customer_favorites FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = customer_favorites.customer_id
      AND customers.auth_id = auth.uid()
      AND customers.active = true
  ));

-- Customers can delete their own favorites
CREATE POLICY "Customers delete own favorites"
  ON public.customer_favorites FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = customer_favorites.customer_id
      AND customers.auth_id = auth.uid()
      AND customers.active = true
  ));

-- Customers can update their own favorites (for soft delete via active flag)
CREATE POLICY "Customers update own favorites"
  ON public.customer_favorites FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = customer_favorites.customer_id
      AND customers.auth_id = auth.uid()
      AND customers.active = true
  ));

-- Index for performance
CREATE INDEX idx_customer_favorites_customer ON public.customer_favorites(customer_id);
CREATE INDEX idx_customer_favorites_product ON public.customer_favorites(product_id);
