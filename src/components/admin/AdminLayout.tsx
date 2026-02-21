import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Outlet } from "react-router-dom";
import { AdminProvider } from "@/contexts/AdminContext";
import AdminSidebarNew from "./AdminSidebarNew";
import AdminTopbar from "./AdminTopbar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const AdminLayout = () => {
  const { user, loading, mustChangePassword } = useAuth();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  if (mustChangePassword) {
    return <Navigate to="/alterar-senha" replace />;
  }

  return (
    <AdminProvider>
      <div className="flex min-h-screen bg-background w-full">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <aside className="w-64 flex-shrink-0">
            <AdminSidebarNew />
          </aside>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar - only for superadmin */}
          <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-lg border-b border-border">
            <div className="flex items-center gap-3 px-4 lg:px-6 h-14">
              {isMobile && (
                <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="-ml-2">
                      <Menu className="w-5 h-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0 w-64">
                    <AdminSidebarNew onNavigate={() => setSidebarOpen(false)} />
                  </SheetContent>
                </Sheet>
              )}
              <AdminTopbar />
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 p-4 lg:p-6">
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </AdminProvider>
  );
};

export default AdminLayout;
