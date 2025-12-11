import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { Category } from "@/data/mockData";

interface CategoryFilterProps {
  categories: Category[];
  activeCategory: string;
  onCategoryChange: (categoryId: string) => void;
}

const CategoryFilter = ({ categories, activeCategory, onCategoryChange }: CategoryFilterProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="relative">
      {/* Scroll buttons */}
      <button
        onClick={() => scroll("left")}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-card shadow-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors hidden md:flex"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        onClick={() => scroll("right")}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-card shadow-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors hidden md:flex"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Categories */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide py-2 px-1 md:px-10"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {categories.map((category) => (
          <Button
            key={category.id}
            variant={activeCategory === category.id ? "chipActive" : "chip"}
            size="chip"
            onClick={() => onCategoryChange(category.id)}
            className="flex-shrink-0 gap-2"
          >
            <span className="text-base">{category.icon}</span>
            <span>{category.name}</span>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default CategoryFilter;
