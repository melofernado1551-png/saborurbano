import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, MapPin, ChevronDown, Receipt } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, { label: string; emoji: string }> = {
  received: { label: "Pedido recebido", emoji: "📥" },
  preparing: { label: "Em preparo", emoji: "👨‍🍳" },
  delivering: { label: "Saiu para entrega", emoji: "🛵" },
  finished: { label: "Finalizado", emoji: "✅" },
};

const FINANCIAL_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  pending: { label: "Pendente de pagamento", color: "bg-destructive text-destructive-foreground", emoji: "🔴" },
  partial: { label: "Parcialmente pago", color: "bg-yellow-500 text-white", emoji: "🟡" },
  paid: { label: "Pago / Quitado", color: "bg-green-600 text-white", emoji: "🟢" },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
};

const CustomerChatPage = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { customer, session } = useCustomerAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showAddresses, setShowAddresses] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch chat
  const { data: chat } = useQuery({
    queryKey: ["customer-chat", chatId],
    enabled: !!chatId && !!session?.user,
    queryFn: async () => {
      const { data, error } = await supabase.from("chats").select("*").eq("id", chatId!).single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch sale
  const { data: sale } = useQuery({
    queryKey: ["customer-sale", chat?.sale_id],
    enabled: !!chat?.sale_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*").eq("id", chat!.sale_id!).single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch tenant
  const { data: tenant } = useQuery({
    queryKey: ["chat-tenant", chat?.tenant_id],
    enabled: !!chat?.tenant_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("id, name, logo_url, slug").eq("id", chat!.tenant_id).single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch messages
  const { data: messages = [] } = useQuery({
    queryKey: ["chat-messages", chatId],
    enabled: !!chatId && !!session?.user,
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

  // Fetch addresses
  const { data: addresses = [] } = useQuery({
    queryKey: ["customer-addresses-chat", customer?.id],
    enabled: !!customer?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_addresses")
        .select("*")
        .eq("customer_id", customer!.id)
        .eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch payments
  const { data: payments = [] } = useQuery({
    queryKey: ["customer-sale-payments", sale?.id],
    enabled: !!sale?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_payments")
        .select("*")
        .eq("sale_id", sale!.id)
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
      .channel(`chat-${chatId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `chat_id=eq.${chatId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["chat-messages", chatId] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sales", filter: `chat_id=eq.${chatId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["customer-sale", chat?.sale_id] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sale_payments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["customer-sale-payments", sale?.id] });
        queryClient.invalidateQueries({ queryKey: ["customer-sale", chat?.sale_id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chatId, chat?.sale_id, sale?.id, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || !chatId || !customer) return;
    setSending(true);
    try {
      const { error } = await supabase.from("chat_messages").insert({
        chat_id: chatId,
        sender_id: customer.id,
        sender_type: "customer",
        content: message.trim(),
        message_type: "text",
      });
      if (error) throw error;
      setMessage("");
    } catch {
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const handleSelectAddress = async (addr: any) => {
    if (!chatId || !customer || !sale) return;
    try {
      const addressData = {
        label: addr.label,
        street: addr.street,
        number: addr.number,
        complement: addr.complement,
        neighborhood: addr.neighborhood,
        city: addr.city,
        reference: addr.reference,
      };
      await supabase.from("sales").update({ delivery_address: addressData }).eq("id", sale.id);
      const addrText = `${addr.street}, ${addr.number}${addr.complement ? ` - ${addr.complement}` : ""} — ${addr.neighborhood}, ${addr.city}${addr.reference ? ` (Ref: ${addr.reference})` : ""}`;
      await supabase.from("chat_messages").insert({
        chat_id: chatId,
        sender_id: customer.id,
        sender_type: "customer",
        content: `📍 **Endereço de entrega:**\n${addr.label}: ${addrText}`,
        message_type: "address_confirmation",
      });
      setShowAddresses(false);
      toast.success("Endereço confirmado!");
      queryClient.invalidateQueries({ queryKey: ["customer-sale", sale.id] });
    } catch {
      toast.error("Erro ao selecionar endereço");
    }
  };

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = sale ? Number(sale.valor_total) - totalPaid : 0;

  const operationalStatus = sale ? STATUS_LABELS[sale.operational_status] || { label: sale.operational_status, emoji: "📋" } : null;
  const financialStatus = sale ? FINANCIAL_LABELS[sale.financial_status] || FINANCIAL_LABELS.pending : null;

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <p className="text-muted-foreground">Faça login para acessar o chat</p>
          <Button onClick={() => navigate("/")} variant="outline" className="mt-4">Voltar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          {tenant && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden flex-shrink-0">
                {tenant.logo_url ? (
                  <img src={tenant.logo_url} alt={tenant.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-bold text-muted-foreground">
                    {tenant.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h1 className="font-semibold text-sm text-foreground truncate">{tenant.name}</h1>
                {sale && <p className="text-xs text-muted-foreground">Pedido #{sale.sale_number}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Status bar */}
        {sale && (
          <div className="px-4 pb-2 space-y-2">
            <div className="flex gap-2 flex-wrap">
              {operationalStatus && (
                <span className="px-2.5 py-1 rounded-full bg-secondary text-foreground text-xs font-medium">
                  {operationalStatus.emoji} {operationalStatus.label}
                </span>
              )}
              {financialStatus && (
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${financialStatus.color}`}>
                  {financialStatus.emoji} {financialStatus.label}
                </span>
              )}
              {payments.length > 0 && (
                <button
                  onClick={() => setShowPayments(!showPayments)}
                  className="px-2.5 py-1 rounded-full bg-secondary text-foreground text-xs font-medium flex items-center gap-1"
                >
                  <Receipt className="w-3 h-3" />
                  Pagamentos ({payments.length})
                  <ChevronDown className={`w-3 h-3 transition-transform ${showPayments ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>

            {/* Financial summary */}
            {totalPaid > 0 && (
              <div className="text-xs text-muted-foreground px-1">
                💰 Total: R$ {Number(sale.valor_total).toFixed(2)} · Pago: <span className="text-green-600 font-medium">R$ {totalPaid.toFixed(2)}</span>
                {remaining > 0 && <span className="text-destructive ml-1">· Falta: R$ {remaining.toFixed(2)}</span>}
              </div>
            )}

            {/* Payment history dropdown */}
            {showPayments && payments.length > 0 && (
              <div className="space-y-1.5 px-1">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-secondary/50 border border-border">
                    <span className="font-medium text-foreground">R$ {Number(p.amount).toFixed(2)}</span>
                    <span className="text-muted-foreground">{PAYMENT_METHOD_LABELS[p.payment_method] || p.payment_method}</span>
                    <span className="text-muted-foreground">
                      {new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => {
          const isCustomer = msg.sender_type === "customer";
          const isSystem = ["order_summary", "address_confirmation", "status_update", "payment_registered"].includes(msg.message_type);

          return (
            <div key={msg.id} className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  isSystem
                    ? "bg-accent border border-border text-foreground"
                    : isCustomer
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-foreground"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <p className={`text-[10px] mt-1 ${isCustomer ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Address selector */}
      {sale && !sale.delivery_address && addresses.length > 0 && (
        <div className="px-4 pb-2">
          <button
            onClick={() => setShowAddresses(!showAddresses)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-accent border border-border text-sm font-medium text-foreground"
          >
            <span className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Selecionar endereço de entrega
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showAddresses ? "rotate-180" : ""}`} />
          </button>
          {showAddresses && (
            <div className="mt-2 space-y-2">
              {addresses.map((addr) => (
                <button
                  key={addr.id}
                  onClick={() => handleSelectAddress(addr)}
                  className="w-full text-left px-4 py-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors"
                >
                  <p className="font-medium text-sm text-foreground">{addr.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {addr.street}, {addr.number}{addr.complement ? ` - ${addr.complement}` : ""} — {addr.neighborhood}, {addr.city}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {sale?.delivery_address && (
        <div className="px-4 pb-2">
          <div className="px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-sm">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <MapPin className="w-3.5 h-3.5 text-green-600" />
              Endereço confirmado: {(sale.delivery_address as any)?.label}
            </p>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border p-4 bg-card">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Digite sua mensagem..."
            className="flex-1 h-10 px-4 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Button
            size="icon"
            className="h-10 w-10 rounded-xl"
            onClick={handleSend}
            disabled={!message.trim() || sending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CustomerChatPage;
