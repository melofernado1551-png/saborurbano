
-- Add name, cpf, cargo columns to app_users
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS cargo text;

-- Update create_app_user function to accept new fields
CREATE OR REPLACE FUNCTION public.create_app_user(
  _login text, _password text, _role text, _tenant_id uuid, _auth_id uuid,
  _name text DEFAULT NULL, _cpf text DEFAULT NULL, _cargo text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _id UUID;
BEGIN
  INSERT INTO public.app_users (login, password_hash, role, tenant_id, auth_id, name, cpf, cargo)
  VALUES (_login, extensions.crypt(_password, extensions.gen_salt('bf', 10)), _role, _tenant_id, _auth_id, _name, _cpf, _cargo)
  RETURNING id INTO _id;
  RETURN _id;
END;
$function$;

-- Add RLS policy so tenant_admin (now "admin" role) can manage users of their own tenant
CREATE POLICY "Tenant admin insert app_users"
  ON public.app_users FOR INSERT
  WITH CHECK (
    get_app_user_role(auth.uid()) = 'tenant_admin'
    AND tenant_id = get_app_user_tenant_id(auth.uid())
  );

CREATE POLICY "Tenant admin update app_users"
  ON public.app_users FOR UPDATE
  USING (
    get_app_user_role(auth.uid()) = 'tenant_admin'
    AND tenant_id = get_app_user_tenant_id(auth.uid())
  );
