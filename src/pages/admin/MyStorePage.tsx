import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/contexts/AdminContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Pencil, Trash2, ChevronUp, ChevronDown, Star, Sparkles,
  GripVertical, Loader2, Save, Eye, Settings2, Flame,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";


const MAX_SECTION_PRODUCTS = 12;

// ── Types ──
interface DraftSectionProduct {
  id?: string; // existing DB id or undefined for new
  product_id: string;
  position: number;
  active: boolean;
}

interface DraftSection {
  id?: string;
  title: string;
  category_id: string | null;
  position: number;
  active: boolean;
  products: DraftSectionProduct[];
  _deleted?: boolean;
}

interface DraftFeatured {
  id?: string;
  product_id: string;
  position: number;
  _deleted?: boolean;
}

const MyStorePage = () => {
  const { effectiveTenantId } = useAdmin();
  const tenantId = effectiveTenantId;

  // ── Remote data ──
  const { data: tenantProducts = [] } = useQuery({
    queryKey: ["tenant-all-products", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, price, promo_price, has_discount, active")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: productImages = [] } = useQuery({
    queryKey: ["tenant-product-images-admin", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_images")
        .select("product_id, image_url, position")
        .eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  const imageMap = useMemo(() => {
    const map: Record<string, string> = {};
    // pick lowest position per product
    const sorted = [...productImages].sort((a, b) => a.position - b.position);
    for (const img of sorted) {
      if (!map[img.product_id]) map[img.product_id] = img.image_url;
    }
    return map;
  }, [productImages]);

  const { data: categories = [] } = useQuery({
    queryKey: ["tenant-categories-for-sections", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("id, name, emoji")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Load existing sections
  const { data: remoteSections = [], isLoading: sectionsLoading } = useQuery({
    queryKey: ["tenant-sections", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_sections")
        .select("id, title, position, active, category_id, tenant_section_products(id, product_id, position, active)")
        .eq("tenant_id", tenantId!)
        .order("position");
      if (error) throw error;
      return data as any[];
    },
  });

  // Load existing featured
  const { data: remoteFeatured = [], isLoading: featuredLoading } = useQuery({
    queryKey: ["featured-products-tenant", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("featured_products_tenant")
        .select("id, product_id, position, active")
        .eq("tenant_id", tenantId!)
        .order("position");
      if (error) throw error;
      return data as any[];
    },
  });

  // Tenant info for preview header
  const { data: tenant } = useQuery({
    queryKey: ["tenant-info-preview", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("name, logo_url, cover_url, category, address, city")
        .eq("id", tenantId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // ── Draft state ──
  const [draftSections, setDraftSections] = useState<DraftSection[]>([]);
  const [draftFeatured, setDraftFeatured] = useState<DraftFeatured[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize drafts from remote data
  useEffect(() => {
    if (sectionsLoading || featuredLoading) return;
    if (initialized) return;
    setDraftSections(
      remoteSections.map((s: any) => ({
        id: s.id,
        title: s.title,
        category_id: s.category_id,
        position: s.position,
        active: s.active,
        products: (s.tenant_section_products || [])
          .sort((a: any, b: any) => a.position - b.position)
          .map((sp: any) => ({
            id: sp.id,
            product_id: sp.product_id,
            position: sp.position,
            active: sp.active,
          })),
      }))
    );
    setDraftFeatured(
      remoteFeatured.map((f: any) => ({
        id: f.id,
        product_id: f.product_id,
        position: f.position,
      }))
    );
    setInitialized(true);
  }, [sectionsLoading, featuredLoading, remoteSections, remoteFeatured, initialized]);

  // ── Dirty detection ──
  const isDirty = useMemo(() => {
    if (!initialized) return false;
    const currentSections = JSON.stringify(
      draftSections.map(({ id, title, category_id, position, active, products, _deleted }) => ({
        id, title, category_id, position, active, _deleted,
        products: products.map(({ id: pid, product_id, position: pos, active: a }) => ({ id: pid, product_id, position: pos, active: a })),
      }))
    );
    const originalSections = JSON.stringify(
      remoteSections.map((s: any) => ({
        id: s.id, title: s.title, category_id: s.category_id, position: s.position, active: s.active, _deleted: undefined,
        products: (s.tenant_section_products || [])
          .sort((a: any, b: any) => a.position - b.position)
          .map((sp: any) => ({ id: sp.id, product_id: sp.product_id, position: sp.position, active: sp.active })),
      }))
    );
    const currentFeatured = JSON.stringify(draftFeatured);
    const originalFeatured = JSON.stringify(remoteFeatured.map((f: any) => ({ id: f.id, product_id: f.product_id, position: f.position })));
    return currentSections !== originalSections || currentFeatured !== originalFeatured;
  }, [draftSections, draftFeatured, remoteSections, remoteFeatured, initialized]);

  // Navigation blocker via beforeunload
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ── Draft actions: Featured ──
  const addFeaturedDraft = (productId: string) => {
    setDraftFeatured((prev) => [
      ...prev.filter((f) => !f._deleted),
      { product_id: productId, position: prev.filter((f) => !f._deleted).length },
    ]);
  };

  const removeFeaturedDraft = (productId: string) => {
    setDraftFeatured((prev) => {
      const item = prev.find((f) => f.product_id === productId && !f._deleted);
      if (!item) return prev;
      if (item.id) {
        return prev.map((f) => (f === item ? { ...f, _deleted: true } : f));
      }
      return prev.filter((f) => f !== item);
    });
  };

  const activeFeatured = draftFeatured.filter((f) => !f._deleted);
  const availableForFeatured = tenantProducts.filter(
    (p) => !activeFeatured.some((f) => f.product_id === p.id)
  );

  // ── Draft actions: Sections ──
  const activeSections = draftSections.filter((s) => !s._deleted);

  const addSectionDraft = (title: string, categoryId: string | null) => {
    setDraftSections((prev) => [
      ...prev,
      {
        title,
        category_id: categoryId === "none" ? null : categoryId,
        position: activeSections.length,
        active: true,
        products: [],
      },
    ]);
  };

  const updateSectionDraft = (index: number, title: string, categoryId: string | null) => {
    setDraftSections((prev) => {
      const activeIdx = getActiveIndices(prev);
      const realIdx = activeIdx[index];
      const next = [...prev];
      next[realIdx] = { ...next[realIdx], title, category_id: categoryId === "none" ? null : categoryId };
      return next;
    });
  };

  const removeSectionDraft = (index: number) => {
    setDraftSections((prev) => {
      const activeIdx = getActiveIndices(prev);
      const realIdx = activeIdx[index];
      const section = prev[realIdx];
      if (section.id) {
        const next = [...prev];
        next[realIdx] = { ...section, _deleted: true };
        return next;
      }
      return prev.filter((_, i) => i !== realIdx);
    });
  };

  const toggleSectionActiveDraft = (index: number) => {
    setDraftSections((prev) => {
      const activeIdx = getActiveIndices(prev);
      const realIdx = activeIdx[index];
      const next = [...prev];
      next[realIdx] = { ...next[realIdx], active: !next[realIdx].active };
      return next;
    });
  };

  const moveSectionDraft = (index: number, direction: "up" | "down") => {
    setDraftSections((prev) => {
      const activeIdx = getActiveIndices(prev);
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= activeIdx.length) return prev;
      const next = [...prev];
      const rA = activeIdx[index];
      const rB = activeIdx[swapIndex];
      const posA = next[rA].position;
      next[rA] = { ...next[rA], position: next[rB].position };
      next[rB] = { ...next[rB], position: posA };
      return next;
    });
  };

  const addProductToSectionDraft = (sectionIndex: number, productId: string) => {
    setDraftSections((prev) => {
      const activeIdx = getActiveIndices(prev);
      const realIdx = activeIdx[sectionIndex];
      const section = prev[realIdx];
      if (section.products.length >= MAX_SECTION_PRODUCTS) {
        toast.error(`Máximo de ${MAX_SECTION_PRODUCTS} produtos por seção`);
        return prev;
      }
      const next = [...prev];
      next[realIdx] = {
        ...section,
        products: [...section.products, { product_id: productId, position: section.products.length, active: true }],
      };
      return next;
    });
  };

  const removeProductFromSectionDraft = (sectionIndex: number, productIndex: number) => {
    setDraftSections((prev) => {
      const activeIdx = getActiveIndices(prev);
      const realIdx = activeIdx[sectionIndex];
      const section = prev[realIdx];
      const next = [...prev];
      next[realIdx] = {
        ...section,
        products: section.products.filter((_, i) => i !== productIndex).map((p, i) => ({ ...p, position: i })),
      };
      return next;
    });
  };

  const getActiveIndices = (sections: DraftSection[]) =>
    sections.reduce<number[]>((acc, s, i) => (s._deleted ? acc : [...acc, i]), []);

  const getAvailableProducts = (sectionIndex: number) => {
    const section = activeSections[sectionIndex];
    if (!section) return tenantProducts;
    const usedIds = section.products.map((p) => p.product_id);
    return tenantProducts.filter((p) => !usedIds.includes(p.id));
  };

  // ── Save all ──
  const handleSave = async () => {
    // Validate
    for (const s of activeSections) {
      if (s.active && s.products.length === 0) {
        toast.error(`A seção "${s.title}" está ativa mas não tem produtos.`);
        return;
      }
      if (s.products.length > MAX_SECTION_PRODUCTS) {
        toast.error(`A seção "${s.title}" excede ${MAX_SECTION_PRODUCTS} produtos.`);
        return;
      }
    }

    setSaving(true);
    try {
      // ─ Featured: delete removed, insert new ─
      const deletedFeaturedIds = draftFeatured.filter((f) => f._deleted && f.id).map((f) => f.id!);
      if (deletedFeaturedIds.length > 0) {
        await supabase.from("featured_products_tenant").delete().in("id", deletedFeaturedIds);
      }
      const newFeatured = activeFeatured.filter((f) => !f.id);
      if (newFeatured.length > 0) {
        await supabase.from("featured_products_tenant").insert(
          newFeatured.map((f, i) => ({ tenant_id: tenantId!, product_id: f.product_id, position: i }))
        );
      }

      // ─ Sections: delete removed, upsert existing, insert new ─
      const deletedSectionIds = draftSections.filter((s) => s._deleted && s.id).map((s) => s.id!);
      if (deletedSectionIds.length > 0) {
        await supabase.from("tenant_section_products").delete().in("tenant_section_id", deletedSectionIds);
        await supabase.from("tenant_sections").delete().in("id", deletedSectionIds);
      }

      for (let i = 0; i < activeSections.length; i++) {
        const section = activeSections[i];
        let sectionId = section.id;

        if (sectionId) {
          // Update existing section
          await supabase.from("tenant_sections").update({
            title: section.title,
            category_id: section.category_id,
            position: i,
            active: section.active,
          }).eq("id", sectionId);

          // Sync products: delete all existing, re-insert
          await supabase.from("tenant_section_products").delete().eq("tenant_section_id", sectionId);
        } else {
          // Insert new section
          const { data, error } = await supabase.from("tenant_sections").insert({
            tenant_id: tenantId!,
            title: section.title,
            category_id: section.category_id,
            position: i,
            active: section.active,
          }).select("id").single();
          if (error) throw error;
          sectionId = data.id;
        }

        // Insert products
        if (section.products.length > 0) {
          await supabase.from("tenant_section_products").insert(
            section.products.map((p, pi) => ({
              tenant_section_id: sectionId!,
              product_id: p.product_id,
              position: pi,
              active: p.active,
            }))
          );
        }
      }

      toast.success("Perfil da loja atualizado com sucesso!");
      // Reset initialized to reload from DB
      setInitialized(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  // ── Dialog states ──
  const [featuredDialogOpen, setFeaturedDialogOpen] = useState(false);
  const [selectedFeaturedProduct, setSelectedFeaturedProduct] = useState("");

  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingSectionIdx, setEditingSectionIdx] = useState<number | null>(null);
  const [sectionForm, setSectionForm] = useState({ title: "", category_id: "" });

  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [activeSectionIdx, setActiveSectionIdx] = useState<number | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");

  const [mobileTab, setMobileTab] = useState("config");

  const openCreateSection = () => {
    setEditingSectionIdx(null);
    setSectionForm({ title: "", category_id: "" });
    setSectionDialogOpen(true);
  };

  const openEditSection = (idx: number) => {
    const s = activeSections[idx];
    setEditingSectionIdx(idx);
    setSectionForm({ title: s.title, category_id: s.category_id || "" });
    setSectionDialogOpen(true);
  };

  const handleSaveSection = () => {
    if (!sectionForm.title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    if (editingSectionIdx !== null) {
      updateSectionDraft(editingSectionIdx, sectionForm.title.trim(), sectionForm.category_id || null);
    } else {
      addSectionDraft(sectionForm.title.trim(), sectionForm.category_id || null);
    }
    setSectionDialogOpen(false);
  };

  const handleAddProduct = () => {
    if (activeSectionIdx !== null && selectedProductId) {
      addProductToSectionDraft(activeSectionIdx, selectedProductId);
    }
    setProductDialogOpen(false);
    setSelectedProductId("");
  };

  const productMap = useMemo(() => {
    const map = new Map<string, typeof tenantProducts[0]>();
    for (const p of tenantProducts) map.set(p.id, p);
    return map;
  }, [tenantProducts]);

  // ── Preview data ──
  const previewSections = useMemo(() => {
    return activeSections
      .filter((s) => s.active)
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        title: s.title,
        products: s.products
          .filter((sp) => sp.active)
          .sort((a, b) => a.position - b.position)
          .map((sp) => productMap.get(sp.product_id))
          .filter(Boolean) as typeof tenantProducts,
      }))
      .filter((s) => s.products.length > 0);
  }, [activeSections, productMap]);

  const previewFeatured = useMemo(() => {
    return activeFeatured
      .map((f) => productMap.get(f.product_id))
      .filter(Boolean) as typeof tenantProducts;
  }, [activeFeatured, productMap]);

  if (!tenantId) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Selecione um estabelecimento para gerenciar a vitrine.</p>
      </div>
    );
  }

  if (!initialized) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Preview Component ──
  const PreviewPanel = () => (
    <div className="bg-background border border-border rounded-2xl overflow-hidden shadow-lg">
      <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center gap-2">
        <Eye className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Pré-visualização da sua loja</span>
      </div>

      <div className="max-h-[70vh] overflow-y-auto">
        {/* Mini header */}
        <div className="relative">
          <div className="w-full h-28 overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-secondary">
            {tenant?.cover_url && <img src={tenant.cover_url} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="flex flex-col items-center -mt-10 relative z-10 pb-3">
            <div className="w-20 h-20 rounded-full bg-card border-4 border-card shadow-lg overflow-hidden">
              {tenant?.logo_url ? (
                <img src={tenant.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl bg-secondary">
                  {tenant?.name?.charAt(0) || "L"}
                </div>
              )}
            </div>
            <h3 className="text-base font-bold mt-1">{tenant?.name || "Sua Loja"}</h3>
            {tenant?.category && <span className="text-xs text-muted-foreground">{tenant.category}</span>}
          </div>
        </div>

        <div className="px-4 pb-6 space-y-6">
          {/* Featured preview */}
          {previewFeatured.length > 0 && (
            <div>
              <h4 className="text-sm font-bold mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
                Destaques da Loja
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {previewFeatured.map((p) => (
                  <PreviewProductCard key={p.id} product={p} featured />
                ))}
              </div>
            </div>
          )}

          {/* Sections preview */}
          {previewSections.length > 0 ? (
            previewSections.map((section, i) => (
              <div key={i}>
                <h4 className="text-sm font-bold mb-3">{section.title}</h4>
                <div className="grid grid-cols-2 gap-2">
                  {section.products.map((p) => (
                    <PreviewProductCard key={p.id} product={p} />
                  ))}
                </div>
              </div>
            ))
          ) : previewFeatured.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">🏪</div>
              <p className="text-xs text-muted-foreground">Adicione seções e produtos para visualizar</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  const PreviewProductCard = ({ product, featured }: { product: typeof tenantProducts[0]; featured?: boolean }) => (
    <div className={`bg-card rounded-xl overflow-hidden shadow-sm border ${featured ? "border-primary/30" : "border-border"}`}>
      <div className="relative h-24 overflow-hidden bg-secondary">
        {imageMap[product.id] ? (
          <img src={imageMap[product.id]} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl bg-gradient-to-br from-secondary to-muted">🍔</div>
        )}
        {featured && (
          <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground flex items-center gap-0.5" style={{ fontSize: "9px" }}>
            <Sparkles className="w-2.5 h-2.5" />
            Destaque
          </div>
        )}
        {product.has_discount && product.promo_price && (
          <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground flex items-center gap-0.5" style={{ fontSize: "9px" }}>
            <Flame className="w-2.5 h-2.5" />
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-xs font-semibold line-clamp-1">{product.name}</p>
        <div className="flex items-center gap-1 mt-0.5">
          {product.has_discount && product.promo_price ? (
            <>
              <span className="text-xs font-bold text-primary">R$ {Number(product.promo_price).toFixed(2)}</span>
              <span className="text-[10px] text-muted-foreground line-through">R$ {Number(product.price).toFixed(2)}</span>
            </>
          ) : (
            <span className="text-xs font-bold">R$ {Number(product.price).toFixed(2)}</span>
          )}
        </div>
      </div>
    </div>
  );

  // ── Config Panel ──
  const ConfigPanel = () => (
    <div className="space-y-6">
      {/* Featured */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="w-4 h-4 text-yellow-500" />
            Destaques da Loja
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => { setSelectedFeaturedProduct(""); setFeaturedDialogOpen(true); }} className="gap-1 h-8">
            <Plus className="w-3 h-3" /> Adicionar
          </Button>
        </CardHeader>
        <CardContent>
          {activeFeatured.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum destaque configurado.</p>
          ) : (
            <div className="space-y-1.5">
              {activeFeatured.map((f) => {
                const product = productMap.get(f.product_id);
                return (
                  <div key={f.product_id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      {imageMap[f.product_id] && (
                        <img src={imageMap[f.product_id]} className="w-8 h-8 rounded-lg object-cover" />
                      )}
                      <span className="text-sm font-medium">{product?.name || "Produto"}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFeaturedDraft(f.product_id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sections */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GripVertical className="w-4 h-4" />
            Seções da Vitrine
          </CardTitle>
          <Button size="sm" variant="outline" onClick={openCreateSection} className="gap-1 h-8">
            <Plus className="w-3 h-3" /> Nova Seção
          </Button>
        </CardHeader>
        <CardContent>
          {activeSections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma seção. A loja usará as categorias padrão.
            </p>
          ) : (
            <div className="space-y-3">
              {activeSections
                .map((s, originalIdx) => ({ section: s, originalIdx }))
                .sort((a, b) => a.section.position - b.section.position)
                .map(({ section, originalIdx }, sortedIdx) => (
                  <div key={originalIdx} className="border border-border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between bg-secondary/30 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-0.5">
                          <Button variant="ghost" size="icon" className="h-5 w-5" disabled={sortedIdx === 0}
                            onClick={() => moveSectionDraft(originalIdx, "up")}>
                            <ChevronUp className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5" disabled={sortedIdx === activeSections.length - 1}
                            onClick={() => moveSectionDraft(originalIdx, "down")}>
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm">{section.title}</h4>
                          <span className="text-xs text-muted-foreground">
                            {section.products.length}/{MAX_SECTION_PRODUCTS} produtos
                            {!section.active && " • Inativa"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Switch checked={section.active} onCheckedChange={() => toggleSectionActiveDraft(originalIdx)} />
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSection(originalIdx)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                          if (confirm("Remover esta seção?")) removeSectionDraft(originalIdx);
                        }}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <div className="p-3">
                      {section.products.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">Nenhum produto</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {section.products.map((sp, pi) => {
                            const product = productMap.get(sp.product_id);
                            return (
                              <Badge key={pi} variant="secondary" className="gap-1 py-1 pl-2 pr-0.5">
                                {product?.name || "Produto"}
                                <button
                                  onClick={() => removeProductFromSectionDraft(originalIdx, pi)}
                                  className="ml-0.5 w-4 h-4 rounded-full hover:bg-destructive/20 flex items-center justify-center"
                                >
                                  <Trash2 className="w-2.5 h-2.5 text-destructive" />
                                </button>
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                      {section.products.length < MAX_SECTION_PRODUCTS && (
                        <Button variant="outline" size="sm" className="mt-2 gap-1 h-7 text-xs"
                          onClick={() => { setActiveSectionIdx(originalIdx); setSelectedProductId(""); setProductDialogOpen(true); }}>
                          <Plus className="w-3 h-3" /> Adicionar Produto
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Minha Vitrine</h1>
          <p className="text-sm text-muted-foreground">Organize os destaques e seções da sua loja</p>
        </div>
        <Button onClick={handleSave} disabled={saving || !isDirty} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar alterações
        </Button>
      </div>

      {isDirty && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-700 dark:text-yellow-300 rounded-xl px-4 py-2.5 text-sm flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          Você tem alterações não salvas.
        </div>
      )}

      {/* Desktop: 2 columns */}
      <div className="hidden lg:grid lg:grid-cols-2 gap-6">
        <ConfigPanel />
        <div className="sticky top-4 self-start">
          <PreviewPanel />
        </div>
      </div>

      {/* Mobile: tabs */}
      <div className="lg:hidden">
        <Tabs value={mobileTab} onValueChange={setMobileTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="config" className="gap-1.5">
              <Settings2 className="w-4 h-4" /> Configuração
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1.5">
              <Eye className="w-4 h-4" /> Pré-visualização
            </TabsTrigger>
          </TabsList>
          <TabsContent value="config" className="mt-4">
            <ConfigPanel />
          </TabsContent>
          <TabsContent value="preview" className="mt-4">
            <PreviewPanel />
          </TabsContent>
        </Tabs>
      </div>

      {/* Save button fixed on mobile */}
      {isDirty && (
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-50">
          <Button onClick={handleSave} disabled={saving} className="w-full gap-2 shadow-xl h-12">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar alterações
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <Dialog open={featuredDialogOpen} onOpenChange={setFeaturedDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Destaque</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label>Produto</Label>
            <Select value={selectedFeaturedProduct} onValueChange={setSelectedFeaturedProduct}>
              <SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
              <SelectContent>
                {availableForFeatured.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeaturedDialogOpen(false)}>Cancelar</Button>
            <Button disabled={!selectedFeaturedProduct} onClick={() => {
              addFeaturedDraft(selectedFeaturedProduct);
              setFeaturedDialogOpen(false);
            }}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSectionIdx !== null ? "Editar Seção" : "Nova Seção"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Título da seção</Label>
              <Input value={sectionForm.title} onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })} placeholder="Ex: 🍔 Hambúrgueres da Casa" />
            </div>
            <div>
              <Label>Categoria (opcional)</Label>
              <Select value={sectionForm.category_id || "none"} onValueChange={(v) => setSectionForm({ ...sectionForm, category_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {categories.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.emoji} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveSection}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Produto à Seção</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label>Produto</Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
              <SelectContent>
                {activeSectionIdx !== null && getAvailableProducts(activeSectionIdx).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)}>Cancelar</Button>
            <Button disabled={!selectedProductId} onClick={handleAddProduct}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default MyStorePage;
