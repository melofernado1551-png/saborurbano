ALTER TABLE public.tenants
ADD COLUMN free_shipping boolean DEFAULT false,
ADD COLUMN shipping_fee numeric DEFAULT null;