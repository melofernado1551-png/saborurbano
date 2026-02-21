import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AdminSidebar from "./AdminSidebar";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Eye, Calendar } from "lucide-react";
import { toast } from "sonner";

const SalesPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string>(user?.tenant_id || "");

  // New sale form
  const [newSale, setNewSale] = useState({ valor_total: "", forma_pagamento: "", observacao: "" });

  const isSuperAdmin = user?.role === "superadmin";

  const { data: tenants } = useQuery({
    queryKey: ["tenants-for-sales"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("id, name").eq("active", true).order("name");
      return data || [];
    },
  });

  const tenantId = isSuperAdmin ? selectedTenantId : user?.tenant_id;

  const { data: sales, isLoading } = useQuery({
    queryKey: ["sales", tenantId, dateFrom, dateTo],
    enabled: !!tenantId,
    queryFn: async () => {
      let query = supabase
        .from("sales" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");

      const { data } = await query;
      return (data || []) as any[];
    },
  });

  const createSaleMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("Selecione um tenant");
      const { error } = await supabase.from("sales" as any).insert({
        tenant_id: tenantId,
        valor_total: parseFloat(newSale.valor_total),
        forma_pagamento: newSale.forma_pagamento || null,
        observacao: newSale.observacao || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      setIsCreateOpen(false);
      setNewSale({ valor_total: "", forma_pagamento: "", observacao: "" });
      toast.success("Venda registrada com sucesso!");
    },
    onError: () => toast.error("Erro ao registrar venda"),
  });

  const filteredSales = sales?.filter((s: any) => {
    if (!search) return true;
    return (
      s.forma_pagamento?.toLowerCase().includes(search.toLowerCase()) ||
      s.observacao?.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <h1 className="text-2xl font-bold">Vendas</h1>
            <div className="flex items-center gap-3">
              {isSuperAdmin && (
                <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Selecione tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button disabled={!tenantId}>
                    <Plus className="w-4 h-4 mr-1" /> Nova Venda
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar Nova Venda</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div>
                      <label className="text-sm font-medium">Valor Total (R$)</label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={newSale.valor_total}
                        onChange={(e) => setNewSale({ ...newSale, valor_total: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Forma de Pagamento</label>
                      <Select
                        value={newSale.forma_pagamento}
                        onValueChange={(v) => setNewSale({ ...newSale, forma_pagamento: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="pix">Pix</SelectItem>
                          <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                          <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Observação</label>
                      <Input
                        placeholder="Opcional"
                        value={newSale.observacao}
                        onChange={(e) => setNewSale({ ...newSale, observacao: e.target.value })}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => createSaleMutation.mutate()}
                      disabled={!newSale.valor_total || createSaleMutation.isPending}
                    >
                      {createSaleMutation.isPending ? "Salvando..." : "Registrar Venda"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por pagamento ou observação..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
                  <span className="text-muted-foreground">até</span>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sales table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Observação</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                    </TableRow>
                  ) : !tenantId ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Selecione um tenant</TableCell>
                    </TableRow>
                  ) : filteredSales?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma venda encontrada</TableCell>
                    </TableRow>
                  ) : (
                    filteredSales?.map((sale: any) => (
                      <TableRow key={sale.id}>
                        <TableCell className="text-sm">
                          {new Date(sale.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="font-semibold">
                          R$ {Number(sale.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="capitalize text-sm">{sale.forma_pagamento?.replace("_", " ") || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-xs">{sale.observacao || "—"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => setSelectedSale(sale)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Sale detail dialog */}
          <Dialog open={!!selectedSale} onOpenChange={() => setSelectedSale(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Detalhes da Venda</DialogTitle>
              </DialogHeader>
              {selectedSale && (
                <div className="space-y-3 mt-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID</span>
                    <span className="text-sm font-mono">{selectedSale.id.slice(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data</span>
                    <span>{new Date(selectedSale.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor Total</span>
                    <span className="font-bold text-lg">
                      R$ {Number(selectedSale.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pagamento</span>
                    <span className="capitalize">{selectedSale.forma_pagamento?.replace("_", " ") || "—"}</span>
                  </div>
                  {selectedSale.observacao && (
                    <div>
                      <span className="text-muted-foreground text-sm">Observação</span>
                      <p className="mt-1">{selectedSale.observacao}</p>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
};

export default SalesPage;
