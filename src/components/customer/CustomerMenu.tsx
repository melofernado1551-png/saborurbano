import { useState } from "react";
import { User, MapPin, LogOut, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import CustomerAuthModal from "./CustomerAuthModal";
import CustomerAddressesModal from "./CustomerAddressesModal";

interface CustomerMenuProps {
  tenantId: string;
}

const CustomerMenu = ({ tenantId }: CustomerMenuProps) => {
  const { customer, session, logout } = useCustomerAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [addressesOpen, setAddressesOpen] = useState(false);

  const isLoggedIn = !!session?.user && !!customer;

  if (!isLoggedIn) {
    return (
      <>
        <Button variant="ghost" size="icon" onClick={() => setAuthOpen(true)}>
          <User className="w-5 h-5" />
        </Button>
        <CustomerAuthModal open={authOpen} onOpenChange={setAuthOpen} tenantId={tenantId} />
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
              {customer.name?.charAt(0)?.toUpperCase() || "C"}
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-3 py-2">
            <p className="text-sm font-semibold truncate">{customer.name}</p>
            <p className="text-xs text-muted-foreground truncate">{customer.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setAddressesOpen(true)} className="gap-2 cursor-pointer">
            <MapPin className="w-4 h-4" /> Meus Endereços
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="gap-2 cursor-pointer text-destructive">
            <LogOut className="w-4 h-4" /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CustomerAddressesModal open={addressesOpen} onOpenChange={setAddressesOpen} />
    </>
  );
};

export default CustomerMenu;
