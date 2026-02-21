import { useAdmin } from "@/contexts/AdminContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Activity,
  Clock,
  AlertTriangle,
  Building2,
  Flame,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";

const DashboardPage = () => {
  const { user } = useAuth();
  const { effectiveTenantId, isSuperAdmin } = useAdmin();

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  // Sales data
  const { data: salesData } = useQuery({
    queryKey: ["dashboard-sales", effectiveTenantId],
    enabled: !!effectiveTenantId,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data: allSales } = await supabase
        .from("sales" as any)
        .select("*")
        .eq("tenant_id", effectiveTenantId!)
        .eq("active", true)
        .gte("created_at", startOfMonth)
        .order("created_at", { ascending: false });

      const sales = (allSales || []) as any[];
      const todaySales = sales.filter((s: any) => s.created_at >= startOfDay);

      const faturamentoDia = todaySales.reduce((acc: number, s: any) => acc + Number(s.valor_total), 0);
      const faturamentoMes = sales.reduce((acc: number, s: any) => acc + Number(s.valor_total), 0);
      const numVendasHoje = todaySales.length;
      const ticketMedio = numVendasHoje > 0 ? faturamentoDia / numVendasHoje : 0;

      // Chart by day
      const byDay: Record<string, number> = {};
      sales.forEach((s: any) => {
        const day = new Date(s.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        byDay[day] = (byDay[day] || 0) + Number(s.valor_total);
      });
      const chartData = Object.entries(byDay)
        .map(([day, total]) => ({ day, total }))
        .reverse();

      // Recent sales (last 5)
      const recentSales = todaySales.slice(0, 5);

      return { faturamentoDia, faturamentoMes, numVendasHoje, ticketMedio, chartData, recentSales };
    },
  });

  // Orders data
  const { data: ordersData } = useQuery({
    queryKey: ["dashboard-orders", effectiveTenantId],
    enabled: !!effectiveTenantId,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, status, created_at")
        .eq("tenant_id", effectiveTenantId!)
        .eq("active", true)
        .gte("created_at", startOfDay);

      const orders = data || [];
      const total = orders.length;
      const emAndamento = orders.filter((o) => o.status === "em_preparo" || o.status === "aberto").length;
      const aguardandoPreparo = orders.filter((o) => o.status === "aberto").length;
      const aguardandoEntrega = orders.filter((o) => o.status === "pronto").length;

      return { total, emAndamento, aguardandoPreparo, aguardandoEntrega };
    },
  });

  // Stock alerts
  const { data: stockAlerts } = useQuery({
    queryKey: ["dashboard-stock-alerts", effectiveTenantId],
    enabled: !!effectiveTenantId,
    refetchInterval: 60000,
    queryFn: async () => {
      const { data } = await supabase
        .from("stock_alerts")
        .select("id, message, is_read, created_at")
        .eq("tenant_id", effectiveTenantId!)
        .eq("active", true)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  if (!effectiveTenantId) {
    return (
      <div className="text-center py-20">
        <Building2 className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold mb-1">Selecione um restaurante</h3>
        <p className="text-muted-foreground text-sm">
          {isSuperAdmin
            ? "Escolha um restaurante no seletor acima para visualizar os dados."
            : "Nenhum restaurante vinculado à sua conta."}
        </p>
      </div>
    );
  }

  const formatCurrency = (v: number) =>
    `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">
          Dashboard {isSuperAdmin && <span className="text-primary">Global</span>}
        </h1>
        <p className="text-muted-foreground text-sm">Bem-vindo, {user?.login}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Pedidos Hoje</CardTitle>
            <ShoppingCart className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ordersData?.total ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Faturamento Hoje</CardTitle>
            <DollarSign className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(salesData?.faturamentoDia ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Ticket Médio</CardTitle>
            <TrendingUp className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(salesData?.ticketMedio ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Em Andamento</CardTitle>
            <Activity className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ordersData?.emAndamento ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Faturamento Mês</CardTitle>
            <DollarSign className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(salesData?.faturamentoMes ?? 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Operational Status + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Operational Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Status Operacional
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Aguardando preparo</span>
              <Badge variant="secondary">{ordersData?.aguardandoPreparo ?? 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Aguardando entrega/retirada</span>
              <Badge variant="secondary">{ordersData?.aguardandoEntrega ?? 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total pedidos hoje</span>
              <Badge>{ordersData?.total ?? 0}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Smart Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Alertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stockAlerts && stockAlerts.length > 0 ? (
              <ul className="space-y-2">
                {stockAlerts.map((alert) => (
                  <li key={alert.id} className="flex items-start gap-2 text-sm">
                    <Flame className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                    <span>{alert.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum alerta no momento 🎉</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vendas Recentes (Hoje)</CardTitle>
        </CardHeader>
        <CardContent>
          {salesData?.recentSales && salesData.recentSales.length > 0 ? (
            <div className="space-y-3">
              {salesData.recentSales.map((sale: any) => (
                <div key={sale.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">
                      {new Date(sale.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="capitalize">{sale.forma_pagamento?.replace("_", " ") || "—"}</span>
                  </div>
                  <span className="font-semibold">{formatCurrency(Number(sale.valor_total))}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma venda registrada hoje.</p>
          )}
        </CardContent>
      </Card>

      {/* Chart */}
      {salesData?.chartData && salesData.chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vendas por Dia (Mês)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesData.chartData}>
                  <XAxis dataKey="day" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Total"]}
                  />
                  <Bar dataKey="total" fill="hsl(24, 95%, 53%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DashboardPage;
