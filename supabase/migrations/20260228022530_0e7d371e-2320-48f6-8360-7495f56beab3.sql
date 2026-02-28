
-- Create table for customer favorite tenants (stores)
CREATE TABLE public.customer_favorite_tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_id, tenant_id)
);

-- Enable RLS
ALTER TABLE public.customer_favorite_tenants ENABLE ROW LEVEL SECURITY;

-- Customers can view their own favorite tenants
CREATE POLICY "Customers can view own favorite tenants"
ON public.customer_favorite_tenants FOR SELECT
USING (customer_id IN (
  SELECT id FROM public.customers WHERE auth_id = auth.uid()
));

-- Customers can insert their own favorite tenants
CREATE POLICY "Customers can insert own favorite tenants"
ON public.customer_favorite_tenants FOR INSERT
WITH CHECK (customer_id IN (
  SELECT id FROM public.customers WHERE auth_id = auth.uid()
));

-- Customers can delete their own favorite tenants
CREATE POLICY "Customers can delete own favorite tenants"
ON public.customer_favorite_tenants FOR DELETE
USING (customer_id IN (
  SELECT id FROM public.customers WHERE auth_id = auth.uid()
));

-- Customers can update their own favorite tenants
CREATE POLICY "Customers can update own favorite tenants"
ON public.customer_favorite_tenants FOR UPDATE
USING (customer_id IN (
  SELECT id FROM public.customers WHERE auth_id = auth.uid()
));
