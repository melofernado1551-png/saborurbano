
-- Add PIX configuration fields to tenants table
ALTER TABLE public.tenants 
ADD COLUMN pix_copy_paste text DEFAULT NULL,
ADD COLUMN pix_receiver_name text DEFAULT NULL;
