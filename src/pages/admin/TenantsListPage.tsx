import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Eye, Pencil, Power, LayoutDashboard, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const TenantsListPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["admin-tenants-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: userCounts = {} } = useQuery({
    queryKey: ["tenant-user-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles" as any)
        .select("tenant_id")
        .eq("active", true);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((u: any) => {
        if (u.tenant_id) counts[u.tenant_id] = (counts[u.tenant_id] || 0) + 1;
      });
      return counts;
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("tenants")
        .update({ active: !active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants-full"] });
      toast.success("Status atualizado");
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  if (user?.role !== "superadmin") return <Navigate to="/admin" replace />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lojas</h1>
          <p className="text-sm text-muted-foreground">Gerencie todos os estabelecimentos da plataforma</p>
        </div>
        <Button onClick={() => navigate("/admin/tenants/novo")} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Loja
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : tenants.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhuma loja cadastrada</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">Categoria</TableHead>
                <TableHead className="hidden md:table-cell">Cidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Criado em</TableHead>
                <TableHead className="hidden lg:table-cell">Colaboradores</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {t.category || "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {t.city || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.active ? "default" : "secondary"}>
                      {t.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                    {format(new Date(t.created_at), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-center">
                    {userCounts[t.id] || 0}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        onClick={() => navigate(`/admin/tenants/${t.id}`)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={t.active ? "Desativar" : "Ativar"}
                        onClick={() => toggleActive.mutate({ id: t.id, active: t.active })}
                      >
                        <Power className={`w-4 h-4 ${t.active ? "text-green-500" : "text-muted-foreground"}`} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default TenantsListPage;
