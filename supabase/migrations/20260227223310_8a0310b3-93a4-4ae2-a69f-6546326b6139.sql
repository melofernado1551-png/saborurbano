
-- Tabela de adicionais de produto
CREATE TABLE public.product_addons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para busca por produto
CREATE INDEX idx_product_addons_product_id ON public.product_addons(product_id);

-- RLS
ALTER TABLE public.product_addons ENABLE ROW LEVEL SECURITY;

-- Leitura pública (apenas ativos)
CREATE POLICY "Public read active addons"
ON public.product_addons FOR SELECT
USING (active = true);

-- Membros do tenant gerenciam adicionais
CREATE POLICY "Members insert addons"
ON public.product_addons FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_addons.product_id
    AND (products.tenant_id = get_user_tenant_id() OR products.tenant_id = get_app_user_tenant_id(auth.uid()))
  )
);

CREATE POLICY "Members update addons"
ON public.product_addons FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_addons.product_id
    AND (products.tenant_id = get_user_tenant_id() OR products.tenant_id = get_app_user_tenant_id(auth.uid()))
  )
);

CREATE POLICY "Members delete addons"
ON public.product_addons FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_addons.product_id
    AND (products.tenant_id = get_user_tenant_id() OR products.tenant_id = get_app_user_tenant_id(auth.uid()))
  )
);

-- Superadmin full access
CREATE POLICY "Superadmin manage addons"
ON public.product_addons FOR ALL
USING (is_superadmin(auth.uid()))
WITH CHECK (is_superadmin(auth.uid()));
