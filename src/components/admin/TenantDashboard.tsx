import { useAuth } from "@/contexts/AuthContext";
import AdminSidebar from "./AdminSidebar";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, TrendingUp, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const TenantDashboard = () => {
  const { user } = useAuth();

  const { data: salesData } = useQuery({
    queryKey: ["tenant-sales-stats", user?.tenant_id],
    enabled: !!user?.tenant_id,
    queryFn: async () => {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

      const { data: allSales } = await supabase
        .from("sales" as any)
        .select("*")
        .eq("tenant_id", user!.tenant_id!)
        .eq("active", true)
        .gte("created_at", startOfMonth)
        .order("created_at", { ascending: false });

      const sales = (allSales || []) as any[];
      const paidSales = sales.filter((s: any) => s.financial_status === 'paid');
      const todayPaidSales = paidSales.filter((s: any) => s.created_at >= startOfDay);

      const faturamentoDia = todayPaidSales.reduce((acc: number, s: any) => acc + Number(s.valor_total), 0);
      const faturamentoMes = paidSales.reduce((acc: number, s: any) => acc + Number(s.valor_total), 0);
      const numVendas = paidSales.length;
      const ticketMedio = numVendas > 0 ? faturamentoMes / numVendas : 0;

      const byDay: Record<string, number> = {};
      sales.forEach((s: any) => {
        const day = new Date(s.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        byDay[day] = (byDay[day] || 0) + Number(s.valor_total);
      });
      const chartData = Object.entries(byDay).map(([day, total]) => ({ day, total })).reverse();

      return { faturamentoDia, faturamentoMes, numVendas, ticketMedio, chartData };
    },
  });

  const getPerformanceStatus = () => {
    if (!salesData) return { label: "Carregando...", color: "text-muted-foreground", bg: "bg-muted" };
    if (salesData.faturamentoMes > 5000) return { label: "Excelente", color: "text-green-700", bg: "bg-green-100" };
    if (salesData.faturamentoMes > 2000) return { label: "Bom", color: "text-yellow-700", bg: "bg-yellow-100" };
    return { label: "Atenção", color: "text-red-700", bg: "bg-red-100" };
  };

  const status = getPerformanceStatus();

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground text-sm">Bem-vindo, {user?.login}</p>
          </div>

          {/* Status */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${status.bg} ${status.color} text-sm font-medium mb-6`}>
            <Activity className="w-4 h-4" />
            {status.label}
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento Hoje</CardTitle>
                <DollarSign className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  R$ {(salesData?.faturamentoDia || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento Mês</CardTitle>
                <TrendingUp className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  R$ {(salesData?.faturamentoMes || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Nº de Vendas</CardTitle>
                <ShoppingCart className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{salesData?.numVendas || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Médio</CardTitle>
                <DollarSign className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  R$ {(salesData?.ticketMedio || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          {salesData?.chartData && salesData.chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Vendas por Período</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesData.chartData}>
                      <XAxis dataKey="day" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Total"]}
                      />
                      <Bar dataKey="total" fill="hsl(24, 95%, 53%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default TenantDashboard;
