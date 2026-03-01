import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Search, Share2, Sparkles, Plus, MessageCircle, Copy, Flame, ShoppingBag, Settings, Heart, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import CustomerMenu from "@/components/customer/CustomerMenu";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useTenantFavorites } from "@/hooks/useTenantFavorites";

// No longer needed - emoji comes from DB

const RestaurantPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const { session, getOrCreateCustomerForTenant } = useCustomerAuth();
  const { user } = useAuth();
  const { addItem, totalItems, totalPrice, setIsOpen: setCartOpen } = useCart();
  const { isFavorite: isTenantFavorite, toggleFavorite: toggleTenantFavorite, isLoggedIn: isTenantFavLoggedIn } = useTenantFavorites();

  // Fetch tenant
  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ["tenant-by-slug", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("slug", slug!)
        .eq("active", true)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Auto-link customer to tenant on login
  useEffect(() => {
    if (session?.user && tenant?.id) {
      getOrCreateCustomerForTenant(tenant.id);
    }
  }, [session?.user?.id, tenant?.id]);

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["tenant-products", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, slug, description, price, promo_price, has_discount, tenant_id")
        .eq("tenant_id", tenant!.id)
        .eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch product images
  const productIds = products.map((p) => p.id);
  const { data: productImages = [] } = useQuery({
    queryKey: ["tenant-product-images", productIds],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_images")
        .select("product_id, image_url")
        .eq("active", true)
        .in("product_id", productIds);
      if (error) throw error;
      return data;
    },
  });

  // Fetch tenant-level featured products
  const { data: tenantFeaturedIds = [] } = useQuery({
    queryKey: ["featured-products-tenant-store", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("featured_products_tenant")
        .select("product_id")
        .eq("tenant_id", tenant!.id)
        .eq("active", true)
        .order("position");
      if (error) throw error;
      return data.map((f: any) => f.product_id);
    },
  });

  // Fetch tenant sections (vitrine)
  const { data: tenantSections = [] } = useQuery({
    queryKey: ["tenant-sections-store", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_sections")
        .select("id, title, position, active, category_id, tenant_section_products(id, product_id, position, active)")
        .eq("tenant_id", tenant!.id)
        .eq("active", true)
        .order("position");
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch product categories for this tenant (with emoji)
  const { data: categories = [] } = useQuery({
    queryKey: ["tenant-product-categories", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("id, name, emoji, position")
        .eq("tenant_id", tenant!.id)
        .eq("active", true)
        .order("position");
      if (error) throw error;
      return data;
    },
  });

  // Fetch category relations
  const { data: categoryRelations = [] } = useQuery({
    queryKey: ["tenant-category-relations", productIds],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_category_relations")
        .select("product_id, category_id")
        .eq("active", true)
        .in("product_id", productIds);
      if (error) throw error;
      return data;
    },
  });

  // Fetch stock info
  const { data: stockData = [] } = useQuery({
    queryKey: ["tenant-stock", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_stock")
        .select("product_id, quantity")
        .eq("tenant_id", tenant!.id)
        .eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch combos
  const { data: combos = [] } = useQuery({
    queryKey: ["tenant-combos", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("combos")
        .select("*, combo_products(product_id, quantity, products(name))")
        .eq("tenant_id", tenant!.id)
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Build maps
  const imageMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const img of productImages) {
      if (!map[img.product_id]) map[img.product_id] = img.image_url;
    }
    return map;
  }, [productImages]);

  const stockMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of stockData) {
      map[s.product_id] = s.quantity;
    }
    return map;
  }, [stockData]);

  const categoryMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const rel of categoryRelations) {
      if (!map[rel.product_id]) map[rel.product_id] = [];
      map[rel.product_id].push(rel.category_id);
    }
    return map;
  }, [categoryRelations]);

  // Categories with products (show all tenant categories)
  const categoriesWithProducts = useMemo(() => {
    return categories;
  }, [categories]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesDesc = (p.description || "").toLowerCase().includes(q);
        // Also search by category name
        const cats = categoryMap[p.id] || [];
        const matchesCat = cats.some((catId) => {
          const cat = categories.find((c) => c.id === catId);
          return cat?.name.toLowerCase().includes(q);
        });
        if (!matchesName && !matchesDesc && !matchesCat) return false;
      }
      if (showFeaturedOnly) {
        if (!tenantFeaturedIds.includes(p.id)) return false;
      }
      if (activeCategories.length > 0) {
        const cats = categoryMap[p.id] || [];
        if (!activeCategories.some((ac) => cats.includes(ac))) return false;
      }
      return true;
    });
  }, [products, searchQuery, activeCategories, categoryMap, categories, showFeaturedOnly, tenantFeaturedIds]);

  const featuredProducts = filteredProducts.filter((p) => tenantFeaturedIds.includes(p.id));
  const generalProducts = filteredProducts;

  // Group by category for general list
  const productsByCategory = useMemo(() => {
    const groups: Record<string, typeof products> = {};
    const uncategorized: typeof products = [];

    for (const p of generalProducts) {
      const cats = categoryMap[p.id] || [];
      if (cats.length === 0) {
        uncategorized.push(p);
      } else {
        for (const catId of cats) {
          if (!groups[catId]) groups[catId] = [];
          groups[catId].push(p);
        }
      }
    }

    const result: { name: string; emoji: string; products: typeof products }[] = [];
    for (const cat of categoriesWithProducts) {
      if (groups[cat.id] && groups[cat.id].length > 0) {
        result.push({ name: cat.name, emoji: (cat as any).emoji || "🍽️", products: groups[cat.id] });
      }
    }
    if (uncategorized.length > 0) {
      result.push({ name: "Outros", emoji: "📦", products: uncategorized });
    }
    if (result.length === 0 && generalProducts.length > 0) {
      result.push({ name: "Todos os Produtos", emoji: "🍽️", products: generalProducts });
    }
    return result;
  }, [generalProducts, categoryMap, categoriesWithProducts]);

  // Build sections from tenant_sections if configured, otherwise fallback to category grouping
  const hasTenantSections = tenantSections.length > 0;
  const sectionedDisplay = useMemo(() => {
    if (!hasTenantSections) return null;
    const productMap = new Map(products.map((p) => [p.id, p]));
    return tenantSections
      .filter((s: any) => s.active)
      .map((section: any) => {
        const sectionProducts = (section.tenant_section_products || [])
          .filter((sp: any) => sp.active)
          .sort((a: any, b: any) => a.position - b.position)
          .map((sp: any) => productMap.get(sp.product_id))
          .filter(Boolean) as typeof products;
        // Apply search filter
        const filtered = sectionProducts.filter((p) => {
          if (!searchQuery.trim()) return true;
          const q = searchQuery.toLowerCase();
          return p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);
        });
        return { title: section.title, products: filtered };
      })
      .filter((s) => s.products.length > 0);
  }, [hasTenantSections, tenantSections, products, searchQuery]);

  const handleShareRestaurant = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: tenant?.name || "", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado!");
      }
    } catch { /* cancelled */ }
  };

  const handleShareProduct = async (product: typeof products[0], e: React.MouseEvent) => {
    e.stopPropagation();
    const productUrl = `${window.location.origin}/${slug}/${product.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          text: `Confira ${product.name} no ${tenant?.name}!`,
          url: productUrl,
        });
      } else {
        await navigator.clipboard.writeText(productUrl);
        toast.success("Link do produto copiado!", {
          action: {
            label: "WhatsApp",
            onClick: () => {
              window.open(`https://wa.me/?text=${encodeURIComponent(`Confira ${product.name}: ${productUrl}`)}`, "_blank");
            },
          },
        });
      }
    } catch { /* cancelled */ }
  };

  const handleShareWhatsApp = (product: typeof products[0], e: React.MouseEvent) => {
    e.stopPropagation();
    const productUrl = `${window.location.origin}/${slug}/${product.slug}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(`Confira ${product.name} no ${tenant?.name}! ${productUrl}`)}`, "_blank");
  };

  if (tenantLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl animate-pulse mb-4">🍽️</div>
          <p className="text-muted-foreground">Carregando loja...</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-xl font-bold mb-2">Loja não encontrada</h2>
          <p className="text-muted-foreground mb-4">A loja que você procura não existe ou está inativa.</p>
          <Button onClick={() => navigate("/")} variant="outline">Voltar ao início</Button>
        </div>
      </div>
    );
  }

  // Skeleton loaders
  const ProductSkeleton = () => (
    <div className="bg-card rounded-2xl overflow-hidden shadow-card">
      <Skeleton className="h-40 w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    </div>
  );

  const handleAddToCart = (product: typeof products[0], e: React.MouseEvent) => {
    e.stopPropagation();
    const outOfStock = stockMap[product.id] !== undefined && stockMap[product.id] <= 0;
    if (outOfStock) return;
    const added = addItem(
      {
        productId: product.id,
        name: product.name,
        price: Number(product.price),
        promoPrice: product.promo_price ? Number(product.promo_price) : null,
        imageUrl: imageMap[product.id] || null,
      },
      { id: tenant.id, slug: tenant.slug, name: tenant.name, freeShipping: (tenant as any).free_shipping, shippingFee: (tenant as any).shipping_fee ? Number((tenant as any).shipping_fee) : null }
    );
    if (added) {
      toast.success("✔ Produto adicionado ao carrinho");
    }
  };
  const handleAddComboToCart = (combo: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const comboProducts = (combo.combo_products || []).map((cp: any) => ({
      productId: cp.product_id,
      name: cp.products?.name || "",
      quantity: cp.quantity,
    }));
    const added = addItem(
      {
        productId: `combo_${combo.id}`,
        name: combo.name,
        price: Number(combo.price),
        promoPrice: combo.promo_price ? Number(combo.promo_price) : null,
        imageUrl: combo.image_url || null,
        isCombo: true,
        comboProducts,
      },
      { id: tenant.id, slug: tenant.slug, name: tenant.name, freeShipping: (tenant as any).free_shipping, shippingFee: (tenant as any).shipping_fee ? Number((tenant as any).shipping_fee) : null }
    );
    if (added) {
      toast.success("✔ Combo adicionado ao carrinho");
    }
  };

  const ComboCard = ({ combo }: { combo: any }) => {
    const comboItems = (combo.combo_products || [])
      .map((cp: any) => `${cp.quantity}x ${cp.products?.name}`)
      .join(" + ");

    return (
      <div
        className="group bg-card rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 border-2 border-primary/20"
      >
        <div className="relative h-40 overflow-hidden bg-white">
          {combo.image_url ? (
            <img src={combo.image_url} alt={combo.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-primary/10 to-secondary">
              <Package className="w-12 h-12 text-primary/50" />
            </div>
          )}
          <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1 shadow-md">
            <Package className="w-3 h-3" />
            Combo
          </div>
        </div>
        <div className="p-3">
          <h4 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">{combo.name}</h4>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{comboItems}</p>
          {combo.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{combo.description}</p>
          )}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              {combo.promo_price ? (
                <>
                  <span className="text-base font-bold text-primary">R$ {Number(combo.promo_price).toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground line-through">R$ {Number(combo.price).toFixed(2)}</span>
                </>
              ) : (
                <span className="text-base font-bold text-foreground">R$ {Number(combo.price).toFixed(2)}</span>
              )}
            </div>
            <button
              onClick={(e) => handleAddComboToCart(combo, e)}
              className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-110 transition-transform shadow-md"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ProductGridCard = ({ product }: { product: typeof products[0] }) => {
    const outOfStock = stockMap[product.id] !== undefined && stockMap[product.id] <= 0;

    return (
      <div
        className={`group bg-card rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 cursor-pointer ${outOfStock ? "opacity-50 pointer-events-none" : ""}`}
        onClick={() => product.slug && navigate(`/${slug}/${product.slug}`)}
      >
        <div className="relative h-40 overflow-hidden bg-white">
          {imageMap[product.id] ? (
            <img src={imageMap[product.id]} alt={product.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-secondary to-muted">🍔</div>
          )}
          {product.has_discount && product.promo_price && (
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center gap-1">
              <Flame className="w-3 h-3" />
              Promoção
            </div>
          )}
          {outOfStock && (
            <div className="absolute inset-0 bg-foreground/60 flex items-center justify-center">
              <span className="px-3 py-1.5 rounded-full bg-card text-foreground font-semibold text-xs">Indisponível</span>
            </div>
          )}
          {/* Share & WhatsApp buttons */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => handleShareProduct(product, e)}
              className="w-8 h-8 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center hover:scale-110 transition-transform"
              title="Copiar link"
            >
              <Copy className="w-3.5 h-3.5 text-foreground" />
            </button>
            <button
              onClick={(e) => handleShareWhatsApp(product, e)}
              className="w-8 h-8 rounded-full bg-green-500/90 backdrop-blur-sm flex items-center justify-center hover:scale-110 transition-transform"
              title="Compartilhar via WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>
        <div className="p-3">
          <h4 className="font-semibold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">{product.name}</h4>
          {product.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{product.description}</p>}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              {product.has_discount && product.promo_price ? (
                <>
                  <span className="text-base font-bold text-primary">R$ {Number(product.promo_price).toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground line-through">R$ {Number(product.price).toFixed(2)}</span>
                </>
              ) : (
                <span className="text-base font-bold text-foreground">R$ {Number(product.price).toFixed(2)}</span>
              )}
            </div>
            <button
              onClick={(e) => handleAddToCart(product, e)}
              className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-110 transition-transform shadow-md"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const FeaturedCard = ({ product }: { product: typeof products[0] }) => {
    const outOfStock = stockMap[product.id] !== undefined && stockMap[product.id] <= 0;

    return (
      <div
        className={`group bg-card rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 cursor-pointer border-2 border-primary/20 ${outOfStock ? "opacity-50 pointer-events-none" : ""}`}
        onClick={() => product.slug && navigate(`/${slug}/${product.slug}`)}
      >
        <div className="relative h-48 overflow-hidden bg-white">
          {imageMap[product.id] ? (
            <img src={imageMap[product.id]} alt={product.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-primary/10 to-secondary">⭐</div>
          )}
          <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1 shadow-md">
            <Sparkles className="w-3 h-3" />
            Destaque
          </div>
          {product.has_discount && product.promo_price && (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center gap-1">
              <Flame className="w-3 h-3" />
              Promoção
            </div>
          )}
          {outOfStock && (
            <div className="absolute inset-0 bg-foreground/60 flex items-center justify-center">
              <span className="px-3 py-1.5 rounded-full bg-card text-foreground font-semibold text-xs">Indisponível</span>
            </div>
          )}
          {/* Share buttons */}
          <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => handleShareProduct(product, e)}
              className="w-8 h-8 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center hover:scale-110 transition-transform"
              title="Copiar link"
            >
              <Copy className="w-3.5 h-3.5 text-foreground" />
            </button>
            <button
              onClick={(e) => handleShareWhatsApp(product, e)}
              className="w-8 h-8 rounded-full bg-green-500/90 backdrop-blur-sm flex items-center justify-center hover:scale-110 transition-transform"
              title="WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>
        <div className="p-4">
          <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">{product.name}</h4>
          {product.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{product.description}</p>}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              {product.has_discount && product.promo_price ? (
                <>
                  <span className="text-lg font-bold text-primary">R$ {Number(product.promo_price).toFixed(2)}</span>
                  <span className="text-sm text-muted-foreground line-through">R$ {Number(product.price).toFixed(2)}</span>
                </>
              ) : (
                <span className="text-lg font-bold text-foreground">R$ {Number(product.price).toFixed(2)}</span>
              )}
            </div>
            <button
              onClick={(e) => handleAddToCart(product, e)}
              className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-110 transition-transform shadow-md"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const hasActiveFilters = searchQuery.trim() || activeCategories.length > 0 || showFeaturedOnly;

  return (
    <div className="min-h-screen bg-background">
      {/* Top navigation bar - NOT CHANGED */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-foreground truncate">{tenant.name}</h1>
          <div className="flex items-center gap-1">
            {user && (
              <Button
                variant="default"
                size="sm"
                onClick={() => navigate("/admin")}
                className="gap-1.5 rounded-xl text-xs"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            )}
            <Button variant="ghost" className="relative gap-2 px-3" onClick={() => setCartOpen(true)}>
              <ShoppingBag className="w-5 h-5" />
              {totalItems > 0 && (
                <>
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold">
                    {totalItems}
                  </span>
                  <span className="text-sm font-semibold text-foreground hidden sm:inline">
                    {totalPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </>
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleShareRestaurant}>
              <Share2 className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (!isTenantFavLoggedIn) {
                  toast.error("Faça login para favoritar");
                  return;
                }
                toggleTenantFavorite.mutate(tenant.id);
              }}
            >
              <Heart className={`w-5 h-5 transition-colors ${isTenantFavorite(tenant.id) ? "text-red-500 fill-red-500" : ""}`} />
            </Button>
            <CustomerMenu tenantId={tenant.id} />
          </div>
        </div>
      </header>

      {/* Restaurant header with cover - NOT CHANGED */}
      <section className="relative z-0">
        <div className="w-full h-56 md:h-72 overflow-hidden">
          {(tenant as any).cover_url ? (
            <img src={(tenant as any).cover_url} alt="Capa" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-secondary" />
          )}
        </div>
        <div className="container mx-auto px-4 flex flex-col items-center text-center -mt-32 relative z-10">
          <div className="w-36 h-36 md:w-40 md:h-40 rounded-full bg-card border-4 border-card shadow-xl overflow-hidden">
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl md:text-6xl bg-secondary">
                {tenant.name.charAt(0)}
              </div>
            )}
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-foreground mt-2">{tenant.name}</h2>
          {tenant.category && (
            <p className="text-sm text-muted-foreground mt-0.5">{tenant.category}</p>
          )}
          {tenant.address && (
            <p className="text-xs text-muted-foreground mt-0.5">{tenant.address}{tenant.city ? `, ${tenant.city}` : ""}</p>
          )}
        </div>
      </section>

      {/* Search bar */}
      <section className="container mx-auto px-4 mt-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Buscar produto ou categoria"
            className="w-full h-12 pl-12 pr-4 rounded-2xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm font-medium"
            >
              Limpar
            </button>
          )}
        </div>
      </section>

      {/* Category chips */}
      <section className="container mx-auto px-4 mt-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {/* All button */}
          <button
            onClick={() => { setActiveCategories([]); setShowFeaturedOnly(false); }}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 shadow-sm ${
              activeCategories.length === 0 && !showFeaturedOnly
                ? "bg-primary text-primary-foreground shadow-md scale-105"
                : "bg-card text-foreground border border-border hover:bg-secondary"
            }`}
          >
            🍽️ Todos
          </button>
          {/* Featured button */}
          {tenantFeaturedIds.length > 0 && (
            <button
              onClick={() => { setShowFeaturedOnly(!showFeaturedOnly); setActiveCategories([]); }}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 shadow-sm ${
                showFeaturedOnly
                  ? "bg-primary text-primary-foreground shadow-md scale-105"
                  : "bg-card text-foreground border border-border hover:bg-secondary"
              }`}
            >
              ⭐ Destaques
            </button>
          )}
          {/* Category buttons */}
          {categoriesWithProducts.map((cat) => {
            const isActive = activeCategories.includes(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategories((prev) =>
                    isActive ? prev.filter((c) => c !== cat.id) : [...prev, cat.id]
                  );
                  setShowFeaturedOnly(false);
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 shadow-sm ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md scale-105"
                    : "bg-card text-foreground border border-border hover:bg-secondary"
                }`}
              >
                {(cat as any).emoji || "🍽️"} {cat.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* Active filter indicator */}
      {hasActiveFilters && (
        <section className="container mx-auto px-4 mt-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              {filteredProducts.length} produto{filteredProducts.length !== 1 ? "s" : ""} encontrado{filteredProducts.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => { setSearchQuery(""); setActiveCategories([]); setShowFeaturedOnly(false); }}
              className="text-primary font-medium hover:underline"
            >
              Limpar filtros
            </button>
          </div>
        </section>
      )}

      <main className="container mx-auto px-4 py-6 space-y-8">
        {productsLoading ? (
          <>
            {/* Skeleton loading */}
            <section>
              <Skeleton className="h-6 w-48 mb-4" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <ProductSkeleton key={i} />
                ))}
              </div>
            </section>
          </>
        ) : (
          <>
            {/* Featured products section */}
            {featuredProducts.length > 0 && activeCategories.length === 0 && !showFeaturedOnly && !searchQuery && (
              <section>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  ⭐ Destaques da Loja
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {featuredProducts.map((p) => (
                    <FeaturedCard key={p.id} product={p} />
                  ))}
                </div>
              </section>
            )}

            {/* Combos section */}
            {combos.length > 0 && activeCategories.length === 0 && !showFeaturedOnly && !searchQuery && (
              <section>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  📦 Combos
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {combos.map((combo: any) => (
                    <ComboCard key={combo.id} combo={combo} />
                  ))}
                </div>
              </section>
            )}

            {/* Featured-only mode */}
            {showFeaturedOnly && (
              <section>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  ⭐ Destaques da Loja
                </h3>
                {filteredProducts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProducts.map((p) => (
                      <FeaturedCard key={p.id} product={p} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-5xl mb-4">⭐</div>
                    <p className="text-muted-foreground">Nenhum produto em destaque no momento</p>
                  </div>
                )}
              </section>
            )}

            {/* Products: sections or category fallback */}
            {!showFeaturedOnly && (
              <>
                {sectionedDisplay ? (
                  sectionedDisplay.length > 0 ? (
                    sectionedDisplay.map((group) => (
                      <section key={group.title}>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                          {group.title}
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                          {group.products.map((p) => (
                            <ProductGridCard key={p.id} product={p} />
                          ))}
                        </div>
                      </section>
                    ))
                  ) : (
                    <div className="text-center py-16">
                      <div className="text-5xl mb-4">😢</div>
                      <h3 className="text-xl font-semibold mb-2">Nenhum produto encontrado</h3>
                      <p className="text-muted-foreground mb-4">Tente ajustar a busca ou os filtros</p>
                      <Button variant="outline" onClick={() => { setSearchQuery(""); setActiveCategories([]); setShowFeaturedOnly(false); }}>
                        Limpar filtros
                      </Button>
                    </div>
                  )
                ) : (
                  productsByCategory.length > 0 ? (
                    productsByCategory.map((group) => (
                      <section key={group.name}>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                          {group.emoji} {group.name}
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                          {group.products.map((p) => (
                            <ProductGridCard key={p.id} product={p} />
                          ))}
                        </div>
                      </section>
                    ))
                  ) : (
                    <div className="text-center py-16">
                      <div className="text-5xl mb-4">😢</div>
                      <h3 className="text-xl font-semibold mb-2">Nenhum produto encontrado</h3>
                      <p className="text-muted-foreground mb-4">Tente ajustar a busca ou os filtros</p>
                      <Button variant="outline" onClick={() => { setSearchQuery(""); setActiveCategories([]); setShowFeaturedOnly(false); }}>
                        Limpar filtros
                      </Button>
                    </div>
                  )
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default RestaurantPage;
