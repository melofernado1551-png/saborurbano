import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";

export const useTenantFavorites = () => {
  const { customer, session } = useCustomerAuth();
  const queryClient = useQueryClient();
  const customerId = customer?.id;

  const { data: favoriteTenantIds = new Set<string>(), isLoading } = useQuery({
    queryKey: ["customer-favorite-tenants", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_favorite_tenants")
        .select("tenant_id")
        .eq("customer_id", customerId!)
        .eq("active", true);
      if (error) throw error;
      return new Set((data || []).map((f: any) => f.tenant_id as string));
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: async (tenantId: string) => {
      if (!customerId) throw new Error("not_logged_in");
      const isFav = favoriteTenantIds.has(tenantId);

      if (isFav) {
        await supabase
          .from("customer_favorite_tenants")
          .delete()
          .eq("customer_id", customerId)
          .eq("tenant_id", tenantId);
      } else {
        await supabase
          .from("customer_favorite_tenants")
          .upsert(
            { customer_id: customerId, tenant_id: tenantId, active: true },
            { onConflict: "customer_id,tenant_id" }
          );
      }
    },
    onMutate: async (tenantId: string) => {
      await queryClient.cancelQueries({ queryKey: ["customer-favorite-tenants", customerId] });
      const prev = queryClient.getQueryData<Set<string>>(["customer-favorite-tenants", customerId]);
      queryClient.setQueryData(["customer-favorite-tenants", customerId], () => {
        const next = new Set(prev);
        if (next.has(tenantId)) next.delete(tenantId);
        else next.add(tenantId);
        return next;
      });
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["customer-favorite-tenants", customerId], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-favorite-tenants", customerId] });
      queryClient.invalidateQueries({ queryKey: ["customer-favorite-tenants-full"] });
    },
  });

  const isFavorite = (tenantId: string) => favoriteTenantIds.has(tenantId);
  const isLoggedIn = !!session?.user && !!customer;

  return { isFavorite, toggleFavorite, isLoggedIn, isLoading, favoriteCount: favoriteTenantIds.size };
};
