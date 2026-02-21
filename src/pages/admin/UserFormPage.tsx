import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ArrowLeft, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface UserForm {
  name: string;
  cpf: string;
  cargo: string;
  login: string;
  role: string;
  active: boolean;
  tenant_id: string;
}

const emptyForm: UserForm = {
  name: "",
  cpf: "",
  cargo: "",
  login: "",
  role: "colaborador",
  active: true,
  tenant_id: "",
};

const formatCPF = (value: string): string => {
  const cleaned = value.replace(/\D/g, "").slice(0, 11);
  return cleaned
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
};

const ROLE_OPTIONS = [
  {
    value: "tenant_admin",
    label: "Admin",
    description: "Acesso total ao painel do estabelecimento. Pode gerenciar usuários e ver dados monetários.",
  },
  {
    value: "colaborador",
    label: "Colaborador",
    description: "Acesso operacional. Não pode ver dados monetários nem gerenciar usuários.",
  },
  {
    value: "contador",
    label: "Contador",
    description: "Acesso somente leitura a dados monetários. Não pode gerenciar operações.",
  },
];

const UserFormPage = () => {
  const { user } = useAuth();
  const { effectiveTenantId, isSuperAdmin, tenants } = useAdmin();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!id;
  const isViewOnly = isEditing && searchParams.get("edit") !== "true";

  const canAccess = user?.role === "superadmin" || user?.role === "tenant_admin";

  const [form, setForm] = useState<UserForm>(emptyForm);
  const [loginError, setLoginError] = useState("");
  const [checkingLogin, setCheckingLogin] = useState(false);
  const loginCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originalLogin = useRef("");

  // Check login uniqueness with debounce
  const checkLoginAvailability = (login: string) => {
    if (loginCheckTimer.current) clearTimeout(loginCheckTimer.current);
    setLoginError("");
    if (!login.trim()) return;
    // Skip if login hasn't changed during edit
    if (isEditing && login === originalLogin.current) return;

    setCheckingLogin(true);
    loginCheckTimer.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from("app_users" as any)
          .select("id")
          .eq("login", login)
          .eq("active", true)
          .neq("id", id || "00000000-0000-0000-0000-000000000000")
          .limit(1);
        if (!error && data && (data as any[]).length > 0) {
          setLoginError("Este login já está em uso. Escolha outro nome de usuário.");
        }
      } catch {
        // ignore
      } finally {
        setCheckingLogin(false);
      }
    }, 500);
  };

  const { data: userData, isLoading } = useQuery({
    queryKey: ["admin-user-detail", id],
    enabled: isEditing,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_users" as any)
        .select("id, login, name, cpf, cargo, role, active, tenant_id")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (userData) {
      setForm({
        name: userData.name || "",
        cpf: userData.cpf || "",
        cargo: userData.cargo || "",
        login: userData.login || "",
        role: userData.role || "colaborador",
        active: userData.active,
        tenant_id: userData.tenant_id || "",
      });
      originalLogin.current = userData.login || "";
    } else if (!isEditing) {
      if (!isSuperAdmin && user?.tenant_id) {
        setForm((prev) => ({ ...prev, tenant_id: user.tenant_id! }));
      } else if (effectiveTenantId) {
        setForm((prev) => ({ ...prev, tenant_id: effectiveTenantId }));
      }
    }
  }, [userData, isEditing, isSuperAdmin, user?.tenant_id, effectiveTenantId]);

  const set = (key: keyof UserForm, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nome é obrigatório");
      if (!form.login.trim()) throw new Error("Login é obrigatório");
      if (!form.role) throw new Error("Permissão é obrigatória");
      if (!form.tenant_id) throw new Error("Estabelecimento é obrigatório");

      if (isEditing) {
        const body: any = {
          user_id: id,
          name: form.name,
          cpf: form.cpf.replace(/\D/g, "") || null,
          cargo: form.cargo || null,
          role: form.role,
          active: form.active,
          login: form.login,
        };

        const { data, error } = await supabase.functions.invoke("update-user", { body });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      } else {
        const { data, error } = await supabase.functions.invoke("create-user", {
          body: {
            login: form.login,
            role: form.role,
            tenant_id: form.tenant_id,
            name: form.name,
            cpf: form.cpf.replace(/\D/g, "") || null,
            cargo: form.cargo || null,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(
        isEditing
          ? "Usuário atualizado!"
          : "Usuário criado! Ele receberá uma senha padrão e precisará alterá-la no primeiro login."
      );
      navigate("/admin/usuarios");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("reset-password", {
        body: { user_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("A senha foi resetada. O usuário precisará definir uma nova senha no próximo login.");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao resetar senha"),
  });

  if (!canAccess) return <Navigate to="/admin" replace />;

  if (isEditing && isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;
  }

  // Can reset password: not self, not superadmin target
  const canResetPassword = isViewOnly && userData && userData.id !== user?.id && userData.role !== "superadmin";

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/usuarios")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {isViewOnly ? "Visualizar Usuário" : isEditing ? "Editar Usuário" : "Novo Usuário"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isViewOnly
              ? `Detalhes de ${userData?.name || userData?.login}`
              : isEditing
              ? `Editando: ${userData?.name || userData?.login}`
              : "Preencha os dados do novo usuário"}
          </p>
        </div>
        {isViewOnly && (
          <div className="flex gap-2">
            {canResetPassword && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Resetar Senha
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Resetar senha do usuário</AlertDialogTitle>
                    <AlertDialogDescription>
                      A senha de <strong>{userData?.name || userData?.login}</strong> será resetada para a senha padrão.
                      O usuário precisará definir uma nova senha no próximo login.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => resetPasswordMutation.mutate()}
                      disabled={resetPasswordMutation.isPending}
                    >
                      {resetPasswordMutation.isPending ? "Resetando..." : "Confirmar Reset"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/admin/usuarios/${id}?edit=true`)}
            >
              Editar
            </Button>
          </div>
        )}
      </div>

      {/* Info about default password for new users */}
      {!isEditing && (
        <div className="bg-muted/50 border border-border rounded-lg p-4 text-sm text-muted-foreground">
          O novo usuário receberá uma <strong>senha padrão</strong> e será obrigado a alterá-la no primeiro login.
        </div>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados Básicos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Nome completo *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex: João da Silva"
              disabled={isViewOnly}
            />
          </div>
          <div className="space-y-2">
            <Label>CPF</Label>
            <Input
              value={form.cpf}
              onChange={(e) => set("cpf", formatCPF(e.target.value))}
              placeholder="000.000.000-00"
              maxLength={14}
              disabled={isViewOnly}
            />
          </div>
          <div className="space-y-2">
            <Label>Cargo</Label>
            <Input
              value={form.cargo}
              onChange={(e) => set("cargo", e.target.value)}
              placeholder="Ex: Gerente, Caixa, etc."
              disabled={isViewOnly}
            />
          </div>
          <div className="space-y-2">
            <Label>Login (username) *</Label>
            <Input
              value={form.login}
              onChange={(e) => {
                const val = e.target.value.toLowerCase().replace(/\s/g, "");
                set("login", val);
                checkLoginAvailability(val);
              }}
              placeholder="Ex: joaosilva"
              disabled={isViewOnly}
              className={loginError ? "border-destructive" : ""}
            />
            {loginError && (
              <p className="text-xs text-destructive">{loginError}</p>
            )}
            {checkingLogin && (
              <p className="text-xs text-muted-foreground">Verificando disponibilidade...</p>
            )}
          </div>
          {!isViewOnly && (
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
              <Label>Usuário ativo</Label>
            </div>
          )}
          {isViewOnly && (
            <div className="sm:col-span-2">
              <Label>Status</Label>
              <p className="mt-1 text-sm">{form.active ? "Ativo" : "Inativo"}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permission */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Permissão *</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ROLE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                form.role === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              } ${isViewOnly ? "pointer-events-none" : ""}`}
              onClick={() => !isViewOnly && set("role", opt.value)}
            >
              <div
                className={`w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                  form.role === opt.value ? "border-primary" : "border-muted-foreground/40"
                }`}
              >
                {form.role === opt.value && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <div>
                <p className="font-medium text-sm">{opt.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Tenant Selection - only for superadmin */}
      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Estabelecimento</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={form.tenant_id}
              onValueChange={(v) => set("tenant_id", v)}
              disabled={isViewOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o estabelecimento" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {!isViewOnly && (
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate("/admin/usuarios")}>
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!form.name || !form.login || !form.role || !!loginError || checkingLogin || saveMutation.isPending}
          >
            {saveMutation.isPending
              ? "Salvando..."
              : isEditing
              ? "Salvar Alterações"
              : "Criar Usuário"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default UserFormPage;
