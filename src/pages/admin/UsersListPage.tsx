import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Superadmin",
  tenant_admin: "Admin",
  colaborador: "Colaborador",
  contador: "Contador",
  user: "Usuário",
};

const UsersListPage = () => {
  const { user } = useAuth();
  const { effectiveTenantId, isSuperAdmin } = useAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Access control: only superadmin or tenant_admin
  const canAccess = user?.role === "superadmin" || user?.role === "tenant_admin";

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users", effectiveTenantId],
    enabled: canAccess,
    queryFn: async () => {
      let query = supabase
        .from("profiles" as any)
        .select("id, login, name, role, cargo, active, tenant_id, created_at")
        .eq("active", true)
        .neq("role", "superadmin")
        .order("name", { ascending: true });

      if (!isSuperAdmin) {
        // Tenant admin: only their tenant
        query = query.eq("tenant_id", user!.tenant_id!);
      } else if (effectiveTenantId) {
        // Superadmin with tenant selected
        query = query.eq("tenant_id", effectiveTenantId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });

  const softDelete = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("update-user", {
        body: { user_id: userId, active: false },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Usuário desativado com sucesso");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao desativar usuário"),
  });

  if (!canAccess) return <Navigate to="/admin" replace />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os usuários do {isSuperAdmin && !effectiveTenantId ? "sistema" : "estabelecimento"}
          </p>
        </div>
        <Button onClick={() => navigate("/admin/usuarios/novo")} className="gap-2">
          <Plus className="w-4 h-4" />
          Cadastrar Usuário
        </Button>
      </div>

      {isSuperAdmin && !effectiveTenantId && (
        <div className="bg-muted/50 border border-border rounded-lg p-4 text-sm text-muted-foreground">
          Selecione um estabelecimento no seletor acima para filtrar os usuários, ou visualize todos.
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum usuário encontrado</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">Cargo</TableHead>
                <TableHead>Permissão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.name || u.login}
                    {!u.name && <span className="text-xs text-muted-foreground ml-1">({u.login})</span>}
                    {u.name && <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">({u.login})</span>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {u.cargo || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.role === "tenant_admin" ? "default" : "secondary"}>
                      {ROLE_LABELS[u.role] || u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.active ? "default" : "outline"}>
                      {u.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Visualizar"
                        onClick={() => navigate(`/admin/usuarios/${u.id}`)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        onClick={() => navigate(`/admin/usuarios/${u.id}?edit=true`)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {u.role !== "superadmin" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="Excluir">
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Desativar usuário</AlertDialogTitle>
                              <AlertDialogDescription>
                                O usuário <strong>{u.name || u.login}</strong> será desativado e não poderá mais acessar o sistema. Deseja continuar?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => softDelete.mutate(u.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Desativar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
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

export default UsersListPage;
