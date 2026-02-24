ALTER TABLE public.tenants
ADD COLUMN opening_time text DEFAULT '08:00',
ADD COLUMN closing_time text DEFAULT '22:00';