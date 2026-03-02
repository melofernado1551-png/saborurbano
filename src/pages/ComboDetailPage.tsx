import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Share2, ShoppingBag, Minus, Plus, Package, Clock, MessageCircle } from "lucide-react";
import { isStoreOpen, formatStoreHours } from "@/lib/storeHours";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";

const ComboDetailPage = () => {
  const { tenantSlug, comboSlug } = useParams<{ tenantSlug: string; comboSlug: string }>();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const [observation, setObservation] = useState("");
  const { addItem, totalItems, totalPrice, setIsOpen: setCartOpen } = useCart();

  // Fetch tenant by slug
  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ["tenant-by-slug", tenantSlug],
    enabled: !!tenantSlug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("slug", tenantSlug!)
        .eq("active", true)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch combo by slug + tenant_id
  const { data: combo, isLoading: comboLoading } = useQuery({
    queryKey: ["combo-by-slug", tenant?.id, comboSlug],
    enabled: !!tenant?.id && !!comboSlug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("combos")
        .select("*, combo_products(product_id, quantity, products(name, price))")
        .eq("tenant_id", tenant!.id)
        .eq("slug", comboSlug!)
        .eq("active", true)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const storeOpen = tenant ? isStoreOpen(tenant.opening_time, tenant.closing_time) : true;
  const hoursLabel = tenant ? formatStoreHours(tenant.opening_time, tenant.closing_time) : "";
  const finalPrice = combo?.promo_price ? Number(combo.promo_price) : Number(combo?.price || 0);

  const comboItems = (combo?.combo_products || [])
    .map((cp: any) => `${cp.quantity}x ${cp.products?.name}`)
    .join(" + ");

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: combo?.name || "", text: `${combo?.name} - ${tenant?.name}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado!");
      }
    } catch { /* cancelled */ }
  };

  const handleShareWhatsApp = () => {
    const url = window.location.href;
    const text = encodeURIComponent(`Confira o combo *${combo?.name}* no *${tenant?.name}*! 🍔📦\n${url}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleAddToCart = () => {
    if (!combo || !tenant) return;
    if (!storeOpen) {
      toast.error("A loja está fechada no momento.");
      return;
    }
    const comboProducts = (combo.combo_products || []).map((cp: any) => ({
      productId: cp.product_id,
      name: cp.products?.name || "",
      quantity: cp.quantity,
    }));
    const trimmedObs = observation.trim();
    const added = addItem(
      {
        productId: `combo_${combo.id}`,
        name: combo.name,
        price: Number(combo.price),
        promoPrice: combo.promo_price ? Number(combo.promo_price) : null,
        imageUrl: combo.image_url || null,
        quantity,
        observation: trimmedObs || undefined,
        isCombo: true,
        comboProducts,
      },
      {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        freeShipping: (tenant as any).free_shipping,
        shippingFee: (tenant as any).shipping_fee ? Number((tenant as any).shipping_fee) : null,
      }
    );
    if (added) {
      toast.success("✔ Combo adicionado ao carrinho");
      setQuantity(1);
      setObservation("");
    }
  };

  const isLoading = tenantLoading || comboLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-5xl animate-pulse">📦</div>
      </div>
    );
  }

  if (!tenant || !combo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-xl font-bold mb-2">Combo não encontrado</h2>
          <p className="text-muted-foreground mb-4">O combo que você procura não existe ou está inativo.</p>
          <Button onClick={() => navigate("/")} variant="outline">Voltar ao início</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate(`/loja/${tenant.slug}`)}
          >
            <div className="w-7 h-7 rounded-full bg-secondary overflow-hidden flex-shrink-0">
              {tenant.logo_url ? (
                <img src={tenant.logo_url} alt={tenant.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                  {tenant.name.charAt(0)}
                </div>
              )}
            </div>
            <h1 className="font-semibold text-foreground truncate text-sm">{tenant.name}</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleShareWhatsApp} className="text-green-500 hover:text-green-600">
              <MessageCircle className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleShare}>
              <Share2 className="w-5 h-5" />
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
          </div>
        </div>
      </header>

      {/* Combo image */}
      <div className="relative w-full h-72 md:h-96 bg-white overflow-hidden">
        {combo.image_url ? (
          <img
            src={combo.image_url}
            alt={combo.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary">
            <Package className="w-20 h-20 text-primary/50" />
          </div>
        )}
        <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center gap-1.5 shadow-md">
          <Package className="w-4 h-4" />
          Combo
        </div>
        {combo.promo_price && (
          <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-destructive text-destructive-foreground text-sm font-bold">
            -{Math.round(((Number(combo.price) - Number(combo.promo_price)) / Number(combo.price)) * 100)}% OFF
          </div>
        )}
      </div>

      {/* Combo info */}
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <h2 className="text-2xl md:text-3xl font-extrabold text-foreground">{combo.name}</h2>

        {combo.description && (
          <p className="text-muted-foreground mt-2">{combo.description}</p>
        )}

        {/* Price */}
        <div className="flex items-center gap-3 mt-4">
          {combo.promo_price ? (
            <>
              <span className="text-3xl font-extrabold text-primary">R$ {Number(combo.promo_price).toFixed(2)}</span>
              <span className="text-lg text-muted-foreground line-through">R$ {Number(combo.price).toFixed(2)}</span>
            </>
          ) : (
            <span className="text-3xl font-extrabold text-foreground">R$ {Number(combo.price).toFixed(2)}</span>
          )}
        </div>

        {/* Combo items */}
        <div className="mt-6">
          <h3 className="text-base font-bold text-foreground mb-3">📦 O que vem no combo</h3>
          <div className="space-y-2">
            {(combo.combo_products || []).map((cp: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/30"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                    {cp.quantity}x
                  </span>
                  <span className="text-sm font-medium text-foreground">{cp.products?.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Observation */}
        <div className="mt-6">
          <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
            Observações (opcional)
          </label>
          <textarea
            value={observation}
            onChange={(e) => setObservation(e.target.value.slice(0, 200))}
            placeholder="Ex: sem cebola, molho à parte..."
            rows={2}
            className="w-full rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
          <span className="text-xs text-muted-foreground mt-1 block text-right">
            {observation.length}/200
          </span>
        </div>

        {/* Quantity + Add to cart */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-3 bg-secondary rounded-xl px-2 py-1">
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <span className="font-bold text-lg w-8 text-center">{quantity}</span>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              onClick={() => setQuantity(quantity + 1)}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {!storeOpen ? (
            <div className="flex-1 flex items-center gap-2 h-12 px-4 rounded-xl bg-destructive/10 border border-destructive/20">
              <Clock className="w-4 h-4 text-destructive shrink-0" />
              <div>
                <p className="text-xs font-semibold text-destructive">Loja fechada</p>
                {hoursLabel && <p className="text-[10px] text-muted-foreground">{hoursLabel}</p>}
              </div>
            </div>
          ) : (
            <Button
              className="flex-1 h-12 gap-2 rounded-xl text-base font-bold"
              onClick={handleAddToCart}
            >
              <ShoppingBag className="w-5 h-5" />
              Adicionar · R$ {(finalPrice * quantity).toFixed(2)}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComboDetailPage;
