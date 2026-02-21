
-- Create unique index on login for active users
CREATE UNIQUE INDEX idx_app_users_login_unique ON public.app_users (login) WHERE active = true;
