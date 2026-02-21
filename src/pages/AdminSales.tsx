import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import SalesPage from "@/components/admin/SalesPage";

const AdminSales = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <SalesPage />;
};

export default AdminSales;
