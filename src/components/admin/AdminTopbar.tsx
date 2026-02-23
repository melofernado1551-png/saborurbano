import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import { useNavigate } from "react-router-dom";
import { Building2, Plus, List } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const AdminTopbar = () => {
  const { user } = useAuth();
  const { isSuperAdmin, tenants, selectedTenantId, setSelectedTenantId } = useAdmin();
  const navigate = useNavigate();

  if (!isSuperAdmin) return null;

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedTenantId || "none"} onValueChange={(v) => setSelectedTenantId(v === "none" ? "" : v)}>
            <SelectTrigger className="w-48 lg:w-64 h-9">
              <SelectValue placeholder="Selecione uma loja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 hidden sm:flex"
          onClick={() => navigate("/admin/tenants/novo")}
        >
          <Plus className="w-4 h-4" />
          Novo
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 hidden sm:flex"
          onClick={() => navigate("/admin/tenants")}
        >
          <List className="w-4 h-4" />
          Gerenciar
        </Button>
      </div>
    </div>
  );
};

export default AdminTopbar;
