import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/contexts/AdminContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Pencil, Trash2, Star, Sparkles, Loader2, Save, Flame, GripVertical, X, Undo2, Search,
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
        .select("id, name, description, price, promo_price, has_discount, active, slug")
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
        .select("id, name, emoji, position")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .order("position");
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
        .select("name, logo_url, cover_url, category, address, city, slug")
        .eq("id", tenantId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // ── Draft state ──
  const [draftSections, setDraftSections] = useState<DraftSection[]>([]);
  const [draftFeatured, setDraftFeatured] = useState<DraftFeatured[]>([]);
  const [draftCategoryOrder, setDraftCategoryOrder] = useState<{ id: string; name: string; emoji: string | null; position: number }[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);

  const initDraft = useCallback(() => {
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
    setDraftCategoryOrder(
      categories.map((c: any) => ({ id: c.id, name: c.name, emoji: c.emoji, position: c.position ?? 0 }))
    );
  }, [remoteSections, remoteFeatured, categories]);

  useEffect(() => {
    if (sectionsLoading || featuredLoading) return;
    if (initialized) return;
    initDraft();
    setInitialized(true);
  }, [sectionsLoading, featuredLoading, initialized, initDraft]);

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
    const cc = JSON.stringify(draftCategoryOrder.map((c) => ({ id: c.id, position: c.position })));
    const oc = JSON.stringify(categories.map((c: any) => ({ id: c.id, position: c.position ?? 0 })));
    return cs !== os || cf !== of2 || cc !== oc;
  }, [draftSections, draftFeatured, draftCategoryOrder, remoteSections, remoteFeatured, categories, initialized]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const handleDiscard = () => {
    if (!isDirty) return;
    if (confirm("Descartar todas as alterações?")) {
      initDraft();
    }
  };

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

  // ── Drag & Drop for Featured ──
  const [dragFeaturedIdx, setDragFeaturedIdx] = useState<number | null>(null);
  const [dragOverFeaturedIdx, setDragOverFeaturedIdx] = useState<number | null>(null);

  const handleFeaturedDragStart = (idx: number) => setDragFeaturedIdx(idx);
  const handleFeaturedDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverFeaturedIdx(idx); };
  const handleFeaturedDrop = (idx: number) => {
    if (dragFeaturedIdx === null || dragFeaturedIdx === idx) { setDragFeaturedIdx(null); setDragOverFeaturedIdx(null); return; }
    setDraftFeatured((prev) => {
      const active = prev.filter((f) => !f._deleted);
      const item = active[dragFeaturedIdx];
      const without = active.filter((_, i) => i !== dragFeaturedIdx);
      without.splice(idx, 0, item);
      const deleted = prev.filter((f) => f._deleted);
      return [...without.map((f, i) => ({ ...f, position: i })), ...deleted];
    });
    setDragFeaturedIdx(null); setDragOverFeaturedIdx(null);
  };

  // ── Drag & Drop for Section Products ──
  const [dragSectionProductInfo, setDragSectionProductInfo] = useState<{ sectionIdx: number; productIdx: number } | null>(null);
  const [dragOverSectionProduct, setDragOverSectionProduct] = useState<{ sectionIdx: number; productIdx: number } | null>(null);

  const handleSectionProductDrop = (sectionIdx: number, productIdx: number) => {
    if (!dragSectionProductInfo || dragSectionProductInfo.sectionIdx !== sectionIdx) {
      setDragSectionProductInfo(null); setDragOverSectionProduct(null); return;
    }
    const fromIdx = dragSectionProductInfo.productIdx;
    if (fromIdx === productIdx) { setDragSectionProductInfo(null); setDragOverSectionProduct(null); return; }
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
    setDragSectionProductInfo(null); setDragOverSectionProduct(null);
  };

  // ── Drag & Drop for Sections ──
  const [dragSectionIdx, setDragSectionIdx] = useState<number | null>(null);
  const [dragOverSectionIdx, setDragOverSectionIdx] = useState<number | null>(null);

  const handleSectionDrop = (idx: number) => {
    if (dragSectionIdx === null || dragSectionIdx === idx) { setDragSectionIdx(null); setDragOverSectionIdx(null); return; }
    setDraftSections((prev) => {
      const arr = [...activeSections].sort((a, b) => a.position - b.position);
      const item = arr[dragSectionIdx];
      const without = arr.filter((_, i) => i !== dragSectionIdx);
      without.splice(idx, 0, item);
      const posMap = new Map<DraftSection, number>();
      without.forEach((s, i) => posMap.set(s, i));
      return prev.map((s) => {
        if (s._deleted) return s;
        const newPos = posMap.get(s);
        return newPos !== undefined ? { ...s, position: newPos } : s;
      });
    });
    setDragSectionIdx(null); setDragOverSectionIdx(null);
  };

  // ── Drag & Drop for Categories ──
  const [dragCatIdx, setDragCatIdx] = useState<number | null>(null);
  const [dragOverCatIdx, setDragOverCatIdx] = useState<number | null>(null);

  const handleCategoryDrop = (idx: number) => {
    if (dragCatIdx === null || dragCatIdx === idx) { setDragCatIdx(null); setDragOverCatIdx(null); return; }
    setDraftCategoryOrder((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(dragCatIdx, 1);
      arr.splice(idx, 0, moved);
      return arr.map((c, i) => ({ ...c, position: i }));
    });
    setDragCatIdx(null); setDragOverCatIdx(null);
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
      // Featured
      const deletedFeaturedIds = draftFeatured.filter((f) => f._deleted && f.id).map((f) => f.id!);
      if (deletedFeaturedIds.length > 0) {
        await supabase.from("featured_products_tenant").delete().in("id", deletedFeaturedIds);
      }
      const newFeatured = activeFeatured.filter((f) => !f.id);
      if (newFeatured.length > 0) {
        const { error: featErr } = await supabase.from("featured_products_tenant").insert(
          newFeatured.map((f, i) => ({ tenant_id: tenantId!, product_id: f.product_id, position: i }))
        );
        if (featErr) throw featErr;
      }
      for (let i = 0; i < activeFeatured.length; i++) {
        const f = activeFeatured[i];
        if (f.id) await supabase.from("featured_products_tenant").update({ position: i }).eq("id", f.id);
      }

      // Sections
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

      // Category order
      for (const cat of draftCategoryOrder) {
        await supabase.from("product_categories").update({ position: cat.position }).eq("id", cat.id);
      }

      toast.success("Sua loja foi atualizada com sucesso!");
      setInitialized(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  // ── Dialogs ──
  const [featuredDialogOpen, setFeaturedDialogOpen] = useState(false);
  const [featuredSearch, setFeaturedSearch] = useState("");
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingSectionIdx, setEditingSectionIdx] = useState<number | null>(null);
  const [sectionForm, setSectionForm] = useState({ title: "", category_id: "" });
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [activeSectionIdx, setActiveSectionIdx] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState("");

  const openCreateSection = () => {
    setEditingSectionIdx(null);
    setSectionForm({ title: "", category_id: "" });
    setSectionDialogOpen(true);
  };

  const openEditSection = (sortedIdx: number) => {
    const sorted = [...activeSections].sort((a, b) => a.position - b.position);
    const s = sorted[sortedIdx];
    setEditingSectionIdx(sortedIdx);
    setSectionForm({ title: s.title, category_id: s.category_id || "" });
    setSectionDialogOpen(true);
  };

  const handleSaveSection = () => {
    if (!sectionForm.title.trim()) { toast.error("Título é obrigatório"); return; }
    if (editingSectionIdx !== null) {
      const sorted = [...activeSections].sort((a, b) => a.position - b.position);
      const section = sorted[editingSectionIdx];
      const realIdx = activeSections.indexOf(section);
      updateSectionDraft(realIdx, sectionForm.title.trim(), sectionForm.category_id || null);
    } else {
      addSectionDraft(sectionForm.title.trim(), sectionForm.category_id || null);
    }
    setSectionDialogOpen(false);
  };

  const handleAddProduct = (productId: string) => {
    if (activeSectionIdx !== null && productId) {
      const sorted = [...activeSections].sort((a, b) => a.position - b.position);
      const section = sorted[activeSectionIdx];
      const realIdx = activeSections.indexOf(section);
      addProductToSectionDraft(realIdx, productId);
    }
  };

  // ── Preview data ──
  const previewFeatured = useMemo(() => {
    return activeFeatured.map((f) => productMap.get(f.product_id)).filter(Boolean) as typeof tenantProducts;
  }, [activeFeatured, productMap]);

  const sortedActiveSections = useMemo(() =>
    [...activeSections].sort((a, b) => a.position - b.position),
  [activeSections]);

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
      </div>
    );
  }

  return (
    <div className="pb-28">
      {/* ── Top bar ── */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
        <span className="text-base">🛠️</span>
        <span className="font-medium">Modo edição da sua loja</span>
        <span className="text-xs opacity-70">— alterações só serão salvas ao final</span>
        {isDirty && (
          <Badge variant="outline" className="ml-auto border-amber-500/40 text-amber-700 dark:text-amber-300 text-xs">
            Não salvo
          </Badge>
        )}
      </div>

      {/* ── Store layout (real layout) ── */}
      <div className="min-h-screen bg-background">
        {/* Store header - mirror of RestaurantPage */}
        <section className="relative z-0">
          <div className="w-full h-56 md:h-72 overflow-hidden">
            {tenant?.cover_url ? (
              <img src={tenant.cover_url} alt="Capa" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-secondary" />
            )}
          </div>
          <div className="container mx-auto px-4 flex flex-col items-center text-center -mt-32 relative z-10">
            <div className="w-36 h-36 md:w-40 md:h-40 rounded-full bg-card border-4 border-card shadow-xl overflow-hidden">
              {tenant?.logo_url ? (
                <img src={tenant.logo_url} alt={tenant.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-5xl md:text-6xl bg-secondary">
                  {tenant?.name?.charAt(0) || "L"}
                </div>
              )}
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground mt-2">{tenant?.name || "Sua Loja"}</h2>
            {tenant?.category && <p className="text-sm text-muted-foreground mt-0.5">{tenant.category}</p>}
            {tenant?.address && <p className="text-xs text-muted-foreground mt-0.5">{tenant.address}{tenant.city ? `, ${tenant.city}` : ""}</p>}
          </div>
        </section>

        <main className="container mx-auto px-4 py-6 space-y-8">
          {/* ═══ FEATURED SECTION ═══ */}
          <EditableSection
            title="⭐ Destaques da Loja"
            icon={<Sparkles className="w-4 h-4 text-amber-500" />}
            onAdd={() => { setFeaturedSearch(""); setFeaturedDialogOpen(true); }}
            addLabel="Adicionar destaque"
            isEmpty={activeFeatured.length === 0}
            emptyText="Clique em + para adicionar produtos em destaque"
            emptyIcon="⭐"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    className={`relative group transition-all ${
                      isDragOver ? "ring-2 ring-primary/50 rounded-2xl" : ""
                    } ${dragFeaturedIdx === idx ? "opacity-40 scale-95" : ""}`}
                  >
                    {/* Edit overlay */}
                    <div className="absolute inset-0 z-10 rounded-2xl border-2 border-dashed border-transparent group-hover:border-primary/40 transition-all pointer-events-none" />
                    <div className="absolute top-2 left-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="w-7 h-7 rounded-lg bg-foreground/70 backdrop-blur-sm flex items-center justify-center cursor-grab active:cursor-grabbing">
                        <GripVertical className="w-3.5 h-3.5 text-background" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeFeaturedDraft(f.product_id)}
                      className="absolute top-2 right-2 z-20 w-7 h-7 rounded-lg bg-destructive/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                    >
                      <X className="w-3.5 h-3.5 text-destructive-foreground" />
                    </button>
                    {/* Real featured card */}
                    <FeaturedProductCard product={product} imageUrl={imageMap[product.id]} />
                  </div>
                );
              })}
            </div>
          </EditableSection>

          {/* ═══ CATEGORY ORDER ═══ */}
          {draftCategoryOrder.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  🏷️ Ordem das Categorias
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    (arraste para reordenar)
                  </span>
                </h3>
              </div>
              <div className="flex gap-2 flex-wrap">
                {draftCategoryOrder.map((cat, idx) => {
                  const isDragOver = dragOverCatIdx === idx;
                  return (
                    <div
                      key={cat.id}
                      draggable
                      onDragStart={() => setDragCatIdx(idx)}
                      onDragOver={(e) => { e.preventDefault(); setDragOverCatIdx(idx); }}
                      onDrop={() => handleCategoryDrop(idx)}
                      onDragEnd={() => { setDragCatIdx(null); setDragOverCatIdx(null); }}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full bg-card border border-border cursor-grab active:cursor-grabbing transition-all select-none ${
                        isDragOver ? "ring-2 ring-primary/50 scale-105" : ""
                      } ${dragCatIdx === idx ? "opacity-40 scale-95" : ""}`}
                    >
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium whitespace-nowrap">
                        {cat.emoji || "🍽️"} {cat.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ═══ CUSTOM SECTIONS ═══ */}
          {sortedActiveSections.map((section, sortedIdx) => {
            const realIdx = activeSections.indexOf(section);
            const isDragOver = dragOverSectionIdx === sortedIdx;

            return (
              <div
                key={sortedIdx}
                draggable
                onDragStart={() => setDragSectionIdx(sortedIdx)}
                onDragOver={(e) => { e.preventDefault(); setDragOverSectionIdx(sortedIdx); }}
                onDrop={() => handleSectionDrop(sortedIdx)}
                onDragEnd={() => { setDragSectionIdx(null); setDragOverSectionIdx(null); }}
                className={`transition-all ${isDragOver ? "ring-2 ring-primary/40 rounded-2xl" : ""} ${dragSectionIdx === sortedIdx ? "opacity-40 scale-[0.98]" : ""} ${!section.active ? "opacity-50" : ""}`}
              >
                <EditableSection
                  title={section.title}
                  onAdd={() => { setActiveSectionIdx(sortedIdx); setProductSearch(""); setProductDialogOpen(true); }}
                  addLabel="Adicionar produto"
                  maxItems={MAX_SECTION_PRODUCTS}
                  currentItems={section.products.length}
                  isEmpty={section.products.length === 0}
                  emptyText="Seção vazia — adicione produtos"
                  emptyIcon="📦"
                  extraControls={
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1.5 mr-2">
                        <span className="text-xs text-muted-foreground">{section.active ? "Ativa" : "Inativa"}</span>
                        <Switch checked={section.active} onCheckedChange={() => toggleSectionActiveDraft(realIdx)} />
                      </div>
                      <button
                        className="w-7 h-7 rounded-lg bg-muted hover:bg-accent flex items-center justify-center transition-colors cursor-grab active:cursor-grabbing"
                        title="Arrastar para reordenar"
                      >
                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => openEditSection(sortedIdx)}
                        className="w-7 h-7 rounded-lg bg-muted hover:bg-accent flex items-center justify-center transition-colors"
                        title="Editar seção"
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => { if (confirm("Remover esta seção?")) removeSectionDraft(realIdx); }}
                        className="w-7 h-7 rounded-lg bg-muted hover:bg-destructive/10 flex items-center justify-center transition-colors"
                        title="Remover seção"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                  }
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {section.products.map((sp, pi) => {
                      const product = productMap.get(sp.product_id);
                      if (!product) return null;
                      const isOver = dragOverSectionProduct?.sectionIdx === sortedIdx && dragOverSectionProduct?.productIdx === pi;
                      return (
                        <div
                          key={pi}
                          draggable
                          onDragStart={(e) => { e.stopPropagation(); setDragSectionProductInfo({ sectionIdx: sortedIdx, productIdx: pi }); }}
                          onDragOver={(e) => { e.stopPropagation(); e.preventDefault(); setDragOverSectionProduct({ sectionIdx: sortedIdx, productIdx: pi }); }}
                          onDrop={(e) => { e.stopPropagation(); handleSectionProductDrop(sortedIdx, pi); }}
                          onDragEnd={() => { setDragSectionProductInfo(null); setDragOverSectionProduct(null); }}
                          className={`relative group transition-all ${
                            isOver ? "ring-2 ring-primary/50 rounded-2xl" : ""
                          } ${dragSectionProductInfo?.sectionIdx === sortedIdx && dragSectionProductInfo?.productIdx === pi ? "opacity-40 scale-95" : ""}`}
                        >
                          {/* Edit overlay */}
                          <div className="absolute inset-0 z-10 rounded-2xl border-2 border-dashed border-transparent group-hover:border-primary/40 transition-all pointer-events-none" />
                          <div className="absolute top-2 left-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="w-6 h-6 rounded-md bg-foreground/70 backdrop-blur-sm flex items-center justify-center cursor-grab active:cursor-grabbing">
                              <GripVertical className="w-3 h-3 text-background" />
                            </button>
                          </div>
                          <button
                            onClick={() => removeProductFromSectionDraft(realIdx, pi)}
                            className="absolute top-2 right-2 z-20 w-6 h-6 rounded-md bg-destructive/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                          >
                            <X className="w-3 h-3 text-destructive-foreground" />
                          </button>
                          {/* Real product card */}
                          <StoreProductCard product={product} imageUrl={imageMap[product.id]} />
                        </div>
                      );
                    })}
                    {/* Add slot */}
                    {section.products.length < MAX_SECTION_PRODUCTS && (
                      <button
                        onClick={() => { setActiveSectionIdx(sortedIdx); setProductSearch(""); setProductDialogOpen(true); }}
                        className="border-2 border-dashed border-border rounded-2xl min-h-[200px] flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors bg-card/50"
                      >
                        <Plus className="w-8 h-8" />
                        <span className="text-sm font-medium">Adicionar</span>
                        <span className="text-xs opacity-60">{section.products.length}/{MAX_SECTION_PRODUCTS}</span>
                      </button>
                    )}
                  </div>
                </EditableSection>
              </div>
            );
          })}

          {/* Add new section */}
          <button
            onClick={openCreateSection}
            className="w-full border-2 border-dashed border-border rounded-2xl py-10 flex flex-col items-center gap-3 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors bg-card/30"
          >
            <Plus className="w-10 h-10" />
            <span className="text-lg font-semibold">Nova Seção</span>
            <span className="text-sm opacity-60">Crie uma seção para organizar seus produtos</span>
          </button>
        </main>
      </div>

      {/* ── Fixed bottom bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <Button variant="outline" onClick={handleDiscard} disabled={!isDirty || saving} className="gap-2">
            <Undo2 className="w-4 h-4" />
            Descartar
          </Button>
          <Button onClick={handleSave} disabled={saving || !isDirty} className="gap-2 px-8">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar alterações
          </Button>
        </div>
      </div>

      {/* ═══ DIALOGS ═══ */}

      {/* Add featured dialog */}
      <Dialog open={featuredDialogOpen} onOpenChange={setFeaturedDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader><DialogTitle>Adicionar Destaque</DialogTitle></DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={featuredSearch}
              onChange={(e) => setFeaturedSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="pl-9"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {availableForFeatured
              .filter((p) => !featuredSearch || p.name.toLowerCase().includes(featuredSearch.toLowerCase()))
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => { addFeaturedDraft(p.id); setFeaturedDialogOpen(false); }}
                  className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-accent transition-colors text-left"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-secondary flex-shrink-0">
                    {imageMap[p.id] ? (
                      <img src={imageMap[p.id]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg">🍔</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <p className="text-xs text-primary font-bold">
                      R$ {Number(p.has_discount && p.promo_price ? p.promo_price : p.price).toFixed(2)}
                    </p>
                  </div>
                  <Plus className="w-5 h-5 text-primary flex-shrink-0" />
                </button>
              ))}
            {availableForFeatured.filter((p) => !featuredSearch || p.name.toLowerCase().includes(featuredSearch.toLowerCase())).length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">Nenhum produto disponível</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Section dialog */}
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

      {/* Add product dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader><DialogTitle>Adicionar Produto à Seção</DialogTitle></DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="pl-9"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {activeSectionIdx !== null && (() => {
              const sorted = [...activeSections].sort((a, b) => a.position - b.position);
              const section = sorted[activeSectionIdx];
              if (!section) return [];
              const usedIds = section.products.map((p) => p.product_id);
              return tenantProducts
                .filter((p) => !usedIds.includes(p.id))
                .filter((p) => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()));
            })().map((p) => (
              <button
                key={p.id}
                onClick={() => { handleAddProduct(p.id); }}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-accent transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-secondary flex-shrink-0">
                  {imageMap[p.id] ? (
                    <img src={imageMap[p.id]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg">🍔</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <p className="text-xs text-primary font-bold">
                    R$ {Number(p.has_discount && p.promo_price ? p.promo_price : p.price).toFixed(2)}
                  </p>
                </div>
                <Plus className="w-5 h-5 text-primary flex-shrink-0" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════

// Editable section wrapper with title and action bar
const EditableSection = ({
  title, icon, onAdd, addLabel, maxItems, currentItems, isEmpty, emptyText, emptyIcon, extraControls, children,
}: {
  title: string;
  icon?: React.ReactNode;
  onAdd: () => void;
  addLabel: string;
  maxItems?: number;
  currentItems?: number;
  isEmpty: boolean;
  emptyText: string;
  emptyIcon: string;
  extraControls?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section>
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-bold flex items-center gap-2">
        {icon}
        {title}
        {maxItems !== undefined && currentItems !== undefined && (
          <span className="text-xs font-normal text-muted-foreground ml-1">({currentItems}/{maxItems})</span>
        )}
      </h3>
      <div className="flex items-center gap-2">
        {extraControls}
        <Button size="sm" variant="outline" onClick={onAdd} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> {addLabel}
        </Button>
      </div>
    </div>
    {isEmpty ? (
      <div className="border-2 border-dashed border-border rounded-2xl py-12 text-center">
        <div className="text-4xl mb-3">{emptyIcon}</div>
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      </div>
    ) : children}
  </section>
);

// Store product card - mirrors RestaurantPage ProductGridCard (without buy buttons)
const StoreProductCard = ({ product, imageUrl }: {
  product: { id: string; name: string; description: string | null; price: number; promo_price: number | null; has_discount: boolean };
  imageUrl?: string;
}) => (
  <div className="bg-card rounded-2xl overflow-hidden shadow-card transition-all duration-300">
    <div className="relative h-40 overflow-hidden bg-secondary">
      {imageUrl ? (
        <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-secondary to-muted">🍔</div>
      )}
      {product.has_discount && product.promo_price && (
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center gap-1">
          <Flame className="w-3 h-3" />
          Promoção
        </div>
      )}
    </div>
    <div className="p-3">
      <h4 className="font-semibold text-sm text-foreground line-clamp-1">{product.name}</h4>
      {product.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{product.description}</p>}
      <div className="flex items-center gap-2 mt-2">
        {product.has_discount && product.promo_price ? (
          <>
            <span className="text-base font-bold text-primary">R$ {Number(product.promo_price).toFixed(2)}</span>
            <span className="text-xs text-muted-foreground line-through">R$ {Number(product.price).toFixed(2)}</span>
          </>
        ) : (
          <span className="text-base font-bold text-foreground">R$ {Number(product.price).toFixed(2)}</span>
        )}
      </div>
    </div>
  </div>
);

// Featured product card - mirrors RestaurantPage FeaturedCard (without buy buttons)
const FeaturedProductCard = ({ product, imageUrl }: {
  product: { id: string; name: string; description: string | null; price: number; promo_price: number | null; has_discount: boolean };
  imageUrl?: string;
}) => (
  <div className="bg-card rounded-2xl overflow-hidden shadow-card transition-all duration-300 border-2 border-primary/20">
    <div className="relative h-48 overflow-hidden bg-secondary">
      {imageUrl ? (
        <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-primary/10 to-secondary">⭐</div>
      )}
      <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1 shadow-md">
        <Sparkles className="w-3 h-3" /> Destaque
      </div>
      {product.has_discount && product.promo_price && (
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center gap-1">
          <Flame className="w-3 h-3" /> Promoção
        </div>
      )}
    </div>
    <div className="p-4">
      <h4 className="font-bold text-foreground">{product.name}</h4>
      {product.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{product.description}</p>}
      <div className="flex items-center gap-2 mt-3">
        {product.has_discount && product.promo_price ? (
          <>
            <span className="text-lg font-bold text-primary">R$ {Number(product.promo_price).toFixed(2)}</span>
            <span className="text-sm text-muted-foreground line-through">R$ {Number(product.price).toFixed(2)}</span>
          </>
        ) : (
          <span className="text-lg font-bold text-foreground">R$ {Number(product.price).toFixed(2)}</span>
        )}
      </div>
    </div>
  </div>
);

export default MyStorePage;
