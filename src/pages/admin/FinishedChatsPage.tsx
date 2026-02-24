import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const FINANCIAL_LABELS: Record<string, { label: string; dotClass: string }> = {
  pending: { label: "Pendente", dotClass: "bg-destructive" },
  partial: { label: "Parcial", dotClass: "bg-yellow-500" },
  paid: { label: "Pago", dotClass: "bg-green-600" },
};

const PAGE_SIZE = 20;

const FinishedChatsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const tenantId = user?.tenant_id;

  const [search, setSearch] = useState("");
  const [financialFilter, setFinancialFilter] = useState("all");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["finished-chats", tenantId, page],
    enabled: !!tenantId,
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from("chats")
        .select("*, customers(name, phone), sales!sales_chat_id_fkey(sale_number, valor_total, financial_status, operational_status, created_at)", { count: "exact" })
        .eq("tenant_id", tenantId!)
        .eq("active", false)
        .order("updated_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { items: data || [], total: count || 0 };
    },
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Client-side filter
  const filtered = items.filter((chat: any) => {
    const name = chat.customers?.name || "";
    const salesArr = chat.sales;
    const sale = Array.isArray(salesArr) ? salesArr[0] : salesArr;
    const saleNum = sale?.sale_number?.toString() || "";

    const matchesSearch = !search || name.toLowerCase().includes(search.toLowerCase()) || saleNum.includes(search);
    const matchesFinancial = financialFilter === "all" || sale?.financial_status === financialFilter;
    return matchesSearch && matchesFinancial;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/pedidos")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">Pedidos Finalizados</h1>
        <span className="text-sm text-muted-foreground">({total})</span>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente ou nº venda..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={financialFilter} onValueChange={setFinancialFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status financeiro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="partial">Parcial</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">Nenhum pedido finalizado encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((chat: any) => {
            const salesArr = chat.sales;
            const sale = Array.isArray(salesArr) ? salesArr[0] : salesArr;
            const customerName = chat.customers?.name || "Cliente";
            const financial = sale ? FINANCIAL_LABELS[sale.financial_status] || FINANCIAL_LABELS.pending : null;
            const saleTime = sale?.created_at ? format(new Date(sale.created_at), "dd/MM HH:mm") : "";

            return (
              <button
                key={chat.id}
                onClick={() => navigate(`/admin/pedidos/${chat.id}`)}
                className="w-full text-left p-4 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {customerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        {customerName}
                        {sale?.sale_number && <span className="text-muted-foreground font-normal"> · #{sale.sale_number}</span>}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {saleTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {saleTime}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {sale && (
                      <span className="text-sm font-semibold text-foreground">
                        R$ {Number(sale.valor_total).toFixed(2)}
                      </span>
                    )}
                    {financial && (
                      <span className="flex items-center gap-1 text-xs">
                        <span className={`w-2 h-2 rounded-full ${financial.dotClass}`} />
                        {financial.label}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
};

export default FinishedChatsPage;
