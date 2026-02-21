import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
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
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface UserForm {
  name: string;
  cpf: string;
  cargo: string;
  login: string;
  password: string;
  role: string;
  active: boolean;
  tenant_id: string;
}

const emptyForm: UserForm = {
  name: "",
  cpf: "",
  cargo: "",
  login: "",
  password: "",
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

  // Load user for editing
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
        password: "",
        role: userData.role || "colaborador",
        active: userData.active,
        tenant_id: userData.tenant_id || "",
      });
    } else if (!isEditing) {
      // Set default tenant_id for new users
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
      if (!isEditing && !form.password) throw new Error("Senha é obrigatória para novo usuário");
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
        if (form.password) body.password = form.password;

        const { data, error } = await supabase.functions.invoke("update-user", { body });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      } else {
        const { data, error } = await supabase.functions.invoke("create-user", {
          body: {
            login: form.login,
            password: form.password,
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
      toast.success(isEditing ? "Usuário atualizado!" : "Usuário criado!");
      navigate("/admin/usuarios");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  if (!canAccess) return <Navigate to="/admin" replace />;

  if (isEditing && isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/usuarios")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
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
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => navigate(`/admin/usuarios/${id}?edit=true`)}
          >
            Editar
          </Button>
        )}
      </div>

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
              onChange={(e) => set("login", e.target.value.toLowerCase().replace(/\s/g, ""))}
              placeholder="Ex: joaosilva"
              disabled={isViewOnly}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{isEditing ? "Nova senha (deixe vazio para manter)" : "Senha *"}</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder={isEditing ? "••••••••" : "Mínimo 6 caracteres"}
              disabled={isViewOnly}
            />
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

      {/* Tenant Selection - only for superadmin creating new user */}
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
            disabled={!form.name || !form.login || !form.role || saveMutation.isPending}
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
