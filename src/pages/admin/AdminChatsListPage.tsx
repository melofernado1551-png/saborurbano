import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const KANBAN_COLUMNS = [
  { key: "received", label: "Aguardando", emoji: "📥", color: "border-t-blue-500" },
  { key: "preparing", label: "Em preparo", emoji: "👨‍🍳", color: "border-t-yellow-500" },
  { key: "delivering", label: "Saiu p/ entrega", emoji: "🛵", color: "border-t-orange-500" },
  { key: "finished", label: "Finalizado", emoji: "✅", color: "border-t-green-600" },
];

const FINANCIAL_LABELS: Record<string, { label: string; dotClass: string }> = {
  pending: { label: "Pendente", dotClass: "bg-destructive" },
  partial: { label: "Parcial", dotClass: "bg-yellow-500" },
  paid: { label: "Pago", dotClass: "bg-green-600" },
};

const MAX_FINISHED = 20;

const AdminChatsListPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = user?.tenant_id;

  // Realtime
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel("admin-chats-kanban")
      .on("postgres_changes", { event: "*", schema: "public", table: "chats", filter: `tenant_id=eq.${tenantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-chats-kanban", tenantId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sales", filter: `tenant_id=eq.${tenantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-chats-kanban", tenantId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, queryClient]);

  const { data: chats = [], isLoading } = useQuery({
    queryKey: ["admin-chats-kanban", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chats")
        .select("*, customers(name, phone), sales!sales_chat_id_fkey(sale_number, valor_total, financial_status, operational_status, created_at)")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Group chats by operational status
  const grouped: Record<string, any[]> = { received: [], preparing: [], delivering: [], finished: [] };
  chats.forEach((chat: any) => {
    const salesArr = chat.sales;
    const sale = Array.isArray(salesArr) ? salesArr[0] : salesArr;
    const status = sale?.operational_status || "received";
    if (grouped[status]) {
      grouped[status].push(chat);
    } else {
      grouped["received"].push(chat);
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-primary" />
          Pedidos / Kanban
        </h1>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {KANBAN_COLUMNS.map((col) => {
            const items = grouped[col.key] || [];
            const isFinished = col.key === "finished";
            const displayItems = isFinished ? items.slice(0, MAX_FINISHED) : items;

            return (
              <div key={col.key} className={`bg-muted/50 rounded-xl border-t-4 ${col.color} flex flex-col min-h-[300px]`}>
                {/* Column header */}
                <div className="p-3 flex items-center justify-between border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{col.emoji}</span>
                    <span className="font-semibold text-sm text-foreground">{col.label}</span>
                  </div>
                  <span className="text-xs font-medium bg-secondary text-secondary-foreground rounded-full px-2 py-0.5">
                    {items.length}
                  </span>
                </div>

                {/* Cards */}
                <ScrollArea className="flex-1 p-2">
                  <div className="space-y-2">
                    {displayItems.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-6">Nenhum pedido</p>
                    )}
                    {displayItems.map((chat: any) => (
                      <KanbanCard key={chat.id} chat={chat} onClick={() => navigate(`/admin/pedidos/${chat.id}`)} />
                    ))}
                  </div>

                  {isFinished && items.length > MAX_FINISHED && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2 text-xs text-muted-foreground"
                      onClick={() => navigate("/admin/pedidos/finalizados")}
                    >
                      Ver todos os {items.length} finalizados →
                    </Button>
                  )}
                </ScrollArea>

                {isFinished && items.length > 0 && (
                  <div className="p-2 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => navigate("/admin/pedidos/finalizados")}
                    >
                      Ver todos finalizados
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const KanbanCard = ({ chat, onClick }: { chat: any; onClick: () => void }) => {
  const salesArr = chat.sales;
  const sale = Array.isArray(salesArr) ? salesArr[0] : salesArr;
  const customerName = chat.customers?.name || "Cliente";
  const financial = sale ? FINANCIAL_LABELS[sale.financial_status] || FINANCIAL_LABELS.pending : null;
  const saleTime = sale?.created_at ? format(new Date(sale.created_at), "HH:mm") : format(new Date(chat.created_at), "HH:mm");

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg bg-card border border-border hover:border-primary/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
            {customerName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm text-foreground truncate">{customerName}</p>
            {sale?.sale_number && (
              <p className="text-xs text-muted-foreground">#{sale.sale_number}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <Clock className="w-3 h-3" />
          {saleTime}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        {sale && (
          <span className="text-sm font-semibold text-foreground">
            R$ {Number(sale.valor_total).toFixed(2)}
          </span>
        )}
        {financial && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${financial.dotClass}`} />
            {financial.label}
          </span>
        )}
      </div>
    </button>
  );
};

export default AdminChatsListPage;
