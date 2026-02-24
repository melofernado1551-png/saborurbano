import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X, Upload, Loader2, Store } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  "Lanchonete", "Pizzaria", "Restaurante", "Hamburgueria", "Açaí",
  "Doceria", "Sorveteria", "Padaria", "Cafeteria", "Bar", "Outro",
];

interface TenantEditForm {
  name: string;
  categories: string[];
  city: string;
  address: string;
  owner_name: string;
}

const TenantEditPage = () => {
  const { user } = useAuth();
  const { effectiveTenantId, isAdminTenant, isSuperAdmin } = useAdmin();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<TenantEditForm>({
    name: "", categories: [], city: "", address: "", owner_name: "",
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  // Tenant admin: always use their own tenant_id from session
  // SuperAdmin: use effectiveTenantId (from topbar selector)
  const tenantId = isAdminTenant ? (user?.tenant_id || null) : (isSuperAdmin ? effectiveTenantId : null);

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["my-tenant", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", tenantId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (tenant) {
      const catStr = tenant.category || "";
      setForm({
        name: tenant.name || "",
        categories: catStr ? catStr.split(",").map((s: string) => s.trim()) : [],
        city: tenant.city || "",
        address: tenant.address || "",
        owner_name: tenant.owner_name || "",
      });
      setLogoUrl(tenant.logo_url || null);
    }
  }, [tenant]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop();
    const filePath = `${tenantId}/logo.${ext}`;
    setLogoUploading(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from("tenant-logos")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("tenant-logos").getPublicUrl(filePath);
      setLogoUrl(publicUrl);
      toast.success("Logo enviada com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar logo");
    } finally {
      setLogoUploading(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        category: form.categories.length > 0 ? form.categories.join(", ") : null,
        city: form.city || null,
        address: form.address || null,
        owner_name: form.owner_name || null,
        logo_url: logoUrl || null,
      };
      const { error } = await supabase.from("tenants").update(payload).eq("id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tenant", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      toast.success("Dados do estabelecimento atualizados!");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const set = (key: keyof TenantEditForm, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleCategory = (cat: string) => {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  };

  // Access control: only tenant_admin or superadmin
  if (!isAdminTenant && !isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Store className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Acesso Negado</h2>
        <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Store className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Nenhum estabelecimento vinculado</h2>
        <p className="text-muted-foreground">Seu usuário não está vinculado a nenhum estabelecimento.</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Dados do Estabelecimento</h1>
        <p className="text-sm text-muted-foreground">Edite as informações do seu estabelecimento</p>
      </div>

      {/* Logo */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Logo</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-5">
            <div className="w-24 h-24 rounded-full bg-secondary overflow-hidden flex-shrink-0 border-2 border-border">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl text-muted-foreground">🏪</div>
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
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Informações</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Nome do estabelecimento *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Burger King" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Categorias</Label>
            {form.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.categories.map((cat) => (
                  <Badge key={cat} variant="secondary" className="gap-1 pr-1">
                    {cat}
                    <button type="button" onClick={() => toggleCategory(cat)} className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => (
                <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer rounded-lg border px-3 py-2 hover:bg-secondary transition-colors">
                  <Checkbox checked={form.categories.includes(cat)} onCheckedChange={() => toggleCategory(cat)} />
                  {cat}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Ex: São Paulo" />
          </div>

          <div className="space-y-2">
            <Label>Endereço / Localização</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Ex: Rua das Flores, 123" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Dono(s)</Label>
            <Input value={form.owner_name} onChange={(e) => set("owner_name", e.target.value)} placeholder="Ex: João Silva, Maria Souza" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name} className="gap-2">
          {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Salvar Alterações
        </Button>
      </div>
    </div>
  );
};

export default TenantEditPage;
