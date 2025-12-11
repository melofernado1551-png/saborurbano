import { X, Star, Clock, Truck, DollarSign } from "lucide-react";
import { Button } from "./ui/button";

interface FilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  filters: {
    rating: number;
    deliveryTime: string;
    freeDelivery: boolean;
    priceRange: string;
  };
  onFiltersChange: (filters: any) => void;
}

const FilterSheet = ({ isOpen, onClose, filters, onFiltersChange }: FilterSheetProps) => {
  const deliveryTimes = [
    { label: "Qualquer", value: "any" },
    { label: "Até 30 min", value: "30" },
    { label: "Até 45 min", value: "45" },
    { label: "Até 60 min", value: "60" },
  ];

  const priceRanges = [
    { label: "Qualquer", value: "any" },
    { label: "$", value: "1" },
    { label: "$$", value: "2" },
    { label: "$$$", value: "3" },
  ];

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 animate-slide-in-right max-h-[85vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Filtros</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Rating */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-warning" />
              Avaliação mínima
            </h3>
            <div className="flex gap-2">
              {[0, 3, 3.5, 4, 4.5].map((rating) => (
                <Button
                  key={rating}
                  variant={filters.rating === rating ? "chipActive" : "chip"}
                  size="chip"
                  onClick={() => onFiltersChange({ ...filters, rating })}
                >
                  {rating === 0 ? "Todas" : `${rating}+`}
                </Button>
              ))}
            </div>
          </div>

          {/* Delivery Time */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Tempo de entrega
            </h3>
            <div className="flex flex-wrap gap-2">
              {deliveryTimes.map((time) => (
                <Button
                  key={time.value}
                  variant={filters.deliveryTime === time.value ? "chipActive" : "chip"}
                  size="chip"
                  onClick={() => onFiltersChange({ ...filters, deliveryTime: time.value })}
                >
                  {time.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Free Delivery */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Truck className="w-4 h-4 text-success" />
              Entrega grátis
            </h3>
            <Button
              variant={filters.freeDelivery ? "chipActive" : "chip"}
              size="chip"
              onClick={() => onFiltersChange({ ...filters, freeDelivery: !filters.freeDelivery })}
            >
              Apenas entrega grátis
            </Button>
          </div>

          {/* Price Range */}
          <div className="mb-8">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              Faixa de preço
            </h3>
            <div className="flex gap-2">
              {priceRanges.map((range) => (
                <Button
                  key={range.value}
                  variant={filters.priceRange === range.value ? "chipActive" : "chip"}
                  size="chip"
                  onClick={() => onFiltersChange({ ...filters, priceRange: range.value })}
                >
                  {range.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onFiltersChange({
                rating: 0,
                deliveryTime: "any",
                freeDelivery: false,
                priceRange: "any",
              })}
            >
              Limpar filtros
            </Button>
            <Button
              variant="hero"
              className="flex-1"
              onClick={onClose}
            >
              Aplicar
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default FilterSheet;
