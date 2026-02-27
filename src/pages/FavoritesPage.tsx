import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useFavorites } from "@/hooks/useFavorites";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

const FavoritesPage = () => {
  const navigate = useNavigate();
  const { customer, session } = useCustomerAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { addItem, tenantId: cartTenantId } = useCart();
  const isLoggedIn = !!session?.user && !!customer;

  const { data: groupedFavorites = [], isLoading } = useQuery({
    queryKey: ["customer-favorites-full", customer?.id],
    enabled: !!customer?.id,
    queryFn: async () => {
      // Get all favorites
      const { data: favs, error } = await supabase
        .from("customer_favorites" as any)
        .select("product_id, created_at")
        .eq("customer_id", customer!.id)
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!favs?.length) return [];

      const productIds = (favs as any[]).map((f: any) => f.product_id);

      // Fetch products with images
      const { data: products } = await supabase
        .from("products")
        .select("id, name, slug, price, promo_price, has_discount, tenant_id, active")
        .in("id", productIds)
        .eq("active", true);

      if (!products?.length) return [];

      // Fetch images
      const { data: images } = await supabase
        .from("product_images")
        .select("product_id, image_url, position")
        .in("product_id", productIds)
        .eq("active", true)
        .order("position", { ascending: true });

      const imageMap: Record<string, string> = {};
      (images || []).forEach((img) => {
        if (!imageMap[img.product_id]) imageMap[img.product_id] = img.image_url;
      });

      // Fetch tenants
      const tenantIds = [...new Set(products.map((p) => p.tenant_id))];
      const { data: tenants } = await supabase
        .from("tenants")
        .select("id, name, slug, logo_url")
        .in("id", tenantIds)
        .eq("active", true);

      const tenantMap: Record<string, any> = {};
      (tenants || []).forEach((t) => { tenantMap[t.id] = t; });

      // Group by tenant
      const groups: Record<string, { tenant: any; products: any[] }> = {};
      // Maintain favorites order
      const favOrder = new Map((favs as any[]).map((f: any, i: number) => [f.product_id, i]));
      
      const sortedProducts = [...products].sort(
        (a, b) => (favOrder.get(a.id) ?? 999) - (favOrder.get(b.id) ?? 999)
      );

      sortedProducts.forEach((product) => {
        const tenant = tenantMap[product.tenant_id];
        if (!tenant) return;
        if (!groups[product.tenant_id]) {
          groups[product.tenant_id] = { tenant, products: [] };
        }
        groups[product.tenant_id].products.push({
          ...product,
          image_url: imageMap[product.id] || null,
          tenant_slug: tenant.slug,
        });
      });

      return Object.values(groups);
    },
  });

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Heart className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Faça login para ver seus favoritos</h2>
        <Button onClick={() => navigate("/")} variant="outline" className="mt-4">Voltar</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Heart className="w-5 h-5 text-red-500 fill-red-500" />
          <h1 className="font-bold text-foreground text-lg">Meus Favoritos</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {isLoading ? (
          <div className="space-y-6">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-muted" />
                  <div className="h-5 w-32 bg-muted rounded" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2].map((j) => (
                    <div key={j} className="h-48 bg-muted rounded-2xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : groupedFavorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Heart className="w-20 h-20 text-muted-foreground/20 mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-1">Nenhum favorito ainda</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Explore os produtos e toque no ❤️ para salvar seus preferidos
            </p>
            <Button onClick={() => navigate("/")} className="rounded-xl">
              Explorar produtos
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedFavorites.map((group: any) => (
              <section key={group.tenant.id}>
                {/* Tenant header */}
                <button
                  onClick={() => navigate(`/loja/${group.tenant.slug}`)}
                  className="flex items-center gap-3 mb-4 hover:opacity-80 transition-opacity"
                >
                  <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden flex-shrink-0 border-2 border-primary/20">
                    {group.tenant.logo_url ? (
                      <img src={group.tenant.logo_url} alt={group.tenant.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm font-bold text-muted-foreground">
                        {group.tenant.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <h2 className="text-base font-bold text-foreground">{group.tenant.name}</h2>
                </button>

                {/* Product cards grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {group.products.map((product: any) => (
                    <FavoriteCard
                      key={product.id}
                      product={product}
                      isFavorite={isFavorite(product.id)}
                      onToggleFavorite={() => toggleFavorite.mutate(product.id)}
                      onAddToCart={() => {
                        if (cartTenantId && cartTenantId !== product.tenant_id) {
                          toast.error("Seu carrinho possui itens de outra loja. Finalize ou limpe antes.");
                          return;
                        }
                        addItem(
                          {
                            productId: product.id,
                            name: product.name,
                            price: product.price,
                            promoPrice: product.has_discount ? product.promo_price : null,
                            imageUrl: product.image_url,
                          },
                          {
                            id: group.tenant.id,
                            slug: group.tenant.slug,
                            name: group.tenant.name,
                          }
                        );
                        toast.success("Adicionado ao carrinho!");
                      }}
                      onNavigate={() => {
                        const path = product.slug
                          ? `/${product.tenant_slug}/${product.slug}`
                          : `/${product.tenant_slug}/produto/${product.id}`;
                        navigate(path);
                      }}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

interface FavoriteCardProps {
  product: any;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onAddToCart: () => void;
  onNavigate: () => void;
}

const FavoriteCard = ({ product, isFavorite, onToggleFavorite, onAddToCart, onNavigate }: FavoriteCardProps) => {
  return (
    <div
      className="group relative bg-card rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 cursor-pointer"
      onClick={onNavigate}
    >
      {/* Image */}
      <div className="relative h-32 sm:h-40 overflow-hidden bg-white">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🍔</div>
        )}

        {/* Discount badge */}
        {product.has_discount && product.promo_price && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold">
            -{Math.round(((product.price - product.promo_price) / product.price) * 100)}%
          </div>
        )}

        {/* Favorite button */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center hover:scale-110 transition-transform"
        >
          <Heart className={`w-4 h-4 transition-colors ${isFavorite ? "text-red-500 fill-red-500" : "text-muted-foreground"}`} />
        </button>
      </div>

      {/* Content */}
      <div className="p-3">
        <h3 className="text-sm font-bold text-foreground line-clamp-1 mb-1">{product.name}</h3>
        <div className="flex items-center gap-1.5 mb-2">
          {product.has_discount && product.promo_price ? (
            <>
              <span className="text-sm font-bold text-primary">R$ {product.promo_price.toFixed(2)}</span>
              <span className="text-[10px] text-muted-foreground line-through">R$ {product.price.toFixed(2)}</span>
            </>
          ) : (
            <span className="text-sm font-bold text-foreground">R$ {product.price.toFixed(2)}</span>
          )}
        </div>

        {/* Add to cart button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs gap-1 rounded-lg"
          onClick={(e) => { e.stopPropagation(); onAddToCart(); }}
        >
          <Plus className="w-3 h-3" /> Carrinho
        </Button>
      </div>
    </div>
  );
};

export default FavoritesPage;
