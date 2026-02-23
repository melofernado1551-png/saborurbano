import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { CustomerAuthProvider } from "@/contexts/CustomerAuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { useAutoTheme } from "@/hooks/useAutoTheme";
import CartDrawer from "@/components/cart/CartDrawer";
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
import TenantEditPage from "./pages/admin/TenantEditPage";
import TagsPage from "./pages/admin/TagsPage";
import ConfigsAdminPage from "./pages/admin/ConfigsAdminPage";
import ProductsListPage from "./pages/admin/ProductsListPage";
import ProductFormPage from "./pages/admin/ProductFormPage";
import RestaurantPage from "./pages/RestaurantPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CustomerChatPage from "./pages/CustomerChatPage";
import CustomerOrdersPage from "./pages/CustomerOrdersPage";
import AdminChatsListPage from "./pages/admin/AdminChatsListPage";
import AdminChatPage from "./pages/admin/AdminChatPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AutoThemeHandler = () => {
  useAutoTheme();
  return null;
};

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
  <QueryClientProvider client={queryClient}>
    <AutoThemeHandler />
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CustomerAuthProvider>
          <CartProvider>
            <CartDrawer />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/alterar-senha" element={<ChangePassword />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="vendas" element={<SalesPageNew />} />
                <Route path="pedidos" element={<AdminChatsListPage />} />
                <Route path="pedidos/:chatId" element={<AdminChatPage />} />
                <Route path="produtos" element={<ProductsListPage />} />
                <Route path="produtos/novo" element={<ProductFormPage />} />
                <Route path="produtos/:id" element={<ProductFormPage />} />
                <Route path="usuarios" element={<UsersListPage />} />
                <Route path="usuarios/novo" element={<UserFormPage />} />
                <Route path="usuarios/:id" element={<UserFormPage />} />
                <Route path="configuracoes" element={<PlaceholderPage title="Configurações" />} />
                <Route path="tenant/editar" element={<TenantEditPage />} />
                <Route path="tenants" element={<TenantsListPage />} />
                <Route path="tenants/novo" element={<TenantFormPage />} />
                <Route path="tenants/:id" element={<TenantFormPage />} />
                <Route path="tags" element={<TagsPage />} />
                <Route path="configs-admin" element={<ConfigsAdminPage />} />
              </Route>
              <Route path="/loja/:slug" element={<RestaurantPage />} />
              <Route path="/chat/:chatId" element={<CustomerChatPage />} />
              <Route path="/meus-pedidos" element={<CustomerOrdersPage />} />
              <Route path="/:tenantSlug/:productSlug" element={<ProductDetailPage />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </CartProvider>
          </CustomerAuthProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
