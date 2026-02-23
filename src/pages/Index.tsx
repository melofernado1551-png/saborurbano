import { useState, useRef } from "react";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import ProductCard from "@/components/ProductCard";
import RestaurantCard from "@/components/RestaurantCard";
import CitySelectionModal from "@/components/CitySelectionModal";
import { ShoppingBag, Store, Search, X } from "lucide-react";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProductCardProduct } from "@/components/ProductCard";
import { useWeather } from "@/hooks/useWeather";

const CITY_STORAGE_KEY = "sabor_urbano_city";

type ViewMode = "products" | "restaurants";

// Tag priority order for display
const TAG_PRIORITY: Record<string, number> = {
  "promocao": 1,
  "mais-pedido": 2,
  "destaque": 3,
  "entrega-rapida": 4,
  "novidade": 5,
  "vegetariano": 6,
  "combo": 7,
  "favorito": 8,
};

// Friendly titles for curated blocks
const CURATED_TITLES: Record<string, string> = {
  "destaque": "⭐ Destaques da galera",
  "mais-pedido": "🔥 O que todo mundo está pedindo",
  "promocao": "💥 Promoções de hoje",
  "entrega-rapida": "⚡ Entrega rápida",
  "novidade": "🆕 Novidades fresquinhas",
  "vegetariano": "🌱 Opções vegetarianas",
  "combo": "🎁 Combos imperdíveis",
  "favorito": "❤️ Favoritos do público",
};

interface TagData {
  id: string;
  name: string;
  emoji: string;
  slug: string;
}

