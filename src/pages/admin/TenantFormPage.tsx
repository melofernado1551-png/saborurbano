import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { generateUniqueTenantSlug } from "@/lib/slugUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, UserPlus, X, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const CATEGORIES = [
  "Lanchonete",
  "Pizzaria",
  "Restaurante",
  "Hamburgueria",
  "Açaí",
  "Doceria",
  "Sorveteria",
  "Padaria",
  "Cafeteria",
  "Bar",
  "Outro",
];

// CNPJ validation
const validateCNPJ = (cnpj: string): boolean => {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;

  const calc = (digits: string, factors: number[]) =>
    factors.reduce((sum, f, i) => sum + parseInt(digits[i]) * f, 0);

  const d1factors = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d2factors = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const remainder1 = calc(cleaned, d1factors) % 11;
  const digit1 = remainder1 < 2 ? 0 : 11 - remainder1;
  if (parseInt(cleaned[12]) !== digit1) return false;

  const remainder2 = calc(cleaned, d2factors) % 11;
  const digit2 = remainder2 < 2 ? 0 : 11 - remainder2;
  if (parseInt(cleaned[13]) !== digit2) return false;

  return true;
};

const formatCNPJ = (value: string): string => {
  const cleaned = value.replace(/\D/g, "").slice(0, 14);
  return cleaned
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

interface TenantForm {
  name: string;
  cnpj: string;
  categories: string[];
  active: boolean;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: string;
  longitude: string;
  owner_name: string;
  owner_phone: string;
  owner_email: string;
  whatsapp_number: string;
}

const emptyForm: TenantForm = {
  name: "",
  cnpj: "",
  categories: [],
  active: true,
  address: "",
  city: "",
  state: "",
  zip_code: "",
  latitude: "",
  longitude: "",
  owner_name: "",
  owner_phone: "",
  owner_email: "",
  whatsapp_number: "",
};

const TenantFormPage = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [form, setForm] = useState<TenantForm>(emptyForm);
  const [cnpjError, setCnpjError] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUser, setNewUser] = useState({ login: "", password: "", name: "", role: "user" as string, active: true });

  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ["tenant-detail", id],
    enabled: isEditing,
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (tenant) {
      const catStr = (tenant as any).category || "";
      setForm({
        name: tenant.name || "",
        cnpj: (tenant as any).cnpj || "",
        categories: catStr ? catStr.split(",").map((s: string) => s.trim()) : [],
        active: tenant.active,
        address: (tenant as any).address || "",
        city: (tenant as any).city || "",
        state: (tenant as any).state || "",
        zip_code: (tenant as any).zip_code || "",
        latitude: (tenant as any).latitude?.toString() || "",
        longitude: (tenant as any).longitude?.toString() || "",
        owner_name: (tenant as any).owner_name || "",
        owner_phone: (tenant as any).owner_phone || "",
        owner_email: (tenant as any).owner_email || "",
        whatsapp_number: tenant.whatsapp_number || "",
      });
      setLogoUrl(tenant.logo_url || null);
      setCoverUrl((tenant as any).cover_url || null);
    }
  }, [tenant]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const tenantId = id || "new";
    const ext = file.name.split(".").pop();
    const filePath = `${tenantId}/logo.${ext}`;

    setLogoUploading(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from("tenant-logos")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("tenant-logos")
        .getPublicUrl(filePath);
      
      setLogoUrl(publicUrl);
      toast.success("Logo enviada com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar logo");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const tenantId = id || "new";
    const ext = file.name.split(".").pop();
    const filePath = `${tenantId}/cover.${ext}`;

    setCoverUploading(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from("tenant-logos")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("tenant-logos")
        .getPublicUrl(filePath);
      
      setCoverUrl(publicUrl);
      toast.success("Capa enviada com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar capa");
    } finally {
      setCoverUploading(false);
    }
  };

  const { data: collaborators = [], isLoading: collabLoading } = useQuery({
    queryKey: ["tenant-collaborators", id],
    enabled: isEditing,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_users")
        .select("id, login, role, active")
        .eq("tenant_id", id!)
        .order("login");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Validate CNPJ if provided
      if (form.cnpj && !validateCNPJ(form.cnpj)) {
        throw new Error("CNPJ inválido");
      }

      // Auto-generate unique slug from name
      const slug = await generateUniqueTenantSlug(form.name, isEditing ? id : undefined);

      const payload: any = {
        name: form.name,
        slug,
        category: form.categories.length > 0 ? form.categories.join(", ") : null,
        cnpj: form.cnpj ? form.cnpj.replace(/\D/g, "") : null,
        active: form.active,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        zip_code: form.zip_code || null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        owner_name: form.owner_name || null,
        owner_phone: form.owner_phone || null,
        owner_email: form.owner_email || null,
        whatsapp_number: form.whatsapp_number || null,
        logo_url: logoUrl || null,
        cover_url: coverUrl || null,
      };

      if (isEditing) {
        const { error } = await supabase.from("tenants").update(payload).eq("id", id!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tenants").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants-full"] });
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      toast.success(isEditing ? "Restaurante atualizado!" : "Restaurante criado!");
      if (!isEditing) navigate("/admin/tenants");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const createUserMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          login: newUser.login,
          password: newUser.password,
          role: newUser.role,
          tenant_id: id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-collaborators", id] });
      toast.success("Colaborador criado!");
      setShowNewUser(false);
      setNewUser({ login: "", password: "", name: "", role: "user", active: true });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao criar colaborador"),
  });

  const toggleUserActive = useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      const { error } = await supabase
        .from("app_users" as any)
        .update({ active: !active })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-collaborators", id] });
      toast.success("Status do colaborador atualizado");
    },
  });

  const set = (key: keyof TenantForm, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleCategory = (cat: string) => {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  };

  const handleCnpjChange = (value: string) => {
    const formatted = formatCNPJ(value);
    set("cnpj", formatted);
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length === 14) {
      setCnpjError(validateCNPJ(cleaned) ? "" : "CNPJ inválido");
    } else {
      setCnpjError("");
    }
  };

  if (user?.role !== "superadmin") return <Navigate to="/admin" replace />;

  if (isEditing && tenantLoading) {
    return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/tenants")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEditing ? "Editar Restaurante" : "Novo Restaurante"}</h1>
          <p className="text-sm text-muted-foreground">
            {isEditing ? `Editando: ${tenant?.name}` : "Preencha os dados do novo estabelecimento"}
          </p>
        </div>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Dados Básicos</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {/* Logo upload */}
          <div className="space-y-2 sm:col-span-2">
            <Label>Logo do Restaurante</Label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl bg-secondary overflow-hidden flex-shrink-0 border border-border">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl text-muted-foreground">🏪</div>
                )}
              </div>
              <div>
                <Button variant="outline" size="sm" className="gap-2" asChild disabled={logoUploading}>
                  <label className="cursor-pointer">
                    {logoUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {logoUploading ? "Enviando..." : "Enviar logo"}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </label>
                </Button>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG ou WebP. Recomendado: 200x200px</p>
              </div>
            </div>
          </div>
          {/* Cover upload */}
          <div className="space-y-2 sm:col-span-2">
            <Label>Imagem de Capa</Label>
            <div className="space-y-3">
              <div className="w-full h-40 rounded-xl bg-secondary overflow-hidden border border-border">
                {coverUrl ? (
                  <img src={coverUrl} alt="Capa" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Nenhuma capa definida</div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" className="gap-2" asChild disabled={coverUploading}>
                  <label className="cursor-pointer">
                    {coverUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {coverUploading ? "Enviando..." : "Enviar capa"}
                    <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                  </label>
                </Button>
                {coverUrl && (
                  <Button variant="ghost" size="sm" onClick={() => setCoverUrl(null)}>
                    <X className="w-4 h-4 mr-1" /> Remover
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">PNG, JPG ou WebP. Recomendado: 1200x400px</p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nome do restaurante *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Burger King" />
          </div>
          <div className="space-y-2">
            <Label>CNPJ</Label>
            <Input
              value={form.cnpj}
              onChange={(e) => handleCnpjChange(e.target.value)}
              placeholder="00.000.000/0000-00"
              maxLength={18}
            />
            {cnpjError && <p className="text-xs text-destructive">{cnpjError}</p>}
          </div>

          {/* Multi-select categories */}
          <div className="space-y-2 sm:col-span-2">
            <Label>Categorias</Label>
            {form.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.categories.map((cat) => (
                  <Badge key={cat} variant="secondary" className="gap-1 pr-1">
                    {cat}
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => (
                <label
                  key={cat}
                  className="flex items-center gap-2 text-sm cursor-pointer rounded-lg border px-3 py-2 hover:bg-secondary transition-colors"
                >
                  <Checkbox
                    checked={form.categories.includes(cat)}
                    onCheckedChange={() => toggleCategory(cat)}
                  />
                  {cat}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input value={form.whatsapp_number} onChange={(e) => set("whatsapp_number", e.target.value)} placeholder="(11) 99999-9999" />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
            <Label>Restaurante ativo</Label>
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Localização</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Endereço completo</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Cidade *</Label>
            <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Ex: São Paulo" />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Input value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="SP" maxLength={2} />
          </div>
          <div className="space-y-2">
            <Label>CEP</Label>
            <Input value={form.zip_code} onChange={(e) => set("zip_code", e.target.value)} placeholder="00000-000" />
          </div>
          <div className="space-y-2">
            <Label>Latitude</Label>
            <Input value={form.latitude} onChange={(e) => set("latitude", e.target.value)} placeholder="-23.5505" />
          </div>
          <div className="space-y-2">
            <Label>Longitude</Label>
            <Input value={form.longitude} onChange={(e) => set("longitude", e.target.value)} placeholder="-46.6333" />
          </div>
        </CardContent>
      </Card>

      {/* Owner */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Dados do Dono</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Nome do dono</Label>
            <Input value={form.owner_name} onChange={(e) => set("owner_name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={form.owner_phone} onChange={(e) => set("owner_phone", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>E-mail (informativo)</Label>
            <Input value={form.owner_email} onChange={(e) => set("owner_email", e.target.value)} type="email" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate("/admin/tenants")}>Cancelar</Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!form.name || !form.city || !!cnpjError || saveMutation.isPending}
        >
          {saveMutation.isPending ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Restaurante"}
        </Button>
      </div>

      {/* Collaborators - only in edit mode */}
      {isEditing && (
        <>
          <Separator />
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Colaboradores do Restaurante</CardTitle>
                <Dialog open={showNewUser} onOpenChange={setShowNewUser}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2">
                      <UserPlus className="w-4 h-4" />
                      Novo Colaborador
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cadastrar Colaborador</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                      <div className="space-y-2">
                        <Label>Login *</Label>
                        <Input value={newUser.login} onChange={(e) => setNewUser((p) => ({ ...p, login: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Senha *</Label>
                        <Input type="password" value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Papel</Label>
                        <Select value={newUser.role} onValueChange={(v) => setNewUser((p) => ({ ...p, role: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tenant_admin">Admin do Tenant</SelectItem>
                            <SelectItem value="user">Usuário</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        onClick={() => createUserMutation.mutate()}
                        disabled={!newUser.login || !newUser.password || createUserMutation.isPending}
                      >
                        {createUserMutation.isPending ? "Criando..." : "Criar Colaborador"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {collabLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : collaborators.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum colaborador vinculado</p>
              ) : (
                <div className="space-y-2">
                  {collaborators.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-sm">{c.login}</span>
                        <Badge variant="outline" className="text-xs">{c.role}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={c.active ? "default" : "secondary"} className="text-xs">
                          {c.active ? "Ativo" : "Inativo"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleUserActive.mutate({ userId: c.id, active: c.active })}
                        >
                          {c.active ? "Desativar" : "Ativar"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default TenantFormPage;
