import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Search, Eye, Calendar, Building2, Pencil, Save, X,
  TrendingUp, TrendingDown, DollarSign, ArrowUpCircle, ArrowDownCircle,
  FileText, Repeat, Trash2, BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const PAYMENT_LABELS: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
};

const CHART_COLORS = {
  revenue: "#16a34a",
  expense: "#dc2626",
  balance: "#2563eb",
};

const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const formatCurrency = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// =============================================
// CHARTS COMPONENT
// =============================================
const CaixaCharts = ({ revenues, expenses }: { revenues: any[]; expenses: any[] }) => {
  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; receitas: number; despesas: number; sortKey: string }> = {};

    (revenues || []).forEach((r: any) => {
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      const label = `${MONTHS_PT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
      if (!map[key]) map[key] = { month: label, receitas: 0, despesas: 0, sortKey: key };
      map[key].receitas += Number(r.amount);
    });

    (expenses || []).forEach((e: any) => {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      const label = `${MONTHS_PT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
      if (!map[key]) map[key] = { month: label, receitas: 0, despesas: 0, sortKey: key };
      map[key].despesas += Number(e.amount);
    });

    return Object.values(map).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [revenues, expenses]);

  const balanceData = useMemo(() => {
    let cumulative = 0;
    return monthlyData.map((m) => {
      cumulative += m.receitas - m.despesas;
      return { month: m.month, saldo: cumulative };
    });
  }, [monthlyData]);

  // Revenue by category for pie
  const revenueByCat = useMemo(() => {
    const map: Record<string, number> = {};
    (revenues || []).forEach((r: any) => {
      const name = r.revenue_types?.name || "Outros";
      map[name] = (map[name] || 0) + Number(r.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [revenues]);

  const PIE_COLORS = ["#16a34a", "#22c55e", "#4ade80", "#86efac", "#bbf7d0", "#dcfce7"];

  if (monthlyData.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Bar chart: Receitas vs Despesas */}
      <Card>
        <CardContent className="pt-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            Receitas vs Despesas por Mês
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 10 }} width={70} />
              <RechartsTooltip
                formatter={(value: number, name: string) => [
                  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
                  name === "receitas" ? "Receitas" : "Despesas",
                ]}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Legend formatter={(v) => (v === "receitas" ? "Receitas" : "Despesas")} />
              <Bar dataKey="receitas" fill={CHART_COLORS.revenue} radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesas" fill={CHART_COLORS.expense} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Line chart: Saldo acumulado */}
      <Card>
        <CardContent className="pt-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            Saldo Acumulado
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={balanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 10 }} width={70} />
              <RechartsTooltip
                formatter={(value: number) => [
                  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
                  "Saldo",
                ]}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="saldo"
                stroke={CHART_COLORS.balance}
                strokeWidth={2.5}
                dot={{ r: 4, fill: CHART_COLORS.balance }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Pie chart: Receitas por categoria */}
      {revenueByCat.length > 1 && (
        <Card className="lg:col-span-2">
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              Receitas por Categoria
            </h3>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={revenueByCat}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    dataKey="value"
                    paddingAngle={2}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {revenueByCat.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: number) => [
                      `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
                    ]}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// =============================================
// OVERVIEW TAB
// =============================================
const CaixaOverview = ({
  revenues,
  expenses,
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
  filterType,
  setFilterType,
  filterDirection,
  setFilterDirection,
  revenueTypes,
  expenseTypes,
  tenant,
  userProfile,
}: any) => {
  const totalRevenues = revenues?.reduce((sum: number, r: any) => sum + Number(r.amount), 0) || 0;
  const totalExpenses = expenses?.reduce((sum: number, e: any) => sum + Number(e.amount), 0) || 0;
  const balance = totalRevenues - totalExpenses;

  // Combine and sort chronologically
  const allMovements = useMemo(() => {
    const revs = (revenues || []).map((r: any) => ({
      ...r,
      direction: "in" as const,
      typeName: r.revenue_types?.name || "—",
    }));
    const exps = (expenses || []).map((e: any) => ({
      ...e,
      direction: "out" as const,
      typeName: e.expense_types?.name || "—",
    }));

    let combined = [...revs, ...exps];

    if (filterDirection === "in") combined = combined.filter((m) => m.direction === "in");
    if (filterDirection === "out") combined = combined.filter((m) => m.direction === "out");
    if (filterType && filterType !== "all") {
      combined = combined.filter((m) =>
        m.direction === "in"
          ? m.revenue_type_id === filterType
          : m.expense_type_id === filterType
      );
    }

    return combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [revenues, expenses, filterDirection, filterType]);

  const generateReport = async () => {
    if (allMovements.length === 0) {
      toast.error("Nenhuma movimentação para gerar relatório");
      return;
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 15;

    if (tenant?.logo_url) {
      try {
        const response = await fetch(tenant.logo_url);
        const blob = await response.blob();
        const reader = new FileReader();
        const logoData = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        doc.addImage(logoData, "PNG", 15, yPos, 20, 20);
        yPos += 2;
      } catch { /* skip */ }
    }

    const textX = tenant?.logo_url ? 40 : 15;
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(tenant?.name || "Loja", textX, yPos + 5);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const address = [tenant?.address, tenant?.city, tenant?.state].filter(Boolean).join(" - ");
    if (address) doc.text(address, textX, yPos + 11);
    doc.text(`Emitido por: ${userProfile?.name || userProfile?.login || "Admin"}`, textX, yPos + 17);
    doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, textX, yPos + 22);

    yPos = tenant?.logo_url ? 42 : 45;
    doc.setDrawColor(200, 200, 200);
    doc.line(15, yPos, pageWidth - 15, yPos);
    yPos += 5;

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório de Caixa", pageWidth / 2, yPos, { align: "center" });
    yPos += 10;

    const tableData = allMovements.map((m: any) => [
      new Date(m.date).toLocaleDateString("pt-BR"),
      m.direction === "in" ? "Receita" : "Despesa",
      m.typeName,
      m.description || "—",
      `${m.direction === "in" ? "+" : "-"} R$ ${Number(m.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Data", "Tipo", "Categoria", "Descrição", "Valor"]],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [255, 107, 0], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      margin: { left: 15, right: 15 },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 4) {
          const value = data.cell.raw as string;
          if (value.startsWith("+")) data.cell.styles.textColor = [22, 163, 74];
          else data.cell.styles.textColor = [220, 38, 38];
        }
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || yPos + 50;
    let summaryY = finalY + 10;
    if (summaryY + 60 > doc.internal.pageSize.getHeight()) { doc.addPage(); summaryY = 20; }

    // --- Build revenue summary by type ---
    const revenueByType: Record<string, { count: number; total: number }> = {};
    (revenues || []).forEach((r: any) => {
      const typeName = r.revenue_types?.name || "Outros";
      if (!revenueByType[typeName]) revenueByType[typeName] = { count: 0, total: 0 };
      revenueByType[typeName].count += 1;
      revenueByType[typeName].total += Number(r.amount);
    });

    // --- Build expense summary by type ---
    const expenseByType: Record<string, { count: number; total: number }> = {};
    (expenses || []).forEach((e: any) => {
      const typeName = e.expense_types?.name || "Outros";
      if (!expenseByType[typeName]) expenseByType[typeName] = { count: 0, total: 0 };
      expenseByType[typeName].count += 1;
      expenseByType[typeName].total += Number(e.amount);
    });

    doc.setDrawColor(200, 200, 200);
    doc.line(15, summaryY - 3, pageWidth - 15, summaryY - 3);
    summaryY += 2;

    const halfWidth = (pageWidth - 30) / 2;
    const leftX = 15;
    const rightX = 15 + halfWidth + 5;

    // --- Left column: Resumo de Receitas ---
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 163, 74);
    doc.text("Resumo de Receitas", leftX, summaryY + 4);
    let leftY = summaryY + 12;

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("Categoria", leftX + 2, leftY);
    doc.text("Qtd", leftX + halfWidth - 28, leftY, { align: "right" });
    doc.text("Valor", leftX + halfWidth - 2, leftY, { align: "right" });
    leftY += 5;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    const revEntries = Object.entries(revenueByType);
    revEntries.forEach(([name, data]) => {
      doc.text(name, leftX + 2, leftY);
      doc.text(String(data.count), leftX + halfWidth - 28, leftY, { align: "right" });
      doc.setTextColor(22, 163, 74);
      doc.text(`R$ ${data.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, leftX + halfWidth - 2, leftY, { align: "right" });
      doc.setTextColor(0, 0, 0);
      leftY += 5;
    });
    leftY += 2;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 163, 74);
    doc.text("Total:", leftX + 2, leftY);
    doc.text(`R$ ${totalRevenues.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, leftX + halfWidth - 2, leftY, { align: "right" });

    // --- Right column: Resumo de Despesas ---
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38);
    doc.text("Resumo de Despesas", rightX, summaryY + 4);
    let rightY = summaryY + 12;

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("Categoria", rightX + 2, rightY);
    doc.text("Qtd", rightX + halfWidth - 28, rightY, { align: "right" });
    doc.text("Valor", rightX + halfWidth - 2, rightY, { align: "right" });
    rightY += 5;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    const expEntries = Object.entries(expenseByType);
    expEntries.forEach(([name, data]) => {
      doc.text(name, rightX + 2, rightY);
      doc.text(String(data.count), rightX + halfWidth - 28, rightY, { align: "right" });
      doc.setTextColor(220, 38, 38);
      doc.text(`R$ ${data.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, rightX + halfWidth - 2, rightY, { align: "right" });
      doc.setTextColor(0, 0, 0);
      rightY += 5;
    });
    rightY += 2;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38);
    doc.text("Total:", rightX + 2, rightY);
    doc.text(`R$ ${totalExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, rightX + halfWidth - 2, rightY, { align: "right" });

    // --- Vertical divider between columns ---
    const maxColumnY = Math.max(leftY, rightY) + 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(leftX + halfWidth + 2, summaryY - 1, leftX + halfWidth + 2, maxColumnY - 2);

    // --- Balance / Saldo ---
    let balanceY = maxColumnY + 4;
    if (balanceY + 15 > doc.internal.pageSize.getHeight()) { doc.addPage(); balanceY = 20; }

    doc.setDrawColor(200, 200, 200);
    doc.line(15, balanceY - 2, pageWidth - 15, balanceY - 2);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Saldo Líquido:", 20, balanceY + 6);
    if (balance >= 0) doc.setTextColor(22, 163, 74);
    else doc.setTextColor(220, 38, 38);
    doc.text(`R$ ${balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, pageWidth - 20, balanceY + 6, { align: "right" });

    doc.save(`relatorio-caixa-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("Relatório gerado com sucesso!");
  };

  const allTypes = [
    ...(revenueTypes || []).map((t: any) => ({ ...t, group: "Receita" })),
    ...(expenseTypes || []).map((t: any) => ({ ...t, group: "Despesa" })),
  ];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-green-200 dark:border-green-900">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/30">
              <ArrowUpCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entradas</p>
              <p className="text-lg font-bold text-green-600">
                R$ {totalRevenues.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-900">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30">
              <ArrowDownCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saídas</p>
              <p className="text-lg font-bold text-red-600">
                R$ {totalExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className={balance >= 0 ? "border-blue-200 dark:border-blue-900" : "border-orange-200 dark:border-orange-900"}>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${balance >= 0 ? "bg-blue-100 dark:bg-blue-900/30" : "bg-orange-100 dark:bg-orange-900/30"}`}>
              <DollarSign className={`w-5 h-5 ${balance >= 0 ? "text-blue-600" : "text-orange-600"}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className={`text-lg font-bold ${balance >= 0 ? "text-blue-600" : "text-orange-600"}`}>
                R$ {balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <CaixaCharts revenues={revenues} expenses={expenses} />
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <Select value={filterDirection} onValueChange={setFilterDirection}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="in">Apenas Receitas</SelectItem>
                <SelectItem value="out">Apenas Despesas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {allTypes.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.group}: {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
              <span className="text-muted-foreground text-sm">até</span>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
            </div>
            <Button variant="outline" onClick={generateReport}>
              <FileText className="w-4 h-4 mr-1" /> Relatório
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Movements list */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allMovements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma movimentação encontrada
                  </TableCell>
                </TableRow>
              ) : (
                allMovements.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm">{new Date(m.date).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      <Badge variant={m.direction === "in" ? "default" : "destructive"} className={m.direction === "in" ? "bg-green-600 hover:bg-green-700" : ""}>
                        {m.direction === "in" ? "Receita" : "Despesa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{m.typeName}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{m.description || "—"}</TableCell>
                    <TableCell className={`text-right font-semibold ${m.direction === "in" ? "text-green-600" : "text-red-600"}`}>
                      {m.direction === "in" ? "+" : "-"} R$ {Number(m.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// =============================================
// REVENUES TAB
// =============================================
const ReceitasTab = ({ tenantId, revenueTypes }: { tenantId: string; revenueTypes: any[] }) => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ amount: "", date: new Date().toISOString().slice(0, 10), description: "", revenue_type_id: "" });

  // Manage revenue types
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

  const { data: revenues, isLoading } = useQuery({
    queryKey: ["revenues", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("revenues")
        .select("*, revenue_types(name)")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .order("date", { ascending: false })
        .limit(50);
      return (data || []) as any[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("revenues").insert({
        tenant_id: tenantId,
        amount: parseFloat(form.amount),
        date: form.date,
        description: form.description || null,
        revenue_type_id: form.revenue_type_id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revenues"] });
      queryClient.invalidateQueries({ queryKey: ["revenues-overview"] });
      setIsOpen(false);
      setForm({ amount: "", date: new Date().toISOString().slice(0, 10), description: "", revenue_type_id: "" });
      toast.success("Receita cadastrada!");
    },
    onError: () => toast.error("Erro ao cadastrar receita"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("revenues").update({ active: false } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revenues"] });
      queryClient.invalidateQueries({ queryKey: ["revenues-overview"] });
      toast.success("Receita removida!");
    },
  });

  const createTypeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("revenue_types").insert({
        tenant_id: tenantId,
        name: newTypeName,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revenue-types"] });
      setNewTypeName("");
      setIsTypeOpen(false);
      toast.success("Tipo de receita criado!");
    },
    onError: () => toast.error("Erro ao criar tipo"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-600" /> Receitas
        </h2>
        <div className="flex gap-2">
          <Dialog open={isTypeOpen} onOpenChange={setIsTypeOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-3.5 h-3.5 mr-1" /> Tipo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Tipo de Receita</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <Input placeholder="Nome do tipo" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} />
                <Button className="w-full" onClick={() => createTypeMutation.mutate()} disabled={!newTypeName || createTypeMutation.isPending}>
                  {createTypeMutation.isPending ? "Salvando..." : "Criar Tipo"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-1" /> Nova Receita
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Cadastrar Receita</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <label className="text-sm font-medium">Valor (R$)</label>
                  <Input type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Data</label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Tipo de Receita</label>
                  <Select value={form.revenue_type_id} onValueChange={(v) => setForm({ ...form, revenue_type_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {(revenueTypes || []).map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Descrição</label>
                  <Input placeholder="Opcional" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <Button className="w-full" onClick={() => createMutation.mutate()} disabled={!form.amount || !form.revenue_type_id || createMutation.isPending}>
                  {createMutation.isPending ? "Salvando..." : "Cadastrar Receita"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : revenues?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma receita cadastrada</TableCell></TableRow>
              ) : (
                revenues?.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{new Date(r.date).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-sm">{r.revenue_types?.name || "—"}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{r.description || "—"}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      + R$ {Number(r.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      {!r.sale_id && (
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(r.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// =============================================
// EXPENSES TAB
// =============================================
const DespesasTab = ({ tenantId, expenseTypes }: { tenantId: string; expenseTypes: any[] }) => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    amount: "", date: new Date().toISOString().slice(0, 10), description: "", expense_type_id: "",
    is_recurring: false, frequency: "", custom_days: "", start_date: "", end_date: "",
  });

  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("*, expense_types(name)")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .order("date", { ascending: false })
        .limit(50);
      return (data || []) as any[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      // Insert the main expense
      const mainExpense: any = {
        tenant_id: tenantId,
        amount: parseFloat(form.amount),
        date: form.date,
        description: form.description || null,
        expense_type_id: form.expense_type_id,
        is_recurring: form.is_recurring,
        frequency: form.is_recurring ? form.frequency : null,
        custom_days: form.is_recurring && form.frequency === "custom" ? parseInt(form.custom_days) : null,
        start_date: form.is_recurring ? (form.start_date || form.date) : null,
        end_date: form.is_recurring && form.end_date ? form.end_date : null,
      };

      const { data: inserted, error } = await supabase.from("expenses").insert(mainExpense).select("id").single();
      if (error) throw error;

      // If recurring, generate future entries
      if (form.is_recurring && inserted) {
        await generateRecurringEntries(inserted.id, mainExpense);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-overview"] });
      setIsOpen(false);
      setForm({
        amount: "", date: new Date().toISOString().slice(0, 10), description: "", expense_type_id: "",
        is_recurring: false, frequency: "", custom_days: "", start_date: "", end_date: "",
      });
      toast.success("Despesa cadastrada!");
    },
    onError: () => toast.error("Erro ao cadastrar despesa"),
  });

  const generateRecurringEntries = async (parentId: string, base: any) => {
    const startDate = new Date(base.start_date || base.date);
    const endDate = base.end_date ? new Date(base.end_date) : null;
    const maxEntries = 12; // Generate up to 12 future entries
    const entries: any[] = [];

    for (let i = 1; i <= maxEntries; i++) {
      const nextDate = new Date(startDate);

      switch (base.frequency) {
        case "weekly": nextDate.setDate(nextDate.getDate() + 7 * i); break;
        case "biweekly": nextDate.setDate(nextDate.getDate() + 14 * i); break;
        case "monthly": nextDate.setMonth(nextDate.getMonth() + i); break;
        case "yearly": nextDate.setFullYear(nextDate.getFullYear() + i); break;
        case "custom":
          if (base.custom_days) nextDate.setDate(nextDate.getDate() + base.custom_days * i);
          break;
      }

      if (endDate && nextDate > endDate) break;

      entries.push({
        tenant_id: base.tenant_id,
        amount: base.amount,
        date: nextDate.toISOString().slice(0, 10),
        description: base.description,
        expense_type_id: base.expense_type_id,
        is_recurring: false,
        parent_expense_id: parentId,
      });
    }

    if (entries.length > 0) {
      await supabase.from("expenses").insert(entries as any);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Also deactivate child entries
      await supabase.from("expenses").update({ active: false } as any).eq("parent_expense_id", id);
      const { error } = await supabase.from("expenses").update({ active: false } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-overview"] });
      toast.success("Despesa removida!");
    },
  });

  const createTypeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("expense_types").insert({
        tenant_id: tenantId,
        name: newTypeName,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-types"] });
      setNewTypeName("");
      setIsTypeOpen(false);
      toast.success("Tipo de despesa criado!");
    },
    onError: () => toast.error("Erro ao criar tipo"),
  });

  const FREQUENCY_LABELS: Record<string, string> = {
    weekly: "Semanal",
    biweekly: "Quinzenal",
    monthly: "Mensal",
    yearly: "Anual",
    custom: "Personalizado",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-red-600" /> Despesas
        </h2>
        <div className="flex gap-2">
          <Dialog open={isTypeOpen} onOpenChange={setIsTypeOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-3.5 h-3.5 mr-1" /> Tipo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Tipo de Despesa</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <Input placeholder="Nome do tipo" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} />
                <Button className="w-full" onClick={() => createTypeMutation.mutate()} disabled={!newTypeName || createTypeMutation.isPending}>
                  {createTypeMutation.isPending ? "Salvando..." : "Criar Tipo"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-1" /> Nova Despesa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Cadastrar Despesa</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <label className="text-sm font-medium">Valor (R$)</label>
                  <Input type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Data</label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Tipo de Despesa</label>
                  <Select value={form.expense_type_id} onValueChange={(v) => setForm({ ...form, expense_type_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {(expenseTypes || []).map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Descrição</label>
                  <Input placeholder="Opcional" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>

                <Separator />

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="recurring"
                    checked={form.is_recurring}
                    onCheckedChange={(checked) => setForm({ ...form, is_recurring: !!checked })}
                  />
                  <label htmlFor="recurring" className="text-sm font-medium flex items-center gap-1.5">
                    <Repeat className="w-4 h-4" /> Despesa recorrente
                  </label>
                </div>

                {form.is_recurring && (
                  <div className="space-y-3 pl-6 border-l-2 border-muted">
                    <div>
                      <label className="text-sm font-medium">Frequência</label>
                      <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Semanal</SelectItem>
                          <SelectItem value="biweekly">Quinzenal</SelectItem>
                          <SelectItem value="monthly">Mensal</SelectItem>
                          <SelectItem value="yearly">Anual</SelectItem>
                          <SelectItem value="custom">Personalizado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {form.frequency === "custom" && (
                      <div>
                        <label className="text-sm font-medium">A cada quantos dias?</label>
                        <Input type="number" placeholder="Ex: 10" value={form.custom_days} onChange={(e) => setForm({ ...form, custom_days: e.target.value })} />
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium">Data de início</label>
                      <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Data de término (opcional)</label>
                      <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={() => createMutation.mutate()}
                  disabled={!form.amount || !form.expense_type_id || (form.is_recurring && !form.frequency) || createMutation.isPending}
                >
                  {createMutation.isPending ? "Salvando..." : "Cadastrar Despesa"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-center">Recorrente</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : expenses?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma despesa cadastrada</TableCell></TableRow>
              ) : (
                expenses?.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">{new Date(e.date).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-sm">{e.expense_types?.name || "—"}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{e.description || "—"}</TableCell>
                    <TableCell className="text-center">
                      {e.is_recurring ? (
                        <Badge variant="outline" className="text-xs">
                          <Repeat className="w-3 h-3 mr-1" />
                          {FREQUENCY_LABELS[e.frequency] || e.frequency}
                        </Badge>
                      ) : e.parent_expense_id ? (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Gerada
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-red-600">
                      - R$ {Number(e.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(e.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// =============================================
// MAIN CAIXA PAGE
// =============================================
const CaixaPage = () => {
  const { user } = useAuth();
  const { effectiveTenantId, isReadOnly, isSuperAdmin, isAdminTenant } = useAdmin();

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterDirection, setFilterDirection] = useState("all");

  // Fetch revenue types
  const { data: revenueTypes } = useQuery({
    queryKey: ["revenue-types", effectiveTenantId],
    enabled: !!effectiveTenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("revenue_types")
        .select("*")
        .eq("tenant_id", effectiveTenantId!)
        .eq("active", true)
        .order("name");
      return (data || []) as any[];
    },
  });

  // Fetch expense types
  const { data: expenseTypes } = useQuery({
    queryKey: ["expense-types", effectiveTenantId],
    enabled: !!effectiveTenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("expense_types")
        .select("*")
        .eq("tenant_id", effectiveTenantId!)
        .eq("active", true)
        .order("name");
      return (data || []) as any[];
    },
  });

  // Fetch revenues
  const { data: revenues } = useQuery({
    queryKey: ["revenues-overview", effectiveTenantId, dateFrom, dateTo],
    enabled: !!effectiveTenantId,
    queryFn: async () => {
      let query = supabase
        .from("revenues")
        .select("*, revenue_types(name)")
        .eq("tenant_id", effectiveTenantId!)
        .eq("active", true)
        .order("date", { ascending: false });

      if (dateFrom) query = query.gte("date", dateFrom);
      if (dateTo) query = query.lte("date", dateTo);

      const { data } = await query;
      return (data || []) as any[];
    },
  });

  // Fetch expenses
  const { data: expenses } = useQuery({
    queryKey: ["expenses-overview", effectiveTenantId, dateFrom, dateTo],
    enabled: !!effectiveTenantId,
    queryFn: async () => {
      let query = supabase
        .from("expenses")
        .select("*, expense_types(name)")
        .eq("tenant_id", effectiveTenantId!)
        .eq("active", true)
        .order("date", { ascending: false });

      if (dateFrom) query = query.gte("date", dateFrom);
      if (dateTo) query = query.lte("date", dateTo);

      const { data } = await query;
      return (data || []) as any[];
    },
  });

  // Fetch tenant for report
  const { data: tenant } = useQuery({
    queryKey: ["tenant-report", effectiveTenantId],
    enabled: !!effectiveTenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("tenants")
        .select("name, address, city, state, logo_url")
        .eq("id", effectiveTenantId!)
        .single();
      return data;
    },
  });

  const { data: userProfile } = useQuery({
    queryKey: ["user-profile-report"],
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return null;
      const { data } = await supabase
        .from("profiles")
        .select("name, login")
        .eq("auth_id", authUser.id)
        .eq("active", true)
        .maybeSingle();
      return data;
    },
  });

  if (!effectiveTenantId) {
    return (
      <div className="text-center py-20">
        <Building2 className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold mb-1">Selecione um restaurante</h3>
        <p className="text-muted-foreground text-sm">Escolha um restaurante para visualizar o caixa.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <DollarSign className="w-6 h-6" /> Caixa
      </h1>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="revenues">Receitas</TabsTrigger>
          <TabsTrigger value="expenses">Despesas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <CaixaOverview
            revenues={revenues}
            expenses={expenses}
            dateFrom={dateFrom}
            dateTo={dateTo}
            setDateFrom={setDateFrom}
            setDateTo={setDateTo}
            filterType={filterType}
            setFilterType={setFilterType}
            filterDirection={filterDirection}
            setFilterDirection={setFilterDirection}
            revenueTypes={revenueTypes}
            expenseTypes={expenseTypes}
            tenant={tenant}
            userProfile={userProfile}
          />
        </TabsContent>

        <TabsContent value="revenues">
          <ReceitasTab tenantId={effectiveTenantId} revenueTypes={revenueTypes || []} />
        </TabsContent>

        <TabsContent value="expenses">
          <DespesasTab tenantId={effectiveTenantId} expenseTypes={expenseTypes || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CaixaPage;
