
-- Update INSERT policy to allow superadmins
DROP POLICY "Members insert images" ON public.product_images;
CREATE POLICY "Members insert images" ON public.product_images
FOR INSERT WITH CHECK (
  is_superadmin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_images.product_id
    AND products.tenant_id = get_user_tenant_id()
  )
);

-- Update UPDATE policy to allow superadmins
DROP POLICY "Members update images" ON public.product_images;
CREATE POLICY "Members update images" ON public.product_images
FOR UPDATE USING (
  is_superadmin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_images.product_id
    AND products.tenant_id = get_user_tenant_id()
  )
);

-- Update DELETE policy to allow superadmins
DROP POLICY "Members delete images" ON public.product_images;
CREATE POLICY "Members delete images" ON public.product_images
FOR DELETE USING (
  is_superadmin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_images.product_id
    AND products.tenant_id = get_user_tenant_id()
  )
);
