import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "./ui/button";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onFilterClick: () => void;
}

const SearchBar = ({ value, onChange, onFilterClick }: SearchBarProps) => {
  return (
    <div className="flex gap-3 w-full">
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Buscar restaurantes ou pratos..."
          className="w-full h-12 pl-12 pr-4 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-card"
        />
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={onFilterClick}
        className="h-12 w-12 rounded-xl border-2 hover:border-primary hover:bg-primary/5"
      >
        <SlidersHorizontal className="w-5 h-5" />
      </Button>
    </div>
  );
};

export default SearchBar;
