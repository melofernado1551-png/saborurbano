import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_LABELS: Record<string, { label: string; emoji: string }> = {
  received: { label: "Recebido", emoji: "📥" },
  preparing: { label: "Em preparo", emoji: "👨‍🍳" },
  delivering: { label: "Entrega", emoji: "🛵" },
  finished: { label: "Finalizado", emoji: "✅" },
};

const FINANCIAL_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  pending: { label: "Pendente", color: "bg-destructive text-destructive-foreground", emoji: "🔴" },
  partial: { label: "Parcial", color: "bg-yellow-500 text-white", emoji: "🟡" },
  paid: { label: "Pago", color: "bg-green-600 text-white", emoji: "🟢" },
};

const AdminChatsListPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const tenantId = user?.tenant_id;

  // Realtime: invalidate query when chats change
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel("admin-chats-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chats", filter: `tenant_id=eq.${tenantId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-chats", tenantId] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales", filter: `tenant_id=eq.${tenantId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-chats", tenantId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, queryClient]);
  const { data: chats = [], isLoading } = useQuery({
    queryKey: ["admin-chats", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chats")
        .select("*, customers(name, phone), sales!sales_chat_id_fkey(sale_number, valor_total, financial_status, operational_status)")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-primary" />
          Pedidos / Chats
        </h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : chats.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">💬</div>
          <p className="text-muted-foreground">Nenhum pedido via chat ainda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {chats.map((chat: any) => {
            const customerName = chat.customers?.name || "Cliente";
            const salesArray = chat.sales;
            const sale = Array.isArray(salesArray) ? salesArray[0] : salesArray;
            const financial = sale ? FINANCIAL_LABELS[sale.financial_status] || FINANCIAL_LABELS.pending : null;
            const operational = sale ? STATUS_LABELS[sale.operational_status] || { label: sale.operational_status, emoji: "📋" } : null;

            return (
              <button
                key={chat.id}
                onClick={() => navigate(`/admin/pedidos/${chat.id}`)}
                className="w-full text-left p-4 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-card-hover transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {customerName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">
                        {customerName}
                        {sale?.sale_number && <span className="text-muted-foreground font-normal"> · #{sale.sale_number}</span>}
                      </p>
                      {sale && (
                        <p className="text-xs text-muted-foreground">R$ {Number(sale.valor_total).toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    {operational && (
                      <span className="px-2 py-0.5 rounded-full bg-secondary text-foreground text-xs">
                        {operational.emoji} {operational.label}
                      </span>
                    )}
                    {financial && (
                      <span className={`px-2 py-0.5 rounded-full text-xs ${financial.color}`}>
                        {financial.emoji} {financial.label}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminChatsListPage;
