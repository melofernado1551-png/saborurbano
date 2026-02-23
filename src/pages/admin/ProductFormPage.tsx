import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/contexts/AdminContext";
import { useNavigate, useParams } from "react-router-dom";
import { generateUniqueProductSlug } from "@/lib/slugUtils";
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
import { ArrowLeft, Loader2, X, ImagePlus, GripVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ProductForm {
  name: string;
  description: string;
  price: string;
  promo_price: string;
  has_discount: boolean;
  active: boolean;
  category_id: string;
  tag_ids: string[];
  is_featured: boolean;
}

interface ProductImage {
  id: string;
  image_url: string;
  position: number;
}

const emptyForm: ProductForm = {
  name: "",
  description: "",
  price: "",
  promo_price: "",
  has_discount: false,
  active: true,
  category_id: "",
  tag_ids: [],
  is_featured: false,
};

const ProductFormPage = () => {
  const { effectiveTenantId } = useAdmin();
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!id;
  const tenantId = effectiveTenantId;

  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch product if editing
  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ["product-detail", id],
    enabled: isEditing,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id!)
        .single();
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
        .select("id, name")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch all tags
  const { data: allTags = [] } = useQuery({
    queryKey: ["all-tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tags")
        .select("id, name, emoji")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing category relation
  const { data: existingCatRel } = useQuery({
    queryKey: ["product-cat-rel", id],
    enabled: isEditing,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_category_relations")
        .select("category_id")
        .eq("product_id", id!)
        .eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing tag relations
  const { data: existingTagRels } = useQuery({
    queryKey: ["product-tag-rels", id],
    enabled: isEditing,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_tags")
        .select("tag_id")
        .eq("product_id", id!)
        .eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing images
  const { data: existingImages } = useQuery({
    queryKey: ["product-images", id],
    enabled: isEditing,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_images")
        .select("id, image_url, position")
        .eq("product_id", id!)
        .eq("active", true)
        .order("position");
      if (error) throw error;
      return data as ProductImage[];
    },
  });

  // Fetch featured status
  const { data: featuredData } = useQuery({
    queryKey: ["product-featured", id],
    enabled: isEditing,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("featured_products")
        .select("id")
        .eq("product_id", id!)
        .eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (product) {
      setForm((prev) => ({
        ...prev,
        name: product.name,
        description: product.description || "",
        price: product.price?.toString() || "",
        promo_price: product.promo_price?.toString() || "",
        has_discount: product.has_discount,
        active: product.active,
      }));
    }
  }, [product]);

  useEffect(() => {
    if (existingCatRel && existingCatRel.length > 0) {
      setForm((prev) => ({ ...prev, category_id: existingCatRel[0].category_id }));
    }
  }, [existingCatRel]);

  useEffect(() => {
    if (existingTagRels) {
      setForm((prev) => ({ ...prev, tag_ids: existingTagRels.map((r) => r.tag_id) }));
    }
  }, [existingTagRels]);

  useEffect(() => {
    if (existingImages) {
      setImages(existingImages);
    }
  }, [existingImages]);

  useEffect(() => {
    if (featuredData) {
      setForm((prev) => ({ ...prev, is_featured: featuredData.length > 0 }));
    }
  }, [featuredData]);

  const set = (key: keyof ProductForm, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleTag = (tagId: string) => {
    setForm((prev) => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter((t) => t !== tagId)
        : [...prev.tag_ids, tagId],
    }));
  };

  // Image upload handler
  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newImages: ProductImage[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) continue;
        const ext = file.name.split(".").pop();
        const path = `${tenantId}/${Date.now()}-${i}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from("product-images")
          .getPublicUrl(path);
        newImages.push({
          id: `new-${Date.now()}-${i}`,
          image_url: urlData.publicUrl,
          position: images.length + i,
        });
      }
      setImages((prev) => [...prev, ...newImages]);
      toast.success(`${newImages.length} imagem(ns) adicionada(s)`);
    } catch (e: any) {
      toast.error("Erro ao enviar imagem: " + (e.message || ""));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx).map((img, i) => ({ ...img, position: i })));
  };

  // Drag & drop reorder
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      return next.map((img, i) => ({ ...img, position: i }));
    });
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nome é obrigatório");
      if (!tenantId) throw new Error("Tenant não identificado");

      const price = parseFloat(form.price) || 0;
      const promoPrice = form.has_discount ? (parseFloat(form.promo_price) || null) : null;

      const slug = await generateUniqueProductSlug(
        form.name,
        tenantId,
        isEditing ? id : undefined
      );

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price,
        promo_price: promoPrice,
        has_discount: form.has_discount,
        active: form.active,
        slug,
        tenant_id: tenantId,
      };

      let productId = id;

      if (isEditing) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", id!);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("products")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        productId = data.id;
      }

      // --- Category relation ---
      if (isEditing) {
        await supabase
          .from("product_category_relations")
          .delete()
          .eq("product_id", productId!);
      }
      if (form.category_id) {
        await supabase
          .from("product_category_relations")
          .insert({ product_id: productId!, category_id: form.category_id });
      }

      // --- Tag relations ---
      if (isEditing) {
        await supabase
          .from("product_tags")
          .delete()
          .eq("product_id", productId!);
      }
      if (form.tag_ids.length > 0) {
        await supabase
          .from("product_tags")
          .insert(
            form.tag_ids.map((tag_id) => ({ product_id: productId!, tag_id }))
          );
      }

      // --- Images ---
      if (isEditing) {
        // Delete old image records
        await supabase
          .from("product_images")
          .delete()
          .eq("product_id", productId!);
      }
      if (images.length > 0) {
        await supabase
          .from("product_images")
          .insert(
            images.map((img, i) => ({
              product_id: productId!,
              image_url: img.image_url,
              position: i,
            }))
          );
      }

      // --- Featured ---
      if (isEditing) {
        const { data: existingFeatured } = await supabase
          .from("featured_products")
          .select("id")
          .eq("product_id", productId!);
        if (existingFeatured && existingFeatured.length > 0) {
          // featured_products management may require superadmin access
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["product-images"] });
      toast.success(isEditing ? "Produto atualizado!" : "Produto criado!");
      navigate("/admin/produtos");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  if (isEditing && productLoading) {
    return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/produtos")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEditing ? "Editar Produto" : "Novo Produto"}</h1>
          <p className="text-sm text-muted-foreground">
            {isEditing ? `Editando: ${product?.name}` : "Preencha os dados do produto"}
          </p>
        </div>
      </div>

      {/* Basic info */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Dados do Produto</CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="product-active-switch" className="text-sm text-muted-foreground">
              {form.active ? "Ativo" : "Inativo"}
            </Label>
            <Switch
              id="product-active-switch"
              checked={form.active}
              onCheckedChange={(v) => set("active", v)}
            />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Nome do produto *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex: X-Burger Especial"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Descrição</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Descreva o produto..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Preço (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
              placeholder="0,00"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Switch
                checked={form.has_discount}
                onCheckedChange={(v) => set("has_discount", v)}
              />
              <Label>Preço promocional</Label>
            </div>
            {form.has_discount && (
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.promo_price}
                onChange={(e) => set("promo_price", e.target.value)}
                placeholder="0,00"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={form.category_id} onValueChange={(v) => set("category_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Images */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Imagens</CardTitle>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleImageUpload(e.target.files)}
          />

          {images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
              {images.map((img, idx) => (
                <div
                  key={img.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`relative group rounded-lg border border-border overflow-hidden aspect-square bg-muted cursor-grab active:cursor-grabbing transition-shadow ${
                    dragIdx === idx ? "ring-2 ring-primary shadow-lg" : ""
                  }`}
                >
                  <img
                    src={img.image_url}
                    alt={`Imagem ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                  <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical className="w-5 h-5 text-white drop-shadow" />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-destructive-foreground rounded-full p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {idx === 0 && (
                    <span className="absolute bottom-1 left-1 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-medium">
                      Principal
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            className="gap-2 w-full border-dashed h-20"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ImagePlus className="w-5 h-5" />
            )}
            {uploading ? "Enviando..." : "Adicionar imagens"}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Arraste as imagens para reordenar. A primeira será a imagem principal.
          </p>
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Tags</CardTitle></CardHeader>
        <CardContent>
          {form.tag_ids.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {form.tag_ids.map((tagId) => {
                const tag = allTags.find((t: any) => t.id === tagId);
                if (!tag) return null;
                return (
                  <Badge key={tagId} variant="secondary" className="gap-1 pr-1 text-sm">
                    {(tag as any).emoji} {(tag as any).name}
                    <button
                      type="button"
                      onClick={() => toggleTag(tagId)}
                      className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {allTags
              .filter((t: any) => !form.tag_ids.includes(t.id))
              .map((tag: any) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className="cursor-pointer hover:bg-secondary transition-colors text-sm gap-1"
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.emoji} {tag.name}
                </Badge>
              ))}
          </div>
          {allTags.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma tag disponível</p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate("/admin/produtos")}>
          Cancelar
        </Button>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isEditing ? "Salvar alterações" : "Criar produto"}
        </Button>
      </div>
    </div>
  );
};

export default ProductFormPage;
