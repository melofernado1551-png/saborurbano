import { Star, Clock, MapPin, Heart, Sparkles } from "lucide-react";
import { Restaurant } from "@/data/mockData";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface RestaurantCardProps {
  restaurant: Restaurant;
  index: number;
}

const RestaurantCard = ({ restaurant, index }: RestaurantCardProps) => {
  const [isFavorite, setIsFavorite] = useState(restaurant.isFavorite);
  const navigate = useNavigate();

  return (
    <div
      className="group relative bg-card rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 cursor-pointer animate-fade-in"
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={() => restaurant.slug && navigate(`/restaurante/${restaurant.slug}`)}
    >
      {/* Image */}
      <div className="relative h-44 overflow-hidden">
        <img
          src={restaurant.image}
          alt={restaurant.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent" />

        {/* Promoted badge */}
        {restaurant.promoted && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Destaque
          </div>
        )}

        {/* Favorite button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsFavorite(!isFavorite);
          }}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center hover:scale-110 transition-transform"
        >
          <Heart
            className={`w-4 h-4 transition-colors ${
              isFavorite ? "fill-destructive text-destructive" : "text-foreground"
            }`}
          />
        </button>

        {/* Closed overlay */}
        {!restaurant.isOpen && (
          <div className="absolute inset-0 bg-foreground/70 flex items-center justify-center">
            <span className="px-4 py-2 rounded-full bg-card text-foreground font-semibold text-sm">
              Fechado agora
            </span>
          </div>
        )}

        {/* Delivery info overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-primary-foreground">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Clock className="w-4 h-4" />
            {restaurant.deliveryTime}
          </div>
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <MapPin className="w-4 h-4" />
            {restaurant.distance} km
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            {restaurant.name}
          </h3>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Star className="w-4 h-4 fill-warning text-warning" />
            <span className="text-sm font-semibold">{restaurant.rating}</span>
            <span className="text-xs text-muted-foreground">({restaurant.reviewCount})</span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {restaurant.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-md bg-secondary text-xs font-medium text-secondary-foreground"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {restaurant.deliveryFee === 0 ? (
              <span className="text-success font-semibold">Entrega grátis</span>
            ) : (
              `Entrega R$ ${restaurant.deliveryFee.toFixed(2)}`
            )}
          </span>
          <span className="text-muted-foreground">
            Mín. R$ {restaurant.minOrder}
          </span>
        </div>
      </div>
    </div>
  );
};

export default RestaurantCard;
