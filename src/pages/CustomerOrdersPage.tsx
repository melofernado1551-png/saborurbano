import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

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
        .select("*, tenants(name, slug), chat_messages(content)")
        .eq("customer_id", customer!.id)
        .eq("active", true)
        .eq("chat_messages.message_type", "order_summary")
        .order("updated_at", { ascending: false });
      if (error) throw error;

      // Fetch sales separately via chat_id
      const chatIds = data.map((c: any) => c.id);
      const { data: sales } = await supabase
        .from("sales")
        .select("chat_id, sale_number, valor_total, financial_status, operational_status")
        .in("chat_id", chatIds);

      const salesMap: Record<string, any> = {};
      sales?.forEach((s: any) => { salesMap[s.chat_id] = s; });

      // Extract product names from messages, fetch products with images
      const allProductNames: string[] = [];
      const tenantIds = new Set<string>();
      data.forEach((chat: any) => {
        tenantIds.add(chat.tenant_id);
        const msg = chat.chat_messages?.[0]?.content || "";
        msg.split("\n").filter((l: string) => l.startsWith("•")).forEach((line: string) => {
          const match = line.match(/•\s*\d+x\s+(.+?)\s*—/);
          if (match) allProductNames.push(match[1].trim());
        });
      });

      // Fetch products with first image
      let productsMap: Record<string, string> = {};
      if (allProductNames.length > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("name, product_images(image_url, position)")
          .in("tenant_id", Array.from(tenantIds))
          .in("name", allProductNames)
          .eq("product_images.active", true)
          .order("position", { referencedTable: "product_images", ascending: true });
        
        products?.forEach((p: any) => {
          const img = p.product_images?.[0]?.image_url;
          if (img) productsMap[p.name] = img;
        });
      }

      return data.map((chat: any) => ({
        ...chat,
        _sale: salesMap[chat.id] || null,
        _productsMap: productsMap,
      }));
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
            const sale = chat._sale;
            const tenant = chat.tenants;
            const operational = sale ? STATUS_LABELS[sale.operational_status] || { label: sale.operational_status, emoji: "📋" } : null;
            const isPaid = sale?.financial_status === "paid";
            const valorTotal = sale ? Number(sale.valor_total) : 0;

            // Extract product names from order_summary
            const orderMsg = chat.chat_messages?.[0]?.content || "";
            const productNames = orderMsg
              .split("\n")
              .filter((line: string) => line.startsWith("•"))
              .map((line: string) => {
                const match = line.match(/•\s*\d+x\s+(.+?)\s*—/);
                return match ? match[1].trim() : null;
              })
              .filter(Boolean) as string[];

            const firstProductName = productNames[0] || "Pedido";
            const firstProductImage = chat._productsMap?.[firstProductName] || null;
            const extraCount = productNames.length > 1 ? productNames.length - 1 : 0;

            return (
              <button
                key={chat.id}
                onClick={() => navigate(`/chat/${chat.id}`)}
                className="w-full text-left p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  {/* Product image */}
                  <div className="w-12 h-12 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                    {firstProductImage ? (
                      <img src={firstProductImage} alt={firstProductName} className="w-full h-full object-contain bg-white" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg">🍽️</div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-foreground truncate">
                      {firstProductName}
                      {extraCount > 0 && <span className="font-normal text-muted-foreground"> +{extraCount}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tenant?.name || "Restaurante"}
                      {sale?.sale_number && <span> · #{sale.sale_number}</span>}
                    </p>
                  </div>

                  {/* Right: value + status */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {sale && (
                      <span className={`text-sm font-semibold ${isPaid ? "text-green-600" : "text-foreground"}`}>
                        R$ {valorTotal.toFixed(2)}
                      </span>
                    )}
                    {operational && (
                      <span className="px-2 py-0.5 rounded-full bg-secondary text-foreground text-xs flex items-center gap-1">
                        {operational.emoji} {operational.label}
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
