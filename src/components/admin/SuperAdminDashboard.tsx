import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, TrendingUp, Activity, Building2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const SuperAdminDashboard = () => {
  const { user } = useAuth();
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");

  const { data: tenants } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, active")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: salesData } = useQuery({
    queryKey: ["sales-stats", selectedTenantId],
    enabled: !!selectedTenantId,
    queryFn: async () => {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

      const { data: allSales } = await supabase
        .from("sales" as any)
        .select("*")
        .eq("tenant_id", selectedTenantId)
        .eq("active", true)
        .gte("created_at", startOfMonth)
        .order("created_at", { ascending: false });

      const sales = (allSales || []) as any[];
      const todaySales = sales.filter((s: any) => s.created_at >= startOfDay);

      const faturamentoDia = todaySales.reduce((acc: number, s: any) => acc + Number(s.valor_total), 0);
      const faturamentoMes = sales.reduce((acc: number, s: any) => acc + Number(s.valor_total), 0);
      const numVendas = sales.length;
      const ticketMedio = numVendas > 0 ? faturamentoMes / numVendas : 0;

      // Group by day for chart
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
    if (!salesData) return { label: "Selecione um tenant", color: "text-muted-foreground", bg: "bg-muted" };
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold">Dashboard <span className="text-primary">Global</span></h1>
              <p className="text-muted-foreground text-sm">Bem-vindo, {user?.login}</p>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-muted-foreground" />
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Selecione um restaurante" />
                </SelectTrigger>
                <SelectContent>
                  {tenants?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!selectedTenantId ? (
            <div className="text-center py-20">
              <Building2 className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold mb-1">Selecione um restaurante</h3>
              <p className="text-muted-foreground text-sm">Escolha um tenant acima para visualizar os dados</p>
            </div>
          ) : (
            <>
              {/* Status badge */}
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
                <Card className="mb-8">
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
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default SuperAdminDashboard;
