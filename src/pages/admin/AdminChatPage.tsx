import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Send, ArrowLeft, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";

const STATUS_LABELS: Record<string, { label: string; emoji: string }> = {
  received: { label: "Pedido recebido", emoji: "📥" },
  preparing: { label: "Em preparo", emoji: "👨‍🍳" },
  delivering: { label: "Saiu para entrega", emoji: "🛵" },
  finished: { label: "Finalizado", emoji: "✅" },
};

const FINANCIAL_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  pending: { label: "Pendente", color: "bg-destructive text-destructive-foreground", emoji: "🔴" },
  partial: { label: "Parcial", color: "bg-yellow-500 text-white", emoji: "🟡" },
  paid: { label: "Pago", color: "bg-green-600 text-white", emoji: "🟢" },
};

const OP_STATUSES = [
  { value: "received", label: "Pedido recebido", emoji: "📥" },
  { value: "preparing", label: "Em preparo", emoji: "👨‍🍳" },
  { value: "delivering", label: "Saiu para entrega", emoji: "🛵" },
  { value: "finished", label: "Finalizado", emoji: "✅" },
];

const AdminChatPage = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch chat
  const { data: chat } = useQuery({
    queryKey: ["admin-chat", chatId],
    enabled: !!chatId,
    queryFn: async () => {
      const { data, error } = await supabase.from("chats").select("*").eq("id", chatId!).single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch sale
  const { data: sale } = useQuery({
    queryKey: ["admin-sale", chat?.sale_id],
    enabled: !!chat?.sale_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*").eq("id", chat!.sale_id!).single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch customer info
  const { data: customerInfo } = useQuery({
    queryKey: ["admin-chat-customer", chat?.customer_id],
    enabled: !!chat?.customer_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name, phone, email").eq("id", chat!.customer_id).single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch messages
  const { data: messages = [] } = useQuery({
    queryKey: ["admin-chat-messages", chatId],
    enabled: !!chatId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("chat_id", chatId!)
        .eq("active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Realtime
  useEffect(() => {
    if (!chatId) return;
    const channel = supabase
      .channel(`admin-chat-${chatId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `chat_id=eq.${chatId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-chat-messages", chatId] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sales" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-sale", chat?.sale_id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chatId, chat?.sale_id, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || !chatId) return;
    setSending(true);
    try {
      await supabase.from("chat_messages").insert({
        chat_id: chatId,
        sender_id: user?.id || null,
        sender_type: "tenant",
        content: message.trim(),
        message_type: "text",
      });
      setMessage("");
    } catch {
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const handleUpdateOperationalStatus = async (newStatus: string) => {
    if (!sale) return;
    try {
      await supabase.from("sales").update({ operational_status: newStatus }).eq("id", sale.id);

      const statusInfo = STATUS_LABELS[newStatus] || { label: newStatus, emoji: "📋" };
      await supabase.from("chat_messages").insert({
        chat_id: chatId,
        sender_id: user?.id || null,
        sender_type: "system",
        content: `${statusInfo.emoji} Status atualizado: **${statusInfo.label}**`,
        message_type: "status_update",
      });

      setShowStatusMenu(false);
      toast.success("Status atualizado!");
      queryClient.invalidateQueries({ queryKey: ["admin-sale", sale.id] });
    } catch {
      toast.error("Erro ao atualizar status");
    }
  };

  const operationalStatus = sale ? STATUS_LABELS[sale.operational_status] || { label: sale.operational_status, emoji: "📋" } : null;
  const financialStatus = sale ? FINANCIAL_LABELS[sale.financial_status] || FINANCIAL_LABELS.pending : null;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Chat header */}
      <div className="border-b border-border p-4 bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-foreground flex items-center gap-2">
              {customerInfo?.name || "Cliente"}
              {sale && <span className="text-sm font-normal text-muted-foreground">· Pedido #{sale.sale_number}</span>}
            </h2>
            {customerInfo?.phone && <p className="text-xs text-muted-foreground">{customerInfo.phone}</p>}
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            {financialStatus && (
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${financialStatus.color}`}>
                {financialStatus.emoji} {financialStatus.label}
              </span>
            )}
            {operationalStatus && (
              <div className="relative">
                <button
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  className="px-2.5 py-1 rounded-full bg-secondary text-foreground text-xs font-medium flex items-center gap-1"
                >
                  {operationalStatus.emoji} {operationalStatus.label}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showStatusMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg z-50 py-1 min-w-[180px]">
                    {OP_STATUSES.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => handleUpdateOperationalStatus(s.value)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors flex items-center gap-2 ${
                          sale?.operational_status === s.value ? "font-bold text-primary" : "text-foreground"
                        }`}
                      >
                        {s.emoji} {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {sale?.delivery_address && (
          <div className="mt-2 px-3 py-2 rounded-lg bg-secondary/50 text-xs text-muted-foreground">
            📍 {(sale.delivery_address as any)?.label}: {(sale.delivery_address as any)?.street}, {(sale.delivery_address as any)?.number} — {(sale.delivery_address as any)?.neighborhood}
          </div>
        )}

        {sale && (
          <div className="mt-2 text-xs text-muted-foreground">
            💰 Total: R$ {Number(sale.valor_total).toFixed(2)}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => {
          const isCustomer = msg.sender_type === "customer";
          const isSystem = msg.message_type === "order_summary" || msg.message_type === "address_confirmation" || msg.message_type === "status_update";

          return (
            <div key={msg.id} className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  isSystem
                    ? "bg-accent border border-border text-foreground"
                    : isCustomer
                    ? "bg-card border border-border text-foreground"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                {isCustomer && <p className="text-xs font-semibold text-primary mb-1">{customerInfo?.name || "Cliente"}</p>}
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <p className={`text-[10px] mt-1 ${!isCustomer && !isSystem ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4 bg-card">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Responder ao cliente..."
            className="flex-1 h-10 px-4 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Button size="icon" className="h-10 w-10 rounded-xl" onClick={handleSend} disabled={!message.trim() || sending}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminChatPage;
