import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Clock, CalendarIcon, Monitor, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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

const KANBAN_COLUMNS = [
  { key: "received", label: "Aguardando", emoji: "📥", color: "border-t-blue-500" },
  { key: "preparing", label: "Em preparo", emoji: "👨‍🍳", color: "border-t-yellow-500" },
  { key: "delivering", label: "Saiu p/ entrega", emoji: "🛵", color: "border-t-orange-500" },
  { key: "delivering_pending", label: "Aguard. confirmação", emoji: "📦", color: "border-t-purple-500" },
  { key: "finished", label: "Finalizado", emoji: "✅", color: "border-t-green-600" },
  { key: "cancelled", label: "Cancelado", emoji: "❌", color: "border-t-red-500" },
];

const STATUS_LABELS: Record<string, { label: string; emoji: string }> = {
  received: { label: "Pedido recebido", emoji: "📥" },
  preparing: { label: "Em preparo", emoji: "👨‍🍳" },
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

  // Drag state
  const [draggedChat, setDraggedChat] = useState<any>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
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
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, queryClient]);

  const { data: chats = [], isLoading } = useQuery({
    queryKey: ["admin-chats-kanban", tenantId, finishedDateFrom.toDateString(), finishedDateTo.toDateString()],
    enabled: !!tenantId,
    queryFn: async () => {
      // Fetch active chats (non-finished, non-cancelled)
      const { data: activeChats, error: err1 } = await supabase
        .from("chats")
        .select("*, customers(name, phone), sales!sales_chat_id_fkey(id, sale_number, valor_total, financial_status, operational_status, created_at)")
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
        .select("*, customers(name, phone), sales!sales_chat_id_fkey(id, sale_number, valor_total, financial_status, operational_status, created_at, cancel_reason, canceled_by)")
        .eq("tenant_id", tenantId!)
        .eq("active", false)
        .eq("status", "closed")
        .gte("updated_at", selectedStart.toISOString())
        .lte("updated_at", selectedEnd.toISOString())
        .order("updated_at", { ascending: false })
        .limit(MAX_FINISHED * 2);
      if (err2) throw err2;

      return [...(activeChats || []), ...(closedChats || [])];
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
  const grouped: Record<string, any[]> = { received: [], preparing: [], delivering: [], delivering_pending: [], finished: [], cancelled: [] };
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

    try {
      const { error: updateErr } = await supabase.from("sales").update({ operational_status: toStatus }).eq("id", sale.id);
      if (updateErr) throw updateErr;

      const statusInfo = STATUS_LABELS[toStatus] || { label: toStatus, emoji: "📋" };
      await supabase.from("chat_messages").insert({
        chat_id: chat.id,
        sender_id: user.id || null,
        sender_type: "system",
        content: `${statusInfo.emoji} Status atualizado: **${statusInfo.label}**`,
        message_type: "status_update",
        metadata: { sender_name: user.name || user.login || "Sistema" },
      });

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
                                <p className="font-bold text-lg text-foreground truncate">{customerName}</p>
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
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-primary" />
          Pedidos / Kanban
        </h1>
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
                          navigate(`/admin/pedidos/${chat.id}`);
                        }}
                        onDragStart={() => handleDragStart(chat)}
                        isCancelled={col.key === "cancelled" || col.key === "delivering_pending"}
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
    </div>
  );
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
        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <Clock className="w-3 h-3" />
          {saleTime}
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
