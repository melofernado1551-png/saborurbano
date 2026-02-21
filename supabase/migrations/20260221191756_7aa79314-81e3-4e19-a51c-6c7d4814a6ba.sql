
-- =============================================
-- FOODCITY MULTI-TENANT SCHEMA
-- =============================================

-- 1. ROLE ENUM
CREATE TYPE public.app_role AS ENUM ('owner', 'manager', 'staff');

-- 2. TENANTS
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#FF6B00',
  secondary_color TEXT DEFAULT '#1A1A2E',
  layout_id UUID,
  whatsapp_number TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 3. SYSTEM USERS
CREATE TABLE public.system_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;

-- 4. USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. CUSTOMERS
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 6. LAYOUTS
CREATE TABLE public.layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  preview_image_url TEXT,
  config JSONB DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.layouts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tenants ADD CONSTRAINT fk_tenants_layout FOREIGN KEY (layout_id) REFERENCES public.layouts(id);

CREATE TABLE public.tenant_layouts (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  layout_id UUID NOT NULL REFERENCES public.layouts(id),
  custom_config JSONB DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.tenant_layouts ENABLE ROW LEVEL SECURITY;

-- 7. HOME CATEGORIES
CREATE TABLE public.home_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.home_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- 8. BANNERS
CREATE TABLE public.promo_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  link TEXT,
  position INT DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.promo_banners ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mini_promo_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  link TEXT,
  active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.mini_promo_banners ENABLE ROW LEVEL SECURITY;

-- 9. PRODUCTS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  promo_price NUMERIC,
  has_discount BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.product_category_relations (
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (product_id, category_id)
);
ALTER TABLE public.product_category_relations ENABLE ROW LEVEL SECURITY;

-- 10. FEATURED PRODUCTS
CREATE TABLE public.featured_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  position INT DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.featured_products ENABLE ROW LEVEL SECURITY;

-- 11. STOCK
CREATE TABLE public.product_stock (
  product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 0,
  min_quantity INT NOT NULL DEFAULT 5,
  active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.product_stock ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;

-- 12. ORDERS
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id),
  origin TEXT NOT NULL DEFAULT 'web',
  delivery_type TEXT NOT NULL DEFAULT 'entrega',
  payment_method TEXT,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aberto',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INT NOT NULL DEFAULT 1,
  price NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 13. WHATSAPP SESSIONS
CREATE TABLE public.whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  step TEXT DEFAULT 'inicio',
  current_order_id UUID REFERENCES public.orders(id),
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SECURITY DEFINER FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT tenant_id FROM public.system_users WHERE id = auth.uid() AND active = true
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.system_users WHERE id = _user_id AND tenant_id = _tenant_id AND active = true)
$$;

-- =============================================
-- RLS POLICIES
-- =============================================

-- TENANTS
CREATE POLICY "Public read active tenants" ON public.tenants FOR SELECT USING (active = true);
CREATE POLICY "Members update own tenant" ON public.tenants FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), id));

-- SYSTEM_USERS
CREATE POLICY "Read own profile" ON public.system_users FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Read teammates" ON public.system_users FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Insert own profile" ON public.system_users FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Update own profile" ON public.system_users FOR UPDATE TO authenticated USING (id = auth.uid());

-- USER_ROLES
CREATE POLICY "Read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owners manage roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'owner')
);
CREATE POLICY "Owners delete roles" ON public.user_roles FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'owner')
);

-- CUSTOMERS
CREATE POLICY "Members read customers" ON public.customers FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Members insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Members update customers" ON public.customers FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Public insert customers" ON public.customers FOR INSERT WITH CHECK (true);

-- LAYOUTS
CREATE POLICY "Public read layouts" ON public.layouts FOR SELECT USING (active = true);

-- TENANT_LAYOUTS
CREATE POLICY "Public read tenant layouts" ON public.tenant_layouts FOR SELECT USING (active = true);
CREATE POLICY "Members manage layout" ON public.tenant_layouts FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Members update layout" ON public.tenant_layouts FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Members delete layout" ON public.tenant_layouts FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant_id());

-- HOME_CATEGORIES
CREATE POLICY "Public read home categories" ON public.home_categories FOR SELECT USING (active = true);

-- PRODUCT_CATEGORIES
CREATE POLICY "Public read product categories" ON public.product_categories FOR SELECT USING (active = true);
CREATE POLICY "Members insert categories" ON public.product_categories FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Members update categories" ON public.product_categories FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Members delete categories" ON public.product_categories FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant_id());

