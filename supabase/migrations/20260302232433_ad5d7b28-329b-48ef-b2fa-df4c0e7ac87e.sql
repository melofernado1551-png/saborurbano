
-- Fix product_images RLS policies to use get_app_user_tenant_id
DROP POLICY IF EXISTS "Members delete images" ON public.product_images;
DROP POLICY IF EXISTS "Members insert images" ON public.product_images;
DROP POLICY IF EXISTS "Members update images" ON public.product_images;

CREATE POLICY "Members delete images" ON public.product_images
FOR DELETE USING (
  is_superadmin(auth.uid()) OR EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_images.product_id
    AND (products.tenant_id = get_user_tenant_id() OR products.tenant_id = get_app_user_tenant_id(auth.uid()))
  )
);

CREATE POLICY "Members insert images" ON public.product_images
FOR INSERT WITH CHECK (
  is_superadmin(auth.uid()) OR EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_images.product_id
    AND (products.tenant_id = get_user_tenant_id() OR products.tenant_id = get_app_user_tenant_id(auth.uid()))
  )
);

CREATE POLICY "Members update images" ON public.product_images
FOR UPDATE USING (
  is_superadmin(auth.uid()) OR EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_images.product_id
    AND (products.tenant_id = get_user_tenant_id() OR products.tenant_id = get_app_user_tenant_id(auth.uid()))
  )
);
