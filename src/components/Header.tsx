import { MapPin, ShoppingBag, User, Menu, Settings } from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "./ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";

interface HeaderProps {
  location: string;
  onLocationClick: () => void;
}

const Header = ({ location, onLocationClick }: HeaderProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { totalItems, setIsOpen: setCartOpen } = useCart();

  return (
    <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <img src={logo} alt="Sabor Urbano" className="w-10 h-10 rounded-xl object-cover" />
            <span className="text-xl font-bold text-foreground hidden sm:block">
              Sabor<span className="text-primary"> Urbano</span>
            </span>
          </div>

          {/* Location */}
          <button 
            onClick={onLocationClick}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors flex-1 max-w-xs"
          >
            <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-sm font-medium truncate">{location}</span>
          </button>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {user && (
              <Button
                variant="default"
                size="sm"
                onClick={() => navigate("/admin")}
                className="gap-2 rounded-xl"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Administração</span>
              </Button>
            )}
            <Button variant="ghost" size="icon" className="relative" onClick={() => setCartOpen(true)}>
              <ShoppingBag className="w-5 h-5" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold">
                  {totalItems}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="icon" className="hidden sm:flex">
              <User className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="sm:hidden">
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
