import { useState, useEffect, useRef } from "react";
import { useAdmin } from "@/contexts/AdminContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldAlert, Upload, Image, Type, Save, Loader2, Star, Search, X, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface FeaturedProduct {
  product_id: string;
  position: number;
  product_name?: string;
  tenant_name?: string;
  image_url?: string | null;
}

const ConfigsAdminPage = () => {
  const { isSuperAdmin } = useAdmin();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [siteTitle, setSiteTitle] = useState("");
  const [siteSubtitle, setSiteSubtitle] = useState("");
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [featuredTenantId, setFeaturedTenantId] = useState<string>("");
  const [productsSectionTitle, setProductsSectionTitle] = useState("Produtos");

  const { data: config, isLoading } = useQuery({
    queryKey: ["system-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_configs")
        .select("*")
        .eq("active", true)
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing featured products
  const { data: existingFeatured = [] } = useQuery({
    queryKey: ["featured-products-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("featured_products")
        .select("product_id, position")
        .eq("active", true)
        .order("position");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch tenants for selector
  const { data: tenantsList = [] } = useQuery({
    queryKey: ["tenants-for-featured"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch products only for selected tenant
  const { data: tenantProducts = [] } = useQuery({
    queryKey: ["tenant-products-for-featured", featuredTenantId],
    enabled: !!featuredTenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .eq("active", true)
        .eq("tenant_id", featuredTenantId)
        .order("name");
      if (error) throw error;
      const productIds = (data || []).map((p) => p.id);
      let imageMap: Record<string, string> = {};
      if (productIds.length > 0) {
        const { data: images } = await supabase
          .from("product_images")
          .select("product_id, image_url, position")
          .eq("active", true)
          .in("product_id", productIds)
          .order("position");
        if (images) {
          for (const img of images) {
            if (!imageMap[img.product_id]) imageMap[img.product_id] = img.image_url;
          }
        }
      }
      return (data || []).map((p) => ({
        id: p.id,
        name: p.name,
        tenant_name: tenantsList.find((t) => t.id === featuredTenantId)?.name || "",
        image_url: imageMap[p.id] || null,
      }));
    },
  });

  // Fetch product names + images for already-featured products (may span multiple tenants)
  const { data: featuredProductDetails = [] } = useQuery({
    queryKey: ["featured-product-details", existingFeatured],
    enabled: existingFeatured.length > 0,
    queryFn: async () => {
      const ids = existingFeatured.map((f) => f.product_id);
      const { data: prods } = await supabase
        .from("products")
        .select("id, name, tenant_id")
        .in("id", ids);
      const tenantIds = [...new Set((prods || []).map((p) => p.tenant_id))];
      let tenantMap: Record<string, string> = {};
      if (tenantIds.length > 0) {
        const { data: tenants } = await supabase.from("tenants").select("id, name").in("id", tenantIds);
        if (tenants) tenantMap = Object.fromEntries(tenants.map((t) => [t.id, t.name]));
      }
      // Fetch first image per product
      let imageMap: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: images } = await supabase
          .from("product_images")
          .select("product_id, image_url, position")
          .eq("active", true)
          .in("product_id", ids)
          .order("position");
        if (images) {
          for (const img of images) {
            if (!imageMap[img.product_id]) imageMap[img.product_id] = img.image_url;
          }
        }
      }
      return (prods || []).map((p) => ({
        id: p.id,
        name: p.name,
        tenant_name: tenantMap[p.tenant_id] || "",
        image_url: imageMap[p.id] || null,
      }));
    },
  });

  // Fetch products section title from app_settings
  const { data: productsTitleSetting } = useQuery({
    queryKey: ["app-setting-products-section-title"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "products_section_title")
        .eq("active", true)
        .maybeSingle();
      return data?.value as string | null;
    },
  });

  useEffect(() => {
    if (config) {
      setSiteTitle(config.site_title || "");
      setSiteSubtitle(config.site_subtitle || "");
      if (config.favicon_url) setFaviconPreview(config.favicon_url);
    }
  }, [config]);

  useEffect(() => {
    if (productsTitleSetting) setProductsSectionTitle(productsTitleSetting);
  }, [productsTitleSetting]);

  useEffect(() => {
    if (existingFeatured.length > 0 && featuredProductDetails.length > 0) {
      const mapped = existingFeatured.map((f) => {
        const prod = featuredProductDetails.find((p) => p.id === f.product_id);
        return {
          product_id: f.product_id,
          position: f.position ?? 0,
          product_name: prod?.name || "Produto não encontrado",
          tenant_name: prod?.tenant_name || "",
          image_url: prod?.image_url || null,
        };
      });
      setFeaturedProducts(mapped);
    }
  }, [existingFeatured, featuredProductDetails]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/png", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];
    if (!allowed.includes(file.type)) {
      toast.error("Formato inválido. Use PNG, SVG ou ICO.");
      return;
    }
    setFaviconFile(file);
    setFaviconPreview(URL.createObjectURL(file));
  };

  const addFeaturedProduct = (productId: string) => {
    if (featuredProducts.length >= 8) {
      toast.error("Máximo de 8 produtos em destaque");
      return;
    }
    if (featuredProducts.some((f) => f.product_id === productId)) {
      toast.error("Produto já está em destaque");
      return;
    }
    const prod = tenantProducts.find((p) => p.id === productId);
    setFeaturedProducts((prev) => [
      ...prev,
      {
        product_id: productId,
        position: prev.length,
        product_name: prod?.name || "",
        tenant_name: prod?.tenant_name || "",
        image_url: prod?.image_url || null,
      },
    ]);
    setProductSearch("");
  };

  const removeFeaturedProduct = (productId: string) => {
    setFeaturedProducts((prev) =>
      prev.filter((f) => f.product_id !== productId).map((f, i) => ({ ...f, position: i }))
    );
  };

  // Drag reorder
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setFeaturedProducts((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      return next.map((f, i) => ({ ...f, position: i }));
    });
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  const filteredSearchProducts = productSearch.trim() && featuredTenantId
    ? tenantProducts
        .filter(
          (p) =>
            !featuredProducts.some((f) => f.product_id === p.id) &&
            p.name.toLowerCase().includes(productSearch.toLowerCase())
        )
        .slice(0, 8)
    : [];

  const saveMutation = useMutation({
    mutationFn: async () => {
      let faviconUrl = config?.favicon_url || null;

      if (faviconFile) {
        const ext = faviconFile.name.split(".").pop();
        const path = `favicon.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("system-assets")
          .upload(path, faviconFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from("system-assets")
          .getPublicUrl(path);
        faviconUrl = urlData.publicUrl;
      }

      const { error } = await supabase
        .from("system_configs")
        .update({
          site_title: siteTitle,
          site_subtitle: siteSubtitle,
          favicon_url: faviconUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config!.id);
      if (error) throw error;

      // Save featured products
      // Delete all existing
      await supabase.from("featured_products").delete().neq("product_id", "00000000-0000-0000-0000-000000000000");

      // Insert new ones
      if (featuredProducts.length > 0) {
        const { error: fpError } = await supabase.from("featured_products").insert(
          featuredProducts.map((f, i) => ({
            product_id: f.product_id,
            position: i,
            active: true,
          }))
        );
        if (fpError) throw fpError;
      }

      // Save products section title
      const { data: existingSetting } = await supabase
        .from("app_settings")
        .select("key")
        .eq("key", "products_section_title")
        .maybeSingle();
      if (existingSetting) {
        await supabase.from("app_settings").update({ value: JSON.parse(JSON.stringify(productsSectionTitle)), updated_at: new Date().toISOString() }).eq("key", "products_section_title");
      } else {
        await supabase.from("app_settings").insert({ key: "products_section_title", value: JSON.parse(JSON.stringify(productsSectionTitle)), active: true });
      }

      // Update browser
      document.title = siteTitle;
      if (faviconUrl) {
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (link) {
          link.href = faviconUrl;
        } else {
          const newLink = document.createElement("link");
          newLink.rel = "icon";
          newLink.href = faviconUrl;
          document.head.appendChild(newLink);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-configs"] });
      queryClient.invalidateQueries({ queryKey: ["featured-products-admin"] });
      toast.success("Configurações salvas com sucesso!");
      setFaviconFile(null);
    },
    onError: () => {
      toast.error("Erro ao salvar configurações.");
    },
  });

  if (!isSuperAdmin) {
    return (
      <div className="text-center py-20">
        <ShieldAlert className="w-16 h-16 mx-auto text-destructive/40 mb-4" />
        <h3 className="text-lg font-semibold mb-1">Acesso restrito</h3>
        <p className="text-muted-foreground text-sm">
          Apenas superadmins podem acessar esta página.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configs Admin</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configurações globais do sistema
        </p>
      </div>

      {/* Identidade Visual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Image className="w-5 h-5" />
            Identidade Visual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Favicon</Label>
            <p className="text-xs text-muted-foreground mb-3">Aceita PNG, SVG e ICO</p>
            <div className="flex items-center gap-4">
              {faviconPreview && (
                <div className="w-12 h-12 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                  <img src={faviconPreview} alt="Favicon preview" className="w-8 h-8 object-contain" />
                </div>
              )}
              <input ref={fileInputRef} type="file" accept=".png,.svg,.ico" onChange={handleFileChange} className="hidden" />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                {faviconPreview ? "Trocar favicon" : "Enviar favicon"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Textos Globais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Type className="w-5 h-5" />
            Textos Globais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="site-title">Título do site</Label>
            <Input id="site-title" value={siteTitle} onChange={(e) => setSiteTitle(e.target.value)} placeholder="Ex: Sabor Urbano" />
          </div>
          <div>
            <Label htmlFor="site-subtitle">Subtítulo do site</Label>
            <Input id="site-subtitle" value={siteSubtitle} onChange={(e) => setSiteSubtitle(e.target.value)} placeholder="Ex: Descubra os melhores sabores" />
          </div>
          <div>
            <Label htmlFor="products-section-title">Título da seção de produtos (página inicial)</Label>
            <Input id="products-section-title" value={productsSectionTitle} onChange={(e) => setProductsSectionTitle(e.target.value)} placeholder="Ex: Produtos" />
          </div>
        </CardContent>
      </Card>

      {/* Produtos em Destaque */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Star className="w-5 h-5" />
            Produtos em Destaque
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Selecione até 8 produtos para exibir na página inicial. Arraste para reordenar.
          </p>

          {/* Tenant selector + Search to add */}
          {featuredProducts.length < 8 && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm">Selecione a loja</Label>
                <Select value={featuredTenantId || "none"} onValueChange={(v) => { setFeaturedTenantId(v === "none" ? "" : v); setProductSearch(""); }}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Escolha uma loja..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione...</SelectItem>
                    {tenantsList.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {featuredTenantId && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Buscar produto para adicionar..."
                    className="pl-9"
                  />
                  {filteredSearchProducts.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredSearchProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addFeaturedProduct(p.id)}
                          className="w-full text-left px-4 py-2.5 hover:bg-accent transition-colors flex items-center justify-between"
                        >
                          <div>
                            <p className="text-sm font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.tenant_name}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">Adicionar</Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {featuredProducts.length}/8 produtos selecionados
          </p>

          {/* Selected products - grid 4 columns */}
          {featuredProducts.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {featuredProducts.map((fp, idx) => (
                <div
                  key={fp.product_id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`relative rounded-lg border bg-card cursor-grab active:cursor-grabbing transition-shadow overflow-hidden ${
                    dragIdx === idx ? "ring-2 ring-primary shadow-lg" : "border-border"
                  }`}
                >
                  <div className="h-24 bg-secondary flex items-center justify-center overflow-hidden">
                    {fp.image_url ? (
                      <img src={fp.image_url} alt={fp.product_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl">🍔</span>
                    )}
                  </div>
                  <span className="absolute top-1 left-1 bg-foreground/70 text-background text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFeaturedProduct(fp.product_id)}
                    className="absolute top-1 right-1 p-0.5 rounded-full bg-card/80 hover:bg-destructive/10 text-destructive transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="p-2">
                    <p className="text-xs font-medium truncate">{fp.product_name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{fp.tenant_name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full sm:w-auto"
      >
        {saveMutation.isPending ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Save className="w-4 h-4 mr-2" />
        )}
        Salvar alterações
      </Button>
    </div>
  );
};

export default ConfigsAdminPage;
