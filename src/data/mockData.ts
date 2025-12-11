export interface Restaurant {
  id: string;
  name: string;
  image: string;
  category: string;
  rating: number;
  reviewCount: number;
  deliveryTime: string;
  deliveryFee: number;
  minOrder: number;
  distance: number;
  isOpen: boolean;
  isFavorite: boolean;
  tags: string[];
  promoted?: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  count: number;
}

export const categories: Category[] = [
  { id: "all", name: "Todos", icon: "🍽️", count: 156 },
  { id: "pizza", name: "Pizza", icon: "🍕", count: 24 },
  { id: "burger", name: "Hambúrguer", icon: "🍔", count: 32 },
  { id: "japanese", name: "Japonesa", icon: "🍱", count: 18 },
  { id: "brazilian", name: "Brasileira", icon: "🍛", count: 28 },
  { id: "dessert", name: "Sobremesas", icon: "🍰", count: 22 },
  { id: "healthy", name: "Saudável", icon: "🥗", count: 16 },
  { id: "chinese", name: "Chinesa", icon: "🥡", count: 12 },
  { id: "mexican", name: "Mexicana", icon: "🌮", count: 8 },
  { id: "drinks", name: "Bebidas", icon: "🥤", count: 14 },
];

export const restaurants: Restaurant[] = [
  {
    id: "1",
    name: "Pizzaria Bella Napoli",
    image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop",
    category: "pizza",
    rating: 4.8,
    reviewCount: 523,
    deliveryTime: "30-45 min",
    deliveryFee: 5.99,
    minOrder: 25,
    distance: 1.2,
    isOpen: true,
    isFavorite: false,
    tags: ["Pizza", "Italiana"],
    promoted: true,
  },
  {
    id: "2",
    name: "Burger House Premium",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop",
    category: "burger",
    rating: 4.6,
    reviewCount: 892,
    deliveryTime: "25-35 min",
    deliveryFee: 4.99,
    minOrder: 20,
    distance: 0.8,
    isOpen: true,
    isFavorite: true,
    tags: ["Hambúrguer", "Americana"],
  },
  {
    id: "3",
    name: "Sushi Zen Master",
    image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&h=300&fit=crop",
    category: "japanese",
    rating: 4.9,
    reviewCount: 1247,
    deliveryTime: "40-55 min",
    deliveryFee: 7.99,
    minOrder: 40,
    distance: 2.5,
    isOpen: true,
    isFavorite: false,
    tags: ["Japonesa", "Sushi"],
    promoted: true,
  },
  {
    id: "4",
    name: "Sabor da Fazenda",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop",
    category: "brazilian",
    rating: 4.5,
    reviewCount: 678,
    deliveryTime: "35-50 min",
    deliveryFee: 3.99,
    minOrder: 30,
    distance: 1.8,
    isOpen: true,
    isFavorite: false,
    tags: ["Brasileira", "Caseira"],
  },
  {
    id: "5",
    name: "Doce Encanto",
    image: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&h=300&fit=crop",
    category: "dessert",
    rating: 4.7,
    reviewCount: 445,
    deliveryTime: "20-30 min",
    deliveryFee: 2.99,
    minOrder: 15,
    distance: 0.5,
    isOpen: true,
    isFavorite: true,
    tags: ["Sobremesas", "Doces"],
  },
  {
    id: "6",
    name: "Green Bowl Fit",
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop",
    category: "healthy",
    rating: 4.4,
    reviewCount: 289,
    deliveryTime: "25-40 min",
    deliveryFee: 4.49,
    minOrder: 25,
    distance: 1.5,
    isOpen: true,
    isFavorite: false,
    tags: ["Saudável", "Vegano"],
  },
  {
    id: "7",
    name: "Dragon Palace",
    image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400&h=300&fit=crop",
    category: "chinese",
    rating: 4.3,
    reviewCount: 567,
    deliveryTime: "35-45 min",
    deliveryFee: 5.49,
    minOrder: 30,
    distance: 2.1,
    isOpen: false,
    isFavorite: false,
    tags: ["Chinesa", "Asiática"],
  },
  {
    id: "8",
    name: "Taco Loco",
    image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop",
    category: "mexican",
    rating: 4.6,
    reviewCount: 334,
    deliveryTime: "30-40 min",
    deliveryFee: 4.99,
    minOrder: 22,
    distance: 1.3,
    isOpen: true,
    isFavorite: false,
    tags: ["Mexicana", "Tacos"],
  },
];
