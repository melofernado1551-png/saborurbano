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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Eye, Calendar, Building2, Pencil, User, MapPin, ShoppingBag, CreditCard, Save, X, XCircle, Star, FileText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PAYMENT_LABELS: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
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
  delivering_pending: { label: "Aguard. confirmação", emoji: "📦" },
  finished: { label: "Finalizado", emoji: "✅" },
};

const SaleDetailDialog = ({ sale, open, onClose, isReadOnly, canEdit }: { sale: any; open: boolean; onClose: () => void; isReadOnly: boolean; canEdit: boolean }) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ observacao: "", forma_pagamento: "", operational_status: "" });
  const [paymentToCancel, setPaymentToCancel] = useState<any>(null);
  const [cancellingPayment, setCancellingPayment] = useState(false);

  // Fetch review for this sale
  const { data: saleReview } = useQuery({
    queryKey: ["sale-review-detail", sale?.id],
    enabled: !!sale?.id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("sale_reviews")
        .select("*, customers!sale_reviews_customer_id_fkey(name)")
        .eq("sale_id", sale.id)
        .eq("active", true)
        .maybeSingle();
      return data as any;
    },
  });

  // Fetch fresh sale data to keep status in sync
  const { data: freshSale } = useQuery({
    queryKey: ["sale-detail-fresh", sale?.id],
    enabled: !!sale?.id && open,
    queryFn: async () => {
      const { data } = await supabase.from("sales").select("*").eq("id", sale.id).single();
      return data;
    },
  });
  const currentSale = freshSale || sale;

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

  const handleCancelPayment = async () => {
    if (!paymentToCancel || !sale) return;
    setCancellingPayment(true);
    try {
      const { error } = await supabase
        .from("sale_payments")
        .update({ active: false })
        .eq("id", paymentToCancel.id);
      if (error) throw error;

      // If there's a chat, send cancellation message
      if (sale.chat_id) {
        await supabase.from("chat_messages").insert({
          chat_id: sale.chat_id,
          sender_id: null,
          sender_type: "system",
          content: `❌ **Pagamento cancelado**\nR$ ${Number(paymentToCancel.amount).toFixed(2)} via ${PAYMENT_LABELS[paymentToCancel.payment_method] || paymentToCancel.payment_method}`,
          message_type: "payment_cancelled",
        });
      }

      setPaymentToCancel(null);
      toast.success("Pagamento cancelado!");
      queryClient.invalidateQueries({ queryKey: ["sale-payments-detail", sale.id] });
      queryClient.invalidateQueries({ queryKey: ["sale-detail-fresh", sale.id] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    } catch {
      toast.error("Erro ao cancelar pagamento");
    } finally {
      setCancellingPayment(false);
    }
  };

  const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const remaining = currentSale ? Number(currentSale.valor_total) - totalPaid : 0;
  const financialInfo = FINANCIAL_LABELS[currentSale?.financial_status] || FINANCIAL_LABELS.pending;
  const opInfo = OP_LABELS[currentSale?.operational_status] || OP_LABELS.received;

  // Parse order summary content
  const orderSummaryContent = saleItems.length > 0 ? saleItems[0].content : null;

  return (
    <>
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
                    <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-secondary/50 border border-border text-sm gap-2">
                      <span className="font-medium text-foreground">R$ {Number(p.amount).toFixed(2)}</span>
                      <span className="text-muted-foreground">{PAYMENT_LABELS[p.payment_method] || p.payment_method}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {canEdit && (
                        <button
                          onClick={() => setPaymentToCancel(p)}
                          className="text-destructive hover:text-destructive/80 transition-colors"
                          title="Cancelar pagamento"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
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

            {/* Review */}
            {saleReview && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5" /> Avaliação do Cliente
                </h4>
                <div className="px-3 py-2.5 rounded-xl bg-secondary/50 border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${s <= saleReview.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-medium">{saleReview.rating}/5</span>
                  </div>
                  {saleReview.comment && (
                    <p className="text-sm text-muted-foreground italic">"{saleReview.comment}"</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    por {saleReview.customers?.name || "Cliente"} em {new Date(saleReview.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            )}

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

      {/* Confirmation dialog for cancelling payment */}
      <AlertDialog open={!!paymentToCancel} onOpenChange={(o) => { if (!o) setPaymentToCancel(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja cancelar o pagamento de{" "}
              <span className="font-semibold">R$ {paymentToCancel ? Number(paymentToCancel.amount).toFixed(2) : "0.00"}</span> via{" "}
              <span className="font-semibold capitalize">
                {PAYMENT_LABELS[paymentToCancel?.payment_method] || paymentToCancel?.payment_method}
              </span>? O status financeiro da venda será recalculado automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelPayment}
              disabled={cancellingPayment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancellingPayment ? "Cancelando..." : "Sim, cancelar pagamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
        .eq("sale_payments.active", true)
        .eq("tenant_id", effectiveTenantId!)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(30);

      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");

      const { data } = await query;
      return (data || []) as any[];
    },
  });

  // Fetch tenant info for report
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

  // Fetch current user profile name
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
      const paymentMethods = s.sale_payments?.map((p: any) => p.payment_method).filter(Boolean) || [];
      match = s.forma_pagamento === filterPayment || paymentMethods.includes(filterPayment);
    }
    return match;
  });

  const generateReport = async () => {
    if (!filteredSales || filteredSales.length === 0) {
      toast.error("Nenhuma venda para gerar relatório");
      return;
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 15;

    // Header: Logo + Store info
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
      } catch {
        // Skip logo if it fails
      }
    }

    const textX = tenant?.logo_url ? 40 : 15;
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(tenant?.name || "Loja", textX, yPos + 5);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const address = [tenant?.address, tenant?.city, tenant?.state].filter(Boolean).join(" - ");
    if (address) {
      doc.text(address, textX, yPos + 11);
    }

    doc.text(`Emitido por: ${userProfile?.name || userProfile?.login || "Admin"}`, textX, yPos + 17);
    doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, textX, yPos + 22);

    yPos = tenant?.logo_url ? 42 : 45;

    // Line separator
    doc.setDrawColor(200, 200, 200);
    doc.line(15, yPos, pageWidth - 15, yPos);
    yPos += 5;

    // Title
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório de Vendas", pageWidth / 2, yPos, { align: "center" });
    yPos += 3;

    // Date range info
    if (dateFrom || dateTo) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const rangeText = `Período: ${dateFrom ? new Date(dateFrom + "T00:00:00").toLocaleDateString("pt-BR") : "—"} até ${dateTo ? new Date(dateTo + "T00:00:00").toLocaleDateString("pt-BR") : "—"}`;
      doc.text(rangeText, pageWidth / 2, yPos + 5, { align: "center" });
      yPos += 5;
    }
    yPos += 5;

    // Table data
    const tableData = filteredSales.map((s: any) => {
      const paymentMethods = s.sale_payments?.map((p: any) => p.payment_method).filter(Boolean) || [];
      const uniqueMethods = [...new Set(paymentMethods)] as string[];
      const paymentLabel = uniqueMethods.length > 0
        ? uniqueMethods.map((m: string) => PAYMENT_LABELS[m] || m).join(", ")
        : PAYMENT_LABELS[s.forma_pagamento] || s.forma_pagamento || "—";

      const fin = FINANCIAL_LABELS[s.financial_status] || FINANCIAL_LABELS.pending;

      return [
        String(s.sale_number || "—"),
        new Date(s.created_at).toLocaleDateString("pt-BR"),
        s.customers?.name || "—",
        `R$ ${Number(s.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        fin.label,
        paymentLabel,
        s.observacao || "",
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [["#", "Data", "Cliente", "Valor", "Status", "Pagamento", "Obs"]],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [255, 107, 0], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 22 },
        2: { cellWidth: 30 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
        5: { cellWidth: 25 },
        6: { cellWidth: "auto" },
      },
      margin: { left: 15, right: 15 },
    });

    // Summary section
    const finalY = (doc as any).lastAutoTable?.finalY || yPos + 50;
    let summaryY = finalY + 10;

    // Check if summary fits on current page
    if (summaryY + 40 > doc.internal.pageSize.getHeight()) {
      doc.addPage();
      summaryY = 20;
    }

    doc.setDrawColor(200, 200, 200);
    doc.line(15, summaryY - 3, pageWidth - 15, summaryY - 3);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Resumo", 15, summaryY + 4);
    summaryY += 10;

    // Calculate totals by payment method
    const paymentTotals: Record<string, number> = {};
    let grandTotal = 0;

    filteredSales.forEach((s: any) => {
      const paymentMethods = s.sale_payments?.map((p: any) => p.payment_method).filter(Boolean) || [];
      const uniqueMethods = [...new Set(paymentMethods)] as string[];
      const method = uniqueMethods.length > 0
        ? uniqueMethods[0]
        : s.forma_pagamento || "sem_pagamento";

      const label = PAYMENT_LABELS[method] || (method === "sem_pagamento" ? "Sem pagamento" : method);
      paymentTotals[label] = (paymentTotals[label] || 0) + Number(s.valor_total);
      grandTotal += Number(s.valor_total);
    });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    Object.entries(paymentTotals).forEach(([method, total]) => {
      doc.text(`${method}:`, 20, summaryY);
      doc.text(`R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, pageWidth - 20, summaryY, { align: "right" });
      summaryY += 6;
    });

    // Grand total
    summaryY += 2;
    doc.setDrawColor(200, 200, 200);
    doc.line(15, summaryY - 2, pageWidth - 15, summaryY - 2);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Total Geral:", 20, summaryY + 5);
    doc.text(`R$ ${grandTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, pageWidth - 20, summaryY + 5, { align: "right" });

    // Save
    doc.save(`relatorio-vendas-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("Relatório gerado com sucesso!");
  };

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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={generateReport}>
            <FileText className="w-4 h-4 mr-1" /> Emitir Relatório
          </Button>
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
                <SelectItem value="cartao">Cartão</SelectItem>
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
