import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  Package,
  Users,
  Settings,
  LogOut,
  Store,
  Tag,
  SlidersHorizontal,
  LayoutGrid,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import logo from "@/assets/logo.png";

interface Props {
  onNavigate?: () => void;
}

const AdminSidebarNew = ({ onNavigate }: Props) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const go = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  const isSuperAdmin = user?.role === "superadmin";
  const isAdminTenant = user?.role === "tenant_admin";
  const isContador = user?.role === "contador";
  const isColaborador = user?.role === "colaborador";

  // Build nav items based on role
  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/admin" },
    // Monetary pages: hidden from colaborador
    ...(!isColaborador
      ? [{ label: "Caixa", icon: ShoppingCart, path: "/admin/caixa" }]
      : []),
    // Operational pages: hidden from contador
    ...(!isContador
      ? [{ label: "Kanban de Pedidos", icon: ClipboardList, path: "/admin/pedidos" }]
      : []),
    ...(!isContador
      ? [{ label: "Produtos e Categorias", icon: Package, path: "/admin/produtos" }]
      : []),
    ...(isSuperAdmin
      ? [{ label: "Lojas", icon: Store, path: "/admin/tenants" }]
      : []),
    ...(isSuperAdmin
      ? [{ label: "Tags", icon: Tag, path: "/admin/tags" }]
      : []),
    ...(isSuperAdmin || isAdminTenant
      ? [{ label: "Bairros / Frete", icon: MapPin, path: "/admin/bairros" }]
      : []),
    ...(isSuperAdmin || isAdminTenant
      ? [{ label: "Minha Vitrine", icon: LayoutGrid, path: "/admin/meu-perfil" }]
      : []),
    ...(isSuperAdmin || isAdminTenant
      ? [{ label: "Usuários", icon: Users, path: "/admin/usuarios" }]
      : []),
    ...(!isContador
      ? [{ label: "Configurações", icon: Settings, path: isAdminTenant ? "/admin/configuracoes" : "/admin/configs-admin" }]
      : []),
  ];

  const roleLabel =
    user?.role === "superadmin"
      ? "Superadmin"
      : user?.role === "tenant_admin"
      ? "Administrador"
      : user?.role === "colaborador"
      ? "Colaborador"
      : user?.role === "contador"
      ? "Contador"
      : "Usuário";

  return (
    <div className="h-full flex flex-col" style={{ background: "hsl(var(--sidebar-background))" }}>
      {/* Logo - clickable to go to home */}
      <div className="px-5 py-6 flex justify-center">
        <button
          onClick={() => go("/")}
          className="bg-white/10 rounded-2xl p-3 flex items-center gap-3 hover:bg-white/20 transition-colors cursor-pointer"
        >
          <img src={logo} alt="Logo" className="w-10 h-10 rounded-xl" />
          <div>
            <h2 className="font-bold text-sm text-white">Sabor Urbano</h2>
            <span className="text-xs" style={{ color: "hsl(var(--sidebar-muted))" }}>
              {roleLabel}
            </span>
          </div>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            item.path === "/admin"
              ? location.pathname === "/admin"
              : location.pathname.startsWith(item.path);

          return (
            <button
              key={item.path}
              onClick={() => go(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "hover:bg-[hsl(var(--sidebar-accent))]"
              }`}
              style={
                !isActive
                  ? { color: "hsl(var(--sidebar-foreground))" }
                  : undefined
              }
            >
              <item.icon className="w-[18px] h-[18px]" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 pb-2" style={{ borderTop: "1px solid hsl(var(--sidebar-border))" }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <Avatar className="w-8 h-8 border-2" style={{ borderColor: "hsl(var(--sidebar-primary))" }}>
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
              {(user?.name || user?.login)?.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name || user?.login}</p>
            <p className="text-xs truncate" style={{ color: "hsl(var(--sidebar-muted))" }}>
              {roleLabel}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-[hsl(var(--sidebar-accent))]"
          style={{ color: "hsl(var(--sidebar-foreground))" }}
        >
          <LogOut className="w-[18px] h-[18px]" />
          Sair
        </button>
      </div>
    </div>
  );
};

export default AdminSidebarNew;
