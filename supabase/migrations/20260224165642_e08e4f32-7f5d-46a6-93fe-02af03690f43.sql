
-- Create push_subscriptions table
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id, endpoint)
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Customers can manage their own subscriptions
CREATE POLICY "Customers insert own push subscriptions"
ON public.push_subscriptions FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM customers WHERE customers.id = push_subscriptions.customer_id AND customers.auth_id = auth.uid() AND customers.active = true
));

CREATE POLICY "Customers read own push subscriptions"
ON public.push_subscriptions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM customers WHERE customers.id = push_subscriptions.customer_id AND customers.auth_id = auth.uid() AND customers.active = true
));

CREATE POLICY "Customers delete own push subscriptions"
ON public.push_subscriptions FOR DELETE
USING (EXISTS (
  SELECT 1 FROM customers WHERE customers.id = push_subscriptions.customer_id AND customers.auth_id = auth.uid() AND customers.active = true
));

-- Service role can read all for sending notifications
CREATE POLICY "Service role read all push subscriptions"
ON public.push_subscriptions FOR SELECT
USING (true);

-- Enable realtime for sales (already done but ensure)
ALTER PUBLICATION supabase_realtime ADD TABLE public.push_subscriptions;
