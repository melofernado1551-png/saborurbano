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
import { X, Upload, Loader2, Store, Image } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  "Lanchonete", "Pizzaria", "Restaurante", "Hamburgueria", "Açaí",
  "Doceria", "Sorveteria", "Padaria", "Cafeteria", "Bar", "Outro",
];

const STATES_CITIES: Record<string, string[]> = {
  PI: ["Buriti dos Lopes", "Parnaíba", "Luís Correia", "Cocal dos Alves"],
};

interface TenantEditForm {
  name: string;
  categories: string[];
  city: string;
  state: string;
  address: string;
  number: string;
  zip_code: string;
  cnpj: string;
  whatsapp_number: string;
  owner_name: string;
  owner_phone: string;
  owner_email: string;
}

const TenantEditPage = () => {
  const { user } = useAuth();
  const { effectiveTenantId, isAdminTenant, isSuperAdmin } = useAdmin();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<TenantEditForm>({
    name: "", categories: [], city: "", state: "", address: "", number: "",
    zip_code: "", cnpj: "", whatsapp_number: "", owner_name: "",
    owner_phone: "", owner_email: "",
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

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
        state: tenant.state || "",
        address: tenant.address || "",
        number: "",
        zip_code: tenant.zip_code || "",
        cnpj: tenant.cnpj || "",
        whatsapp_number: tenant.whatsapp_number || "",
        owner_name: tenant.owner_name || "",
        owner_phone: tenant.owner_phone || "",
        owner_email: tenant.owner_email || "",
      });
      setLogoUrl(tenant.logo_url || null);
      setCoverUrl(tenant.cover_url || null);
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

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop();
    const filePath = `${tenantId}/cover.${ext}`;
    setCoverUploading(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from("tenant-logos")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("tenant-logos").getPublicUrl(filePath);
      setCoverUrl(publicUrl);
      toast.success("Banner enviado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar banner");
    } finally {
      setCoverUploading(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        category: form.categories.length > 0 ? form.categories.join(", ") : null,
        city: form.city || null,
        state: form.state || null,
        address: form.address || null,
        zip_code: form.zip_code || null,
        cnpj: form.cnpj || null,
        whatsapp_number: form.whatsapp_number || null,
        owner_name: form.owner_name || null,
        owner_phone: form.owner_phone || null,
        owner_email: form.owner_email || null,
        logo_url: logoUrl || null,
        cover_url: coverUrl || null,
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

      {/* Banner / Cover */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Banner / Capa</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="w-full h-40 rounded-lg bg-secondary overflow-hidden border-2 border-border">
              {coverUrl ? (
                <img src={coverUrl} alt="Banner" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground gap-2">
                  <Image className="w-6 h-6" />
                  <span className="text-sm">Nenhum banner definido</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="gap-2" asChild disabled={coverUploading}>
                <label className="cursor-pointer">
                  {coverUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {coverUploading ? "Enviando..." : "Enviar banner"}
                  <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                </label>
              </Button>
              {coverUrl && (
                <Button variant="ghost" size="sm" onClick={() => setCoverUrl(null)} className="text-destructive gap-1">
                  <X className="w-4 h-4" /> Remover
                </Button>
              )}
              <p className="text-xs text-muted-foreground">Recomendado: 1200x400px</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informações Gerais */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Informações Gerais</CardTitle></CardHeader>
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
            <Label>CNPJ</Label>
            <Input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
          </div>

          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input value={form.whatsapp_number} onChange={(e) => set("whatsapp_number", e.target.value)} placeholder="(00) 00000-0000" />
          </div>
        </CardContent>
      </Card>

      {/* Localização */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Localização</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>CEP</Label>
            <Input
              value={form.zip_code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 8);
                set("zip_code", v);
              }}
              placeholder="00000000"
              maxLength={8}
            />
          </div>

          <div className="space-y-2">
            <Label>Estado</Label>
            <select
              value={form.state}
              onChange={(e) => {
                set("state", e.target.value);
                set("city", "");
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Selecione</option>
              {Object.keys(STATES_CITIES).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Cidade</Label>
            <select
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              disabled={!form.state}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">{form.state ? "Selecione a cidade" : "Selecione o estado primeiro"}</option>
              {(STATES_CITIES[form.state] || []).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Endereço (Rua)</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Ex: Rua das Flores" />
          </div>

          <div className="space-y-2">
            <Label>Número</Label>
            <Input value={form.number} onChange={(e) => set("number", e.target.value)} placeholder="Ex: 123" />
          </div>
        </CardContent>
      </Card>

      {/* Responsável */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Responsável</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Nome do responsável</Label>
            <Input value={form.owner_name} onChange={(e) => set("owner_name", e.target.value)} placeholder="Ex: João Silva" />
          </div>

          <div className="space-y-2">
            <Label>Telefone do responsável</Label>
            <Input value={form.owner_phone} onChange={(e) => set("owner_phone", e.target.value)} placeholder="(00) 00000-0000" />
          </div>

          <div className="space-y-2">
            <Label>Email do responsável</Label>
            <Input value={form.owner_email} onChange={(e) => set("owner_email", e.target.value)} placeholder="email@exemplo.com" />
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
