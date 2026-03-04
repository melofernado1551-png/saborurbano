import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export interface CartAddon {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  promoPrice: number | null;
  quantity: number;
  imageUrl: string | null;
  observation?: string;
  addons?: CartAddon[];
  cartItemId: string;
  isCombo?: boolean;
  comboProducts?: { productId: string; name: string; quantity: number }[];
}

export interface SelectedAddress {
  id: string;
  label: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  neighborhood_id?: string;
  city: string;
  reference?: string;
  shipping_fee: number | null;
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
  selectedAddress: SelectedAddress | null;
  setSelectedAddress: (address: SelectedAddress | null) => void;
  addItem: (item: Omit<CartItem, "quantity" | "cartItemId"> & { quantity?: number }, tenant: TenantInfo) => boolean;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  updateObservation: (cartItemId: string, observation: string) => void;
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
  freeShipping?: boolean;
  baseShippingFee?: number | null;
  selectedAddress?: SelectedAddress | null;
}

const generateCartItemId = (productId: string, addons?: CartAddon[], observation?: string): string => {
  const addonKey = addons?.map(a => a.id).sort().join(",") || "";
  return `${productId}__${addonKey}__${observation || ""}`;
};

const computeDeliveryFee = (
  address: SelectedAddress | null,
  freeShipping?: boolean,
  baseShippingFee?: number | null,
): number => {
  if (freeShipping) return 0;
  if (baseShippingFee != null && baseShippingFee > 0) return baseShippingFee;
  return address?.shipping_fee ?? 0;
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<StoredCart | null>(() => {
    try {
      const stored = localStorage.getItem(CART_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      if (parsed?.items) {
        parsed.items = parsed.items.map((item: any) => ({
          ...item,
          cartItemId: item.cartItemId || generateCartItemId(item.productId, item.addons, item.observation),
        }));
      }
      return parsed;
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

  const addItem = useCallback(
    (item: Omit<CartItem, "quantity" | "cartItemId"> & { quantity?: number }, tenant: TenantInfo): boolean => {
      if (cart && cart.tenantId !== tenant.id && cart.items.length > 0) {
        setTenantMismatch(true);
        return false;
      }

      const cartItemId = generateCartItemId(item.productId, item.addons, item.observation);

      setCart((prev) => {
        const existing = prev?.items || [];
        const idx = existing.findIndex((i) => i.cartItemId === cartItemId);
        let newItems: CartItem[];

        if (idx >= 0) {
          newItems = existing.map((i, j) =>
            j === idx ? { ...i, quantity: i.quantity + (item.quantity || 1) } : i
          );
        } else {
          newItems = [...existing, { ...item, quantity: item.quantity || 1, cartItemId }];
        }

        const fs = prev?.freeShipping ?? tenant.freeShipping;
        const bsf = prev?.baseShippingFee ?? tenant.shippingFee;
        const addr = prev?.selectedAddress || null;

        return {
          tenantId: prev?.tenantId || tenant.id,
          tenantSlug: prev?.tenantSlug || tenant.slug,
          tenantName: prev?.tenantName || tenant.name,
          items: newItems,
          deliveryFee: computeDeliveryFee(addr, fs, bsf),
          freeShipping: fs,
          baseShippingFee: bsf,
          selectedAddress: addr,
        };
      });
      return true;
    },
    [cart]
  );

  const setSelectedAddress = useCallback((address: SelectedAddress | null) => {
    setCart((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        selectedAddress: address,
        deliveryFee: computeDeliveryFee(address, prev.freeShipping, prev.baseShippingFee),
      };
    });
  }, []);

  const removeItem = useCallback((cartItemId: string) => {
    setCart((prev) => {
      if (!prev) return null;
      const newItems = prev.items.filter((i) => i.cartItemId !== cartItemId);
      if (newItems.length === 0) return null;
      return { ...prev, items: newItems };
    });
  }, []);

  const updateQuantity = useCallback((cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(cartItemId);
      return;
    }
    setCart((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        items: prev.items.map((i) => (i.cartItemId === cartItemId ? { ...i, quantity } : i)),
      };
    });
  }, [removeItem]);

  const updateObservation = useCallback((cartItemId: string, observation: string) => {
    setCart((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        items: prev.items.map((i) => (i.cartItemId === cartItemId ? { ...i, observation } : i)),
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
    const basePrice = i.promoPrice ?? i.price;
    const addonsTotal = i.addons?.reduce((a, addon) => a + addon.price, 0) || 0;
    return sum + (basePrice + addonsTotal) * i.quantity;
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
        selectedAddress: cart?.selectedAddress || null,
        setSelectedAddress,
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
