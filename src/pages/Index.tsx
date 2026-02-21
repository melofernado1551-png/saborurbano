import { useState, useEffect } from "react";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import SearchBar from "@/components/SearchBar";
import CategoryFilter from "@/components/CategoryFilter";
import QuickFilters from "@/components/QuickFilters";
import RestaurantCard from "@/components/RestaurantCard";
import FilterSheet from "@/components/FilterSheet";
import CitySelectionModal from "@/components/CitySelectionModal";
import { categories } from "@/data/mockData";
import { MapPin } from "lucide-react";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const CITY_STORAGE_KEY = "sabor_urbano_city";

const Index = () => {
  const [selectedCity, setSelectedCity] = useState<string | null>(() => {
    return localStorage.getItem(CITY_STORAGE_KEY);
  });
  const [showCityModal, setShowCityModal] = useState(!selectedCity);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeQuickFilters, setActiveQuickFilters] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    rating: 0,
    deliveryTime: "any",
    freeDelivery: false,
    priceRange: "any",
  });

  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
    localStorage.setItem(CITY_STORAGE_KEY, city);
    setShowCityModal(false);
  };

  const handleChangeCity = () => {
    setShowCityModal(true);
  };

  // Fetch tenants from Supabase filtered by city
  const { data: tenants = [], isLoading } = useQuery({
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

  // Map tenants to restaurant-like objects for RestaurantCard
  const restaurants = tenants.map((t) => ({
    id: t.id,
    name: t.name,
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

  const handleQuickFilterToggle = (filterId: string) => {
    setActiveQuickFilters((prev) =>
      prev.includes(filterId)
        ? prev.filter((id) => id !== filterId)
        : [...prev, filterId]
    );
  };

  // Filter restaurants by search
  const filteredRestaurants = restaurants.filter((r) => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      if (
        !r.name.toLowerCase().includes(query) &&
        !r.tags.some((tag) => tag.toLowerCase().includes(query))
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      <Header
        location={selectedCity || "Selecione a cidade"}
        onLocationClick={handleChangeCity}
      />

      <CitySelectionModal open={showCityModal} onCitySelect={handleCitySelect} />

      <main>
        <HeroSection />

        {/* Search and filters section */}
        <section className="container mx-auto px-4 -mt-4 relative z-10">
          <div className="bg-card rounded-2xl shadow-lg p-4 md:p-6 border border-border">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onFilterClick={() => setIsFilterOpen(true)}
            />

            <div className="mt-4">
              <CategoryFilter
                categories={categories}
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
              />
            </div>
          </div>
        </section>

        {/* Quick filters */}
        <section className="container mx-auto px-4 py-4">
          <QuickFilters
            activeFilters={activeQuickFilters}
            onFilterToggle={handleQuickFilterToggle}
          />
        </section>

        {/* Restaurant grid */}
        <section className="container mx-auto px-4 pb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-bold">
              Restaurantes{" "}
              <span className="text-muted-foreground font-normal text-base">
                ({filteredRestaurants.length})
              </span>
            </h2>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span className="hidden sm:inline">Ordenar por distância</span>
            </div>
          </div>

          {!selectedCity ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📍</div>
              <h3 className="text-xl font-semibold mb-2">
                Selecione sua cidade
              </h3>
              <p className="text-muted-foreground">
                Para ver os restaurantes disponíveis na sua região
              </p>
            </div>
          ) : isLoading ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4 animate-pulse">🍽️</div>
              <h3 className="text-xl font-semibold mb-2">Carregando restaurantes...</h3>
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🍽️</div>
              <h3 className="text-xl font-semibold mb-2">
                Nenhum restaurante encontrado
              </h3>
              <p className="text-muted-foreground">
                Tente ajustar os filtros ou buscar por outro termo
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredRestaurants.map((restaurant, index) => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  index={index}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />

      {/* Filter sheet */}
      <FilterSheet
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onFiltersChange={setFilters}
      />
    </div>
  );
};

export default Index;
