-- Update all database functions to reference 'profiles' instead of 'app_users'

CREATE OR REPLACE FUNCTION public.create_app_user(_login text, _password text, _role text, _tenant_id uuid, _auth_id uuid, _name text DEFAULT NULL::text, _cpf text DEFAULT NULL::text, _cargo text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _id UUID;
BEGIN
  INSERT INTO public.profiles (login, password_hash, role, tenant_id, auth_id, name, cpf, cargo)
  VALUES (_login, extensions.crypt(_password, extensions.gen_salt('bf', 10)), _role, _tenant_id, _auth_id, _name, _cpf, _cargo)
  RETURNING id INTO _id;
  RETURN _id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_app_user(_login text, _password text, _role text, _tenant_id uuid, _auth_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _id UUID;
BEGIN
  INSERT INTO public.profiles (login, password_hash, role, tenant_id, auth_id)
  VALUES (_login, extensions.crypt(_password, extensions.gen_salt('bf', 10)), _role, _tenant_id, _auth_id)
  RETURNING id INTO _id;
  RETURN _id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_app_user_role(_auth_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.profiles WHERE auth_id = _auth_id AND active = true
$function$;

CREATE OR REPLACE FUNCTION public.get_app_user_tenant_id(_auth_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT tenant_id FROM public.profiles WHERE auth_id = _auth_id AND active = true
$function$;

CREATE OR REPLACE FUNCTION public.is_superadmin(_auth_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = _auth_id AND role = 'superadmin' AND active = true)
$function$;

CREATE OR REPLACE FUNCTION public.update_app_user_password(_user_id uuid, _password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  UPDATE public.profiles
  SET password_hash = extensions.crypt(_password, extensions.gen_salt('bf', 10))
  WHERE id = _user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_password(_password text, _hash text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  SELECT _hash = extensions.crypt(_password, _hash)
$function$;