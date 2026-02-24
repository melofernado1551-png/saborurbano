import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  received: "📥 Recebido",
  preparing: "👨‍🍳 Em preparo",
  delivering: "🛵 Saiu para entrega",
  finished: "✅ Finalizado",
};

const FINANCIAL_LABELS: Record<string, string> = {
  pending: "🔴 Pagamento pendente",
  partial: "🟡 Parcialmente pago",
  paid: "🟢 Pago / Quitado",
};

const playNotificationSound = () => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    // Pleasant two-tone notification
    osc.type = "sine";
    osc.frequency.setValueAtTime(587, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(784, ctx.currentTime + 0.15); // G5
    
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Audio not available
  }
};

const OrderStatusNotifier = () => {
  const { customer } = useCustomerAuth();
  const previousStates = useRef<Record<string, { operational: string; financial: string }>>({});

  useEffect(() => {
    if (!customer?.id) return;

    // First, load current states to avoid showing notifications on mount
    const loadInitialStates = async () => {
      const { data: chats } = await supabase
        .from("chats")
        .select("sale_id")
        .eq("customer_id", customer.id)
        .eq("active", true);

      if (!chats?.length) return;
      
      const saleIds = chats.map((c: any) => c.sale_id).filter(Boolean);
      if (!saleIds.length) return;

      const { data: sales } = await supabase
        .from("sales")
        .select("id, operational_status, financial_status, sale_number")
        .in("id", saleIds);

      sales?.forEach((s: any) => {
        previousStates.current[s.id] = {
          operational: s.operational_status,
          financial: s.financial_status,
        };
      });
    };

    loadInitialStates();

    // Subscribe to realtime changes on sales
    const channel = supabase
      .channel("customer-order-status")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sales",
        },
        (payload) => {
          const sale = payload.new as any;
          const prev = previousStates.current[sale.id];

          if (!prev) {
            // Not tracking this sale
            previousStates.current[sale.id] = {
              operational: sale.operational_status,
              financial: sale.financial_status,
            };
            return;
          }

          const messages: string[] = [];

          if (prev.operational !== sale.operational_status) {
            const label = STATUS_LABELS[sale.operational_status] || sale.operational_status;
            messages.push(label);
          }

          if (prev.financial !== sale.financial_status) {
            const label = FINANCIAL_LABELS[sale.financial_status] || sale.financial_status;
            messages.push(label);
          }

          if (messages.length > 0) {
            playNotificationSound();
            
            toast(
              `Pedido #${sale.sale_number || ""}`,
              {
                description: messages.join(" · "),
                duration: 6000,
                position: "top-center",
                className: "!bg-card !border-primary/30 !shadow-lg",
              }
            );
          }

          // Update tracked state
          previousStates.current[sale.id] = {
            operational: sale.operational_status,
            financial: sale.financial_status,
          };
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customer?.id]);

  return null;
};

export default OrderStatusNotifier;
