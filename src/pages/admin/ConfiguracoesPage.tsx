import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import TenantEditPage from "./TenantEditPage";

/**
 * /admin/configuracoes
 * - superadmin → redirected to /admin/configs-admin (global settings)
 * - tenant_admin → edits own tenant (auto-resolved from session)
 * - others → access denied
 */
const ConfiguracoesPage = () => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  // Superadmin should use /admin/configs-admin for global settings
  if (user.role === "superadmin") {
    return <Navigate to="/admin/configs-admin" replace />;
  }

  // Tenant admin edits their own tenant - resolved from session, never from URL
  if (user.role === "tenant_admin") {
    return <TenantEditPage />;
  }

  // Other roles: access denied
  return (
    <div className="text-center py-20">
      <h3 className="text-lg font-semibold mb-1">Acesso Negado</h3>
      <p className="text-muted-foreground text-sm">
        Você não tem permissão para acessar esta página.
      </p>
    </div>
  );
};

export default ConfiguracoesPage;

