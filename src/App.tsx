import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import AdminLayout from "./components/admin/AdminLayout";
import DashboardPage from "./pages/admin/DashboardPage";
import SalesPageNew from "./pages/admin/SalesPageNew";
import PlaceholderPage from "./pages/admin/PlaceholderPage";
import TenantsListPage from "./pages/admin/TenantsListPage";
import TenantFormPage from "./pages/admin/TenantFormPage";
import UsersListPage from "./pages/admin/UsersListPage";
import UserFormPage from "./pages/admin/UserFormPage";
import RestaurantPage from "./pages/RestaurantPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/alterar-senha" element={<ChangePassword />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="vendas" element={<SalesPageNew />} />
              <Route path="pedidos" element={<PlaceholderPage title="Pedidos" />} />
              <Route path="produtos" element={<PlaceholderPage title="Produtos" />} />
              <Route path="usuarios" element={<UsersListPage />} />
              <Route path="usuarios/novo" element={<UserFormPage />} />
              <Route path="usuarios/:id" element={<UserFormPage />} />
              <Route path="configuracoes" element={<PlaceholderPage title="Configurações" />} />
              <Route path="tenants" element={<TenantsListPage />} />
              <Route path="tenants/novo" element={<TenantFormPage />} />
              <Route path="tenants/:id" element={<TenantFormPage />} />
            </Route>
            <Route path="/restaurante/:slug" element={<RestaurantPage />} />
            <Route path="/:tenantSlug/:productSlug" element={<ProductDetailPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
