import { useState, useEffect } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Eye, Calendar, Building2, Pencil, User, MapPin, ShoppingBag, CreditCard, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const PAYMENT_LABELS: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
};

const FINANCIAL_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-destructive text-destructive-foreground" },
  awaiting_check: { label: "Aguardando conferência", color: "bg-yellow-500 text-white" },
  partial: { label: "Parcial", color: "bg-yellow-500 text-white" },
  paid: { label: "Pago", color: "bg-green-600 text-white" },
};

const OP_LABELS: Record<string, { label: string; emoji: string }> = {
  received: { label: "Recebido", emoji: "📥" },
  preparing: { label: "Em preparo", emoji: "👨‍🍳" },
  delivering: { label: "Saiu p/ entrega", emoji: "🛵" },
  finished: { label: "Finalizado", emoji: "✅" },
};

const SaleDetailDialog = ({ sale, open, onClose, isReadOnly, canEdit }: { sale: any; open: boolean; onClose: () => void; isReadOnly: boolean; canEdit: boolean }) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ observacao: "", forma_pagamento: "", operational_status: "" });

  // Fetch customer
  const { data: customer } = useQuery({
    queryKey: ["sale-customer", sale?.customer_id],
    enabled: !!sale?.customer_id && open,
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name, phone, email").eq("id", sale.customer_id).maybeSingle();
      return data;
    },
  });

  // Fetch delivery address from sale
  const deliveryAddress = sale?.delivery_address as any;

  // Fetch sale items
  const { data: saleItems = [] } = useQuery({
    queryKey: ["sale-items-detail", sale?.id],
    enabled: !!sale?.id && open,
    queryFn: async () => {
      // Try to get items from chat order_summary message
      if (!sale.chat_id) return [];
      const { data } = await supabase
        .from("chat_messages")
        .select("content")
        .eq("chat_id", sale.chat_id)
        .eq("message_type", "order_summary")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1);
      return data || [];
    },
  });

  // Fetch payments
  const { data: payments = [] } = useQuery({
    queryKey: ["sale-payments-detail", sale?.id],
    enabled: !!sale?.id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("sale_payments")
        .select("*")
        .eq("sale_id", sale.id)
        .eq("active", true)
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  useEffect(() => {
    if (sale && editing) {
      setEditData({
        observacao: sale.observacao || "",
        forma_pagamento: sale.forma_pagamento || "",
        operational_status: sale.operational_status || "received",
      });
    }
  }, [sale, editing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("sales")
        .update({
          observacao: editData.observacao || null,
          forma_pagamento: editData.forma_pagamento || null,
          operational_status: editData.operational_status,
        })
        .eq("id", sale.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      setEditing(false);
      toast.success("Venda atualizada!");
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const remaining = sale ? Number(sale.valor_total) - totalPaid : 0;
  const financialInfo = FINANCIAL_LABELS[sale?.financial_status] || FINANCIAL_LABELS.pending;
  const opInfo = OP_LABELS[sale?.operational_status] || OP_LABELS.received;

  // Parse order summary content
  const orderSummaryContent = saleItems.length > 0 ? saleItems[0].content : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setEditing(false); onClose(); } }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              Venda #{sale?.sale_number || "—"}
              <Badge className={`text-xs ${financialInfo.color}`}>{financialInfo.label}</Badge>
            </DialogTitle>
            {canEdit && !editing && (
              <Button variant="ghost" size="icon" onClick={() => setEditing(true)}>
                <Pencil className="w-4 h-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        {sale && (
          <div className="space-y-4">
            {/* Cliente */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Cliente
              </h4>
              {customer ? (
                <div className="px-3 py-2.5 rounded-xl bg-secondary/50 border border-border">
                  <p className="font-medium text-sm text-foreground">{customer.name}</p>
                  {customer.phone && <p className="text-xs text-muted-foreground">{customer.phone}</p>}
                  {customer.email && <p className="text-xs text-muted-foreground">{customer.email}</p>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Cliente não identificado</p>
              )}
            </div>

            {/* Endereço */}
            {deliveryAddress && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Endereço de entrega
                </h4>
                <div className="px-3 py-2.5 rounded-xl bg-secondary/50 border border-border">
                  <p className="font-medium text-sm text-foreground">{deliveryAddress.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {deliveryAddress.street}, {deliveryAddress.number}
                    {deliveryAddress.complement ? ` - ${deliveryAddress.complement}` : ""} — {deliveryAddress.neighborhood}, {deliveryAddress.city}
                  </p>
                  {deliveryAddress.reference && (
                    <p className="text-xs text-muted-foreground mt-0.5">Ref: {deliveryAddress.reference}</p>
                  )}
                </div>
              </div>
            )}

            {/* Pedido */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5" /> Pedido
              </h4>
              <div className="px-3 py-2.5 rounded-xl bg-secondary/50 border border-border">
                {orderSummaryContent ? (
                  <p className="text-sm text-foreground whitespace-pre-wrap">{orderSummaryContent}</p>
                ) : (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground">Total</span>
                      <span className="font-bold">R$ {Number(sale.valor_total).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Status operacional */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-secondary/50 border border-border">
                <span className="text-xs text-muted-foreground">Status operacional</span>
                {editing ? (
                  <Select value={editData.operational_status} onValueChange={(v) => setEditData({ ...editData, operational_status: v })}>
                    <SelectTrigger className="w-44 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(OP_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.emoji} {v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm font-medium">{opInfo.emoji} {opInfo.label}</span>
                )}
              </div>
            </div>

            <Separator />

            {/* Pagamentos */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Pagamentos
              </h4>

              {/* Forma de pagamento */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-secondary/50 border border-border">
                <span className="text-xs text-muted-foreground">Forma de pagamento</span>
                {editing ? (
                  <Select value={editData.forma_pagamento} onValueChange={(v) => setEditData({ ...editData, forma_pagamento: v })}>
                    <SelectTrigger className="w-44 h-7 text-xs">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm">{PAYMENT_LABELS[sale.forma_pagamento] || sale.forma_pagamento || "—"}</span>
                )}
              </div>

              {payments.length > 0 ? (
                <div className="space-y-1.5">
                  {payments.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-secondary/50 border border-border text-sm">
                      <span className="font-medium text-foreground">R$ {Number(p.amount).toFixed(2)}</span>
                      <span className="text-muted-foreground">{PAYMENT_LABELS[p.payment_method] || p.payment_method}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Total pago</span>
                    <span className="font-bold text-green-600">R$ {totalPaid.toFixed(2)}</span>
                  </div>
                  {remaining > 0 && (
                    <div className="flex justify-between px-3 text-sm">
                      <span className="text-muted-foreground">Restante</span>
                      <span className="font-bold text-destructive">R$ {remaining.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic px-3">Nenhum pagamento registrado</p>
              )}
            </div>

            {/* Observação */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Observação</h4>
              {editing ? (
                <Textarea
                  value={editData.observacao}
                  onChange={(e) => setEditData({ ...editData, observacao: e.target.value })}
                  placeholder="Observação..."
                  rows={2}
                />
              ) : (
                <p className="text-sm text-foreground">{sale.observacao || "—"}</p>
              )}
            </div>

            {/* Info */}
            <div className="text-xs text-muted-foreground">
              Criado em: {new Date(sale.created_at).toLocaleString("pt-BR")}
            </div>

            {/* Edit actions */}
            {editing && (
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                  <X className="w-3.5 h-3.5 mr-1" /> Cancelar
                </Button>
                <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  <Save className="w-3.5 h-3.5 mr-1" /> {saveMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const SalesPageNew = () => {
  const { user } = useAuth();
  const { effectiveTenantId, isReadOnly, isSuperAdmin, isAdminTenant } = useAdmin();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<any>(null);

  const [newSale, setNewSale] = useState({
    valor_total: "",
    forma_pagamento: "",
    observacao: "",
  });

  const { data: sales, isLoading } = useQuery({
    queryKey: ["sales", effectiveTenantId, dateFrom, dateTo],
    enabled: !!effectiveTenantId,
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select("*, customers(name), sale_payments(payment_method)")
        .eq("tenant_id", effectiveTenantId!)
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
      if (!effectiveTenantId) throw new Error("Selecione um restaurante");
      const { error } = await supabase.from("sales").insert({
        tenant_id: effectiveTenantId,
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
    let match = true;
    if (search) {
      const q = search.toLowerCase();
      match =
        s.forma_pagamento?.toLowerCase().includes(q) ||
        s.observacao?.toLowerCase().includes(q) ||
        s.customers?.name?.toLowerCase().includes(q) ||
        String(s.sale_number).includes(q);
    }
    if (filterPayment && filterPayment !== "all" && match) {
      match = s.forma_pagamento === filterPayment;
    }
    return match;
  });

  if (!effectiveTenantId) {
    return (
      <div className="text-center py-20">
        <Building2 className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold mb-1">Selecione um restaurante</h3>
        <p className="text-muted-foreground text-sm">Escolha um restaurante para visualizar as vendas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Vendas</h1>
        {!isReadOnly && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
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
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, nº..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterPayment} onValueChange={setFilterPayment}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>
                <SelectItem value="cartao_debito">Cartão Débito</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
              <span className="text-muted-foreground text-sm">até</span>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredSales?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma venda encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales?.map((sale: any) => {
                  const fin = FINANCIAL_LABELS[sale.financial_status] || FINANCIAL_LABELS.pending;
                  return (
                    <TableRow key={sale.id} className="cursor-pointer hover:bg-secondary/50" onClick={() => setSelectedSale(sale)}>
                      <TableCell className="text-sm font-medium">{sale.sale_number || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(sale.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-sm">{sale.customers?.name || "—"}</TableCell>
                      <TableCell className="font-semibold">
                        R$ {Number(sale.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${fin.color}`}>{fin.label}</Badge>
                      </TableCell>
                      <TableCell className="capitalize text-sm">
                        {(() => {
                          // Try sale_payments first, then fallback to forma_pagamento
                          const paymentMethods = sale.sale_payments?.map((p: any) => p.payment_method).filter(Boolean) || [];
                          const uniqueMethods = [...new Set(paymentMethods)] as string[];
                          if (uniqueMethods.length > 0) {
                            return uniqueMethods.map((m: string) => PAYMENT_LABELS[m] || m).join(", ");
                          }
                          return PAYMENT_LABELS[sale.forma_pagamento] || sale.forma_pagamento || "—";
                        })()}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelectedSale(sale); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <SaleDetailDialog
        sale={selectedSale}
        open={!!selectedSale}
        onClose={() => setSelectedSale(null)}
        isReadOnly={isReadOnly}
        canEdit={isSuperAdmin || isAdminTenant}
      />
    </div>
  );
};

export default SalesPageNew;
