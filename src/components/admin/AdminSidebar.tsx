import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Users, Building2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

const AdminSidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const isSuperAdmin = user?.role === "superadmin";

  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/admin" },
    { label: "Vendas", icon: ShoppingCart, path: "/admin/vendas" },
    ...(isSuperAdmin
      ? [
          { label: "Tenants", icon: Building2, path: "/admin/tenants" },
          { label: "Usuários", icon: Users, path: "/admin/usuarios" },
        ]
      : user?.role === "tenant_admin"
        ? [{ label: "Usuários", icon: Users, path: "/admin/usuarios" }]
        : []),
  ];

  return (
    <aside className="w-64 bg-card border-r border-border min-h-screen flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Logo" className="w-10 h-10 rounded-xl" />
          <div>
            <h2 className="font-bold text-sm">Sabor Urbano</h2>
            <span className="text-xs text-muted-foreground capitalize">{user?.role?.replace("_", " ")}</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
