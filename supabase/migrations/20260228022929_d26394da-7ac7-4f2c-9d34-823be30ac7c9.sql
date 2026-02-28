
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Customers can view own favorite tenants" ON public.customer_favorite_tenants;
DROP POLICY IF EXISTS "Customers can insert own favorite tenants" ON public.customer_favorite_tenants;
DROP POLICY IF EXISTS "Customers can update own favorite tenants" ON public.customer_favorite_tenants;
DROP POLICY IF EXISTS "Customers can delete own favorite tenants" ON public.customer_favorite_tenants;

-- Recreate as PERMISSIVE
CREATE POLICY "Customers can view own favorite tenants"
  ON public.customer_favorite_tenants FOR SELECT
  USING (customer_id IN (SELECT id FROM customers WHERE auth_id = auth.uid()));

CREATE POLICY "Customers can insert own favorite tenants"
  ON public.customer_favorite_tenants FOR INSERT
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE auth_id = auth.uid()));

CREATE POLICY "Customers can update own favorite tenants"
  ON public.customer_favorite_tenants FOR UPDATE
  USING (customer_id IN (SELECT id FROM customers WHERE auth_id = auth.uid()));

CREATE POLICY "Customers can delete own favorite tenants"
  ON public.customer_favorite_tenants FOR DELETE
  USING (customer_id IN (SELECT id FROM customers WHERE auth_id = auth.uid()));
