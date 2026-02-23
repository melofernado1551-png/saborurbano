import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Star, Sparkles, GripVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const MAX_SECTION_PRODUCTS = 12;

const MyStorePage = () => {
  const { effectiveTenantId } = useAdmin();
  const queryClient = useQueryClient();
  const tenantId = effectiveTenantId;

  // --- Featured Products Tenant ---
  const { data: tenantProducts = [] } = useQuery({
    queryKey: ["tenant-all-products", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, active")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: featuredTenant = [], isLoading: featuredLoading } = useQuery({
    queryKey: ["featured-products-tenant", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("featured_products_tenant")
        .select("id, product_id, position, active, products(name)")
        .eq("tenant_id", tenantId!)
        .order("position");
      if (error) throw error;
      return data as any[];
    },
  });

  const [featuredDialogOpen, setFeaturedDialogOpen] = useState(false);
  const [selectedFeaturedProduct, setSelectedFeaturedProduct] = useState("");

  const addFeatured = useMutation({
    mutationFn: async () => {
      if (!selectedFeaturedProduct || !tenantId) throw new Error("Selecione um produto");
      const pos = featuredTenant.length;
      const { error } = await supabase.from("featured_products_tenant").insert({
        tenant_id: tenantId,
        product_id: selectedFeaturedProduct,
        position: pos,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["featured-products-tenant"] });
      toast.success("Destaque adicionado!");
      setFeaturedDialogOpen(false);
      setSelectedFeaturedProduct("");
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  const removeFeatured = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("featured_products_tenant").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["featured-products-tenant"] });
      toast.success("Destaque removido");
    },
  });

  const availableForFeatured = tenantProducts.filter(
    (p) => !featuredTenant.some((f: any) => f.product_id === p.id)
  );

  // --- Sections ---
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

  const { data: sections = [], isLoading: sectionsLoading } = useQuery({
    queryKey: ["tenant-sections", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_sections")
        .select("id, title, position, active, category_id, tenant_section_products(id, product_id, position, active, products(name))")
        .eq("tenant_id", tenantId!)
        .order("position");
      if (error) throw error;
      return data as any[];
    },
  });

  // Section dialog
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionForm, setSectionForm] = useState({ title: "", category_id: "" });

  const openCreateSection = () => {
    setEditingSectionId(null);
    setSectionForm({ title: "", category_id: "" });
    setSectionDialogOpen(true);
  };

  const openEditSection = (section: any) => {
    setEditingSectionId(section.id);
    setSectionForm({ title: section.title, category_id: section.category_id || "" });
    setSectionDialogOpen(true);
  };

  const saveSection = useMutation({
    mutationFn: async () => {
      if (!sectionForm.title.trim()) throw new Error("Título é obrigatório");
      if (!tenantId) throw new Error("Tenant não identificado");
      if (editingSectionId) {
        const { error } = await supabase
          .from("tenant_sections")
          .update({
            title: sectionForm.title.trim(),
            category_id: sectionForm.category_id || null,
          })
          .eq("id", editingSectionId);
        if (error) throw error;
      } else {
        const pos = sections.length;
        const { error } = await supabase.from("tenant_sections").insert({
          tenant_id: tenantId,
          title: sectionForm.title.trim(),
          category_id: sectionForm.category_id || null,
          position: pos,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-sections"] });
      toast.success(editingSectionId ? "Seção atualizada!" : "Seção criada!");
      setSectionDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const toggleSectionActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("tenant_sections").update({ active: !active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-sections"] });
      toast.success("Status atualizado");
    },
  });

  const moveSection = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: "up" | "down" }) => {
      const idx = sections.findIndex((s: any) => s.id === id);
      if (idx < 0) return;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sections.length) return;
      const updates = [
        supabase.from("tenant_sections").update({ position: swapIdx }).eq("id", sections[idx].id),
        supabase.from("tenant_sections").update({ position: idx }).eq("id", sections[swapIdx].id),
      ];
      await Promise.all(updates);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant-sections"] }),
  });

  const deleteSection = useMutation({
    mutationFn: async (id: string) => {
      // Delete section products first
      await supabase.from("tenant_section_products").delete().eq("tenant_section_id", id);
      const { error } = await supabase.from("tenant_sections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-sections"] });
      toast.success("Seção removida");
    },
  });

  // --- Section Products ---
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");

  const openAddProduct = (sectionId: string) => {
    setActiveSectionId(sectionId);
    setSelectedProductId("");
    setProductDialogOpen(true);
  };

  const addSectionProduct = useMutation({
    mutationFn: async () => {
      if (!activeSectionId || !selectedProductId) throw new Error("Selecione um produto");
      const section = sections.find((s: any) => s.id === activeSectionId);
      const currentProducts = section?.tenant_section_products || [];
      if (currentProducts.length >= MAX_SECTION_PRODUCTS) {
        throw new Error(`Máximo de ${MAX_SECTION_PRODUCTS} produtos por seção`);
      }
      const pos = currentProducts.length;
      const { error } = await supabase.from("tenant_section_products").insert({
        tenant_section_id: activeSectionId,
        product_id: selectedProductId,
        position: pos,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-sections"] });
      toast.success("Produto adicionado à seção!");
      setProductDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  const removeSectionProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tenant_section_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-sections"] });
      toast.success("Produto removido da seção");
    },
  });

  const getAvailableProducts = (sectionId: string) => {
    const section = sections.find((s: any) => s.id === sectionId);
    const usedIds = (section?.tenant_section_products || []).map((sp: any) => sp.product_id);
    return tenantProducts.filter((p) => !usedIds.includes(p.id));
  };

  if (!tenantId) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Selecione um estabelecimento para gerenciar a vitrine.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Minha Vitrine</h1>
        <p className="text-sm text-muted-foreground">Organize os destaques e seções da sua loja</p>
      </div>

      {/* Featured Products */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Star className="w-5 h-5 text-yellow-500" />
            Destaques da Loja
          </CardTitle>
          <Button size="sm" onClick={() => setFeaturedDialogOpen(true)} className="gap-1">
            <Plus className="w-4 h-4" /> Adicionar
          </Button>
        </CardHeader>
        <CardContent>
          {featuredLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : featuredTenant.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum produto em destaque. Adicione para destacar na vitrine da sua loja.</p>
          ) : (
            <div className="space-y-2">
              {featuredTenant.map((f: any) => (
                <div key={f.id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-medium">{f.products?.name || "Produto"}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeFeatured.mutate(f.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sections */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <GripVertical className="w-5 h-5" />
            Seções da Vitrine
          </CardTitle>
          <Button size="sm" onClick={openCreateSection} className="gap-1">
            <Plus className="w-4 h-4" /> Nova Seção
          </Button>
        </CardHeader>
        <CardContent>
          {sectionsLoading ? (
            <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
          ) : sections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma seção criada. A loja usará as categorias padrão como fallback.
            </p>
          ) : (
            <div className="space-y-4">
              {sections.map((section: any, idx: number) => {
                const sectionProducts = (section.tenant_section_products || []).sort((a: any, b: any) => a.position - b.position);
                return (
                  <div key={section.id} className="border border-border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between bg-secondary/30 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-0.5">
                          <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === 0} onClick={() => moveSection.mutate({ id: section.id, direction: "up" })}>
                            <ChevronUp className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === sections.length - 1} onClick={() => moveSection.mutate({ id: section.id, direction: "down" })}>
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm">{section.title}</h4>
                          <span className="text-xs text-muted-foreground">{sectionProducts.length}/{MAX_SECTION_PRODUCTS} produtos</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={section.active} onCheckedChange={() => toggleSectionActive.mutate({ id: section.id, active: section.active })} />
                        <Button variant="ghost" size="icon" onClick={() => openEditSection(section)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => {
                          if (confirm("Remover esta seção e todos os seus produtos?")) deleteSection.mutate(section.id);
                        }}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <div className="p-3">
                      {sectionProducts.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-3">Nenhum produto nesta seção</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {sectionProducts.map((sp: any) => (
                            <Badge key={sp.id} variant="secondary" className="gap-1 py-1.5 pl-3 pr-1">
                              {sp.products?.name || "Produto"}
                              <button
                                onClick={() => removeSectionProduct.mutate(sp.id)}
                                className="ml-1 w-5 h-5 rounded-full hover:bg-destructive/20 flex items-center justify-center"
                              >
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      {sectionProducts.length < MAX_SECTION_PRODUCTS && (
                        <Button variant="outline" size="sm" className="mt-3 gap-1" onClick={() => openAddProduct(section.id)}>
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

      {/* Featured Dialog */}
      <Dialog open={featuredDialogOpen} onOpenChange={setFeaturedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Destaque</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeaturedDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => addFeatured.mutate()} disabled={!selectedFeaturedProduct || addFeatured.isPending}>
              {addFeatured.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Section Dialog */}
      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSectionId ? "Editar Seção" : "Nova Seção"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Título da seção</Label>
              <Input value={sectionForm.title} onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })} placeholder="Ex: 🍔 Hambúrgueres da Casa" />
            </div>
            <div>
              <Label>Categoria (opcional)</Label>
              <Select value={sectionForm.category_id} onValueChange={(v) => setSectionForm({ ...sectionForm, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Nenhuma categoria" /></SelectTrigger>
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
            <Button onClick={() => saveSection.mutate()} disabled={saveSection.isPending}>
              {saveSection.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Product to Section Dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Produto à Seção</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Produto</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                <SelectContent>
                  {activeSectionId && getAvailableProducts(activeSectionId).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => addSectionProduct.mutate()} disabled={!selectedProductId || addSectionProduct.isPending}>
              {addSectionProduct.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyStorePage;
