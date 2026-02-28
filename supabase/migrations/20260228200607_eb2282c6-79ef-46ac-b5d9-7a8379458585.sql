
-- Create sale_reviews table for customer ratings
CREATE TABLE public.sale_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique: one review per sale
CREATE UNIQUE INDEX idx_sale_reviews_sale_id ON public.sale_reviews(sale_id) WHERE active = true;

-- Enable RLS
ALTER TABLE public.sale_reviews ENABLE ROW LEVEL SECURITY;

-- Customers can insert their own reviews
CREATE POLICY "Customers insert own reviews"
  ON public.sale_reviews FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM customers WHERE customers.id = sale_reviews.customer_id AND customers.auth_id = auth.uid() AND customers.active = true
  ));

-- Customers can read their own reviews
CREATE POLICY "Customers read own reviews"
  ON public.sale_reviews FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM customers WHERE customers.id = sale_reviews.customer_id AND customers.auth_id = auth.uid() AND customers.active = true
  ));

-- Tenant members can read reviews for their tenant
CREATE POLICY "Tenant members read reviews"
  ON public.sale_reviews FOR SELECT
  USING (tenant_id = get_app_user_tenant_id(auth.uid()));

-- Superadmin reads all
CREATE POLICY "Superadmin reads all reviews"
  ON public.sale_reviews FOR SELECT
  USING (is_superadmin(auth.uid()));
