import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, Truck, Clock, MapPin, DollarSign, Loader2, Package, PackageCheck, Key, RefreshCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Navigate, useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";

const EntregadorPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = user?.tenant_id;

  const isAllowed = user?.role === "entregador" || user?.role === "tenant_admin" || user?.role === "superadmin";

  // Fetch ready delivery orders
  const { data: readyOrders = [], isLoading } = useQuery({
    queryKey: ["entregador-ready-orders", tenantId],
    enabled: !!tenantId && isAllowed,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, sale_number, valor_total, created_at, delivery_address, customer_id, operational_status, entregador_id, entregador_nome")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .eq("tipo_pedido", "delivery")
        .eq("operational_status", "ready")
        .is("entregador_id", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch my active deliveries (delivering status assigned to me)
  const { data: myDeliveries = [] } = useQuery({
    queryKey: ["entregador-my-deliveries", tenantId, user?.id],
    enabled: !!tenantId && !!user?.id && isAllowed,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, sale_number, valor_total, created_at, delivery_address, customer_id, operational_status, entregador_nome, hora_saida_entrega, delivery_code")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .eq("entregador_id", user!.id)
        .in("operational_status", ["delivering", "delivering_pending"])
        .order("hora_saida_entrega", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch customer names for orders
  const customerIds = [...readyOrders, ...myDeliveries].map((o: any) => o.customer_id).filter(Boolean);
  const { data: customers = [] } = useQuery({
    queryKey: ["entregador-customers", customerIds.join(",")],
    enabled: customerIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name, phone").in("id", customerIds);
      return data || [];
    },
  });

  const getCustomerName = (customerId: string) => {
    const c = customers.find((c: any) => c.id === customerId);
    return c?.name || "Cliente";
  };

  const [confirmingSaleId, setConfirmingSaleId] = useState<string | null>(null);
  const [concluding, setConcluding] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleConcluirEntrega = async (saleId: string) => {
    setConcluding(true);
    try {
      const { error } = await supabase.from("sales").update({
        operational_status: "delivering_pending",
      } as any).eq("id", saleId);
      if (error) throw error;

      const { data: chat } = await supabase.from("chats").select("id").eq("sale_id", saleId).single();
      if (chat) {
        await supabase.from("chat_messages").insert({
          chat_id: chat.id,
          sender_id: user!.id,
          sender_type: "system",
          content: "📦 O entregador informou que a entrega foi realizada. Por favor, confirme o recebimento.",
          message_type: "status_update",
          metadata: { sender_name: user!.name || user!.login || "Sistema" },
        });
      }

      toast.success("Entrega marcada como concluída! Aguardando confirmação do cliente.");
      setConfirmingSaleId(null);
      queryClient.invalidateQueries({ queryKey: ["entregador-my-deliveries"] });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao concluir entrega");
    } finally {
      setConcluding(false);
    }
  };

  // Realtime
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel("entregador-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales", filter: `tenant_id=eq.${tenantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["entregador-ready-orders"] });
        queryClient.invalidateQueries({ queryKey: ["entregador-my-deliveries"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, queryClient]);

  const handleAssumirEntrega = async (sale: any) => {
    if (!user) return;
    try {
      const { error } = await supabase.from("sales").update({
        operational_status: "delivering",
        entregador_id: user.id,
        entregador_nome: user.name || user.login,
        hora_saida_entrega: new Date().toISOString(),
      } as any).eq("id", sale.id);
      if (error) throw error;

      // Find chat for this sale and send message
      const { data: chat } = await supabase
        .from("chats")
        .select("id")
        .eq("sale_id", sale.id)
        .single();

      if (chat) {
        await supabase.from("chat_messages").insert({
          chat_id: chat.id,
          sender_id: user.id,
          sender_type: "system",
          content: `🛵 Seu pedido saiu para entrega com ${user.name || user.login}`,
          message_type: "status_update",
          metadata: { sender_name: user.name || user.login || "Sistema" },
        });
      }

      toast.success("Entrega assumida! Boa entrega 🛵");
      queryClient.invalidateQueries({ queryKey: ["entregador-ready-orders"] });
      queryClient.invalidateQueries({ queryKey: ["entregador-my-deliveries"] });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao assumir entrega");
    }
  };

  const getTimeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    return `${hours}h${mins % 60}min`;
  };

  const formatAddress = (addr: any) => {
    if (!addr) return "Sem endereço";
    if (typeof addr === "string") return addr;
    const parts = [addr.street, addr.number, addr.neighborhood, addr.city].filter(Boolean);
    return parts.join(", ") || "Sem endereço";
  };

  if (!user) return <Navigate to="/login" />;
  if (!isAllowed) return <Navigate to="/login" replace />;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["entregador-ready-orders"] }),
      queryClient.invalidateQueries({ queryKey: ["entregador-my-deliveries"] }),
    ]);
    setTimeout(() => setRefreshing(false), 600);
    toast.success("Pedidos atualizados!");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="w-8 h-8 rounded-lg" />
            <div>
              <h1 className="font-bold text-foreground text-lg">Painel Entregador</h1>
              <p className="text-xs text-muted-foreground">{user.name || user.login}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleRefresh} className="h-9 w-9">
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowLogoutConfirm(true)} className="gap-1.5">
              <LogOut className="w-4 h-4" /> Sair
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* My Active Deliveries */}
        {myDeliveries.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Truck className="w-4 h-4" /> Minhas Entregas em Andamento
            </h2>
            <div className="space-y-3">
              {myDeliveries.map((sale: any) => (
                <Card key={sale.id} className="border-l-4 border-l-orange-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">#{sale.sale_number}</Badge>
                        <span className="font-semibold text-foreground">{getCustomerName(sale.customer_id)}</span>
                      </div>
                      <span className="text-lg font-bold text-foreground">R$ {Number(sale.valor_total).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{formatAddress(sale.delivery_address)}</span>
                    </div>
                    {(sale as any).delivery_code && (
                      <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-primary/10 border border-primary/20">
                        <Key className="w-4 h-4 text-primary" />
                        <span className="text-xs text-muted-foreground">Código:</span>
                        <span className="font-mono font-extrabold text-xl text-primary tracking-[0.15em]">{(sale as any).delivery_code}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>Saiu há {sale.hora_saida_entrega ? getTimeSince(sale.hora_saida_entrega) : "—"}</span>
                      </div>
                      {sale.operational_status === "delivering" && (
                        <Button size="sm" variant="default" className="gap-1.5 bg-green-600 hover:bg-green-700" onClick={() => setConfirmingSaleId(sale.id)}>
                          <PackageCheck className="w-4 h-4" /> Concluir entrega
                        </Button>
                      )}
                      {sale.operational_status === "delivering_pending" && (
                        <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">Aguardando confirmação</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Ready Orders */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" /> Pedidos Prontos para Entrega
          </h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : readyOrders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Truck className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Nenhum pedido pronto no momento</p>
                <p className="text-xs text-muted-foreground mt-1">Novos pedidos aparecerão automaticamente</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {readyOrders.map((sale: any) => (
                <Card key={sale.id} className="border-l-4 border-l-green-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">#{sale.sale_number}</Badge>
                        <span className="font-semibold text-foreground">{getCustomerName(sale.customer_id)}</span>
                      </div>
                      <span className="text-lg font-bold text-foreground">R$ {Number(sale.valor_total).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{formatAddress(sale.delivery_address)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>Criado há {getTimeSince(sale.created_at)}</span>
                      </div>
                      <Button size="sm" className="gap-1.5" onClick={() => handleAssumirEntrega(sale)}>
                        <Truck className="w-4 h-4" /> Assumir entrega
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirm conclude dialog */}
      <AlertDialog open={!!confirmingSaleId} onOpenChange={(open) => { if (!open) setConfirmingSaleId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir entrega</AlertDialogTitle>
            <AlertDialogDescription>
              Você confirma que a entrega foi realizada? O cliente será notificado para confirmar o recebimento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmingSaleId && handleConcluirEntrega(confirmingSaleId)} disabled={concluding}>
              {concluding ? "Concluindo..." : "Sim, concluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Logout confirmation */}
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair do painel</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja sair do painel de entregas?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>Sim, sair</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EntregadorPage;
