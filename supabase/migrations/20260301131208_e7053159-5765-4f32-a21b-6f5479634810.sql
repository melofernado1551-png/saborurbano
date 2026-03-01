
-- Add INSERT policy using get_app_user_tenant_id for product_category_relations
CREATE POLICY "Tenant admin insert relations"
ON public.product_category_relations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_category_relations.product_id
    AND products.tenant_id = get_app_user_tenant_id(auth.uid())
  )
  OR is_superadmin(auth.uid())
);

-- Add DELETE policy using get_app_user_tenant_id for product_category_relations
CREATE POLICY "Tenant admin delete relations"
ON public.product_category_relations
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_category_relations.product_id
    AND products.tenant_id = get_app_user_tenant_id(auth.uid())
  )
);
