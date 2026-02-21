import { createContext, useContext, useState, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Tenant {
  id: string;
  name: string;
}

interface AdminContextType {
  selectedTenantId: string;
  setSelectedTenantId: (id: string) => void;
  tenants: Tenant[];
  tenantsLoading: boolean;
  effectiveTenantId: string | null;
  isSuperAdmin: boolean;
  isAdminTenant: boolean;
  isColaborador: boolean;
  isContador: boolean;
  isReadOnly: boolean;
  tenantName: string;
}

const AdminContext = createContext<AdminContextType | null>(null);

export const useAdmin = () => {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
};

export const AdminProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [selectedTenantId, setSelectedTenantId] = useState("");

  const isSuperAdmin = user?.role === "superadmin";
  const isAdminTenant = user?.role === "tenant_admin";
  const isColaborador = user?.role === "colaborador";
  const isContador = user?.role === "contador";
  const isReadOnly = user?.role === "contador";

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ["admin-tenants"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data as Tenant[];
    },
  });

  const effectiveTenantId = isSuperAdmin ? selectedTenantId || null : user?.tenant_id || null;

  const tenantName = tenants.find((t) => t.id === effectiveTenantId)?.name || "";

  return (
    <AdminContext.Provider
      value={{
        selectedTenantId,
        setSelectedTenantId,
        tenants,
        tenantsLoading,
        effectiveTenantId,
        isSuperAdmin,
        isAdminTenant,
        isColaborador,
        isContador,
        isReadOnly,
        tenantName,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};
