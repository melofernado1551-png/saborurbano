import { Share2 } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface ProductCardProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promo_price: number | null;
  has_discount: boolean;
  image_url: string | null;
  tenant_name: string;
  tenant_logo: string | null;
  tenant_slug: string;
}

interface ProductCardProps {
  product: ProductCardProduct;
  index: number;
}

const ProductCard = ({ product, index }: ProductCardProps) => {
  const navigate = useNavigate();
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/${product.tenant_slug}/produto/${product.id}`;
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
    <div
      className="group relative bg-card rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 cursor-pointer animate-fade-in"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Image */}
      <div className="relative h-44 overflow-hidden bg-secondary">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
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

        {/* Share button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleShare}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-card/90 backdrop-blur-sm hover:bg-card"
        >
          <Share2 className="w-4 h-4" />
        </Button>
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
            navigate(`/restaurante/${product.tenant_slug}`);
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
  );
};

export default ProductCard;
export type { ProductCardProduct };
