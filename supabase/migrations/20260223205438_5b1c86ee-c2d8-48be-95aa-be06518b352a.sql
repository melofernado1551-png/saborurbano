
-- Customers need to INSERT sales when checking out
CREATE POLICY "Customers insert own sales"
ON public.sales
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = sales.customer_id
    AND customers.auth_id = auth.uid()
    AND customers.active = true
  )
);

-- Customers need to READ their own sales
CREATE POLICY "Customers read own sales"
ON public.sales
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = sales.customer_id
    AND customers.auth_id = auth.uid()
    AND customers.active = true
  )
);

-- Customers need to read own chats (already exists but let's also allow update for address)
CREATE POLICY "Customers update own chats"
ON public.chats
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = chats.customer_id
    AND customers.auth_id = auth.uid()
    AND customers.active = true
  )
);

-- Customers need to read own customers record
CREATE POLICY "Customers read own record"
ON public.customers
FOR SELECT
USING (auth_id = auth.uid() AND active = true);

-- Customers need to update own record
CREATE POLICY "Customers update own record"
ON public.customers
FOR UPDATE
USING (auth_id = auth.uid() AND active = true);
