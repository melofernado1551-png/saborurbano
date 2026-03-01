
-- Create sale_items table to track individual items in each sale
CREATE TABLE public.sale_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- Tenant members can read sale items for their tenant's sales
CREATE POLICY "Tenant members read sale_items"
  ON public.sale_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_items.sale_id
    AND s.tenant_id = get_app_user_tenant_id(auth.uid())
  ));

-- Tenant members can insert sale items for their tenant's sales
CREATE POLICY "Tenant members insert sale_items"
  ON public.sale_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_items.sale_id
    AND s.tenant_id = get_app_user_tenant_id(auth.uid())
  ));

-- Tenant members can update sale items for their tenant's sales
CREATE POLICY "Tenant members update sale_items"
  ON public.sale_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_items.sale_id
    AND s.tenant_id = get_app_user_tenant_id(auth.uid())
  ));

-- Tenant members can delete sale items for their tenant's sales
CREATE POLICY "Tenant members delete sale_items"
  ON public.sale_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_items.sale_id
    AND s.tenant_id = get_app_user_tenant_id(auth.uid())
  ));

-- Superadmin full access
CREATE POLICY "Superadmin manage sale_items"
  ON public.sale_items FOR ALL
  USING (is_superadmin(auth.uid()))
  WITH CHECK (is_superadmin(auth.uid()));

-- Index for performance
CREATE INDEX idx_sale_items_sale_id ON public.sale_items(sale_id);
