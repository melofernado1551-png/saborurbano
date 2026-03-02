import { useAdmin } from "@/contexts/AdminContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Clock,
  AlertTriangle,
  Building2,
  Flame,
  ChefHat,
  CheckCircle2,
  Truck,
  Hourglass,
  Activity,
  CalendarDays,
  UtensilsCrossed,
  Medal,
  Timer,
} from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { useEffect } from "react";

const DashboardPage = () => {
  const { user } = useAuth();
  const { effectiveTenantId, isSuperAdmin, isAdminTenant, isColaborador, tenantName } = useAdmin();

  const canSeeFinancials = isSuperAdmin || isAdminTenant;
  const isGarcom = user?.role === "garcom";
  const isEntregador = user?.role === "entregador";

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  // Week starts on Sunday
  const startOfWeekDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
  const endOfWeekDate = new Date(startOfWeekDate.getFullYear(), startOfWeekDate.getMonth(), startOfWeekDate.getDate() + 6);
  const startOfWeek = startOfWeekDate.toISOString();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const endOfMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const formatDateBR = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const weekLabel = `${formatDateBR(startOfWeekDate)} a ${formatDateBR(endOfWeekDate)}`;
  const monthLabel = `01/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()} a ${formatDateBR(endOfMonthDate)}`;

  // ─── LAYER 1: OPERATIONAL (real-time) ───
  const { data: opsData, refetch: refetchOps } = useQuery({
    queryKey: ["dashboard-ops", effectiveTenantId],
    enabled: !!effectiveTenantId,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("sales" as any)
        .select("id, operational_status, created_at")
        .eq("tenant_id", effectiveTenantId!)
        .eq("active", true)
        .gte("created_at", startOfDay);

      const sales = (data || []) as any[];

      const aguardando = sales.filter((s: any) => s.operational_status === "received").length;
      const emPreparo = sales.filter((s: any) => s.operational_status === "preparing").length;
      const prontos = sales.filter((s: any) => s.operational_status === "ready").length;
      const emEntrega = sales.filter((s: any) => s.operational_status === "delivering").length;
      const finalizados = sales.filter((s: any) => s.operational_status === "finished").length;
      const emAndamento = aguardando + emPreparo + prontos + emEntrega;

      return { aguardando, emPreparo, prontos, emEntrega, finalizados, emAndamento, total: sales.length };
    },
  });

  // Realtime subscription for sales changes
  useEffect(() => {
    if (!effectiveTenantId) return;
    const channel = supabase
      .channel("dashboard-sales-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales", filter: `tenant_id=eq.${effectiveTenantId}` }, () => {
        refetchOps();
        if (canSeeFinancials) refetchFinancials();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTenantId]);

  // ─── LAYER 2: FINANCIAL (admin only) ───
  const { data: financialData, refetch: refetchFinancials } = useQuery({
    queryKey: ["dashboard-financials", effectiveTenantId],
    enabled: !!effectiveTenantId && canSeeFinancials,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data: allSales } = await supabase
        .from("sales" as any)
        .select("id, valor_total, created_at, forma_pagamento")
        .eq("tenant_id", effectiveTenantId!)
        .eq("active", true)
        .eq("financial_status", "paid")
        .gte("created_at", startOfMonth)
        .order("created_at", { ascending: false });

      const sales = (allSales || []) as any[];

      const todaySales = sales.filter((s: any) => s.created_at >= startOfDay);
      const weekSales = sales.filter((s: any) => s.created_at >= startOfWeek);

      const faturamentoDia = todaySales.reduce((acc: number, s: any) => acc + Number(s.valor_total), 0);
      const faturamentoSemana = weekSales.reduce((acc: number, s: any) => acc + Number(s.valor_total), 0);
      const faturamentoMes = sales.reduce((acc: number, s: any) => acc + Number(s.valor_total), 0);
      const qtdVendasPagas = sales.length;
      const ticketMedio = qtdVendasPagas > 0 ? faturamentoMes / qtdVendasPagas : 0;

      // Chart grouped by week of month
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const byWeek: Record<number, number> = {};
      sales.forEach((s: any) => {
        const saleDate = new Date(s.created_at);
        const dayOfMonth = saleDate.getDate();
        const firstDayWeekday = monthStart.getDay(); // 0=Sun
        const weekNum = Math.floor((dayOfMonth + firstDayWeekday - 1) / 7) + 1;
        byWeek[weekNum] = (byWeek[weekNum] || 0) + Number(s.valor_total);
      });
      const chartData = Object.entries(byWeek)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([week, total]) => ({ day: `Sem ${week}`, total }));

      return { faturamentoDia, faturamentoSemana, faturamentoMes, qtdVendasPagas, ticketMedio, chartData };
    },
  });

  // ─── LAYER 3: PERFORMANCE METRICS ───
  const { data: performanceData } = useQuery({
    queryKey: ["dashboard-performance", effectiveTenantId],
    enabled: !!effectiveTenantId,
    refetchInterval: 30000,
    queryFn: async () => {
      // Fetch finished sales this month for performance
      const { data: finishedSales } = await supabase
        .from("sales" as any)
        .select("id, entregador_id, entregador_nome, garcom_id, garcom_nome, tipo_pedido, valor_total, tempo_total_entrega, created_at, hora_saida_entrega, hora_entrega")
        .eq("tenant_id", effectiveTenantId!)
        .eq("active", true)
        .eq("operational_status", "finished")
        .gte("created_at", startOfMonth);

      const sales = (finishedSales || []) as any[];
      const todaySalesPerf = sales.filter((s: any) => s.created_at >= startOfDay);

      // Entregador ranking
      const entregadorMap: Record<string, { nome: string; total: number; entregas: number; tempoTotal: number; entregasComTempo: number; hoje: number }> = {};
      sales.filter((s: any) => s.tipo_pedido === "delivery" && s.entregador_id).forEach((s: any) => {
        const key = s.entregador_id;
        if (!entregadorMap[key]) {
          entregadorMap[key] = { nome: s.entregador_nome || "Entregador", total: 0, entregas: 0, tempoTotal: 0, entregasComTempo: 0, hoje: 0 };
        }
        entregadorMap[key].entregas++;
        if (s.tempo_total_entrega) {
          entregadorMap[key].tempoTotal += s.tempo_total_entrega;
          entregadorMap[key].entregasComTempo++;
        }
        if (s.created_at >= startOfDay) entregadorMap[key].hoje++;
      });

      const entregadorRanking = Object.entries(entregadorMap)
        .map(([id, data]) => ({
          id,
          nome: data.nome,
          entregas: data.entregas,
          hoje: data.hoje,
          tempoMedio: data.entregasComTempo > 0 ? Math.round(data.tempoTotal / data.entregasComTempo) : null,
        }))
        .sort((a, b) => b.entregas - a.entregas);

      // Garçom ranking
      const garcomMap: Record<string, { nome: string; pedidos: number; valorTotal: number; hoje: number }> = {};
      sales.filter((s: any) => s.tipo_pedido === "mesa" && s.garcom_id).forEach((s: any) => {
        const key = s.garcom_id;
        if (!garcomMap[key]) {
          garcomMap[key] = { nome: s.garcom_nome || "Garçom", pedidos: 0, valorTotal: 0, hoje: 0 };
        }
        garcomMap[key].pedidos++;
        garcomMap[key].valorTotal += Number(s.valor_total);
        if (s.created_at >= startOfDay) garcomMap[key].hoje++;
      });

      const garcomRanking = Object.entries(garcomMap)
        .map(([id, data]) => ({
          id,
          nome: data.nome,
          pedidos: data.pedidos,
          hoje: data.hoje,
          valorTotal: data.valorTotal,
        }))
        .sort((a, b) => b.pedidos - a.pedidos);

      const entregasHoje = todaySalesPerf.filter((s: any) => s.tipo_pedido === "delivery" && s.entregador_id).length;
      const mesasHoje = todaySalesPerf.filter((s: any) => s.tipo_pedido === "mesa" && s.garcom_id).length;

      return { entregadorRanking, garcomRanking, entregasHoje, mesasHoje };
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

  const opsCards = [
    { label: "Aguardando", value: opsData?.aguardando ?? 0, icon: Hourglass, color: "text-yellow-500" },
    { label: "Em Preparo", value: opsData?.emPreparo ?? 0, icon: ChefHat, color: "text-orange-500" },
    { label: "Prontos", value: opsData?.prontos ?? 0, icon: CheckCircle2, color: "text-green-500" },
    { label: "Em Entrega", value: opsData?.emEntrega ?? 0, icon: Truck, color: "text-blue-500" },
    { label: "Finalizados Hoje", value: opsData?.finalizados ?? 0, icon: CheckCircle2, color: "text-emerald-600" },
    { label: "Em Andamento", value: opsData?.emAndamento ?? 0, icon: Activity, color: "text-primary" },
  ];

  const showEntregadorRanking = !isGarcom; // Everyone except garcom-only
  const showGarcomRanking = !isEntregador; // Everyone except entregador-only

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">
          Dashboard {tenantName ? `- ${tenantName}` : isSuperAdmin ? <span className="text-primary">Global</span> : ""}
        </h1>
        <p className="text-muted-foreground text-sm">Bem-vindo, {user?.name || user?.login}</p>
      </div>

      {/* ═══ LAYER 1: O AGORA ═══ */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Operação em Tempo Real
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {opsCards.map((card) => (
            <Card key={card.label} className="relative overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ═══ LAYER 2: FINANCEIRO (ADMIN ONLY) ═══ */}
      {canSeeFinancials && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Financeiro — Somente Vendas Pagas
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Faturamento Hoje</CardTitle>
                <DollarSign className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{formatCurrency(financialData?.faturamentoDia ?? 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Faturamento Semana</CardTitle>
                <TooltipProvider>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <CalendarDays className="w-4 h-4 text-primary cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent><p>{weekLabel}</p></TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{formatCurrency(financialData?.faturamentoSemana ?? 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Faturamento Mês</CardTitle>
                <TooltipProvider>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <DollarSign className="w-4 h-4 text-primary cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent><p>{monthLabel}</p></TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{formatCurrency(financialData?.faturamentoMes ?? 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Vendas Pagas</CardTitle>
                <ShoppingCart className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{financialData?.qtdVendasPagas ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Ticket Médio</CardTitle>
                <TrendingUp className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{formatCurrency(financialData?.ticketMedio ?? 0)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          {financialData?.chartData && financialData.chartData.length > 0 && (
            <div className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Vendas por Semana (Mês)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={financialData.chartData}>
                        <XAxis dataKey="day" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip formatter={(value: number) => [formatCurrency(value), "Total"]} />
                        <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ═══ LAYER 3: PERFORMANCE OPERACIONAL ═══ */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          📊 Performance Operacional
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Entregador Ranking */}
          {showEntregadorRanking && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="w-4 h-4" /> 🛵 Top Entregadores
                  {performanceData?.entregasHoje !== undefined && (
                    <Badge variant="secondary" className="text-xs ml-auto">{performanceData.entregasHoje} hoje</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {performanceData?.entregadorRanking && performanceData.entregadorRanking.length > 0 ? (
                  <div className="space-y-3">
                    {performanceData.entregadorRanking.slice(0, 5).map((e: any, i: number) => (
                      <div key={e.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`}</span>
                          <div>
                            <p className="font-medium text-foreground">{e.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {e.entregas} entrega{e.entregas !== 1 ? "s" : ""} no mês
                              {e.hoje > 0 && <span className="ml-1 text-primary">· {e.hoje} hoje</span>}
                            </p>
                          </div>
                        </div>
                        {e.tempoMedio !== null && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Timer className="w-3 h-3" /> ~{e.tempoMedio}min
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma entrega finalizada este mês.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Garçom Ranking */}
          {showGarcomRanking && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4" /> 🍽️ Top Garçons
                  {performanceData?.mesasHoje !== undefined && (
                    <Badge variant="secondary" className="text-xs ml-auto">{performanceData.mesasHoje} hoje</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {performanceData?.garcomRanking && performanceData.garcomRanking.length > 0 ? (
                  <div className="space-y-3">
                    {performanceData.garcomRanking.slice(0, 5).map((g: any, i: number) => (
                      <div key={g.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`}</span>
                          <div>
                            <p className="font-medium text-foreground">{g.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {g.pedidos} pedido{g.pedidos !== 1 ? "s" : ""} no mês
                              {g.hoje > 0 && <span className="ml-1 text-primary">· {g.hoje} hoje</span>}
                            </p>
                          </div>
                        </div>
                        {canSeeFinancials && (
                          <span className="text-xs font-medium text-foreground">{formatCurrency(g.valorTotal)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum pedido de mesa finalizado este mês.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            Alertas de Estoque
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
  );
};

export default DashboardPage;
