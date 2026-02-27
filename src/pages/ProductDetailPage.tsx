import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSwipe } from "@/hooks/useSwipe";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Share2, ShoppingBag, Minus, Plus, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCart, CartAddon } from "@/contexts/CartContext";

const ProductDetailPage = () => {
  const { tenantSlug, productSlug } = useParams<{ tenantSlug: string; productSlug: string }>();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const [observation, setObservation] = useState("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<CartAddon[]>([]);
  const { addItem, totalItems, totalPrice, setIsOpen: setCartOpen } = useCart();

  const changeImage = (next: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentImageIndex(next);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 200);
  };

  const imageSwipe = useSwipe({
    onSwipeLeft: () => changeImage(currentImageIndex === (images?.length || 1) - 1 ? 0 : currentImageIndex + 1),
    onSwipeRight: () => changeImage(currentImageIndex === 0 ? (images?.length || 1) - 1 : currentImageIndex - 1),
  });

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

  // Fetch product by slug + tenant_id
  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ["product-by-slug", tenant?.id, productSlug],
    enabled: !!tenant?.id && !!productSlug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .eq("slug", productSlug!)
        .eq("active", true)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch product images
  const { data: images = [] } = useQuery({
    queryKey: ["product-images", product?.id],
    enabled: !!product?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_images")
        .select("image_url, position")
        .eq("product_id", product!.id)
        .eq("active", true)
        .order("position", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch product addons
  const { data: addons = [] } = useQuery({
    queryKey: ["product-addons", product?.id],
    enabled: !!product?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_addons")
        .select("id, name, price, position")
        .eq("product_id", product!.id)
        .eq("active", true)
        .order("position");
      if (error) throw error;
      return data;
    },
  });

  // Fetch stock
  const { data: stock } = useQuery({
    queryKey: ["product-stock", product?.id],
    enabled: !!product?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_stock")
        .select("quantity")
        .eq("product_id", product!.id)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const mainImage = images[0]?.image_url || null;
  const outOfStock = stock !== null && stock !== undefined && stock.quantity <= 0;
  const basePrice = product?.has_discount && product?.promo_price ? Number(product.promo_price) : Number(product?.price || 0);
  const addonsTotal = selectedAddons.reduce((sum, a) => sum + a.price, 0);
  const finalUnitPrice = basePrice + addonsTotal;

  const toggleAddon = (addon: { id: string; name: string; price: number }) => {
    setSelectedAddons((prev) => {
      const exists = prev.find((a) => a.id === addon.id);
      if (exists) return prev.filter((a) => a.id !== addon.id);
      return [...prev, { id: addon.id, name: addon.name, price: Number(addon.price) }];
    });
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: product?.name || "", text: `${product?.name} - ${tenant?.name}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado!");
      }
    } catch { /* cancelled */ }
  };

  const isLoading = tenantLoading || productLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-5xl animate-pulse">🍽️</div>
      </div>
    );
  }

  if (!tenant || !product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-xl font-bold mb-2">Produto não encontrado</h2>
          <p className="text-muted-foreground mb-4">O produto que você procura não existe ou está inativo.</p>
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

      {/* Product image */}
      <div
        className="relative w-full h-72 md:h-96 bg-white overflow-hidden"
        onTouchStart={imageSwipe.onTouchStart}
        onTouchEnd={imageSwipe.onTouchEnd}
      >
        {images.length > 0 ? (
          <>
            <img
              src={images[currentImageIndex]?.image_url}
              alt={product.name}
              className={`w-full h-full object-contain transition-opacity duration-300 ease-in-out ${isTransitioning ? "opacity-0" : "opacity-100"}`}
            />
            {images.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-card/80 backdrop-blur-sm hover:bg-card shadow-md"
                  onClick={() => changeImage(currentImageIndex === 0 ? images.length - 1 : currentImageIndex - 1)}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-card/80 backdrop-blur-sm hover:bg-card shadow-md"
                  onClick={() => changeImage(currentImageIndex === images.length - 1 ? 0 : currentImageIndex + 1)}
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      className={`w-2 h-2 rounded-full transition-all ${i === currentImageIndex ? "bg-primary w-4" : "bg-card/70"}`}
                      onClick={() => setCurrentImageIndex(i)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-7xl">🍔</div>
        )}
        {product.has_discount && product.promo_price && (
          <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-destructive text-destructive-foreground text-sm font-bold">
            -{Math.round(((Number(product.price) - Number(product.promo_price)) / Number(product.price)) * 100)}% OFF
          </div>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-foreground/60 flex items-center justify-center">
            <span className="px-4 py-2 rounded-full bg-card text-foreground font-semibold">Indisponível</span>
          </div>
        )}
      </div>

      {/* Product info */}
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <h2 className="text-2xl md:text-3xl font-extrabold text-foreground">{product.name}</h2>

        {product.description && (
          <p className="text-muted-foreground mt-2">{product.description}</p>
        )}

        {/* Price */}
        <div className="flex items-center gap-3 mt-4">
          {product.has_discount && product.promo_price ? (
            <>
              <span className="text-3xl font-extrabold text-primary">R$ {Number(product.promo_price).toFixed(2)}</span>
              <span className="text-lg text-muted-foreground line-through">R$ {Number(product.price).toFixed(2)}</span>
            </>
          ) : (
            <span className="text-3xl font-extrabold text-foreground">R$ {Number(product.price).toFixed(2)}</span>
          )}
        </div>

        {/* Addons section */}
        {addons.length > 0 && !outOfStock && (
          <div className="mt-6">
            <h3 className="text-base font-bold text-foreground mb-3">✨ Personalize seu pedido</h3>
            <div className="space-y-2">
              {addons.map((addon) => {
                const isSelected = selectedAddons.some((a) => a.id === addon.id);
                return (
                  <button
                    key={addon.id}
                    type="button"
                    onClick={() => toggleAddon(addon)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border bg-secondary/30 hover:bg-secondary/60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <span className={`text-sm font-medium ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                        {addon.name}
                      </span>
                    </div>
                    <span className={`text-sm font-bold ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                      +R$ {Number(addon.price).toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Price breakdown */}
            {selectedAddons.length > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-secondary/50 space-y-1">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Preço base</span>
                  <span>R$ {basePrice.toFixed(2)}</span>
                </div>
                {selectedAddons.map((a) => (
                  <div key={a.id} className="flex justify-between text-sm text-muted-foreground">
                    <span>+ {a.name}</span>
                    <span>R$ {a.price.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold text-foreground border-t border-border pt-1">
                  <span>Valor unitário</span>
                  <span>R$ {finalUnitPrice.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Observation */}
        {!outOfStock && (
          <div className="mt-6">
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
              Observações (opcional)
            </label>
            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value.slice(0, 200))}
              placeholder="Ex: sem cebola, bem passado, molho à parte..."
              rows={2}
              className="w-full rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
            <span className="text-xs text-muted-foreground mt-1 block text-right">
              {observation.length}/200
            </span>
          </div>
        )}

        {/* Quantity + Add to cart */}
        {!outOfStock && (
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

            <Button
              className="flex-1 h-12 gap-2 rounded-xl text-base font-bold"
              disabled={outOfStock}
              onClick={() => {
                const trimmedObs = observation.trim();
                const added = addItem(
                  {
                    productId: product.id,
                    name: product.name,
                    price: Number(product.price),
                    promoPrice: product.promo_price ? Number(product.promo_price) : null,
                    imageUrl: mainImage,
                    quantity,
                    observation: trimmedObs || undefined,
                    addons: selectedAddons.length > 0 ? selectedAddons : undefined,
                  },
                  { id: tenant.id, slug: tenant.slug, name: tenant.name, freeShipping: (tenant as any).free_shipping, shippingFee: (tenant as any).shipping_fee ? Number((tenant as any).shipping_fee) : null }
                );
                if (added) {
                  toast.success("✔ Produto adicionado ao carrinho");
                  setQuantity(1);
                  setObservation("");
                  setSelectedAddons([]);
                }
              }}
            >
              <ShoppingBag className="w-5 h-5" />
              Adicionar · R$ {(finalUnitPrice * quantity).toFixed(2)}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDetailPage;
