
-- Create a function to update password hash for app_users
CREATE OR REPLACE FUNCTION public.update_app_user_password(_user_id uuid, _password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  UPDATE public.app_users
  SET password_hash = extensions.crypt(_password, extensions.gen_salt('bf', 10))
  WHERE id = _user_id;
END;
$function$;
