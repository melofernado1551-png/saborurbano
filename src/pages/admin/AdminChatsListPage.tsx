import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Clock, CalendarIcon, Monitor, X, Printer, UtensilsCrossed, Truck, User, DollarSign } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { notifyCustomer } from "@/lib/notifyCustomer";

const KANBAN_COLUMNS = [
  { key: "received", label: "Aguardando", emoji: "📥", color: "border-t-blue-500" },
  { key: "preparing", label: "Em preparo", emoji: "👨‍🍳", color: "border-t-yellow-500" },
  { key: "ready", label: "Pronto", emoji: "✅", color: "border-t-green-500" },
  { key: "delivering_pending", label: "Aguard. confirmação", emoji: "📦", color: "border-t-purple-500" },
  { key: "delivering", label: "Saiu p/ entrega", emoji: "🛵", color: "border-t-orange-500" },
  { key: "finished", label: "Finalizado", emoji: "✅", color: "border-t-green-600" },
  { key: "cancelled", label: "Cancelado", emoji: "❌", color: "border-t-red-500" },
];

const STATUS_LABELS: Record<string, { label: string; emoji: string }> = {
  received: { label: "Pedido recebido", emoji: "📥" },
  preparing: { label: "Em preparo", emoji: "👨‍🍳" },
  ready: { label: "Pronto", emoji: "✅" },
  delivering: { label: "Saiu para entrega", emoji: "🛵" },
  delivering_pending: { label: "Aguardando confirmação", emoji: "📦" },
  finished: { label: "Finalizado", emoji: "✅" },
  cancelled: { label: "Cancelado", emoji: "❌" },
};

const FINANCIAL_LABELS: Record<string, { label: string; dotClass: string }> = {
  pending: { label: "Pendente", dotClass: "bg-destructive" },
  awaiting_check: { label: "Aguardando conferência", dotClass: "bg-yellow-500" },
  partial: { label: "Parcial", dotClass: "bg-yellow-500" },
  paid: { label: "Pago", dotClass: "bg-green-600" },
};

const MAX_FINISHED = 20;

const AdminChatsListPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = user?.tenant_id;

  // TV mode
  const [tvMode, setTvMode] = useState(false);
  // Tipo pedido filter
  const [tipoPedidoFilter, setTipoPedidoFilter] = useState<"todos" | "delivery" | "mesa">("todos");

  // Drag state
  const [draggedChat, setDraggedChat] = useState<any>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [selectedMesaSale, setSelectedMesaSale] = useState<any>(null);
  // Confirmation dialog
  const [pendingMove, setPendingMove] = useState<{ chat: any; toStatus: string } | null>(null);
  // Finished/cancelled column date range filter (defaults to today)
  const [finishedDateFrom, setFinishedDateFrom] = useState<Date>(new Date());
  const [finishedDateTo, setFinishedDateTo] = useState<Date>(new Date());
  // Track unread chats
  const [viewedChats, setViewedChats] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("viewed-chats");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload: any) => {
        if (payload.new?.sender_type === "customer") {
          const chatId = payload.new.chat_id;
          setViewedChats((prev) => {
            const next = new Set(prev);
            next.delete(chatId);
            const arr = Array.from(next);
            localStorage.setItem("viewed-chats", JSON.stringify(arr));
            return next;
          });
          queryClient.invalidateQueries({ queryKey: ["admin-chats-kanban", tenantId] });

          // Play notification sound for new customer message
          try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = "sine";
            osc.frequency.setValueAtTime(587, ctx.currentTime);
            osc.frequency.setValueAtTime(784, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.4);
          } catch { /* Audio not available */ }

          const preview = payload.new.content?.length > 60
            ? payload.new.content.substring(0, 60) + "…"
            : payload.new.content;
          toast("💬 Nova mensagem do cliente", {
            description: preview || "Você recebeu uma nova mensagem",
            duration: 5000,
            position: "top-center",
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, queryClient]);

  // Fetch tenant config for require_paid_for_delivery
  const { data: tenantConfig } = useQuery({
    queryKey: ["tenant-config", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("require_paid_for_delivery").eq("id", tenantId!).single();
      if (error) throw error;
      return data;
    },
  });
  const requirePaidForDelivery = tenantConfig?.require_paid_for_delivery !== false;

  const { data: chats = [], isLoading } = useQuery({
    queryKey: ["admin-chats-kanban", tenantId, finishedDateFrom.toDateString(), finishedDateTo.toDateString()],
    enabled: !!tenantId,
    queryFn: async () => {
      // Fetch active chats (non-finished, non-cancelled)
      const { data: activeChats, error: err1 } = await supabase
        .from("chats")
        .select("*, customers(name, phone), sales!sales_chat_id_fkey(id, sale_number, valor_total, financial_status, operational_status, created_at, tipo_pedido, numero_mesa)")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .order("updated_at", { ascending: false });
      if (err1) throw err1;

      // Fetch closed chats (finished + cancelled) for the selected date range
      const selectedStart = new Date(finishedDateFrom);
      selectedStart.setHours(0, 0, 0, 0);
      const selectedEnd = new Date(finishedDateTo);
      selectedEnd.setHours(23, 59, 59, 999);
      const { data: closedChats, error: err2 } = await supabase
        .from("chats")
        .select("*, customers(name, phone), sales!sales_chat_id_fkey(id, sale_number, valor_total, financial_status, operational_status, created_at, cancel_reason, canceled_by, tipo_pedido, numero_mesa)")
        .eq("tenant_id", tenantId!)
        .eq("active", false)
        .eq("status", "closed")
        .gte("updated_at", selectedStart.toISOString())
        .lte("updated_at", selectedEnd.toISOString())
        .order("updated_at", { ascending: false })
        .limit(MAX_FINISHED * 2);
      if (err2) throw err2;

      // Fetch mesa sales WITHOUT chat (they don't go through chat flow)
      const existingChatSaleIds = new Set<string>();
      [...(activeChats || []), ...(closedChats || [])].forEach((chat: any) => {
        const salesArr = chat.sales;
        const sale = Array.isArray(salesArr) ? salesArr[0] : salesArr;
        if (sale?.id) existingChatSaleIds.add(sale.id);
      });

      const { data: mesaSales, error: err3 } = await supabase
        .from("sales")
        .select("id, sale_number, valor_total, financial_status, operational_status, created_at, tipo_pedido, numero_mesa, customer_id, representante, garcom_nome")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .eq("tipo_pedido", "mesa")
        .is("chat_id", null)
        .order("created_at", { ascending: false });
      if (err3) throw err3;

      // Convert mesa sales to chat-like objects for unified rendering
      const mesaChatLike = (mesaSales || []).map((sale: any) => ({
        id: `mesa-sale-${sale.id}`,
        tenant_id: tenantId,
        customer_id: sale.customer_id,
        status: "open",
        active: !["finished", "cancelled"].includes(sale.operational_status),
        created_at: sale.created_at,
        updated_at: sale.created_at,
        customers: { name: sale.representante ? `${sale.representante} - Mesa ${sale.numero_mesa}` : `Mesa ${sale.numero_mesa}`, phone: null },
        sales: sale,
        _isMesaSale: true,
      }));

      return [...(activeChats || []), ...(closedChats || []), ...mesaChatLike];
    },
  });

  // Fetch last customer message per chat for unread detection
  const { data: lastCustomerMessages = [] } = useQuery({
    queryKey: ["admin-chats-last-customer-msg", tenantId],
    enabled: !!tenantId && chats.length > 0,
    queryFn: async () => {
      const chatIds = chats.map((c: any) => c.id);
      const { data, error } = await supabase
        .from("chat_messages")
        .select("chat_id, sender_type, created_at")
        .in("chat_id", chatIds)
        .eq("sender_type", "customer")
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((m: any) => {
        if (!map[m.chat_id]) map[m.chat_id] = m.created_at;
      });
      return map;
    },
  });

  const hasUnread = useCallback((chatId: string) => {
    return !!(lastCustomerMessages as any)[chatId] && !viewedChats.has(chatId);
  }, [lastCustomerMessages, viewedChats]);

  const markAsViewed = useCallback((chatId: string) => {
    setViewedChats((prev) => {
      const next = new Set(prev);
      next.add(chatId);
      localStorage.setItem("viewed-chats", JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  // Group chats by operational status
  const grouped: Record<string, any[]> = { received: [], preparing: [], ready: [], delivering: [], delivering_pending: [], finished: [], cancelled: [] };
  chats.forEach((chat: any) => {
    const salesArr = chat.sales;
    const sale = Array.isArray(salesArr) ? salesArr[0] : salesArr;
    // Filter by tipo_pedido
    if (tipoPedidoFilter !== "todos") {
      const tipo = sale?.tipo_pedido || "delivery";
      if (tipo !== tipoPedidoFilter) return;
    }
    const status = sale?.operational_status || "received";
    if (grouped[status]) {
      grouped[status].push(chat);
    } else {
      grouped["received"].push(chat);
    }
  });

  // Drag handlers
  const handleDragStart = (chat: any) => {
    setDraggedChat(chat);
  };

  const handleDragOver = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    setDropTarget(colKey);
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = (colKey: string) => {
    setDropTarget(null);
    if (!draggedChat) return;
    const salesArr = draggedChat.sales;
    const sale = Array.isArray(salesArr) ? salesArr[0] : salesArr;
    const currentStatus = sale?.operational_status || "received";
    if (currentStatus === colKey) {
      setDraggedChat(null);
      return;
    }
    // Don't allow drag to cancelled column (use modal instead)
    if (colKey === "cancelled") {
      toast.error("Use o botão de cancelar no chat do pedido.");
      setDraggedChat(null);
      return;
    }
    // Don't allow drag to delivering_pending (requires code validation in chat)
    if (colKey === "delivering_pending") {
      toast.error("Use a validação de código no chat do pedido.");
      setDraggedChat(null);
      return;
    }
    // Block delivering if require_paid_for_delivery is on and not paid
    if (colKey === "delivering" && requirePaidForDelivery) {
      const financialStatus = sale?.financial_status || "pending";
      if (financialStatus !== "paid") {
        toast.error("O pedido precisa estar pago antes de sair para entrega.");
        setDraggedChat(null);
        return;
      }
    }
    // Don't allow drag from cancelled, finished, or delivering_pending
    if (currentStatus === "cancelled" || currentStatus === "finished" || currentStatus === "delivering_pending") {
      toast.error("Pedidos finalizados, cancelados ou aguardando confirmação não podem ser movidos.");
      setDraggedChat(null);
      return;
    }
    setPendingMove({ chat: draggedChat, toStatus: colKey });
    setDraggedChat(null);
  };

  const handleConfirmMove = async () => {
    if (!pendingMove || !user) return;
    const { chat, toStatus } = pendingMove;
    const salesArr = chat.sales;
    const sale = Array.isArray(salesArr) ? salesArr[0] : salesArr;
    if (!sale) {
      toast.error("Pedido sem venda associada");
      setPendingMove(null);
      return;
    }
    // Double-check payment requirement before delivering
    if (toStatus === "delivering" && requirePaidForDelivery && sale.financial_status !== "paid") {
      toast.error("O pedido precisa estar pago antes de sair para entrega.");
      setPendingMove(null);
      return;
    }

    try {
      const updateData: any = { operational_status: toStatus };

      // If moving to delivering, record entregador info
      if (toStatus === "delivering" && user) {
        updateData.entregador_id = user.id;
        updateData.entregador_nome = user.name || user.login;
        updateData.hora_saida_entrega = new Date().toISOString();
      }

      // If moving to finished from delivering, record delivery time
      if (toStatus === "finished" && sale.operational_status === "delivering") {
        updateData.hora_entrega = new Date().toISOString();
      }

      const { error: updateErr } = await supabase.from("sales").update(updateData).eq("id", sale.id);
      if (updateErr) throw updateErr;

      // Custom message for delivering
      let statusMessage: string;
      if (toStatus === "delivering" && user) {
        statusMessage = `🛵 Seu pedido saiu para entrega com ${user.name || user.login || "Entregador"}`;
      } else {
        const statusInfo = STATUS_LABELS[toStatus] || { label: toStatus, emoji: "📋" };
        statusMessage = `${statusInfo.emoji} Status atualizado: **${statusInfo.label}**`;
      }

      await supabase.from("chat_messages").insert({
        chat_id: chat.id,
        sender_id: user.id || null,
        sender_type: "system",
        content: statusMessage,
        message_type: "status_update",
        metadata: { sender_name: user.name || user.login || "Sistema" },
      });

      // Send push notification to customer
      if (chat.customer_id) {
        notifyCustomer(chat.customer_id, toStatus, chat.id);
      }

      if (toStatus === "finished") {
        await supabase.from("chats").update({ active: false, status: "closed" }).eq("id", chat.id);
      }

      toast.success(toStatus === "finished" ? "Pedido finalizado e chat encerrado!" : "Status atualizado!");
      queryClient.invalidateQueries({ queryKey: ["admin-chats-kanban", tenantId] });
    } catch (err) {
      console.error("Erro ao mover pedido:", err);
      toast.error("Erro ao atualizar status");
    }
    setPendingMove(null);
  };

  const targetLabel = pendingMove ? KANBAN_COLUMNS.find(c => c.key === pendingMove.toStatus)?.label || pendingMove.toStatus : "";
  const pendingCustomerName = pendingMove?.chat?.customers?.name || "Cliente";

  // TV Mode: only show active columns (not finished/cancelled), bigger cards
  const TV_COLUMNS = KANBAN_COLUMNS.filter(c => c.key !== "finished" && c.key !== "cancelled");

  // TV Mode: sound notification for new orders
  const prevReceivedIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!tvMode) {
      prevReceivedIds.current = new Set((grouped.received || []).map((c: any) => c.id));
      return;
    }
    const currentIds = new Set((grouped.received || []).map((c: any) => c.id));
    const hasNew = [...currentIds].some(id => !prevReceivedIds.current.has(id));

    if (prevReceivedIds.current.size > 0 && hasNew) {
      // Play alert sound
      try {
        const ctx = new AudioContext();
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.type = "sine";
        osc1.frequency.setValueAtTime(880, now);
        osc1.frequency.setValueAtTime(1100, now + 0.15);
        osc1.frequency.setValueAtTime(880, now + 0.3);

        osc2.type = "sine";
        osc2.frequency.setValueAtTime(660, now);
        osc2.frequency.setValueAtTime(880, now + 0.15);
        osc2.frequency.setValueAtTime(660, now + 0.3);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.setValueAtTime(0.5, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

        osc1.start(now);
        osc1.stop(now + 0.5);
        osc2.start(now);
        osc2.stop(now + 0.5);
      } catch { /* Audio not available */ }
    }

    prevReceivedIds.current = currentIds;
  }, [tvMode, grouped.received]);

  // TV Mode: live clock
  const [tvClock, setTvClock] = useState(() => new Date());
  useEffect(() => {
    if (!tvMode) return;
    const interval = setInterval(() => setTvClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, [tvMode]);

  // TV Mode: auto-refresh every 30s
  useEffect(() => {
    if (!tvMode) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["admin-chats-kanban", tenantId] });
    }, 30000);
    return () => clearInterval(interval);
  }, [tvMode, tenantId, queryClient]);

  if (tvMode) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col">
        {/* TV Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-3">
            <Monitor className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Modo TV — Pedidos</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-mono font-bold text-foreground">
              {tvClock.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            <span className="text-sm text-muted-foreground">
              {tvClock.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </span>
            <Button variant="outline" size="sm" onClick={() => setTvMode(false)} className="gap-1.5">
              <X className="w-4 h-4" /> Sair
            </Button>
          </div>
        </div>

        {/* TV Kanban */}
        <div className="flex-1 flex gap-4 p-4 overflow-hidden">
          {TV_COLUMNS.map((col) => {
            const items = grouped[col.key] || [];
            return (
              <div
                key={col.key}
                className={`bg-muted/50 rounded-xl border-t-4 ${col.color} flex flex-col flex-1 min-w-0`}
              >
                {/* Column header */}
                <div className="p-4 flex items-center justify-between border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{col.emoji}</span>
                    <span className="font-bold text-lg text-foreground">{col.label}</span>
                  </div>
                  <span className="text-sm font-semibold bg-secondary text-secondary-foreground rounded-full px-3 py-1">
                    {items.length}
                  </span>
                </div>

                {/* Cards */}
                <ScrollArea className="flex-1 p-3">
                  <div className="space-y-3">
                    {items.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-10">Nenhum pedido</p>
                    )}
                    {items.map((chat: any) => {
                      const salesArr = chat.sales;
                      const sale = Array.isArray(salesArr) ? salesArr[0] : salesArr;
                      const customerName = chat.customers?.name || "Cliente";
                      const financial = sale ? FINANCIAL_LABELS[sale.financial_status] || FINANCIAL_LABELS.pending : null;
                      const saleTime = sale?.created_at ? format(new Date(sale.created_at), "HH:mm") : format(new Date(chat.created_at), "HH:mm");
                      const isUnread = hasUnread(chat.id);

                      return (
                        <div
                          key={chat.id}
                          className={`p-4 rounded-xl bg-card border-2 border-border transition-all ${
                            isUnread ? "ring-2 ring-destructive/60 border-destructive animate-pulse" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${
                                isUnread ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                              }`}>
                                {customerName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-bold text-lg text-foreground truncate">{customerName}</p>
                                  {sale?.tipo_pedido === "mesa" ? (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-600 dark:text-amber-400">🍽️ Mesa {sale.numero_mesa}</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-400 text-blue-600 dark:text-blue-400">🛵</Badge>
                                  )}
                                </div>
                                {sale?.sale_number && (
                                  <p className="text-sm text-muted-foreground">Pedido #{sale.sale_number}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
                              <Clock className="w-4 h-4" />
                              <span className="font-medium">{saleTime}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                            {sale && (
                              <span className="text-xl font-bold text-foreground">
                                R$ {Number(sale.valor_total).toFixed(2)}
                              </span>
                            )}
                            {financial && (
                              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <span className={`w-2.5 h-2.5 rounded-full ${financial.dotClass}`} />
                                {financial.label}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-primary" />
            Pedidos / Kanban
          </h1>
          <div className="flex items-center gap-1 ml-2">
            <Button
              variant={tipoPedidoFilter === "todos" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setTipoPedidoFilter("todos")}
            >
              Todos
            </Button>
            <Button
              variant={tipoPedidoFilter === "delivery" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2 gap-1"
              onClick={() => setTipoPedidoFilter("delivery")}
            >
              🛵 Delivery
            </Button>
            <Button
              variant={tipoPedidoFilter === "mesa" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2 gap-1"
              onClick={() => setTipoPedidoFilter("mesa")}
            >
              🍽️ Mesa
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Button variant="outline" size="sm" onClick={() => setTvMode(true)} className="gap-1.5 mr-2">
            <Monitor className="w-4 h-4" />
            Modo TV
          </Button>
          <span className="text-muted-foreground text-xs">Finalizados/Cancelados:</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5" />
                {format(finishedDateFrom, "dd/MM/yy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={finishedDateFrom}
                onSelect={(d) => {
                  if (d) {
                    setFinishedDateFrom(d);
                    if (d > finishedDateTo) setFinishedDateTo(d);
                  }
                }}
                disabled={(date) => date > new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground text-xs">até</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5" />
                {format(finishedDateTo, "dd/MM/yy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={finishedDateTo}
                onSelect={(d) => {
                  if (d) {
                    setFinishedDateTo(d);
                    if (d < finishedDateFrom) setFinishedDateFrom(d);
                  }
                }}
                disabled={(date) => date > new Date() || date < finishedDateFrom}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-64 min-w-[240px] w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {KANBAN_COLUMNS.map((col) => {
            const items = grouped[col.key] || [];
            const isClosed = col.key === "finished" || col.key === "cancelled";
            const displayItems = isClosed ? items.slice(0, MAX_FINISHED) : items;
            const isOver = dropTarget === col.key;

            return (
              <div
                key={col.key}
                className={`bg-muted/50 rounded-xl border-t-4 ${col.color} flex flex-col min-h-[300px] min-w-[240px] w-full transition-all ${
                  isOver ? "ring-2 ring-primary/50 bg-primary/5" : ""
                }`}
                onDragOver={(e) => handleDragOver(e, col.key)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(col.key)}
              >
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
                      <KanbanCard
                        key={chat.id}
                        chat={chat}
                        hasUnread={hasUnread(chat.id)}
                        onClick={() => {
                          markAsViewed(chat.id);
                          if (chat._isMesaSale) {
                            const salesArr = chat.sales;
                            const sale = Array.isArray(salesArr) ? salesArr[0] : salesArr;
                            setSelectedMesaSale({ ...sale, _mesaNumero: chat.customers?.name });
                          } else {
                            navigate(`/admin/pedidos/${chat.id}`);
                          }
                        }}
                        onDragStart={() => handleDragStart(chat)}
                        isCancelled={col.key === "cancelled"}
                        isLocked={col.key === "delivering_pending"}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation dialog for drag move */}
      <AlertDialog open={!!pendingMove} onOpenChange={(open) => { if (!open) setPendingMove(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mover pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja mover o pedido de <strong>{pendingCustomerName}</strong> para <strong>"{targetLabel}"</strong>?
              {pendingMove?.toStatus === "finished" && (
                <span className="block mt-2 text-destructive font-medium">
                  ⚠️ O chat será encerrado e não poderá ser reaberto.
                </span>
              )}
              <span className="block mt-1">O cliente será notificado da mudança de status.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmMove}>Sim, mover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mesa Sale Detail Modal */}
      <MesaSaleDetailDialog
        sale={selectedMesaSale}
        open={!!selectedMesaSale}
        onClose={() => setSelectedMesaSale(null)}
      />
    </div>
  );
};

const PAYMENT_LABELS_KANBAN: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
};

const MesaSaleDetailDialog = ({ sale, open, onClose }: { sale: any; open: boolean; onClose: () => void }) => {
  const { data: saleItems = [] } = useQuery({
    queryKey: ["mesa-sale-items-kanban", sale?.id],
    enabled: !!sale?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_items")
        .select("*")
        .eq("sale_id", sale.id)
        .eq("active", true)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["mesa-sale-payments-kanban", sale?.id],
    enabled: !!sale?.id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("sale_payments")
        .select("*")
        .eq("sale_id", sale.id)
        .eq("active", true)
        .order("created_at");
      return data || [];
    },
  });

  const { data: freshSale } = useQuery({
    queryKey: ["mesa-sale-fresh-kanban", sale?.id],
    enabled: !!sale?.id && open,
    queryFn: async () => {
      const { data } = await supabase.from("sales").select("*").eq("id", sale.id).single();
      return data;
    },
  });

  const currentSale = freshSale || sale;
  if (!sale) return null;

  const financial = FINANCIAL_LABELS[currentSale?.financial_status] || FINANCIAL_LABELS.pending;
  const opInfo = STATUS_LABELS[currentSale?.operational_status] || STATUS_LABELS.received;
  const saleDate = currentSale?.created_at ? format(new Date(currentSale.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "";
  const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const remaining = Number(currentSale?.valor_total || 0) - totalPaid;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5" />
            {sale._mesaNumero || `Mesa ${currentSale?.numero_mesa}`}
            {currentSale?.sale_number && <span className="text-muted-foreground font-normal text-sm">#{currentSale.sale_number}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs"><span className={`w-2 h-2 rounded-full ${financial.dotClass}`} />{financial.label}</span>
            <Badge variant="outline" className="text-xs">{opInfo.emoji} {opInfo.label}</Badge>
            {currentSale?.representante && (
              <Badge variant="secondary" className="text-xs gap-1">
                <User className="w-3 h-3" /> {currentSale.representante}
              </Badge>
            )}
            {currentSale?.garcom_nome && (
              <Badge variant="outline" className="text-xs gap-1">
                🍽️ Garçom: {currentSale.garcom_nome}
              </Badge>
            )}
          </div>

          {saleDate && <p className="text-xs text-muted-foreground">{saleDate}</p>}

          <Separator />

          {/* Items */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Itens do pedido</h4>
            {saleItems.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhum item encontrado</p>
            ) : (
              <div className="space-y-1">
                {saleItems.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-start p-2 rounded-lg bg-secondary/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        <span className="text-primary font-bold">{item.quantity}x</span> {item.product_name}
                      </p>
                      {item.observacao && (
                        <p className="text-xs text-muted-foreground">Obs: {item.observacao}</p>
                      )}
                    </div>
                    <span className="text-sm font-semibold shrink-0 ml-2">
                      R$ {(Number(item.unit_price) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Total */}
          <div className="flex justify-between items-center">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-bold">R$ {Number(currentSale?.valor_total || 0).toFixed(2)}</span>
          </div>

          {/* Payments */}
          {payments.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" /> Pagamentos
              </h4>
              {payments.map((p: any) => (
                <div key={p.id} className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                  <span className="text-sm">{PAYMENT_LABELS_KANBAN[p.payment_method] || p.payment_method}</span>
                  <span className="text-sm font-semibold">R$ {Number(p.amount).toFixed(2)}</span>
                </div>
              ))}
              {remaining > 0.01 && (
                <p className="text-xs text-destructive font-medium">Falta: R$ {remaining.toFixed(2)}</p>
              )}
            </div>
          )}

          {/* Observacao */}
          {currentSale?.observacao && (
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Observação</h4>
              <p className="text-sm bg-secondary/30 p-2 rounded-lg">{currentSale.observacao}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const printReceipt = async (chat: any, e: React.MouseEvent) => {
  e.stopPropagation();
  const salesArr = chat.sales;
  const sale = Array.isArray(salesArr) ? salesArr[0] : salesArr;
  if (!sale) {
    toast.error("Nenhuma venda associada a este pedido");
    return;
  }

  try {
    // Fetch sale items
    const { data: saleItems, error: itemsErr } = await supabase
      .from("chat_messages")
      .select("content, metadata")
      .eq("chat_id", chat.id)
      .eq("message_type", "order_summary")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1);

    // Fetch payment methods from sale_payments
    const { data: payments } = await supabase
      .from("sale_payments")
      .select("payment_method, amount")
      .eq("sale_id", sale.id)
      .eq("active", true)
      .order("created_at", { ascending: true });

    const PAYMENT_METHOD_LABELS: Record<string, string> = {
      pix: "Pix",
      cash: "Dinheiro",
      card: "Cartão",
      credit: "Crédito",
      debit: "Débito",
    };

    // Fetch customer address from sale
    const customerName = chat.customers?.name || "Cliente";
    const customerPhone = chat.customers?.phone || "";
    const saleNumber = sale.sale_number || "-";
    const saleDate = sale.created_at ? format(new Date(sale.created_at), "dd/MM/yyyy HH:mm") : "-";
    const total = Number(sale.valor_total || 0).toFixed(2);
    const paymentMethod = payments && payments.length > 0
      ? payments.map((p: any) => `${PAYMENT_METHOD_LABELS[p.payment_method] || p.payment_method} (R$ ${Number(p.amount).toFixed(2)})`).join(", ")
      : "-";
    const financialLabel = FINANCIAL_LABELS[sale.financial_status]?.label || "Pendente";
    const deliveryAddress = sale.delivery_address;
    const obs = sale.observacao || "";

    // Try to get order items from chat messages
    let itemsHtml = "";
    if (saleItems && saleItems.length > 0) {
      const content = saleItems[0].content;
      // Filter out header (Pedido #X), total line, delivery fee, and empty lines
      itemsHtml = content
        .split("\n")
        .filter((line: string) => {
          const trimmed = line.trim();
          if (!trimmed) return false;
          if (/^\*?\*?Pedido\s*#/i.test(trimmed) || /📋/.test(trimmed)) return false;
          if (/\*?\*?Total:/i.test(trimmed) || /💰/.test(trimmed)) return false;
          if (/🚚/.test(trimmed)) return false;
          if (/📝\s*Obs:/i.test(trimmed)) return false;
          return true;
        })
        .map((line: string) => `<div style="font-size:12px;padding:1px 0">${line}</div>`)
        .join("");
    }

    // Build address string
    let addressHtml = "";
    if (deliveryAddress && typeof deliveryAddress === "object") {
      const addr = deliveryAddress as any;
      const parts = [addr.street, addr.number, addr.complement, addr.neighborhood, addr.city].filter(Boolean);
      if (parts.length > 0) {
        addressHtml = `<div style="margin-top:8px;border-top:1px dashed #000;padding-top:6px">
          <strong>Endereço:</strong><br/>${parts.join(", ")}
          ${addr.reference ? `<br/><em>Ref: ${addr.reference}</em>` : ""}
        </div>`;
      }
    }

    const receiptHtml = `
      <html><head><title>Recibo #${saleNumber}</title>
      <style>
        @media print { body { margin: 0; } @page { margin: 10mm; } }
        body { font-family: monospace; max-width: 280px; margin: 0 auto; padding: 10px; font-size: 12px; }
        .center { text-align: center; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        .bold { font-weight: bold; }
        .row { display: flex; justify-content: space-between; }
      </style></head><body>
        <div class="center bold" style="font-size:16px;margin-bottom:4px">RECIBO DE PEDIDO</div>
        <div class="center" style="font-size:11px;margin-bottom:8px">Pedido #${saleNumber}</div>
        <div class="divider"></div>
        <div><strong>Cliente:</strong> ${customerName}</div>
        ${customerPhone ? `<div><strong>Tel:</strong> ${customerPhone}</div>` : ""}
        <div><strong>Data:</strong> ${saleDate}</div>
        <div class="divider"></div>
        ${itemsHtml ? `<div class="bold">Itens:</div>${itemsHtml}<div class="divider"></div>` : ""}
        ${obs ? `<div><strong>Obs:</strong> ${obs}</div><div class="divider"></div>` : ""}
        ${addressHtml}
        <div class="divider"></div>
        <div class="row bold" style="font-size:14px"><span>TOTAL:</span><span>R$ ${total}</span></div>
        <div style="margin-top:4px"><strong>Pagamento:</strong> ${paymentMethod}</div>
        <div><strong>Status:</strong> ${financialLabel}</div>
        <div class="divider"></div>
        <div class="center" style="font-size:10px;margin-top:8px;color:#666">Impresso em ${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
      </body></html>
    `;

    const printWindow = window.open("", "_blank", "width=350,height=600");
    if (printWindow) {
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 300);
    }
  } catch (err) {
    console.error("Erro ao imprimir recibo:", err);
    toast.error("Erro ao gerar recibo");
  }
};

const KanbanCard = ({
  chat,
  hasUnread,
  onClick,
  onDragStart,
  isCancelled = false,
}: {
  chat: any;
  hasUnread: boolean;
  onClick: () => void;
  onDragStart: () => void;
  isCancelled?: boolean;
}) => {
  const salesArr = chat.sales;
  const sale = Array.isArray(salesArr) ? salesArr[0] : salesArr;
  const customerName = chat.customers?.name || "Cliente";
  const financial = sale ? FINANCIAL_LABELS[sale.financial_status] || FINANCIAL_LABELS.pending : null;
  const saleTime = sale?.created_at ? format(new Date(sale.created_at), "HH:mm") : format(new Date(chat.created_at), "HH:mm");

  return (
    <div
      draggable={!isCancelled}
      onDragStart={onDragStart}
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg bg-card border border-border hover:border-primary/40 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing select-none relative ${
        hasUnread ? "ring-2 ring-destructive/60 border-destructive" : ""
      } ${isCancelled ? "opacity-70 cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
            isCancelled ? "bg-destructive/10 text-destructive" : hasUnread ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
          }`}>
            {customerName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm text-foreground truncate">
              {customerName}
              {hasUnread && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-destructive" />
                </span>
              )}
            </p>
            {sale?.sale_number && (
              <p className="text-xs text-muted-foreground">#{sale.sale_number}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {saleTime}
          </div>
          <button
            onClick={(e) => printReceipt(chat, e)}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
            title="Imprimir recibo"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        {sale && (
          <span className={`text-sm font-semibold ${isCancelled ? "text-muted-foreground line-through" : "text-foreground"}`}>
            R$ {Number(sale.valor_total).toFixed(2)}
          </span>
        )}
        {isCancelled ? (
          <span className="text-xs text-destructive font-medium">Cancelado</span>
        ) : financial ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${financial.dotClass}`} />
            {financial.label}
          </span>
        ) : null}
      </div>
    </div>
  );
};

export default AdminChatsListPage;
