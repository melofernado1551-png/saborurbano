import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageCircle } from "lucide-react";

const FINANCIAL_LABELS: Record<string, { color: string; emoji: string }> = {
  pending: { color: "bg-destructive text-destructive-foreground", emoji: "🔴" },
  partial: { color: "bg-yellow-500 text-white", emoji: "🟡" },
  paid: { color: "bg-green-600 text-white", emoji: "🟢" },
};

const STATUS_LABELS: Record<string, { label: string; emoji: string }> = {
  received: { label: "Recebido", emoji: "📥" },
  preparing: { label: "Em preparo", emoji: "👨‍🍳" },
  delivering: { label: "Entrega", emoji: "🛵" },
  finished: { label: "Finalizado", emoji: "✅" },
};

const CustomerOrdersPage = () => {
  const { customer, session } = useCustomerAuth();
  const navigate = useNavigate();

  const { data: chats = [], isLoading } = useQuery({
    queryKey: ["my-chats", customer?.id],
    enabled: !!customer?.id && !!session?.user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chats")
        .select("*, sales(sale_number, valor_total, financial_status, operational_status), tenants(name, logo_url, slug)")
        .eq("customer_id", customer!.id)
        .eq("active", true)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <p className="text-muted-foreground">Faça login para ver seus pedidos</p>
          <Button onClick={() => navigate("/")} variant="outline" className="mt-4">Voltar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-foreground">Meus Pedidos</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-3">
        {isLoading ? (
          <div className="text-center py-12"><div className="text-5xl animate-pulse">📋</div></div>
        ) : chats.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-muted-foreground">Nenhum pedido ainda</p>
          </div>
        ) : (
          chats.map((chat: any) => {
            const sale = chat.sales;
            const tenant = chat.tenants;
            const financial = sale ? FINANCIAL_LABELS[sale.financial_status] || FINANCIAL_LABELS.pending : null;
            const operational = sale ? STATUS_LABELS[sale.operational_status] || { label: sale.operational_status, emoji: "📋" } : null;

            return (
              <button
                key={chat.id}
                onClick={() => navigate(`/chat/${chat.id}`)}
                className="w-full text-left p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden flex-shrink-0">
                      {tenant?.logo_url ? (
                        <img src={tenant.logo_url} alt={tenant.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-muted-foreground">
                          {tenant?.name?.charAt(0) || "?"}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">
                        {tenant?.name || "Restaurante"}
                        {sale?.sale_number && <span className="text-muted-foreground font-normal"> · #{sale.sale_number}</span>}
                      </p>
                      {sale && <p className="text-xs text-muted-foreground">R$ {Number(sale.valor_total).toFixed(2)}</p>}
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
                        {financial.emoji}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CustomerOrdersPage;
