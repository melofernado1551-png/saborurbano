
-- 1) Tabela de mesas
CREATE TABLE public.mesas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  numero INTEGER NOT NULL,
  identificador TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, numero)
);

ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active mesas" ON public.mesas
  FOR SELECT USING (active = true);

CREATE POLICY "Tenant admin manage mesas" ON public.mesas
  FOR ALL TO authenticated
  USING (tenant_id = get_app_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_app_user_tenant_id(auth.uid()));

CREATE POLICY "Superadmin manage mesas" ON public.mesas
  FOR ALL TO authenticated
  USING (is_superadmin(auth.uid()))
  WITH CHECK (is_superadmin(auth.uid()));

-- 2) Adicionar campos em sales
ALTER TABLE public.sales
  ADD COLUMN tipo_pedido TEXT NOT NULL DEFAULT 'delivery',
  ADD COLUMN mesa_id UUID REFERENCES public.mesas(id),
  ADD COLUMN numero_mesa INTEGER;

-- 3) Habilitar realtime para mesas
ALTER PUBLICATION supabase_realtime ADD TABLE public.mesas;
