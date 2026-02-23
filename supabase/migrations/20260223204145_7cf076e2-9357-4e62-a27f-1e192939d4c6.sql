
-- =============================================
-- FASE 1: Estrutura de banco para fluxo de pedidos via chat
-- =============================================

-- 1. Atualizar tabela customers: adicionar auth_id e email
ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS auth_id uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS email text UNIQUE;

-- 2. Tabela de endereços do cliente
CREATE TABLE public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  label text NOT NULL, -- Ex: Casa, Trabalho
  street text NOT NULL,
  number text NOT NULL,
  complement text,
  neighborhood text NOT NULL,
  city text NOT NULL,
  reference text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers read own addresses"
  ON public.customer_addresses FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.customers 
    WHERE customers.id = customer_addresses.customer_id 
      AND customers.auth_id = auth.uid()
      AND customers.active = true
  ));

CREATE POLICY "Customers insert own addresses"
  ON public.customer_addresses FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.customers 
    WHERE customers.id = customer_addresses.customer_id 
      AND customers.auth_id = auth.uid()
      AND customers.active = true
  ));

CREATE POLICY "Customers update own addresses"
  ON public.customer_addresses FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.customers 
    WHERE customers.id = customer_addresses.customer_id 
      AND customers.auth_id = auth.uid()
      AND customers.active = true
  ));

CREATE POLICY "Customers delete own addresses"
  ON public.customer_addresses FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.customers 
    WHERE customers.id = customer_addresses.customer_id 
      AND customers.auth_id = auth.uid()
      AND customers.active = true
  ));

-- Tenant members can read addresses for orders
CREATE POLICY "Tenant members read customer addresses"
  ON public.customer_addresses FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = customer_addresses.customer_id
      AND c.tenant_id = get_app_user_tenant_id(auth.uid())
  ));

-- 3. Tabela de chats
CREATE TABLE public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  sale_id uuid, -- will reference sales, added after sales update
  status text NOT NULL DEFAULT 'open', -- open, closed
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers read own chats"
  ON public.chats FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.customers 
    WHERE customers.id = chats.customer_id 
      AND customers.auth_id = auth.uid()
      AND customers.active = true
  ));

CREATE POLICY "Customers insert chats"
  ON public.chats FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.customers 
    WHERE customers.id = chats.customer_id 
      AND customers.auth_id = auth.uid()
      AND customers.active = true
  ));

CREATE POLICY "Tenant members read chats"
  ON public.chats FOR SELECT
  USING (tenant_id = get_app_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members update chats"
  ON public.chats FOR UPDATE
  USING (tenant_id = get_app_user_tenant_id(auth.uid()));

-- 4. Tabela de mensagens do chat
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_type text NOT NULL, -- 'customer', 'tenant', 'system'
  sender_id uuid, -- customer_id or profile_id depending on sender_type
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'text', -- 'text', 'order_summary', 'address_selection', 'status_update'
  metadata jsonb DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Customers can read messages from their chats
CREATE POLICY "Customers read own chat messages"
  ON public.chat_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.chats
    JOIN public.customers ON customers.id = chats.customer_id
    WHERE chats.id = chat_messages.chat_id
      AND customers.auth_id = auth.uid()
      AND customers.active = true
  ));

-- Customers can send messages in their chats
CREATE POLICY "Customers insert chat messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.chats
    JOIN public.customers ON customers.id = chats.customer_id
    WHERE chats.id = chat_messages.chat_id
      AND customers.auth_id = auth.uid()
      AND customers.active = true
  ));

-- Tenant members can read chat messages
CREATE POLICY "Tenant members read chat messages"
  ON public.chat_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = chat_messages.chat_id
      AND chats.tenant_id = get_app_user_tenant_id(auth.uid())
  ));

-- Tenant members can send messages
CREATE POLICY "Tenant members insert chat messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = chat_messages.chat_id
      AND chats.tenant_id = get_app_user_tenant_id(auth.uid())
  ));

-- 5. Atualizar tabela sales com campos adicionais
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS sale_number integer,
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id),
  ADD COLUMN IF NOT EXISTS chat_id uuid REFERENCES public.chats(id),
  ADD COLUMN IF NOT EXISTS financial_status text NOT NULL DEFAULT 'pending', -- pending, partial, paid
  ADD COLUMN IF NOT EXISTS operational_status text NOT NULL DEFAULT 'received', -- received, preparing, delivering, completed
  ADD COLUMN IF NOT EXISTS delivery_address jsonb;

-- Sequence helper: get next sale number per tenant
CREATE OR REPLACE FUNCTION public.next_sale_number(_tenant_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(MAX(sale_number), 0) + 1 
  FROM public.sales 
  WHERE tenant_id = _tenant_id
$$;

-- 6. Tabela de pagamentos da venda
CREATE TABLE public.sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  amount numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL, -- pix, dinheiro, cartao, outros
  registered_by uuid, -- profile id of who registered
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read payments"
  ON public.sale_payments FOR SELECT
  USING (tenant_id = get_app_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members insert payments"
  ON public.sale_payments FOR INSERT
  WITH CHECK (tenant_id = get_app_user_tenant_id(auth.uid()));

CREATE POLICY "Superadmin read all payments"
  ON public.sale_payments FOR SELECT
  USING (is_superadmin(auth.uid()));

-- Customers can see payments on their sales
CREATE POLICY "Customers read own sale payments"
  ON public.sale_payments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sales s
    JOIN public.customers c ON c.id = s.customer_id
    WHERE s.id = sale_payments.sale_id
      AND c.auth_id = auth.uid()
      AND c.active = true
  ));

-- 7. Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;

-- 8. Function to get customer by auth_id
CREATE OR REPLACE FUNCTION public.get_customer_by_auth_id(_auth_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.customers WHERE auth_id = _auth_id AND active = true LIMIT 1
$$;
