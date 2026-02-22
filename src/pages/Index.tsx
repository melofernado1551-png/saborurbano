import { useState } from "react";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import SearchBar from "@/components/SearchBar";
import ProductCard from "@/components/ProductCard";
import RestaurantCard from "@/components/RestaurantCard";
import CitySelectionModal from "@/components/CitySelectionModal";
import { MapPin, ShoppingBag, Store, Search } from "lucide-react";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProductCardProduct } from "@/components/ProductCard";

const CITY_STORAGE_KEY = "sabor_urbano_city";

type ViewMode = "products" | "restaurants";

const Index = () => {
  const [selectedCity, setSelectedCity] = useState<string | null>(() => {
    return localStorage.getItem(CITY_STORAGE_KEY);
  });
  const [showCityModal, setShowCityModal] = useState(!selectedCity);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("products");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
    localStorage.setItem(CITY_STORAGE_KEY, city);
    setShowCityModal(false);
  };

  // Fetch products with tenant info for the selected city
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products-by-city", selectedCity],
    enabled: !!selectedCity && viewMode === "products",
    queryFn: async () => {
      // Get tenant IDs in this city first
      const { data: cityTenants, error: tErr } = await supabase
        .from("tenants")
        .select("id, name, logo_url, slug")
        .eq("active", true)
        .ilike("city", selectedCity!);
      if (tErr) throw tErr;
      if (!cityTenants || cityTenants.length === 0) return [];

      const tenantIds = cityTenants.map((t) => t.id);
      const tenantMap = Object.fromEntries(
        cityTenants.map((t) => [t.id, t])
      );

      // Fetch products for those tenants
      const { data: prods, error: pErr } = await supabase
        .from("products")
        .select("id, name, slug, description, price, promo_price, has_discount, tenant_id")
        .eq("active", true)
        .in("tenant_id", tenantIds);
      if (pErr) throw pErr;

      // Fetch product images
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
            if (!imageMap[img.product_id]) {
              imageMap[img.product_id] = img.image_url;
            }
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

  // Map tenants for RestaurantCard
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

  // Filter
  const filteredProducts = products.filter((p) => {
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
    return (
      r.name.toLowerCase().includes(q) ||
      r.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });

  const isLoading = viewMode === "products" ? productsLoading : tenantsLoading;
  const itemCount = viewMode === "products" ? filteredProducts.length : filteredRestaurants.length;

  return (
    <div className="min-h-screen bg-background">
      <Header
        location={selectedCity || "Selecione a cidade"}
        onLocationClick={() => setShowCityModal(true)}
      />

      <CitySelectionModal open={showCityModal} onCitySelect={handleCitySelect} />

      <main>
        <HeroSection />

        {/* Search section */}
        <section className="container mx-auto px-4 -mt-4 relative z-10">
          <div className="bg-card rounded-2xl shadow-lg p-4 md:p-6 border border-border">
            {/* Search */}
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

            {/* View mode toggle */}
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

            {/* Category filters */}
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
          </div>
        </section>

        {/* Content grid */}
        <section className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-bold">
              {viewMode === "products" ? "Produtos" : "Restaurantes"}{" "}
              <span className="text-muted-foreground font-normal text-base">
                ({itemCount})
              </span>
            </h2>
          </div>

          {!selectedCity ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📍</div>
              <h3 className="text-xl font-semibold mb-2">Selecione sua cidade</h3>
              <p className="text-muted-foreground">Para ver os produtos disponíveis na sua região</p>
            </div>
          ) : isLoading ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4 animate-pulse">🍽️</div>
              <h3 className="text-xl font-semibold mb-2">Carregando...</h3>
            </div>
          ) : itemCount === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🍽️</div>
              <h3 className="text-xl font-semibold mb-2">
                {viewMode === "products" ? "Nenhum produto encontrado" : "Nenhum restaurante encontrado"}
              </h3>
              <p className="text-muted-foreground">Tente ajustar a busca ou selecionar outra cidade</p>
            </div>
          ) : viewMode === "products" ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {filteredProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} />
              ))}
            </div>
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
