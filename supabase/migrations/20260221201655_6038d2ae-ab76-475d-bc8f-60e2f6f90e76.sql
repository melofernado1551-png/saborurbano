
-- Function to verify password against hash
CREATE OR REPLACE FUNCTION public.verify_password(_password TEXT, _hash TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT _hash = extensions.crypt(_password, _hash)
$$;

-- Function to create app_user with hashed password
CREATE OR REPLACE FUNCTION public.create_app_user(
  _login TEXT,
  _password TEXT,
  _role TEXT,
  _tenant_id UUID,
  _auth_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _id UUID;
BEGIN
  INSERT INTO public.app_users (login, password_hash, role, tenant_id, auth_id)
  VALUES (_login, extensions.crypt(_password, extensions.gen_salt('bf', 10)), _role, _tenant_id, _auth_id)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
