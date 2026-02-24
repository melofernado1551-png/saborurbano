import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Send, ArrowLeft, ChevronDown, DollarSign, CreditCard, Banknote, QrCode, X } from "lucide-react";
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

const PAYMENT_METHODS = [
  { value: "pix", label: "Pix", icon: QrCode },
  { value: "dinheiro", label: "Dinheiro", icon: Banknote },
  { value: "cartao_credito", label: "Cartão Crédito", icon: CreditCard },
  { value: "cartao_debito", label: "Cartão Débito", icon: CreditCard },
];

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
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [registeringPayment, setRegisteringPayment] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<any[]>([]);
  const [pendingFinishStatus, setPendingFinishStatus] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Fetch payments
  const { data: payments = [] } = useQuery({
    queryKey: ["sale-payments", sale?.id],
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

  // Clear optimistic messages when real messages update
  useEffect(() => {
    if (messages.length > 0) {
      setOptimisticMessages([]);
    }
  }, [messages]);

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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sale_payments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["sale-payments", sale?.id] });
        queryClient.invalidateQueries({ queryKey: ["admin-sale", chat?.sale_id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chatId, chat?.sale_id, sale?.id, queryClient]);

  // Combined messages for display
  const allMessages = [...messages, ...optimisticMessages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length]);

  const handleSend = useCallback(async () => {
    if (!message.trim() || !chatId) return;
    const content = message.trim();
    setMessage("");

    // Optimistic message
    const optimistic = {
      id: `optimistic-${Date.now()}`,
      chat_id: chatId,
      sender_id: user?.id || null,
      sender_type: "tenant",
      content,
      message_type: "text",
      metadata: { sender_name: user?.name || user?.login || "Loja" },
      created_at: new Date().toISOString(),
      active: true,
      _optimistic: true,
    };
    setOptimisticMessages((prev) => [...prev, optimistic]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    setSending(true);
    try {
      const { error } = await supabase.from("chat_messages").insert({
        chat_id: chatId,
        sender_id: user?.id || null,
        sender_type: "tenant",
        content,
        message_type: "text",
        metadata: { sender_name: user?.name || user?.login || "Loja" },
      });
      if (error) throw error;
      // Immediate refetch to ensure message appears
      queryClient.invalidateQueries({ queryKey: ["admin-chat-messages", chatId] });
    } catch {
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      toast.error("Erro ao enviar mensagem");
      setMessage(content); // Restore message
    } finally {
      setSending(false);
    }
  }, [message, chatId, user, queryClient]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    // Auto-resize
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  };

  const handleUpdateOperationalStatus = async (newStatus: string) => {
    if (!sale) return;

    // If "finished", show confirmation dialog first
    if (newStatus === "finished") {
      setShowStatusMenu(false);
      setPendingFinishStatus(true);
      return;
    }

    await executeStatusUpdate(newStatus);
  };

  const executeStatusUpdate = async (newStatus: string) => {
    if (!sale) return;
    try {
      const { error: updateErr } = await supabase.from("sales").update({ operational_status: newStatus }).eq("id", sale.id);
      if (updateErr) throw updateErr;

      const statusInfo = STATUS_LABELS[newStatus] || { label: newStatus, emoji: "📋" };
      const { error: msgErr } = await supabase.from("chat_messages").insert({
        chat_id: chatId,
        sender_id: user?.id || null,
        sender_type: "system",
        content: `${statusInfo.emoji} Status atualizado: **${statusInfo.label}**`,
        message_type: "status_update",
        metadata: { sender_name: user?.name || user?.login || "Sistema" },
      });
      if (msgErr) console.error("Erro ao enviar mensagem de status:", msgErr);

      // If finishing, close the chat
      if (newStatus === "finished" && chatId) {
        await supabase.from("chats").update({ active: false, status: "closed" }).eq("id", chatId);
      }

      setShowStatusMenu(false);
      toast.success(newStatus === "finished" ? "Pedido finalizado e chat encerrado!" : "Status atualizado!");
      queryClient.invalidateQueries({ queryKey: ["admin-sale", sale.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-chat-messages", chatId] });

      if (newStatus === "finished") {
        navigate("/admin/pedidos");
      }
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
      toast.error("Erro ao atualizar status");
    }
  };

  const handleRegisterPayment = async () => {
    if (!sale || !paymentMethod) return;
    const amount = remaining;

    setRegisteringPayment(true);
    try {
      const { error } = await supabase.from("sale_payments").insert({
        sale_id: sale.id,
        tenant_id: sale.tenant_id,
        amount,
        payment_method: paymentMethod,
        registered_by: user?.id || null,
      });
      if (error) throw error;

      const methodLabel = PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label || paymentMethod;
      await supabase.from("chat_messages").insert({
        chat_id: chatId,
        sender_id: user?.id || null,
        sender_type: "system",
        content: `💳 **Pagamento registrado**\nR$ ${amount.toFixed(2)} via ${methodLabel}`,
        message_type: "payment_registered",
        metadata: { sender_name: user?.name || user?.login || "Sistema" },
      });

      setPaymentMethod("");
      setShowPaymentForm(false);
      toast.success("Pagamento registrado!");
    } catch {
      toast.error("Erro ao registrar pagamento");
    } finally {
      setRegisteringPayment(false);
    }
  };

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = sale ? Number(sale.valor_total) - totalPaid : 0;

  const operationalStatus = sale ? STATUS_LABELS[sale.operational_status] || { label: sale.operational_status, emoji: "📋" } : null;
  const financialStatus = sale ? FINANCIAL_LABELS[sale.financial_status] || FINANCIAL_LABELS.pending : null;

  return (
    <div className="flex flex-col -m-4 lg:-m-6 h-[calc(100vh-64px)]">
      {/* Chat header */}
      <div className="border-b border-border p-4 bg-card">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-bold text-foreground flex items-center gap-2">
              {customerInfo?.name || "Cliente"}
              {sale && <span className="text-sm font-normal text-muted-foreground">· Pedido #{sale.sale_number}</span>}
            </h2>
            {sale && (
              <p className="text-xs text-muted-foreground mt-0.5">
                💰 Total: R$ {Number(sale.valor_total).toFixed(2)}
                {totalPaid > 0 && (
                  <>
                    {" "}· Pago: <span className="text-green-600 font-medium">R$ {totalPaid.toFixed(2)}</span>
                    {remaining > 0 && <span className="ml-1 text-destructive">· Falta: R$ {remaining.toFixed(2)}</span>}
                  </>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
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
            {financialStatus && (
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${financialStatus.color}`}>
                {financialStatus.emoji} {financialStatus.label}
              </span>
            )}
            {sale && sale.financial_status !== "paid" && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setShowPaymentForm(!showPaymentForm)}
              >
                <DollarSign className="w-3 h-3" />
                Registrar Pagamento
              </Button>
            )}
          </div>
        </div>

        {sale?.delivery_address && (
          <div className="mt-2 px-3 py-2 rounded-lg bg-secondary/50 text-xs text-muted-foreground">
            📍 {(sale.delivery_address as any)?.label}: {(sale.delivery_address as any)?.street}, {(sale.delivery_address as any)?.number} — {(sale.delivery_address as any)?.neighborhood}
          </div>
        )}

        {/* Payment form */}
        {showPaymentForm && sale && (
          <div className="mt-3 p-3 rounded-xl bg-secondary/50 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Registrar Pagamento</p>
              <button onClick={() => setShowPaymentForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PAYMENT_METHODS.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.value}
                    onClick={() => setPaymentMethod(m.value)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                      paymentMethod === m.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:border-primary/30"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {m.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Valor: <span className="font-semibold text-foreground">R$ {remaining.toFixed(2)}</span>
              </p>
              <Button
                size="sm"
                className="h-9"
                disabled={!paymentMethod || registeringPayment}
                onClick={handleRegisterPayment}
              >
                {registeringPayment ? "..." : "Confirmar"}
              </Button>
            </div>

            {/* Payment history */}
            {payments.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground">Histórico de Pagamentos</p>
                {payments.map((p) => {
                  const methodLabel = PAYMENT_METHODS.find((m) => m.value === p.payment_method)?.label || p.payment_method;
                  return (
                    <div key={p.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-card">
                      <span className="text-foreground font-medium">R$ {Number(p.amount).toFixed(2)}</span>
                      <span className="text-muted-foreground capitalize">{methodLabel}</span>
                      <span className="text-muted-foreground">
                        {new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {allMessages.map((msg) => {
          const isCustomer = msg.sender_type === "customer";
          const isTenant = msg.sender_type === "tenant";
          const isSystem = ["order_summary", "address_confirmation", "status_update", "payment_registered"].includes(msg.message_type);
          const senderName = (msg.metadata as any)?.sender_name;

          return (
            <div key={msg.id} className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}>
              <div className="max-w-[80%]">
                {/* Sender name for store messages */}
                {isTenant && senderName && (
                  <p className="text-[11px] text-muted-foreground mb-0.5 text-right px-1">{senderName}</p>
                )}
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm ${
                    isSystem
                      ? "bg-accent border border-border text-foreground"
                      : isCustomer
                      ? "bg-card border border-border text-foreground"
                      : "bg-primary text-primary-foreground"
                  } ${msg._optimistic ? "opacity-70" : ""}`}
                >
                  {isCustomer && <p className="text-xs font-semibold text-primary mb-1">{customerInfo?.name || "Cliente"}</p>}
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${!isCustomer && !isSystem ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4 bg-card">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder="Responder ao cliente..."
            rows={1}
            className="flex-1 min-h-[40px] max-h-[120px] px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
          <Button size="icon" className="h-10 w-10 rounded-xl flex-shrink-0" onClick={handleSend} disabled={!message.trim() || sending}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Confirmation dialog for finishing */}
      <AlertDialog open={pendingFinishStatus} onOpenChange={setPendingFinishStatus}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja finalizar este pedido e encerrar o chat? Ele não poderá ser reaberto após essa ação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => executeStatusUpdate("finished")}>
              Sim, finalizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminChatPage;
