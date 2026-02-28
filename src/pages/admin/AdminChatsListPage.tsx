import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Clock, CalendarIcon } from "lucide-react";
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
  { key: "finished", label: "Finalizado", emoji: "✅", color: "border-t-green-600" },
];

const STATUS_LABELS: Record<string, { label: string; emoji: string }> = {
  received: { label: "Pedido recebido", emoji: "📥" },
  preparing: { label: "Em preparo", emoji: "👨‍🍳" },
  delivering: { label: "Saiu para entrega", emoji: "🛵" },
  finished: { label: "Finalizado", emoji: "✅" },
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

  // Drag state
  const [draggedChat, setDraggedChat] = useState<any>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  // Confirmation dialog
  const [pendingMove, setPendingMove] = useState<{ chat: any; toStatus: string } | null>(null);
  // Finished column date filter (defaults to today)
  const [finishedDate, setFinishedDate] = useState<Date>(new Date());
  // Track unread chats (chats with customer messages not yet opened by admin)
  const [viewedChats, setViewedChats] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("viewed-chats");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  // Realtime — also listen to chat_messages for unread detection
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
        // If a customer sends a message, mark that chat as unread
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
    queryKey: ["admin-chats-kanban", tenantId, finishedDate.toDateString()],
    enabled: !!tenantId,
    queryFn: async () => {
      // Fetch active chats (non-finished)
      const { data: activeChats, error: err1 } = await supabase
        .from("chats")
        .select("*, customers(name, phone), sales!sales_chat_id_fkey(id, sale_number, valor_total, financial_status, operational_status, created_at)")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .order("updated_at", { ascending: false });
      if (err1) throw err1;

      // Fetch finished chats for the selected date
      const selectedStart = new Date(finishedDate);
      selectedStart.setHours(0, 0, 0, 0);
      const selectedEnd = new Date(finishedDate);
      selectedEnd.setHours(23, 59, 59, 999);
      const { data: finishedChats, error: err2 } = await supabase
        .from("chats")
        .select("*, customers(name, phone), sales!sales_chat_id_fkey(id, sale_number, valor_total, financial_status, operational_status, created_at)")
        .eq("tenant_id", tenantId!)
        .eq("active", false)
        .eq("status", "closed")
        .gte("updated_at", selectedStart.toISOString())
        .lte("updated_at", selectedEnd.toISOString())
        .order("updated_at", { ascending: false })
        .limit(MAX_FINISHED);
      if (err2) throw err2;

      return [...(activeChats || []), ...(finishedChats || [])];
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
      // Get the latest customer message per chat
      const map: Record<string, string> = {};
      (data || []).forEach((m: any) => {
        if (!map[m.chat_id]) map[m.chat_id] = m.created_at;
      });
      return map;
    },
  });

  // A chat has unread messages if last customer message exists and chat hasn't been "viewed"
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
      // Update operational status
      const { error: updateErr } = await supabase.from("sales").update({ operational_status: toStatus }).eq("id", sale.id);
      if (updateErr) throw updateErr;

      // Send status notification to client via chat message
      const statusInfo = STATUS_LABELS[toStatus] || { label: toStatus, emoji: "📋" };
      await supabase.from("chat_messages").insert({
        chat_id: chat.id,
        sender_id: user.id || null,
        sender_type: "system",
        content: `${statusInfo.emoji} Status atualizado: **${statusInfo.label}**`,
        message_type: "status_update",
        metadata: { sender_name: user.name || user.login || "Sistema" },
      });

      // If finishing, close the chat
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
            const isOver = dropTarget === col.key;

            return (
              <div
                key={col.key}
                className={`bg-muted/50 rounded-xl border-t-4 ${col.color} flex flex-col min-h-[300px] transition-all ${
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
                  <div className="flex items-center gap-1.5">
                    {isFinished && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground">
                            <CalendarIcon className="w-3.5 h-3.5" />
                            {format(finishedDate, "dd/MM", { locale: ptBR })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            mode="single"
                            selected={finishedDate}
                            onSelect={(d) => d && setFinishedDate(d)}
                            disabled={(date) => date > new Date()}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                    <span className="text-xs font-medium bg-secondary text-secondary-foreground rounded-full px-2 py-0.5">
                      {items.length}
                    </span>
                  </div>
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
                      />
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
}: {
  chat: any;
  hasUnread: boolean;
  onClick: () => void;
  onDragStart: () => void;
}) => {
  const salesArr = chat.sales;
  const sale = Array.isArray(salesArr) ? salesArr[0] : salesArr;
  const customerName = chat.customers?.name || "Cliente";
  const financial = sale ? FINANCIAL_LABELS[sale.financial_status] || FINANCIAL_LABELS.pending : null;
  const saleTime = sale?.created_at ? format(new Date(sale.created_at), "HH:mm") : format(new Date(chat.created_at), "HH:mm");

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg bg-card border border-border hover:border-primary/40 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing select-none relative ${
        hasUnread ? "ring-2 ring-destructive/60 border-destructive" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
            hasUnread ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
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
    </div>
  );
};

export default AdminChatsListPage;
