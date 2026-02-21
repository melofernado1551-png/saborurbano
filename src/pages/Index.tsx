import { useState, useMemo } from "react";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import SearchBar from "@/components/SearchBar";
import CategoryFilter from "@/components/CategoryFilter";
import QuickFilters from "@/components/QuickFilters";
import RestaurantCard from "@/components/RestaurantCard";
import FilterSheet from "@/components/FilterSheet";
import { categories, restaurants } from "@/data/mockData";
import { MapPin } from "lucide-react";
import Footer from "@/components/Footer";

const Index = () => {
  const [location, setLocation] = useState("Rua das Flores, 123");
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

  const handleQuickFilterToggle = (filterId: string) => {
    setActiveQuickFilters((prev) =>
      prev.includes(filterId)
        ? prev.filter((id) => id !== filterId)
        : [...prev, filterId]
    );
  };

  const filteredRestaurants = useMemo(() => {
    let result = [...restaurants];

    // Category filter
    if (activeCategory !== "all") {
      result = result.filter((r) => r.category === activeCategory);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Rating filter
    if (filters.rating > 0) {
      result = result.filter((r) => r.rating >= filters.rating);
    }

    // Free delivery filter
    if (filters.freeDelivery) {
      result = result.filter((r) => r.deliveryFee === 0);
    }

    // Quick filters
    if (activeQuickFilters.includes("popular")) {
      result = result.filter((r) => r.reviewCount > 500);
    }
    if (activeQuickFilters.includes("freeDelivery")) {
      result = result.filter((r) => r.deliveryFee === 0);
    }
    if (activeQuickFilters.includes("topRated")) {
      result = result.filter((r) => r.rating >= 4.5);
    }

    // Sort promoted first
    result.sort((a, b) => {
      if (a.promoted && !b.promoted) return -1;
      if (!a.promoted && b.promoted) return 1;
      return 0;
    });

    return result;
  }, [activeCategory, searchQuery, filters, activeQuickFilters]);

  return (
    <div className="min-h-screen bg-background">
      <Header location={location} onLocationClick={() => {}} />

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

          {filteredRestaurants.length === 0 ? (
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
