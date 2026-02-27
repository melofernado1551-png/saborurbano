import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";

export const useFavorites = () => {
  const { customer, session } = useCustomerAuth();
  const queryClient = useQueryClient();
  const customerId = customer?.id;

  const { data: favoriteIds = new Set<string>(), isLoading } = useQuery({
    queryKey: ["customer-favorites", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_favorites" as any)
        .select("product_id")
        .eq("customer_id", customerId!)
        .eq("active", true);
      if (error) throw error;
      return new Set((data || []).map((f: any) => f.product_id as string));
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: async (productId: string) => {
      if (!customerId) throw new Error("not_logged_in");

      const isFav = favoriteIds.has(productId);

      if (isFav) {
        // Remove favorite
        await supabase
          .from("customer_favorites" as any)
          .delete()
          .eq("customer_id", customerId)
          .eq("product_id", productId);
      } else {
        // Add favorite — upsert to handle unique constraint
        await supabase
          .from("customer_favorites" as any)
          .upsert(
            { customer_id: customerId, product_id: productId, active: true },
            { onConflict: "customer_id,product_id" }
          );
      }
    },
    onMutate: async (productId: string) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ["customer-favorites", customerId] });
      const prev = queryClient.getQueryData<Set<string>>(["customer-favorites", customerId]);
      queryClient.setQueryData(["customer-favorites", customerId], () => {
        const next = new Set(prev);
        if (next.has(productId)) {
          next.delete(productId);
        } else {
          next.add(productId);
        }
        return next;
      });
      return { prev };
    },
    onError: (_err, _productId, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["customer-favorites", customerId], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-favorites", customerId] });
      queryClient.invalidateQueries({ queryKey: ["customer-favorites-full"] });
    },
  });

  const isFavorite = (productId: string) => favoriteIds.has(productId);
  const isLoggedIn = !!session?.user && !!customer;

  return { isFavorite, toggleFavorite, isLoggedIn, isLoading, favoriteCount: favoriteIds.size };
};
