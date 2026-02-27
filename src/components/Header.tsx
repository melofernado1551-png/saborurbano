import { useState } from "react";
import { MapPin, ShoppingBag, User, Settings, LogOut, Heart } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { Button } from "./ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import CustomerAuthModal from "./customer/CustomerAuthModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface HeaderProps {
  location: string;
  onLocationClick: () => void;
}

const Header = ({ location, onLocationClick }: HeaderProps) => {
  const { user } = useAuth();
  const { customer, session, logout } = useCustomerAuth();
  const navigate = useNavigate();
  const { totalItems, totalPrice, setIsOpen: setCartOpen } = useCart();
  const [authOpen, setAuthOpen] = useState(false);

  const isCustomerLoggedIn = !!session?.user && !!customer;

  return (
    <>
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
            <div className="flex items-center gap-1">
              {user && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => navigate("/admin")}
                  className="gap-2 rounded-xl"
                >
                  <Settings className="w-4 h-4" />
                   Admin
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => navigate("/favoritos")} className="relative">
                <Heart className="w-5 h-5" />
              </Button>
              <Button variant="ghost" className="relative gap-2 px-3" onClick={() => setCartOpen(true)}>
                <ShoppingBag className="w-5 h-5" />
                {totalItems > 0 && (
                  <>
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold">
                      {totalItems}
                    </span>
                    <span className="text-sm font-semibold text-foreground hidden sm:inline">
                      {totalPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </>
                )}
              </Button>

              {isCustomerLoggedIn ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <User className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover z-50">
                    <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                      {customer.name || session.user.email}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/meus-pedidos")}>
                      Meus Pedidos
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => logout()} className="text-destructive">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : user ? (
                <Button variant="ghost" size="icon" onClick={() => toast.info("Você está logado com uma conta administrativa. Use o painel Admin para gerenciar.")}>
                  <User className="w-5 h-5" />
                </Button>
              ) : (
                <Button variant="ghost" size="icon" onClick={() => setAuthOpen(true)}>
                  <User className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <CustomerAuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        tenantId=""
      />
    </>
  );
};

export default Header;
