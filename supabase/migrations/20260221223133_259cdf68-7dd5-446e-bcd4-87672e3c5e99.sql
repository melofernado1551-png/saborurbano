
-- Add must_change_password column to app_users
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
