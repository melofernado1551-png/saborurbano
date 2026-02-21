import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Share2, ShoppingBag, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ProductDetailPage = () => {
  const { tenantSlug, productSlug } = useParams<{ tenantSlug: string; productSlug: string }>();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);

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
        .select("image_url")
        .eq("product_id", product!.id)
        .eq("active", true);
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
  const finalPrice = product?.has_discount && product?.promo_price ? Number(product.promo_price) : Number(product?.price || 0);

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
          <h1 className="font-semibold text-foreground truncate text-sm">{tenant.name}</h1>
          <Button variant="ghost" size="icon" onClick={handleShare}>
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Product image */}
      <div className="relative w-full h-64 md:h-80 bg-secondary overflow-hidden">
        {mainImage ? (
          <img src={mainImage} alt={product.name} className="w-full h-full object-cover" />
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
        {/* Tenant info */}
        <div
          className="flex items-center gap-2 mb-4 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigate(`/restaurante/${tenant.slug}`)}
        >
          <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden flex-shrink-0">
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm font-bold text-muted-foreground">
                {tenant.name.charAt(0)}
              </div>
            )}
          </div>
          <span className="text-sm text-muted-foreground">{tenant.name}</span>
        </div>

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

        {/* Quantity + Add to cart (prepared for future) */}
        {!outOfStock && (
          <div className="flex items-center gap-4 mt-8">
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

            <Button className="flex-1 h-12 gap-2 rounded-xl text-base font-bold" disabled={outOfStock}>
              <ShoppingBag className="w-5 h-5" />
              Adicionar · R$ {(finalPrice * quantity).toFixed(2)}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDetailPage;
