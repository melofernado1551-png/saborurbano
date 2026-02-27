
-- Table for neighborhoods served by each tenant with shipping fees
CREATE TABLE public.tenant_neighborhoods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  shipping_fee NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_tenant_neighborhoods_tenant ON public.tenant_neighborhoods(tenant_id);

-- Enable RLS
ALTER TABLE public.tenant_neighborhoods ENABLE ROW LEVEL SECURITY;

-- Public can read active neighborhoods (customers need to see them)
CREATE POLICY "Public read active neighborhoods"
  ON public.tenant_neighborhoods FOR SELECT
  USING (active = true);

-- Tenant admins manage their own neighborhoods
CREATE POLICY "Members insert neighborhoods"
  ON public.tenant_neighborhoods FOR INSERT
  WITH CHECK (tenant_id = get_app_user_tenant_id(auth.uid()));

CREATE POLICY "Members update neighborhoods"
  ON public.tenant_neighborhoods FOR UPDATE
  USING (tenant_id = get_app_user_tenant_id(auth.uid()));

CREATE POLICY "Members delete neighborhoods"
  ON public.tenant_neighborhoods FOR DELETE
  USING (tenant_id = get_app_user_tenant_id(auth.uid()));

-- Superadmin full access
CREATE POLICY "Superadmin manage neighborhoods"
  ON public.tenant_neighborhoods FOR ALL
  USING (is_superadmin(auth.uid()))
  WITH CHECK (is_superadmin(auth.uid()));

-- Add neighborhood_id to customer_addresses
ALTER TABLE public.customer_addresses
  ADD COLUMN neighborhood_id UUID REFERENCES public.tenant_neighborhoods(id),
  ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
