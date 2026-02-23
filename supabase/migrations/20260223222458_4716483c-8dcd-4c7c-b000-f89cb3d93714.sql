
-- Allow superadmin to manage featured_products
CREATE POLICY "Superadmin insert featured_products"
ON public.featured_products FOR INSERT
TO authenticated
WITH CHECK (is_superadmin(auth.uid()));

CREATE POLICY "Superadmin update featured_products"
ON public.featured_products FOR UPDATE
TO authenticated
USING (is_superadmin(auth.uid()));

CREATE POLICY "Superadmin delete featured_products"
ON public.featured_products FOR DELETE
TO authenticated
USING (is_superadmin(auth.uid()));
