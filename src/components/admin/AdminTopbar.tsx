import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import { Building2, User } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const AdminTopbar = () => {
  const { user } = useAuth();
  const { isSuperAdmin, tenants, selectedTenantId, setSelectedTenantId, tenantName } = useAdmin();

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-3">
        {isSuperAdmin ? (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
              <SelectTrigger className="w-48 lg:w-64 h-9">
                <SelectValue placeholder="Selecione um restaurante" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <span className="text-sm font-medium text-foreground">
            {tenantName || "Meu Restaurante"}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground hidden sm:block">{user?.login}</span>
        <Avatar className="w-8 h-8">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
            {user?.login?.charAt(0).toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
      </div>
    </div>
  );
};

export default AdminTopbar;
