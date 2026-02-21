import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import SuperAdminDashboard from "@/components/admin/SuperAdminDashboard";
import TenantDashboard from "@/components/admin/TenantDashboard";

const Admin = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === "superadmin") {
    return <SuperAdminDashboard />;
  }

  return <TenantDashboard />;
};

export default Admin;
