
-- Add new columns to tenants table for full restaurant management
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS owner_phone text,
  ADD COLUMN IF NOT EXISTS owner_email text;

-- Allow superadmin to insert tenants
CREATE POLICY "Superadmin insert tenants"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (is_superadmin(auth.uid()));

-- Allow superadmin to delete (soft) tenants  
CREATE POLICY "Superadmin delete tenants"
ON public.tenants
FOR DELETE
TO authenticated
USING (is_superadmin(auth.uid()));

-- Allow superadmin to update any tenant
CREATE POLICY "Superadmin update any tenant"
ON public.tenants
FOR UPDATE
TO authenticated
USING (is_superadmin(auth.uid()));

-- Allow superadmin to manage app_users
CREATE POLICY "Superadmin insert app_users"
ON public.app_users
FOR INSERT
TO authenticated
WITH CHECK (is_superadmin(auth.uid()));

CREATE POLICY "Superadmin update app_users"
ON public.app_users
FOR UPDATE
TO authenticated
USING (is_superadmin(auth.uid()));
