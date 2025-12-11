import { Flame, Truck, Clock, Star, Percent } from "lucide-react";
import { Button } from "./ui/button";

interface QuickFilter {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface QuickFiltersProps {
  activeFilters: string[];
  onFilterToggle: (filterId: string) => void;
}

const quickFilters: QuickFilter[] = [
  { id: "popular", label: "Populares", icon: <Flame className="w-4 h-4" /> },
  { id: "freeDelivery", label: "Entrega Grátis", icon: <Truck className="w-4 h-4" /> },
  { id: "fast", label: "Mais Rápidos", icon: <Clock className="w-4 h-4" /> },
  { id: "topRated", label: "Bem Avaliados", icon: <Star className="w-4 h-4" /> },
  { id: "promo", label: "Promoções", icon: <Percent className="w-4 h-4" /> },
];

const QuickFilters = ({ activeFilters, onFilterToggle }: QuickFiltersProps) => {
  return (
    <div className="flex gap-2 overflow-x-auto py-2" style={{ scrollbarWidth: "none" }}>
      {quickFilters.map((filter) => (
        <Button
          key={filter.id}
          variant={activeFilters.includes(filter.id) ? "chipActive" : "chip"}
          size="chip"
          onClick={() => onFilterToggle(filter.id)}
          className="flex-shrink-0"
        >
          {filter.icon}
          <span>{filter.label}</span>
        </Button>
      ))}
    </div>
  );
};

export default QuickFilters;