const Index = () => {
  const [selectedCity, setSelectedCity] = useState<string | null>(() => {
    return localStorage.getItem(CITY_STORAGE_KEY);
  });
  const [showCityModal, setShowCityModal] = useState(!selectedCity);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("products");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<TagData | null>(null);
  const productsRef = useRef<HTMLDivElement>(null);
  const weatherCondition = useWeather(selectedCity);

  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
    localStorage.setItem(CITY_STORAGE_KEY, city);
    setShowCityModal(false);
  };

  // Fetch tags with product counts
  const { data: tagsWithProducts = [], isLoading: tagsLoading } = useQuery({
    queryKey: ["home-tags", selectedCity],
    enabled: !!selectedCity,
    queryFn: async () => {
      // Get tenants in city
      const { data: cityTenants } = await supabase
        .from("tenants")
        .select("id")
        .eq("active", true)
        .ilike("city", selectedCity!);
      if (!cityTenants?.length) return [];
      const tenantIds = cityTenants.map((t) => t.id);

      // Get active tags
      const { data: tags } = await supabase
        .from("tags")
        .select("id, name, emoji, slug")
        .eq("active", true);
      if (!tags?.length) return [];

      // Get product_tags for products in those tenants
      const { data: productTags } = await supabase
        .from("product_tags")
        .select("tag_id, product_id")
        .eq("active", true);

      const { data: activeProducts } = await supabase
        .from("products")
        .select("id")
        .eq("active", true)
        .in("tenant_id", tenantIds);

      const activeProductIds = new Set((activeProducts || []).map((p) => p.id));

      // Count products per tag
      const tagProductCount: Record<string, number> = {};
      for (const pt of productTags || []) {
        if (activeProductIds.has(pt.product_id)) {
          tagProductCount[pt.tag_id] = (tagProductCount[pt.tag_id] || 0) + 1;
        }
      }

      // Filter tags with products, sort by priority, limit to 6
      return tags
        .filter((t) => (tagProductCount[t.id] || 0) > 0)
        .sort((a, b) => (TAG_PRIORITY[a.slug] || 99) - (TAG_PRIORITY[b.slug] || 99))
        .slice(0, 6);
    },
  });

  // Fetch products with tenant info
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products-by-city", selectedCity],
    enabled: !!selectedCity && viewMode === "products",
    queryFn: async () => {
      const { data: cityTenants, error: tErr } = await supabase
        .from("tenants")
        .select("id, name, logo_url, slug")
        .eq("active", true)
        .ilike("city", selectedCity!);
      if (tErr) throw tErr;
      if (!cityTenants?.length) return [];

      const tenantIds = cityTenants.map((t) => t.id);
      const tenantMap = Object.fromEntries(cityTenants.map((t) => [t.id, t]));

      const { data: prods, error: pErr } = await supabase
        .from("products")
        .select("id, name, slug, description, price, promo_price, has_discount, tenant_id")
        .eq("active", true)
        .in("tenant_id", tenantIds);
      if (pErr) throw pErr;

      const productIds = (prods || []).map((p) => p.id);
      let imageMap: Record<string, string> = {};
      if (productIds.length > 0) {
        const { data: images } = await supabase
          .from("product_images")
          .select("product_id, image_url")
          .eq("active", true)
          .in("product_id", productIds);
        if (images) {
          for (const img of images) {
            if (!imageMap[img.product_id]) imageMap[img.product_id] = img.image_url;
          }
        }
      }

      return (prods || []).map((p): ProductCardProduct => {
        const tenant = tenantMap[p.tenant_id];
        return {
          id: p.id,
          name: p.name,
          slug: (p as any).slug || undefined,
          description: p.description,
          price: Number(p.price),
          promo_price: p.promo_price ? Number(p.promo_price) : null,
          has_discount: p.has_discount,
          image_url: imageMap[p.id] || null,
          tenant_name: tenant?.name || "",
          tenant_logo: tenant?.logo_url || null,
          tenant_slug: tenant?.slug || "",
        };
      });
    },
  });

  // Fetch product_tags mapping
  const { data: productTagsMap = {} } = useQuery({
    queryKey: ["product-tags-map", selectedCity],
    enabled: !!selectedCity && viewMode === "products",
    queryFn: async () => {
      const { data } = await supabase
        .from("product_tags")
        .select("product_id, tag_id")
        .eq("active", true);
      const map: Record<string, string[]> = {};
      for (const pt of data || []) {
        if (!map[pt.product_id]) map[pt.product_id] = [];
        map[pt.product_id].push(pt.tag_id);
      }
      return map;
    },
  });

  // Fetch all tags for badge display
  const { data: allTags = [] } = useQuery({
    queryKey: ["all-tags"],
    queryFn: async () => {
      const { data } = await supabase.from("tags").select("id, name, emoji, slug").eq("active", true);
      return data || [];
    },
  });

  // Fetch tenants for restaurant view
  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ["tenants-by-city", selectedCity],
    enabled: !!selectedCity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("active", true)
        .ilike("city", selectedCity!);
      if (error) throw error;
      return data;
    },
  });

  const restaurants = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    image: t.logo_url || "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop",
    category: (t.category || "").split(",")[0]?.trim().toLowerCase() || "other",
    rating: 0,
    reviewCount: 0,
    deliveryTime: "30-45 min",
    deliveryFee: 0,
    minOrder: 0,
    distance: 0,
    isOpen: true,
    isFavorite: false,
    tags: t.category ? t.category.split(",").map((c: string) => c.trim()) : [],
    promoted: false,
  }));

  // Filter products (search + tag)
  const filteredProducts = products.filter((p) => {
    // Tag filter
    if (selectedTag) {
      const pTags = productTagsMap[p.id] || [];
      if (!pTags.includes(selectedTag.id)) return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.tenant_name.toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q)
    );
  });

  const filteredRestaurants = restaurants.filter((r) => {
    if (selectedCategory && !r.tags.some((tag) => tag.toLowerCase() === selectedCategory.toLowerCase())) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.tags.some((tag) => tag.toLowerCase().includes(q));
  });

  const isLoading = viewMode === "products" ? productsLoading : tenantsLoading;
  const itemCount = viewMode === "products" ? filteredProducts.length : filteredRestaurants.length;

  // Get badge tag for a product (highest priority)
  const getProductBadge = (productId: string) => {
    const pTagIds = productTagsMap[productId] || [];
    if (!pTagIds.length) return null;
    const badgePriority = ["promocao", "destaque", "mais-pedido"];
    for (const slug of badgePriority) {
      const tag = allTags.find((t) => t.slug === slug && pTagIds.includes(t.id));
      if (tag) return tag;
    }
    return null;
  };

  // Build curated blocks (max 3, after every 6 products)
  const curatedBlocks: { tag: TagData; products: ProductCardProduct[]; insertAfter: number }[] = [];
  if (viewMode === "products" && !selectedTag && filteredProducts.length > 0) {
    const curatedOrder = ["destaque", "mais-pedido", "promocao", "entrega-rapida", "novidade"];
    const usedProductIds = new Set<string>();
    let blockCount = 0;

    for (const slug of curatedOrder) {
      if (blockCount >= 3) break;
      const tag = allTags.find((t) => t.slug === slug);
      if (!tag) continue;

      const tagProducts = products.filter((p) => {
        const pTags = productTagsMap[p.id] || [];
        return pTags.includes(tag.id) && !usedProductIds.has(p.id);
      }).slice(0, 4);

      if (tagProducts.length === 0) continue;

      tagProducts.forEach((p) => usedProductIds.add(p.id));
      curatedBlocks.push({
        tag,
        products: tagProducts,
        insertAfter: (blockCount + 1) * 6,
      });
      blockCount++;
    }
  }

  const handleTagClick = (tag: TagData) => {
    setSelectedTag(selectedTag?.id === tag.id ? null : tag);
    setTimeout(() => {
      productsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  // Render products grid with curated blocks interspersed
  const renderProductsGrid = () => {
    if (filteredProducts.length === 0) return null;

    const elements: React.ReactNode[] = [];
    let productIndex = 0;

    for (let i = 0; i < filteredProducts.length; i++) {
      elements.push(
        <ProductCard
          key={filteredProducts[i].id}
          product={filteredProducts[i]}
          index={i}
          badgeTag={getProductBadge(filteredProducts[i].id)}
        />
      );
      productIndex++;

      // Check if we should insert a curated block
      if (!selectedTag) {
        const block = curatedBlocks.find((b) => b.insertAfter === productIndex);
        if (block) {
          elements.push(
            <div key={`curated-${block.tag.slug}`} className="col-span-full">
              <div className="py-6">
                <h3 className="text-lg font-bold mb-4 text-center">
                  {CURATED_TITLES[block.tag.slug] || `${block.tag.emoji} ${block.tag.name}`}
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {block.products.map((p, idx) => (
                    <ProductCard
                      key={`curated-${p.id}`}
                      product={p}
                      index={idx}
                      badgeTag={getProductBadge(p.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        }
      }
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {elements}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        location={selectedCity || "Selecione a cidade"}
        onLocationClick={() => setShowCityModal(true)}
      />

      <CitySelectionModal open={showCityModal} onCitySelect={handleCitySelect} />

      <main>
        <HeroSection weatherCondition={weatherCondition} />

        {/* Search section */}
        <section className="container mx-auto px-4 -mt-4 relative z-10">
          <div className="bg-card rounded-2xl shadow-lg p-4 md:p-6 border border-border">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={viewMode === "products" ? "Buscar produtos..." : "Buscar restaurantes..."}
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-card"
              />
            </div>

            <div className="flex gap-2 mt-4 justify-center">
              <Button
                variant={viewMode === "products" ? "default" : "outline"}
                size="sm"
                className="gap-2 rounded-xl"
                onClick={() => setViewMode("products")}
              >
                <ShoppingBag className="w-4 h-4" />
                Produtos
              </Button>
              <Button
                variant={viewMode === "restaurants" ? "default" : "outline"}
                size="sm"
                className="gap-2 rounded-xl"
                onClick={() => setViewMode("restaurants")}
              >
                <Store className="w-4 h-4" />
                Restaurantes
              </Button>
            </div>

            {/* Category filters (for restaurants) */}
            {viewMode === "restaurants" && (
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                {[
                  { name: "Lanchonete", emoji: "🍔" },
                  { name: "Pizzaria", emoji: "🍕" },
                  { name: "Restaurante", emoji: "🍽️" },
                  { name: "Hamburgueria", emoji: "🍔" },
                  { name: "Açaí", emoji: "🍇" },
                  { name: "Doceria", emoji: "🍰" },
                  { name: "Sorveteria", emoji: "🍦" },
                  { name: "Padaria", emoji: "🥖" },
                  { name: "Cafeteria", emoji: "☕" },
                  { name: "Bar", emoji: "🍻" },
                  { name: "Outro", emoji: "🏪" },
                ].map((cat) => (
                  <Button
                    key={cat.name}
                    variant={selectedCategory === cat.name ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5 rounded-xl text-xs"
                    onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                  >
                    <span>{cat.emoji}</span>
                    {cat.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Tag track (products mode only) */}
        {viewMode === "products" && (
          <section className="container mx-auto px-4 mt-4">
            {tagsLoading ? (
              <div className="flex gap-2 overflow-hidden">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-28 rounded-full flex-shrink-0" />
                ))}
              </div>
            ) : tagsWithProducts.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide justify-center">
                {tagsWithProducts.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleTagClick(tag)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 border flex-shrink-0 ${
                      selectedTag?.id === tag.id
                        ? "bg-primary text-primary-foreground border-primary shadow-md"
                        : "bg-card border-border text-foreground hover:border-primary/50 hover:bg-accent"
                    }`}
                  >
                    <span>{tag.emoji}</span>
                    {tag.name}
                  </button>
                ))}
              </div>
            ) : null}

            {/* Active tag indicator */}
            {selectedTag && (
              <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                <span>
                  Mostrando produtos {selectedTag.emoji} {selectedTag.name}
                </span>
                <button
                  onClick={() => setSelectedTag(null)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Limpar filtro
                </button>
              </div>
            )}
          </section>
        )}

        {/* Content grid */}
        <section ref={productsRef} className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-bold">
              {viewMode === "products" ? "Produtos" : "Restaurantes"}
            </h2>
          </div>

          {!selectedCity ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📍</div>
              <h3 className="text-xl font-semibold mb-2">Selecione sua cidade</h3>
              <p className="text-muted-foreground">Para ver os produtos disponíveis na sua região</p>
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-44 w-full rounded-2xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : itemCount === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">😢</div>
              <h3 className="text-xl font-semibold mb-2">
                Nenhum {viewMode === "products" ? "produto" : "restaurante"} encontrado
              </h3>
              <p className="text-muted-foreground">
                {selectedTag
                  ? "Nenhum produto encontrado para essa seleção"
                  : "Tente ajustar a busca ou selecionar outra cidade"}
              </p>
              {selectedTag && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setSelectedTag(null)}
                >
                  Limpar filtro
                </Button>
              )}
            </div>
          ) : viewMode === "products" ? (
            renderProductsGrid()
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredRestaurants.map((restaurant, index) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} index={index} />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
