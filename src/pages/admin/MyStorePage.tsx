import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/contexts/AdminContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Pencil, Trash2, Star, Sparkles, Loader2, Save, Eye, Flame, GripVertical, ChevronDown, ChevronUp, X,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const MAX_SECTION_PRODUCTS = 12;

// ── Types ──
interface DraftSectionProduct {
  id?: string;
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

  useEffect(() => {
    if (sectionsLoading || featuredLoading) return;
    if (initialized) return;
    setDraftSections(
      remoteSections.map((s: any) => ({
        id: s.id, title: s.title, category_id: s.category_id,
        position: s.position, active: s.active,
        products: (s.tenant_section_products || [])
          .sort((a: any, b: any) => a.position - b.position)
          .map((sp: any) => ({ id: sp.id, product_id: sp.product_id, position: sp.position, active: sp.active })),
      }))
    );
    setDraftFeatured(
      remoteFeatured.map((f: any) => ({ id: f.id, product_id: f.product_id, position: f.position }))
    );
    setInitialized(true);
  }, [sectionsLoading, featuredLoading, remoteSections, remoteFeatured, initialized]);

  // ── Dirty detection ──
  const isDirty = useMemo(() => {
    if (!initialized) return false;
    const cs = JSON.stringify(draftSections.map(({ id, title, category_id, position, active, products, _deleted }) => ({
      id, title, category_id, position, active, _deleted,
      products: products.map(({ id: pid, product_id, position: pos, active: a }) => ({ id: pid, product_id, position: pos, active: a })),
    })));
    const os = JSON.stringify(remoteSections.map((s: any) => ({
      id: s.id, title: s.title, category_id: s.category_id, position: s.position, active: s.active, _deleted: undefined,
      products: (s.tenant_section_products || []).sort((a: any, b: any) => a.position - b.position)
        .map((sp: any) => ({ id: sp.id, product_id: sp.product_id, position: sp.position, active: sp.active })),
    })));
    const cf = JSON.stringify(draftFeatured);
    const of2 = JSON.stringify(remoteFeatured.map((f: any) => ({ id: f.id, product_id: f.product_id, position: f.position })));
    return cs !== os || cf !== of2;
  }, [draftSections, draftFeatured, remoteSections, remoteFeatured, initialized]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ── Product map ──
  const productMap = useMemo(() => {
    const map = new Map<string, typeof tenantProducts[0]>();
    for (const p of tenantProducts) map.set(p.id, p);
    return map;
  }, [tenantProducts]);

  // ── Featured actions ──
  const activeFeatured = draftFeatured.filter((f) => !f._deleted);
  const availableForFeatured = tenantProducts.filter(
    (p) => !activeFeatured.some((f) => f.product_id === p.id)
  );

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
      if (item.id) return prev.map((f) => (f === item ? { ...f, _deleted: true } : f));
      return prev.filter((f) => f !== item);
    });
  };

  // ── Sections actions ──
  const getActiveIndices = (sections: DraftSection[]) =>
    sections.reduce<number[]>((acc, s, i) => (s._deleted ? acc : [...acc, i]), []);

  const activeSections = draftSections.filter((s) => !s._deleted);

  const addSectionDraft = (title: string, categoryId: string | null) => {
    setDraftSections((prev) => [
      ...prev,
      { title, category_id: categoryId === "none" ? null : categoryId, position: activeSections.length, active: true, products: [] },
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

  const getAvailableProducts = (sectionIndex: number) => {
    const section = activeSections[sectionIndex];
    if (!section) return tenantProducts;
    const usedIds = section.products.map((p) => p.product_id);
    return tenantProducts.filter((p) => !usedIds.includes(p.id));
  };

  // ── Drag & Drop for Featured ──
  const [dragFeaturedIdx, setDragFeaturedIdx] = useState<number | null>(null);
  const [dragOverFeaturedIdx, setDragOverFeaturedIdx] = useState<number | null>(null);

  const handleFeaturedDragStart = (idx: number) => setDragFeaturedIdx(idx);
  const handleFeaturedDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverFeaturedIdx(idx);
  };
  const handleFeaturedDrop = (idx: number) => {
    if (dragFeaturedIdx === null || dragFeaturedIdx === idx) {
      setDragFeaturedIdx(null);
      setDragOverFeaturedIdx(null);
      return;
    }
    setDraftFeatured((prev) => {
      const active = prev.filter((f) => !f._deleted);
      const item = active[dragFeaturedIdx];
      const without = active.filter((_, i) => i !== dragFeaturedIdx);
      without.splice(idx, 0, item);
      const deleted = prev.filter((f) => f._deleted);
      return [...without.map((f, i) => ({ ...f, position: i })), ...deleted];
    });
    setDragFeaturedIdx(null);
    setDragOverFeaturedIdx(null);
  };

  // ── Drag & Drop for Section Products ──
  const [dragSectionProductInfo, setDragSectionProductInfo] = useState<{ sectionIdx: number; productIdx: number } | null>(null);
  const [dragOverSectionProduct, setDragOverSectionProduct] = useState<{ sectionIdx: number; productIdx: number } | null>(null);

  const handleSectionProductDragStart = (sectionIdx: number, productIdx: number) => {
    setDragSectionProductInfo({ sectionIdx, productIdx });
  };
  const handleSectionProductDragOver = (e: React.DragEvent, sectionIdx: number, productIdx: number) => {
    e.preventDefault();
    setDragOverSectionProduct({ sectionIdx, productIdx });
  };
  const handleSectionProductDrop = (sectionIdx: number, productIdx: number) => {
    if (!dragSectionProductInfo || dragSectionProductInfo.sectionIdx !== sectionIdx) {
      setDragSectionProductInfo(null);
      setDragOverSectionProduct(null);
      return;
    }
    const fromIdx = dragSectionProductInfo.productIdx;
    if (fromIdx === productIdx) {
      setDragSectionProductInfo(null);
      setDragOverSectionProduct(null);
      return;
    }
    setDraftSections((prev) => {
      const activeIdx = getActiveIndices(prev);
      const realIdx = activeIdx[sectionIdx];
      const section = prev[realIdx];
      const prods = [...section.products];
      const [moved] = prods.splice(fromIdx, 1);
      prods.splice(productIdx, 0, moved);
      const next = [...prev];
      next[realIdx] = { ...section, products: prods.map((p, i) => ({ ...p, position: i })) };
      return next;
    });
    setDragSectionProductInfo(null);
    setDragOverSectionProduct(null);
  };

  // ── Drag & Drop for Sections ──
  const [dragSectionIdx, setDragSectionIdx] = useState<number | null>(null);
  const [dragOverSectionIdx, setDragOverSectionIdx] = useState<number | null>(null);

  const handleSectionDragStart = (idx: number) => setDragSectionIdx(idx);
  const handleSectionDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverSectionIdx(idx);
  };
  const handleSectionDrop = (idx: number) => {
    if (dragSectionIdx === null || dragSectionIdx === idx) {
      setDragSectionIdx(null);
      setDragOverSectionIdx(null);
      return;
    }
    setDraftSections((prev) => {
      const activeIdx = getActiveIndices(prev);
      const sorted = [...activeSections].sort((a, b) => a.position - b.position);
      const [moved] = sorted.splice(dragSectionIdx, 0);
      // Reorder
      const arr = activeSections.sort((a, b) => a.position - b.position);
      const item = arr[dragSectionIdx];
      const without = arr.filter((_, i) => i !== dragSectionIdx);
      without.splice(idx, 0, item);
      // Rebuild with new positions
      const posMap = new Map<DraftSection, number>();
      without.forEach((s, i) => posMap.set(s, i));
      return prev.map((s) => {
        if (s._deleted) return s;
        const newPos = posMap.get(s);
        return newPos !== undefined ? { ...s, position: newPos } : s;
      });
    });
    setDragSectionIdx(null);
    setDragOverSectionIdx(null);
  };

  // ── Save ──
  const handleSave = async () => {
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
      // Update positions for existing
      for (let i = 0; i < activeFeatured.length; i++) {
        const f = activeFeatured[i];
        if (f.id) {
          await supabase.from("featured_products_tenant").update({ position: i }).eq("id", f.id);
        }
      }

      const deletedSectionIds = draftSections.filter((s) => s._deleted && s.id).map((s) => s.id!);
      if (deletedSectionIds.length > 0) {
        await supabase.from("tenant_section_products").delete().in("tenant_section_id", deletedSectionIds);
        await supabase.from("tenant_sections").delete().in("id", deletedSectionIds);
      }

      const sortedSections = [...activeSections].sort((a, b) => a.position - b.position);
      for (let i = 0; i < sortedSections.length; i++) {
        const section = sortedSections[i];
        let sectionId = section.id;

        if (sectionId) {
          await supabase.from("tenant_sections").update({
            title: section.title, category_id: section.category_id, position: i, active: section.active,
          }).eq("id", sectionId);
          await supabase.from("tenant_section_products").delete().eq("tenant_section_id", sectionId);
        } else {
          const { data, error } = await supabase.from("tenant_sections").insert({
            tenant_id: tenantId!, title: section.title, category_id: section.category_id, position: i, active: section.active,
          }).select("id").single();
          if (error) throw error;
          sectionId = data.id;
        }

        if (section.products.length > 0) {
          await supabase.from("tenant_section_products").insert(
            section.products.map((p, pi) => ({
              tenant_section_id: sectionId!, product_id: p.product_id, position: pi, active: p.active,
            }))
          );
        }
      }

      toast.success("Perfil da loja atualizado com sucesso!");
      setInitialized(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  // ── Dialogs ──
  const [featuredDialogOpen, setFeaturedDialogOpen] = useState(false);
  const [selectedFeaturedProduct, setSelectedFeaturedProduct] = useState("");
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingSectionIdx, setEditingSectionIdx] = useState<number | null>(null);
  const [sectionForm, setSectionForm] = useState({ title: "", category_id: "" });
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [activeSectionIdx, setActiveSectionIdx] = useState<number | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");

  const openCreateSection = () => {
    setEditingSectionIdx(null);
    setSectionForm({ title: "", category_id: "" });
    setSectionDialogOpen(true);
  };

  const openEditSection = (idx: number) => {
    const sorted = [...activeSections].sort((a, b) => a.position - b.position);
    const s = sorted[idx];
    setEditingSectionIdx(idx);
    setSectionForm({ title: s.title, category_id: s.category_id || "" });
    setSectionDialogOpen(true);
  };

  const handleSaveSection = () => {
    if (!sectionForm.title.trim()) { toast.error("Título é obrigatório"); return; }
    if (editingSectionIdx !== null) {
      // Find the actual index in activeSections for the sorted position
      const sorted = [...activeSections].sort((a, b) => a.position - b.position);
      const section = sorted[editingSectionIdx];
      const realIdx = activeSections.indexOf(section);
      updateSectionDraft(realIdx, sectionForm.title.trim(), sectionForm.category_id || null);
    } else {
      addSectionDraft(sectionForm.title.trim(), sectionForm.category_id || null);
    }
    setSectionDialogOpen(false);
  };

  const handleAddProduct = () => {
    if (activeSectionIdx !== null && selectedProductId) {
      // Find real index from sorted
      const sorted = [...activeSections].sort((a, b) => a.position - b.position);
      const section = sorted[activeSectionIdx];
      const realIdx = activeSections.indexOf(section);
      addProductToSectionDraft(realIdx, selectedProductId);
    }
    setProductDialogOpen(false);
    setSelectedProductId("");
  };

  // ── Preview data ──
  const previewSections = useMemo(() => {
    return activeSections
      .filter((s) => s.active)
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        title: s.title,
        products: s.products.filter((sp) => sp.active)
          .sort((a, b) => a.position - b.position)
          .map((sp) => productMap.get(sp.product_id))
          .filter(Boolean) as typeof tenantProducts,
      }))
      .filter((s) => s.products.length > 0);
  }, [activeSections, productMap]);

  const previewFeatured = useMemo(() => {
    return activeFeatured.map((f) => productMap.get(f.product_id)).filter(Boolean) as typeof tenantProducts;
  }, [activeFeatured, productMap]);

  // ── Render guards ──
  if (!tenantId) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Selecione um estabelecimento para gerenciar a vitrine.</p>
      </div>
    );
  }

  if (!initialized) {
    return (
      <div className="space-y-6 p-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const sortedActiveSections = [...activeSections].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Minha Vitrine</h1>
          <p className="text-sm text-muted-foreground">Organize como sua loja aparece para os clientes</p>
        </div>
        <Button onClick={handleSave} disabled={saving || !isDirty} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar alterações
        </Button>
      </div>

      {isDirty && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-xl px-4 py-2.5 text-sm flex items-center gap-2">
          ⚠️ Você tem alterações não salvas.
        </div>
      )}

      {/* ═══ PREVIEW SECTION ═══ */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
        <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center gap-2">
          <Eye className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Pré-visualização da sua loja</span>
        </div>

        {/* Store header preview */}
        <div className="relative">
          <div className="w-full h-32 overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-secondary">
            {tenant?.cover_url && <img src={tenant.cover_url} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="flex flex-col items-center -mt-10 relative z-10 pb-4">
            <div className="w-20 h-20 rounded-full bg-card border-4 border-card shadow-lg overflow-hidden">
              {tenant?.logo_url ? (
                <img src={tenant.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl bg-secondary">
                  {tenant?.name?.charAt(0) || "L"}
                </div>
              )}
            </div>
            <h3 className="text-lg font-bold mt-2">{tenant?.name || "Sua Loja"}</h3>
            {tenant?.category && <span className="text-xs text-muted-foreground">{tenant.category}</span>}
          </div>
        </div>

        {/* Preview content */}
        <div className="px-4 pb-6 space-y-6">
          {previewFeatured.length > 0 && (
            <div>
              <h4 className="text-sm font-bold mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Destaques da Loja
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {previewFeatured.map((p) => (
                  <MiniProductCard key={p.id} product={p} imageUrl={imageMap[p.id]} featured />
                ))}
              </div>
            </div>
          )}

          {previewSections.map((section, i) => (
            <div key={i}>
              <h4 className="text-sm font-bold mb-3">{section.title}</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {section.products.map((p) => (
                  <MiniProductCard key={p.id} product={p} imageUrl={imageMap[p.id]} />
                ))}
              </div>
            </div>
          ))}

          {previewFeatured.length === 0 && previewSections.length === 0 && (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">🏪</div>
              <p className="text-sm text-muted-foreground">Adicione destaques e seções abaixo para ver a pré-visualização</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ FEATURED PRODUCTS ═══ */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="w-5 h-5 text-amber-500" />
            ⭐ Destaques da Loja
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => { setSelectedFeaturedProduct(""); setFeaturedDialogOpen(true); }} className="gap-1.5">
            <Plus className="w-4 h-4" /> Adicionar
          </Button>
        </CardHeader>
        <CardContent>
          {activeFeatured.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum destaque. Adicione produtos para aparecerem em destaque na loja.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {activeFeatured.map((f, idx) => {
                const product = productMap.get(f.product_id);
                if (!product) return null;
                const isDragOver = dragOverFeaturedIdx === idx;
                return (
                  <div
                    key={f.product_id}
                    draggable
                    onDragStart={() => handleFeaturedDragStart(idx)}
                    onDragOver={(e) => handleFeaturedDragOver(e, idx)}
                    onDrop={() => handleFeaturedDrop(idx)}
                    onDragEnd={() => { setDragFeaturedIdx(null); setDragOverFeaturedIdx(null); }}
                    className={`relative group bg-card border rounded-xl overflow-hidden cursor-grab active:cursor-grabbing transition-all ${
                      isDragOver ? "border-primary ring-2 ring-primary/30 scale-[1.02]" : "border-border hover:border-primary/40"
                    } ${dragFeaturedIdx === idx ? "opacity-50" : ""}`}
                  >
                    <div className="absolute top-1.5 left-1.5 z-10">
                      <div className="w-6 h-6 rounded-md bg-foreground/60 backdrop-blur-sm flex items-center justify-center">
                        <GripVertical className="w-3.5 h-3.5 text-background" />
                      </div>
                    </div>
                    <button
                      onClick={() => removeFeaturedDraft(f.product_id)}
                      className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-md bg-destructive/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5 text-destructive-foreground" />
                    </button>
                    <div className="h-24 bg-secondary overflow-hidden">
                      {imageMap[f.product_id] ? (
                        <img src={imageMap[f.product_id]} alt={product.name} className="w-full h-full object-contain bg-white" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">🍔</div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-semibold line-clamp-1">{product.name}</p>
                      <p className="text-xs text-primary font-bold mt-0.5">
                        R$ {Number(product.has_discount && product.promo_price ? product.promo_price : product.price).toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })}
              {/* Add button card */}
              <button
                onClick={() => { setSelectedFeaturedProduct(""); setFeaturedDialogOpen(true); }}
                className="border-2 border-dashed border-border rounded-xl h-full min-h-[140px] flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
              >
                <Plus className="w-6 h-6" />
                <span className="text-xs font-medium">Adicionar</span>
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ SECTIONS ═══ */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            🧩 Seções da Vitrine
          </CardTitle>
          <Button size="sm" variant="outline" onClick={openCreateSection} className="gap-1.5">
            <Plus className="w-4 h-4" /> Nova Seção
          </Button>
        </CardHeader>
        <CardContent>
          {activeSections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Nenhuma seção criada. A loja usará as categorias padrão.</p>
              <Button variant="outline" className="mt-3 gap-1.5" onClick={openCreateSection}>
                <Plus className="w-4 h-4" /> Criar primeira seção
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedActiveSections.map((section, sortedIdx) => {
                const realIdx = activeSections.indexOf(section);
                const isDragOver = dragOverSectionIdx === sortedIdx;
                return (
                  <div
                    key={sortedIdx}
                    draggable
                    onDragStart={() => handleSectionDragStart(sortedIdx)}
                    onDragOver={(e) => handleSectionDragOver(e, sortedIdx)}
                    onDrop={() => handleSectionDrop(sortedIdx)}
                    onDragEnd={() => { setDragSectionIdx(null); setDragOverSectionIdx(null); }}
                    className={`border rounded-xl overflow-hidden transition-all ${
                      isDragOver ? "border-primary ring-2 ring-primary/30" : "border-border"
                    } ${dragSectionIdx === sortedIdx ? "opacity-50" : ""} ${!section.active ? "opacity-60" : ""}`}
                  >
                    {/* Section header */}
                    <div className="flex items-center justify-between bg-muted/50 px-3 py-2.5 cursor-grab active:cursor-grabbing">
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div>
                          <h4 className="font-semibold text-sm">{section.title}</h4>
                          <span className="text-xs text-muted-foreground">
                            {section.products.length}/{MAX_SECTION_PRODUCTS} produtos
                            {!section.active && " • Inativa"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Switch checked={section.active} onCheckedChange={() => toggleSectionActiveDraft(realIdx)} />
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSection(sortedIdx)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                          if (confirm("Remover esta seção?")) removeSectionDraft(realIdx);
                        }}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {/* Section products */}
                    <div className="p-3">
                      {section.products.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Nenhum produto nesta seção</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                          {section.products.map((sp, pi) => {
                            const product = productMap.get(sp.product_id);
                            if (!product) return null;
                            const isOver = dragOverSectionProduct?.sectionIdx === sortedIdx && dragOverSectionProduct?.productIdx === pi;
                            return (
                              <div
                                key={pi}
                                draggable
                                onDragStart={(e) => { e.stopPropagation(); handleSectionProductDragStart(sortedIdx, pi); }}
                                onDragOver={(e) => { e.stopPropagation(); handleSectionProductDragOver(e, sortedIdx, pi); }}
                                onDrop={(e) => { e.stopPropagation(); handleSectionProductDrop(sortedIdx, pi); }}
                                onDragEnd={() => { setDragSectionProductInfo(null); setDragOverSectionProduct(null); }}
                                className={`relative group bg-secondary/50 border rounded-lg overflow-hidden cursor-grab active:cursor-grabbing transition-all ${
                                  isOver ? "border-primary ring-1 ring-primary/30" : "border-transparent"
                                }`}
                              >
                                <button
                                  onClick={() => removeProductFromSectionDraft(realIdx, pi)}
                                  className="absolute top-1 right-1 z-10 w-5 h-5 rounded-full bg-destructive/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3 text-destructive-foreground" />
                                </button>
                                <div className="h-16 bg-white overflow-hidden">
                                  {imageMap[sp.product_id] ? (
                                    <img src={imageMap[sp.product_id]} alt="" className="w-full h-full object-contain" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xl">🍔</div>
                                  )}
                                </div>
                                <div className="p-1.5">
                                  <p className="text-[10px] font-medium line-clamp-1">{product.name}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {section.products.length < MAX_SECTION_PRODUCTS && (
                        <Button variant="outline" size="sm" className="mt-3 gap-1.5 text-xs"
                          onClick={() => { setActiveSectionIdx(sortedIdx); setSelectedProductId(""); setProductDialogOpen(true); }}>
                          <Plus className="w-3 h-3" /> Adicionar Produto
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fixed save on mobile */}
      {isDirty && (
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-50">
          <Button onClick={handleSave} disabled={saving} className="w-full gap-2 shadow-xl h-12">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar alterações
          </Button>
        </div>
      )}

      {/* ═══ DIALOGS ═══ */}
      <Dialog open={featuredDialogOpen} onOpenChange={setFeaturedDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Destaque</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label>Produto</Label>
            <Select value={selectedFeaturedProduct} onValueChange={setSelectedFeaturedProduct}>
              <SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
              <SelectContent>
                {availableForFeatured.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      {imageMap[p.id] && <img src={imageMap[p.id]} className="w-6 h-6 rounded object-cover" />}
                      {p.name}
                    </div>
                  </SelectItem>
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
                {activeSectionIdx !== null && (() => {
                  const sorted = [...activeSections].sort((a, b) => a.position - b.position);
                  const section = sorted[activeSectionIdx];
                  if (!section) return [];
                  const usedIds = section.products.map((p) => p.product_id);
                  return tenantProducts.filter((p) => !usedIds.includes(p.id));
                })().map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      {imageMap[p.id] && <img src={imageMap[p.id]} className="w-6 h-6 rounded object-cover" />}
                      {p.name}
                    </div>
                  </SelectItem>
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

// ── Mini product card for preview ──
const MiniProductCard = ({ product, imageUrl, featured }: {
  product: { id: string; name: string; price: number; promo_price: number | null; has_discount: boolean };
  imageUrl?: string;
  featured?: boolean;
}) => (
  <div className={`bg-card rounded-xl overflow-hidden shadow-sm border ${featured ? "border-primary/30" : "border-border"}`}>
    <div className="relative h-20 overflow-hidden bg-white">
      {imageUrl ? (
        <img src={imageUrl} alt={product.name} className="w-full h-full object-contain" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-2xl bg-gradient-to-br from-secondary to-muted">🍔</div>
      )}
      {featured && (
        <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground flex items-center gap-0.5 text-[9px]">
          <Sparkles className="w-2.5 h-2.5" /> Destaque
        </div>
      )}
      {product.has_discount && product.promo_price && (
        <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground flex items-center gap-0.5 text-[9px]">
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

export default MyStorePage;