-- PROMO_BANNERS
CREATE POLICY "Public read promo banners" ON public.promo_banners FOR SELECT USING (active = true);
CREATE POLICY "Members insert banners" ON public.promo_banners FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Members update banners" ON public.promo_banners FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Members delete banners" ON public.promo_banners FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant_id());

-- MINI_PROMO_BANNERS
CREATE POLICY "Public read mini banners" ON public.mini_promo_banners FOR SELECT USING (active = true);
CREATE POLICY "Members insert mini banners" ON public.mini_promo_banners FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Members update mini banners" ON public.mini_promo_banners FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Members delete mini banners" ON public.mini_promo_banners FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant_id());

-- PRODUCTS
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (active = true);
CREATE POLICY "Members insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Members update products" ON public.products FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Members delete products" ON public.products FOR DELETE TO authenticated USING (tenant_id = public.get_user_tenant_id());

-- PRODUCT_IMAGES
CREATE POLICY "Public read product images" ON public.product_images FOR SELECT USING (active = true);
CREATE POLICY "Members insert images" ON public.product_images FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.products WHERE id = product_images.product_id AND tenant_id = public.get_user_tenant_id()));
CREATE POLICY "Members update images" ON public.product_images FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products WHERE id = product_images.product_id AND tenant_id = public.get_user_tenant_id()));
CREATE POLICY "Members delete images" ON public.product_images FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products WHERE id = product_images.product_id AND tenant_id = public.get_user_tenant_id()));

-- PRODUCT_CATEGORY_RELATIONS
CREATE POLICY "Public read relations" ON public.product_category_relations FOR SELECT USING (active = true);
CREATE POLICY "Members insert relations" ON public.product_category_relations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.products WHERE id = product_category_relations.product_id AND tenant_id = public.get_user_tenant_id()));
CREATE POLICY "Members delete relations" ON public.product_category_relations FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products WHERE id = product_category_relations.product_id AND tenant_id = public.get_user_tenant_id()));

-- FEATURED_PRODUCTS
CREATE POLICY "Public read featured" ON public.featured_products FOR SELECT USING (active = true);

-- PRODUCT_STOCK
CREATE POLICY "Members read stock" ON public.product_stock FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Members insert stock" ON public.product_stock FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Members update stock" ON public.product_stock FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id());

-- STOCK_ALERTS
CREATE POLICY "Members read alerts" ON public.stock_alerts FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Members update alerts" ON public.stock_alerts FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id());

-- ORDERS
CREATE POLICY "Members read orders" ON public.orders FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Members update orders" ON public.orders FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Public create orders" ON public.orders FOR INSERT WITH CHECK (true);

-- ORDER_ITEMS
CREATE POLICY "Members read order items" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders WHERE id = order_items.order_id AND tenant_id = public.get_user_tenant_id()));
CREATE POLICY "Public create order items" ON public.order_items FOR INSERT WITH CHECK (true);

-- WHATSAPP_SESSIONS
CREATE POLICY "Members read sessions" ON public.whatsapp_sessions FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Members insert sessions" ON public.whatsapp_sessions FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Members update sessions" ON public.whatsapp_sessions FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id());

-- =============================================
-- TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION public.auto_create_product_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.product_stock (product_id, tenant_id, quantity, min_quantity)
  VALUES (NEW.id, NEW.tenant_id, 0, 5);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_create_stock
AFTER INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.auto_create_product_stock();

CREATE OR REPLACE FUNCTION public.check_low_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.quantity <= NEW.min_quantity THEN
    INSERT INTO public.stock_alerts (tenant_id, product_id, message)
    VALUES (NEW.tenant_id, NEW.product_id, 'Estoque baixo: ' || NEW.quantity || ' unidades restantes');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_low_stock
AFTER UPDATE ON public.product_stock
FOR EACH ROW EXECUTE FUNCTION public.check_low_stock();

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_system_users_tenant ON public.system_users(tenant_id);
CREATE INDEX idx_customers_tenant ON public.customers(tenant_id);
CREATE INDEX idx_products_tenant ON public.products(tenant_id);
CREATE INDEX idx_orders_tenant ON public.orders(tenant_id);
CREATE INDEX idx_orders_customer ON public.orders(customer_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_product_stock_tenant ON public.product_stock(tenant_id);
CREATE INDEX idx_stock_alerts_tenant ON public.stock_alerts(tenant_id);
CREATE INDEX idx_whatsapp_sessions_tenant ON public.whatsapp_sessions(tenant_id);
CREATE INDEX idx_tenants_slug ON public.tenants(slug);
CREATE INDEX idx_promo_banners_tenant ON public.promo_banners(tenant_id);
CREATE INDEX idx_product_categories_tenant ON public.product_categories(tenant_id);
