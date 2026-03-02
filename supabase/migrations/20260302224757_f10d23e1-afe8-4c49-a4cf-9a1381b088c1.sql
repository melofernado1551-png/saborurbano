
-- Add new columns to sales for delivery/waiter tracking
ALTER TABLE public.sales 
  ADD COLUMN IF NOT EXISTS entregador_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS entregador_nome text,
  ADD COLUMN IF NOT EXISTS hora_saida_entrega timestamp with time zone,
  ADD COLUMN IF NOT EXISTS hora_entrega timestamp with time zone,
  ADD COLUMN IF NOT EXISTS tempo_total_entrega integer,
  ADD COLUMN IF NOT EXISTS garcom_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS garcom_nome text;

-- Add 'entregador' role to the profiles role options (it's a text field, no enum needed)
-- The profiles.role is already a text field supporting: superadmin, tenant_admin, colaborador, contador, garcom
-- We just need to use 'entregador' as a new value
