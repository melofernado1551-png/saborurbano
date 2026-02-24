import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  promoPrice: number | null;
  quantity: number;
  imageUrl: string | null;
  observation?: string;
}

interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  freeShipping?: boolean;
  shippingFee?: number | null;
}

interface CartContextType {
  items: CartItem[];
  tenantId: string | null;
  tenantSlug: string | null;
  tenantName: string | null;
  totalItems: number;
  subtotal: number;
  deliveryFee: number;
  totalPrice: number;
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }, tenant: TenantInfo) => boolean;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateObservation: (productId: string, observation: string) => void;
  clearCart: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  tenantMismatch: boolean;
  dismissMismatch: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};

const CART_KEY = "sabor_urbano_cart";

interface StoredCart {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  items: CartItem[];
  deliveryFee: number;
}

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<StoredCart | null>(() => {
    try {
      const stored = localStorage.getItem(CART_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isOpen, setIsOpen] = useState(false);
  const [tenantMismatch, setTenantMismatch] = useState(false);

  useEffect(() => {
    if (cart && cart.items.length > 0) {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } else {
      localStorage.removeItem(CART_KEY);
    }
  }, [cart]);

  const dismissMismatch = useCallback(() => setTenantMismatch(false), []);

  const computeDeliveryFee = (tenant: TenantInfo): number => {
    if (tenant.freeShipping) return 0;
    if (tenant.shippingFee != null && tenant.shippingFee > 0) return tenant.shippingFee;
    return 0;
  };

  const addItem = useCallback(
    (item: Omit<CartItem, "quantity"> & { quantity?: number }, tenant: TenantInfo): boolean => {
      // Block if cart belongs to a different tenant
      if (cart && cart.tenantId !== tenant.id && cart.items.length > 0) {
        setTenantMismatch(true);
        return false;
      }

      setCart((prev) => {
        const existing = prev?.items || [];
        const idx = existing.findIndex(
          (i) => i.productId === item.productId && (i.observation || "") === (item.observation || "")
        );
        let newItems: CartItem[];

        if (idx >= 0) {
          newItems = existing.map((i, j) =>
            j === idx ? { ...i, quantity: i.quantity + (item.quantity || 1) } : i
          );
        } else {
          newItems = [...existing, { ...item, quantity: item.quantity || 1 }];
        }

        return {
          tenantId: prev?.tenantId || tenant.id,
          tenantSlug: prev?.tenantSlug || tenant.slug,
          tenantName: prev?.tenantName || tenant.name,
          items: newItems,
          deliveryFee: prev?.deliveryFee ?? computeDeliveryFee(tenant),
        };
      });
      return true;
    },
    [cart]
  );

  const removeItem = useCallback((productId: string) => {
    setCart((prev) => {
      if (!prev) return null;
      const newItems = prev.items.filter((i) => i.productId !== productId);
      if (newItems.length === 0) return null;
      return { ...prev, items: newItems };
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setCart((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        items: prev.items.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
      };
    });
  }, [removeItem]);

  const updateObservation = useCallback((productId: string, observation: string) => {
    setCart((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        items: prev.items.map((i) => (i.productId === productId ? { ...i, observation } : i)),
      };
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart(null);
    setIsOpen(false);
  }, []);

  const items = cart?.items || [];
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => {
    const unitPrice = i.promoPrice ?? i.price;
    return sum + unitPrice * i.quantity;
  }, 0);
  const deliveryFee = cart?.deliveryFee ?? 0;
  const totalPrice = subtotal + deliveryFee;

  return (
    <CartContext.Provider
      value={{
        items,
        tenantId: cart?.tenantId || null,
        tenantSlug: cart?.tenantSlug || null,
        tenantName: cart?.tenantName || null,
        totalItems,
        subtotal,
        deliveryFee,
        totalPrice,
        addItem,
        removeItem,
        updateQuantity,
        updateObservation,
        clearCart,
        isOpen,
        setIsOpen,
        tenantMismatch,
        dismissMismatch,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
