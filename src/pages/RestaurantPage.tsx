import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Search, Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const RestaurantPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

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

  // Fetch featured products
  const { data: featuredIds = [] } = useQuery({
    queryKey: ["featured-products", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("featured_products")
        .select("product_id")
        .eq("active", true);
      if (error) throw error;
      return data.map((f) => f.product_id);
    },
  });

  // Fetch product categories for this tenant
  const { data: categories = [] } = useQuery({
    queryKey: ["tenant-product-categories", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("id, name")
        .eq("tenant_id", tenant!.id)
        .eq("active", true);
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

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !(p.description || "").toLowerCase().includes(q)) {
          return false;
        }
      }
      if (activeCategory) {
        const cats = categoryMap[p.id] || [];
        if (!cats.includes(activeCategory)) return false;
      }
      return true;
    });
  }, [products, searchQuery, activeCategory, categoryMap]);

  // Separate featured/combos/general
  const featuredProducts = filteredProducts.filter((p) => featuredIds.includes(p.id));
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

    const result: { name: string; products: typeof products }[] = [];
    for (const cat of categories) {
      if (groups[cat.id] && groups[cat.id].length > 0) {
        result.push({ name: cat.name, products: groups[cat.id] });
      }
    }
    if (uncategorized.length > 0) {
      result.push({ name: "Outros", products: uncategorized });
    }
    // If no categories at all, show everything as "Todos os produtos"
    if (result.length === 0 && generalProducts.length > 0) {
      result.push({ name: "Todos os Produtos", products: generalProducts });
    }
    return result;
  }, [generalProducts, categoryMap, categories]);

  const handleShare = async () => {
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

  if (tenantLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl animate-pulse mb-4">🍽️</div>
          <p className="text-muted-foreground">Carregando restaurante...</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-xl font-bold mb-2">Restaurante não encontrado</h2>
          <p className="text-muted-foreground mb-4">O restaurante que você procura não existe ou está inativo.</p>
          <Button onClick={() => navigate("/")} variant="outline">Voltar ao início</Button>
        </div>
      </div>
    );
  }

  const ProductGridCard = ({ product }: { product: typeof products[0] }) => {
    const outOfStock = stockMap[product.id] !== undefined && stockMap[product.id] <= 0;

    return (
      <div className={`group bg-card rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 cursor-pointer ${outOfStock ? "opacity-50 pointer-events-none" : ""}`} onClick={() => product.slug && navigate(`/${slug}/${product.slug}`)}>
        <div className="relative h-40 overflow-hidden bg-secondary">
          {imageMap[product.id] ? (
            <img src={imageMap[product.id]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">🍔</div>
          )}
          {product.has_discount && product.promo_price && (
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-xs font-semibold">
              -{Math.round(((Number(product.price) - Number(product.promo_price)) / Number(product.price)) * 100)}%
            </div>
          )}
          {outOfStock && (
            <div className="absolute inset-0 bg-foreground/60 flex items-center justify-center">
              <span className="px-3 py-1.5 rounded-full bg-card text-foreground font-semibold text-xs">Indisponível</span>
            </div>
          )}
        </div>
        <div className="p-3">
          <h4 className="font-semibold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">{product.name}</h4>
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
  };

  const FeaturedCard = ({ product }: { product: typeof products[0] }) => {
    const outOfStock = stockMap[product.id] !== undefined && stockMap[product.id] <= 0;

    return (
      <div className={`group bg-card rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 cursor-pointer border-2 border-primary/20 ${outOfStock ? "opacity-50 pointer-events-none" : ""}`} onClick={() => product.slug && navigate(`/${slug}/${product.slug}`)}>
        <div className="relative h-48 overflow-hidden bg-secondary">
          {imageMap[product.id] ? (
            <img src={imageMap[product.id]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl">⭐</div>
          )}
          <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Destaque
          </div>
          {product.has_discount && product.promo_price && (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-xs font-semibold">
              -{Math.round(((Number(product.price) - Number(product.promo_price)) / Number(product.price)) * 100)}%
            </div>
          )}
          {outOfStock && (
            <div className="absolute inset-0 bg-foreground/60 flex items-center justify-center">
              <span className="px-3 py-1.5 rounded-full bg-card text-foreground font-semibold text-xs">Indisponível</span>
            </div>
          )}
        </div>
        <div className="p-4">
          <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">{product.name}</h4>
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
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top navigation bar */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-foreground truncate">{tenant.name}</h1>
          <Button variant="ghost" size="icon" onClick={handleShare}>
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Restaurant header */}
      <section className="relative bg-gradient-to-b from-primary/10 to-background py-8 md:py-12">
        <div className="container mx-auto px-4 flex flex-col items-center text-center">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-card border-4 border-card shadow-lg overflow-hidden mb-4">
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl md:text-5xl bg-secondary">
                {tenant.name.charAt(0)}
              </div>
            )}
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-foreground">{tenant.name}</h2>
          {tenant.category && (
            <p className="text-sm text-muted-foreground mt-1">{tenant.category}</p>
          )}
          {tenant.address && (
            <p className="text-xs text-muted-foreground mt-2">{tenant.address}{tenant.city ? `, ${tenant.city}` : ""}</p>
          )}
        </div>
      </section>

      {/* Search and category filters */}
      <section className="container mx-auto px-4 -mt-4 relative z-10">
        <div className="bg-card rounded-2xl shadow-lg p-4 border border-border">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar produto..."
              className="w-full h-11 pl-12 pr-4 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          {categories.length > 0 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setActiveCategory(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  !activeCategory ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    activeCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <main className="container mx-auto px-4 py-8 space-y-10">
        {productsLoading ? (
          <div className="text-center py-16">
            <div className="text-5xl animate-pulse mb-4">🍽️</div>
            <p className="text-muted-foreground">Carregando produtos...</p>
          </div>
        ) : (
          <>
            {/* Featured products */}
            {featuredProducts.length > 0 && !activeCategory && !searchQuery && (
              <section>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Destaques
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {featuredProducts.map((p) => (
                    <FeaturedCard key={p.id} product={p} />
                  ))}
                </div>
              </section>
            )}

            {/* Products by category */}
            {productsByCategory.length > 0 ? (
              productsByCategory.map((group) => (
                <section key={group.name}>
                  <h3 className="text-lg font-bold mb-4">{group.name}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {group.products.map((p) => (
                      <ProductGridCard key={p.id} product={p} />
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">🍽️</div>
                <h3 className="text-xl font-semibold mb-2">Nenhum produto encontrado</h3>
                <p className="text-muted-foreground">Tente ajustar a busca ou os filtros</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default RestaurantPage;
