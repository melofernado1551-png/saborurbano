
-- =============================================
-- MÓDULO FINANCEIRO (CAIXA)
-- =============================================

-- 1. Tipos de Receita
CREATE TABLE public.revenue_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.revenue_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read revenue_types" ON public.revenue_types
  FOR SELECT USING (tenant_id = get_app_user_tenant_id(auth.uid()) OR is_superadmin(auth.uid()));

CREATE POLICY "Admin insert revenue_types" ON public.revenue_types
  FOR INSERT WITH CHECK (
    (tenant_id = get_app_user_tenant_id(auth.uid()) AND get_app_user_role(auth.uid()) IN ('tenant_admin', 'superadmin'))
    OR is_superadmin(auth.uid())
  );

CREATE POLICY "Admin update revenue_types" ON public.revenue_types
  FOR UPDATE USING (
    (tenant_id = get_app_user_tenant_id(auth.uid()) AND get_app_user_role(auth.uid()) IN ('tenant_admin', 'superadmin'))
    OR is_superadmin(auth.uid())
  );

CREATE POLICY "Admin delete revenue_types" ON public.revenue_types
  FOR DELETE USING (
    (tenant_id = get_app_user_tenant_id(auth.uid()) AND get_app_user_role(auth.uid()) IN ('tenant_admin', 'superadmin'))
    OR is_superadmin(auth.uid())
  );

-- 2. Tipos de Despesa
CREATE TABLE public.expense_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read expense_types" ON public.expense_types
  FOR SELECT USING (tenant_id = get_app_user_tenant_id(auth.uid()) OR is_superadmin(auth.uid()));

CREATE POLICY "Admin insert expense_types" ON public.expense_types
  FOR INSERT WITH CHECK (
    (tenant_id = get_app_user_tenant_id(auth.uid()) AND get_app_user_role(auth.uid()) IN ('tenant_admin', 'superadmin'))
    OR is_superadmin(auth.uid())
  );

CREATE POLICY "Admin update expense_types" ON public.expense_types
  FOR UPDATE USING (
    (tenant_id = get_app_user_tenant_id(auth.uid()) AND get_app_user_role(auth.uid()) IN ('tenant_admin', 'superadmin'))
    OR is_superadmin(auth.uid())
  );

CREATE POLICY "Admin delete expense_types" ON public.expense_types
  FOR DELETE USING (
    (tenant_id = get_app_user_tenant_id(auth.uid()) AND get_app_user_role(auth.uid()) IN ('tenant_admin', 'superadmin'))
    OR is_superadmin(auth.uid())
  );

-- 3. Receitas (Entradas)
CREATE TABLE public.revenues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  revenue_type_id UUID NOT NULL REFERENCES public.revenue_types(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  sale_id UUID REFERENCES public.sales(id),
  created_by UUID,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.revenues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read revenues" ON public.revenues
  FOR SELECT USING (
    (tenant_id = get_app_user_tenant_id(auth.uid()) AND get_app_user_role(auth.uid()) IN ('tenant_admin', 'contador', 'superadmin'))
    OR is_superadmin(auth.uid())
  );

CREATE POLICY "Admin insert revenues" ON public.revenues
  FOR INSERT WITH CHECK (
    (tenant_id = get_app_user_tenant_id(auth.uid()) AND get_app_user_role(auth.uid()) IN ('tenant_admin', 'superadmin'))
    OR is_superadmin(auth.uid())
  );

CREATE POLICY "Admin update revenues" ON public.revenues
  FOR UPDATE USING (
    (tenant_id = get_app_user_tenant_id(auth.uid()) AND get_app_user_role(auth.uid()) IN ('tenant_admin', 'superadmin'))
    OR is_superadmin(auth.uid())
  );

CREATE POLICY "Admin delete revenues" ON public.revenues
  FOR DELETE USING (
    (tenant_id = get_app_user_tenant_id(auth.uid()) AND get_app_user_role(auth.uid()) IN ('tenant_admin', 'superadmin'))
    OR is_superadmin(auth.uid())
  );

-- 4. Despesas (Saídas)
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  expense_type_id UUID NOT NULL REFERENCES public.expense_types(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  frequency TEXT, -- 'monthly', 'weekly', 'biweekly', 'yearly', 'custom'
  custom_days INTEGER, -- for custom frequency
  start_date DATE,
  end_date DATE, -- null = indefinite
  parent_expense_id UUID REFERENCES public.expenses(id), -- for generated recurring entries
  created_by UUID,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read expenses" ON public.expenses
  FOR SELECT USING (
    (tenant_id = get_app_user_tenant_id(auth.uid()) AND get_app_user_role(auth.uid()) IN ('tenant_admin', 'contador', 'superadmin'))
    OR is_superadmin(auth.uid())
  );

CREATE POLICY "Admin insert expenses" ON public.expenses
  FOR INSERT WITH CHECK (
    (tenant_id = get_app_user_tenant_id(auth.uid()) AND get_app_user_role(auth.uid()) IN ('tenant_admin', 'superadmin'))
    OR is_superadmin(auth.uid())
  );

CREATE POLICY "Admin update expenses" ON public.expenses
  FOR UPDATE USING (
    (tenant_id = get_app_user_tenant_id(auth.uid()) AND get_app_user_role(auth.uid()) IN ('tenant_admin', 'superadmin'))
    OR is_superadmin(auth.uid())
  );

CREATE POLICY "Admin delete expenses" ON public.expenses
  FOR DELETE USING (
    (tenant_id = get_app_user_tenant_id(auth.uid()) AND get_app_user_role(auth.uid()) IN ('tenant_admin', 'superadmin'))
    OR is_superadmin(auth.uid())
  );

-- 5. Seed default types on tenant creation
CREATE OR REPLACE FUNCTION public.auto_create_financial_types()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.revenue_types (tenant_id, name) VALUES
    (NEW.id, 'Venda balcão'),
    (NEW.id, 'Venda externa'),
    (NEW.id, 'Ajuste de caixa'),
    (NEW.id, 'Outros');

  INSERT INTO public.expense_types (tenant_id, name) VALUES
    (NEW.id, 'Aluguel'),
    (NEW.id, 'Insumos'),
    (NEW.id, 'Energia'),
    (NEW.id, 'Internet'),
    (NEW.id, 'Funcionários'),
    (NEW.id, 'Marketing'),
    (NEW.id, 'Outros');

  RETURN NEW;
END;
$function$;

CREATE TRIGGER auto_create_financial_types_trigger
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_financial_types();
