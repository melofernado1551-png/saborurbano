import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { Minus, Plus, Trash2, ShoppingBag, MessageCircle } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import CustomerAuthModal from "@/components/customer/CustomerAuthModal";

const CartDrawer = () => {
  const {
    items,
    tenantId,
    tenantSlug,
    tenantName,
    totalItems,
    totalPrice,
    removeItem,
    updateQuantity,
    updateObservation,
    clearCart,
    isOpen,
    setIsOpen,
  } = useCart();
  const { customer, session, getOrCreateCustomerForTenant } = useCustomerAuth();
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleCheckout = async () => {
    if (!session?.user) {
      setShowAuthModal(true);
      return;
    }

    if (!tenantId) return;

    // Ensure customer exists for this tenant
    let cust = customer;
    if (!cust || cust.tenant_id !== tenantId) {
      cust = await getOrCreateCustomerForTenant(tenantId);
    }

    if (!cust) {
      toast.error("Erro ao vincular cliente ao estabelecimento.");
      return;
    }

    setCheckoutLoading(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) throw new Error("Sessão expirada");

      const response = await supabase.functions.invoke("create-checkout", {
        body: {
          tenant_id: tenantId,
          items: items.map((i) => ({
            productId: i.productId,
            name: i.name,
            price: i.price,
            promoPrice: i.promoPrice,
            quantity: i.quantity,
            observation: i.observation,
          })),
        },
      });

      if (response.error) throw new Error(response.error.message || "Erro no checkout");
      const result = response.data;

      if (!result?.success) throw new Error(result?.error || "Erro ao criar pedido");

      clearCart();
      setIsOpen(false);
      toast.success(`Pedido #${result.sale_number} criado!`);
      navigate(`/chat/${result.chat_id}`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao finalizar pedido");
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (items.length === 0 && !isOpen) return null;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-primary" />
                Carrinho
                {tenantName && (
                  <span className="text-sm font-normal text-muted-foreground">· {tenantName}</span>
                )}
              </SheetTitle>
              {items.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearCart} className="text-destructive hover:text-destructive text-xs">
                  Limpar
                </Button>
              )}
            </div>
          </SheetHeader>

          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="text-5xl mb-4">🛒</div>
              <p className="text-muted-foreground font-medium">Seu carrinho está vazio</p>
              <p className="text-sm text-muted-foreground mt-1">Adicione produtos para fazer um pedido</p>
            </div>
          ) : (
            <>
              {/* Items list */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {items.map((item) => {
                  const unitPrice = item.promoPrice ?? item.price;
                  return (
                    <div key={item.productId} className="flex gap-3 p-3 bg-secondary/50 rounded-xl">
                      {/* Image */}
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-secondary flex-shrink-0">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">🍔</div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-foreground line-clamp-1">{item.name}</h4>
                        <p className="text-sm font-bold text-primary mt-0.5">
                          R$ {unitPrice.toFixed(2)}
                        </p>

                        {/* Observation */}
                        <input
                          type="text"
                          placeholder="Obs: sem cebola..."
                          value={item.observation || ""}
                          onChange={(e) => updateObservation(item.productId, e.target.value)}
                          className="w-full mt-1.5 text-xs px-2 py-1 rounded-md bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                          onClick={(e) => e.stopPropagation()}
                        />

                        {/* Quantity controls */}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                              className="w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center hover:bg-secondary transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-bold text-sm w-6 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                              className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground">
                              R$ {(unitPrice * item.quantity).toFixed(2)}
                            </span>
                            <button
                              onClick={() => removeItem(item.productId)}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="border-t border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{totalItems} {totalItems === 1 ? "item" : "itens"}</span>
                  <span className="text-xl font-extrabold text-foreground">R$ {totalPrice.toFixed(2)}</span>
                </div>
                <Button
                  className="w-full h-12 rounded-xl gap-2 text-base font-bold"
                  onClick={handleCheckout}
                  disabled={checkoutLoading}
                >
                  <MessageCircle className="w-5 h-5" />
                  {checkoutLoading ? "Processando..." : "Finalizar Pedido"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Auth modal for checkout */}
      {showAuthModal && tenantId && (
        <CustomerAuthModal
          tenantId={tenantId}
          open={showAuthModal}
          onOpenChange={setShowAuthModal}
        />
      )}
    </>
  );
};

export default CartDrawer;
