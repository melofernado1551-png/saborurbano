import { useState } from "react";
import { Share2, Heart } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useFavorites } from "@/hooks/useFavorites";
import CustomerAuthModal from "./customer/CustomerAuthModal";
interface ProductCardProduct {
  id: string;
  name: string;
  slug?: string;
  description: string | null;
  price: number;
  promo_price: number | null;
  has_discount: boolean;
  image_url: string | null;
  tenant_name: string;
  tenant_logo: string | null;
  tenant_slug: string;
}

interface BadgeTag {
  emoji: string;
  name: string;
  slug: string;
}

interface ProductCardProps {
  product: ProductCardProduct;
  index: number;
  badgeTag?: BadgeTag | null;
}

const ProductCard = ({ product, index, badgeTag }: ProductCardProps) => {
  const { isFavorite, toggleFavorite, isLoggedIn } = useFavorites();
  const [authOpen, setAuthOpen] = useState(false);
  const fav = isFavorite(product.id);

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn) {
      setAuthOpen(true);
      return;
    }
    toggleFavorite.mutate(product.id);
  };

  const navigate = useNavigate();
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const productPath = product.slug ? `/${product.tenant_slug}/${product.slug}` : `/${product.tenant_slug}/produto/${product.id}`;
    const url = `${window.location.origin}${productPath}`;
    const shareData = {
      title: product.name,
      text: `Confira ${product.name} em ${product.tenant_name}!`,
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado!");
      }
    } catch {
      // user cancelled share
    }
  };

    return (
    <>
    <div
      className="group relative bg-card rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 cursor-pointer animate-fade-in"
      onClick={() => {
        const path = product.slug ? `/${product.tenant_slug}/${product.slug}` : `/${product.tenant_slug}/produto/${product.id}`;
        navigate(path);
      }}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Image */}
      <div className="relative h-44 overflow-hidden bg-white">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">
            🍔
          </div>
        )}

        {/* Discount badge */}
        {product.has_discount && product.promo_price && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-destructive text-destructive-foreground text-xs font-semibold">
            -{Math.round(((product.price - product.promo_price) / product.price) * 100)}%
          </div>
        )}

        {/* Tag badge */}
        {badgeTag && !product.has_discount && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
            {badgeTag.emoji} {badgeTag.name}
          </div>
        )}

        {/* Share & Favorite buttons */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <button
            onClick={handleFavorite}
            className="w-8 h-8 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center hover:scale-110 transition-transform"
          >
            <Heart className={`w-4 h-4 transition-colors ${fav ? "text-red-500 fill-red-500" : "text-muted-foreground"}`} />
          </button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleShare}
            className="w-8 h-8 rounded-full bg-card/90 backdrop-blur-sm hover:bg-card"
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors mb-1">
          {product.name}
        </h3>

        {product.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
            {product.description}
          </p>
        )}

        {/* Price */}
        <div className="flex items-center gap-2 mb-3">
          {product.has_discount && product.promo_price ? (
            <>
              <span className="text-lg font-bold text-primary">
                R$ {product.promo_price.toFixed(2)}
              </span>
              <span className="text-sm text-muted-foreground line-through">
                R$ {product.price.toFixed(2)}
              </span>
            </>
          ) : (
            <span className="text-lg font-bold text-foreground">
              R$ {product.price.toFixed(2)}
            </span>
          )}
        </div>

        {/* Tenant info */}
        <div
          className="flex items-center gap-2 pt-2 border-t border-border cursor-pointer hover:opacity-80 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/loja/${product.tenant_slug}`);
          }}
        >
          <div className="w-6 h-6 rounded-full bg-secondary overflow-hidden flex-shrink-0">
            {product.tenant_logo ? (
              <img
                src={product.tenant_logo}
                alt={product.tenant_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                {product.tenant_name.charAt(0)}
              </div>
            )}
          </div>
          <span className="text-xs text-muted-foreground truncate">
            {product.tenant_name}
          </span>
        </div>
      </div>
    </div>
    <CustomerAuthModal open={authOpen} onOpenChange={setAuthOpen} tenantId="" />
    </>
  );
};

export default ProductCard;
export type { ProductCardProduct };
