
-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create app_users table for custom auth
CREATE TABLE public.app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  login TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  tenant_id UUID REFERENCES public.tenants(id),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_role CHECK (role IN ('superadmin', 'tenant_admin', 'user')),
  CONSTRAINT superadmin_no_tenant CHECK (
    (role = 'superadmin' AND tenant_id IS NULL) OR (role != 'superadmin')
  ),
  CONSTRAINT non_superadmin_needs_tenant CHECK (
    (role = 'superadmin') OR (tenant_id IS NOT NULL)
  )
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Security definer function to get app_user role
CREATE OR REPLACE FUNCTION public.get_app_user_role(_auth_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.app_users WHERE auth_id = _auth_id AND active = true
$$;

-- Security definer function to get app_user tenant_id
CREATE OR REPLACE FUNCTION public.get_app_user_tenant_id(_auth_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.app_users WHERE auth_id = _auth_id AND active = true
$$;

-- Security definer function to check if user is superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin(_auth_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_users WHERE auth_id = _auth_id AND role = 'superadmin' AND active = true)
$$;

-- RLS for app_users: superadmin sees all, others see own + same tenant
CREATE POLICY "Superadmin reads all users"
ON public.app_users FOR SELECT
TO authenticated
USING (is_superadmin(auth.uid()));

CREATE POLICY "Users read own record"
ON public.app_users FOR SELECT
TO authenticated
USING (auth_id = auth.uid());

CREATE POLICY "Tenant admins read tenant users"
ON public.app_users FOR SELECT
TO authenticated
USING (
  tenant_id = get_app_user_tenant_id(auth.uid())
  AND get_app_user_role(auth.uid()) IN ('tenant_admin', 'superadmin')
);

-- Create sales table
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  valor_total NUMERIC NOT NULL DEFAULT 0,
  forma_pagamento TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Sales RLS
CREATE POLICY "Superadmin reads all sales"
ON public.sales FOR SELECT
TO authenticated
USING (is_superadmin(auth.uid()));

CREATE POLICY "Tenant members read own sales"
ON public.sales FOR SELECT
TO authenticated
USING (tenant_id = get_app_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members insert sales"
ON public.sales FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = get_app_user_tenant_id(auth.uid())
  OR is_superadmin(auth.uid())
);

CREATE POLICY "Tenant members update sales"
ON public.sales FOR UPDATE
TO authenticated
USING (
  tenant_id = get_app_user_tenant_id(auth.uid())
  OR is_superadmin(auth.uid())
);

-- Insert superadmin user (password hashed with bcrypt)
-- Password: fmjradmin##2027&&
INSERT INTO public.app_users (login, password_hash, role, tenant_id)
VALUES ('admin', crypt('fmjradmin##2027&&', gen_salt('bf', 10)), 'superadmin', NULL);
