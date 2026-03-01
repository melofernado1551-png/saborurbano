import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/contexts/AdminContext";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, ImagePlus, Plus, Trash2, Package } from "lucide-react";
import { toast } from "sonner";

interface ComboForm {
  name: string;
  description: string;
  price: string;
  promo_price: string;
  active: boolean;
  category_ids: string[];
}

interface ComboProductItem {
  product_id: string;
  product_name: string;
  quantity: number;
}

const emptyForm: ComboForm = {
  name: "",
  description: "",
  price: "",
  promo_price: "",
  active: true,
  category_ids: [],
};

const ComboFormPage = () => {
  const { effectiveTenantId } = useAdmin();
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!id;
  const tenantId = effectiveTenantId;

  const [form, setForm] = useState<ComboForm>(emptyForm);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [comboProducts, setComboProducts] = useState<ComboProductItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch combo if editing
  const { data: combo, isLoading: comboLoading } = useQuery({
    queryKey: ["combo-detail", id],
    enabled: isEditing,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("combos")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch combo products if editing
  const { data: existingComboProducts } = useQuery({
    queryKey: ["combo-products-admin", id],
    enabled: isEditing,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("combo_products")
        .select("product_id, quantity, products(name)")
        .eq("combo_id", id!)
        .eq("active", true);
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch combo category relations
  const { data: existingComboCatRels } = useQuery({
    queryKey: ["combo-cat-rels", id],
    enabled: isEditing,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("combo_category_relations")
        .select("category_id")
        .eq("combo_id", id!)
        .eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["product-categories", tenantId],
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

  // Fetch products for selection
  const { data: products = [] } = useQuery({
    queryKey: ["tenant-products-for-combo", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (combo) {
      setForm({
        name: combo.name,
        description: combo.description || "",
        price: combo.price?.toString() || "",
        promo_price: combo.promo_price?.toString() || "",
        active: combo.active,
        category_ids: [],
      });
      setImageUrl(combo.image_url || null);
    }
  }, [combo]);

  useEffect(() => {
    if (existingComboProducts) {
      setComboProducts(
        existingComboProducts.map((cp: any) => ({
          product_id: cp.product_id,
          product_name: cp.products?.name || "",
          quantity: cp.quantity,
        }))
      );
    }
  }, [existingComboProducts]);

  useEffect(() => {
    if (existingComboCatRels) {
      setForm((prev) => ({
        ...prev,
        category_ids: existingComboCatRels.map((r: any) => r.category_id),
      }));
    }
  }, [existingComboCatRels]);

  const set = (key: keyof ComboForm, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleCategory = (catId: string) => {
    setForm((prev) => ({
      ...prev,
      category_ids: prev.category_ids.includes(catId)
        ? prev.category_ids.filter((c) => c !== catId)
        : [...prev.category_ids, catId],
    }));
  };

  // Image upload
  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const file = files[0];
      if (!file.type.startsWith("image/")) throw new Error("Arquivo inválido");
      const ext = file.name.split(".").pop();
      const path = `${tenantId}/combos/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(path);
      setImageUrl(urlData.publicUrl);
      toast.success("Imagem adicionada");
    } catch (e: any) {
      toast.error("Erro ao enviar imagem: " + (e.message || ""));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Add product to combo
  const addProductToCombo = () => {
    if (!selectedProductId) return;
    if (comboProducts.some((cp) => cp.product_id === selectedProductId)) {
      toast.error("Este produto já está no combo");
      return;
    }
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;
    setComboProducts((prev) => [
      ...prev,
      { product_id: product.id, product_name: product.name, quantity: 1 },
    ]);
    setSelectedProductId("");
  };

  const updateProductQuantity = (idx: number, quantity: number) => {
    if (quantity < 1) return;
    setComboProducts((prev) =>
      prev.map((cp, i) => (i === idx ? { ...cp, quantity } : cp))
    );
  };

  const removeProductFromCombo = (idx: number) => {
    setComboProducts((prev) => prev.filter((_, i) => i !== idx));
  };

  // Available products (not already in combo)
  const availableProducts = products.filter(
    (p) => !comboProducts.some((cp) => cp.product_id === p.id)
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nome é obrigatório");
      if (!tenantId) throw new Error("Tenant não identificado");
      if (comboProducts.length === 0) throw new Error("Adicione pelo menos 1 produto ao combo");

      const price = parseFloat(form.price) || 0;
      if (price <= 0) throw new Error("Preço deve ser maior que zero");
      const promoPrice = form.promo_price ? parseFloat(form.promo_price) : null;

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price,
        promo_price: promoPrice,
        image_url: imageUrl,
        active: form.active,
        tenant_id: tenantId,
        slug: form.name.trim().toLowerCase(), // trigger will overwrite
      };

      let comboId = id;

      if (isEditing) {
        const { error } = await supabase
          .from("combos")
          .update(payload)
          .eq("id", id!);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("combos")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        comboId = data.id;
      }

      // --- Combo products ---
      if (isEditing) {
        await supabase
          .from("combo_products")
          .delete()
          .eq("combo_id", comboId!);
      }
      await supabase.from("combo_products").insert(
        comboProducts.map((cp) => ({
          combo_id: comboId!,
          product_id: cp.product_id,
          quantity: cp.quantity,
        }))
      );

      // --- Category relations ---
      if (isEditing) {
        await supabase
          .from("combo_category_relations")
          .delete()
          .eq("combo_id", comboId!);
      }
      if (form.category_ids.length > 0) {
        await supabase.from("combo_category_relations").insert(
          form.category_ids.map((category_id) => ({
            combo_id: comboId!,
            category_id,
          }))
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-combos"] });
      toast.success(isEditing ? "Combo atualizado!" : "Combo criado!");
      navigate("/admin/produtos");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  if (isEditing && comboLoading) {
    return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/produtos")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEditing ? "Editar Combo" : "Novo Combo"}</h1>
          <p className="text-sm text-muted-foreground">
            {isEditing ? `Editando: ${combo?.name}` : "Monte um combo de produtos"}
          </p>
        </div>
      </div>

      {/* Basic info */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Dados do Combo</CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="combo-active-switch" className="text-sm text-muted-foreground">
              {form.active ? "Ativo" : "Inativo"}
            </Label>
            <Switch
              id="combo-active-switch"
              checked={form.active}
              onCheckedChange={(v) => set("active", v)}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do combo *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex: Combo Família"
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Descreva o combo"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Preço do combo *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Preço promocional</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.promo_price}
                onChange={(e) => set("promo_price", e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Image */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Imagem do Combo</CardTitle>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleImageUpload(e.target.files)}
          />
          {imageUrl ? (
            <div className="relative w-full h-48 rounded-xl overflow-hidden bg-secondary">
              <img src={imageUrl} alt="Combo" className="w-full h-full object-contain" />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={() => setImageUrl(null)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full h-48 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground"
            >
              {uploading ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : (
                <>
                  <ImagePlus className="w-8 h-8" />
                  <span className="text-sm">Clique para adicionar imagem</span>
                </>
              )}
            </button>
          )}
        </CardContent>
      </Card>

      {/* Combo products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="w-5 h-5" />
            Composição do Combo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Product selector */}
          <div className="flex gap-2">
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione um produto" />
              </SelectTrigger>
              <SelectContent>
                {availableProducts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — R$ {Number(p.price).toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addProductToCombo} disabled={!selectedProductId} className="gap-1">
              <Plus className="w-4 h-4" />
              Adicionar
            </Button>
          </div>

          {/* Product list */}
          {comboProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum produto adicionado ao combo</p>
            </div>
          ) : (
            <div className="space-y-2">
              {comboProducts.map((cp, idx) => (
                <div
                  key={cp.product_id}
                  className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{cp.product_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateProductQuantity(idx, cp.quantity - 1)}
                      className="w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center hover:bg-secondary transition-colors text-sm font-bold"
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-bold text-sm">{cp.quantity}</span>
                    <button
                      onClick={() => updateProductQuantity(idx, cp.quantity + 1)}
                      className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeProductFromCombo(idx)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Categorias (opcional)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat: any) => {
              const isSelected = form.category_ids.includes(cat.id);
              return (
                <Badge
                  key={cat.id}
                  variant={isSelected ? "default" : "outline"}
                  className="cursor-pointer text-sm px-3 py-1.5"
                  onClick={() => toggleCategory(cat.id)}
                >
                  {cat.emoji || "🍽️"} {cat.name}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex gap-3 justify-end pb-8">
        <Button variant="outline" onClick={() => navigate("/admin/produtos")}>
          Cancelar
        </Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="gap-2"
        >
          {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEditing ? "Salvar Combo" : "Criar Combo"}
        </Button>
      </div>
    </div>
  );
};

export default ComboFormPage;
