import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  UtensilsCrossed,
  Plus,
  Minus,
  CreditCard,
  LogOut,
  ArrowLeft,
  X,
  Loader2,
  Search,
  QrCode,
  Banknote,
  Copy,
  Check,
  DollarSign,
  Printer,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Navigate, useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";
import { generatePixWithAmount } from "@/lib/pixUtils";
import QRCodeLib from "qrcode";

interface Mesa {
  id: string;
  numero: number;
  identificador: string | null;
  active: boolean;
}

interface Product {
  id: string;
  name: string;
  price: number;
  promo_price: number | null;
  has_discount: boolean;
  description: string | null;
}

interface Category {
  id: string;
  name: string;
  emoji: string | null;
}

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  observacao?: string;
}

interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  observacao: string | null;
  created_at: string;
}

interface MesaSale {
  id: string;
  sale_number: number | null;
  operational_status: string;
  financial_status: string;
  valor_total: number;
  mesa_id: string;
  numero_mesa: number;
  representante: string | null;
}

const MESA_STATUS_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  livre: { bg: "bg-emerald-500", border: "border-emerald-600", text: "text-white", label: "Livre" },
  aberto: { bg: "bg-[#F07B2C]", border: "border-[#D96A1E]", text: "text-white", label: "Pedido Aberto" },
  andamento: { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-300 dark:border-amber-700", text: "text-amber-700 dark:text-amber-300", label: "Em Andamento" },
  pagamento: { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-300 dark:border-emerald-700", text: "text-emerald-700 dark:text-emerald-300", label: "Aguardando Pagamento" },
};

const GarcomPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [addingProduct, setAddingProduct] = useState<Product | null>(null);
  const [itemQty, setItemQty] = useState(1);
  const [itemObs, setItemObs] = useState("");
  const [sendingPayment, setSendingPayment] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<"choose" | "pix" | "cash_change" | "cash_amount" | "card_confirm">("choose");
  const [pixCopied, setPixCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [changeAmount, setChangeAmount] = useState("");
  const [showRepresentanteModal, setShowRepresentanteModal] = useState(false);
  const [representanteInput, setRepresentanteInput] = useState("");

  const tenantId = user?.tenant_id;

  // Fetch mesas
  const { data: mesas = [] } = useQuery({
    queryKey: ["garcom-mesas", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mesas" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .order("numero");
      if (error) throw error;
      return data as unknown as Mesa[];
    },
  });

  // Fetch open mesa sales
  const { data: mesaSales = [] } = useQuery({
    queryKey: ["garcom-mesa-sales", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, sale_number, operational_status, financial_status, valor_total, mesa_id, numero_mesa, representante")
        .eq("tenant_id", tenantId!)
        .eq("tipo_pedido", "mesa")
        .eq("active", true)
        .not("operational_status", "in", '("finished","cancelled")')
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as MesaSale[];
    },
  });

  // Get current sale for selected mesa
  const currentSale = selectedMesa ? mesaSales.find((s) => s.mesa_id === selectedMesa.id) : null;

  // Fetch existing sale items
  const { data: existingSaleItems = [] } = useQuery({
    queryKey: ["garcom-sale-items", currentSale?.id],
    enabled: !!currentSale?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_items" as any)
        .select("*")
        .eq("sale_id", currentSale!.id)
        .eq("active", true)
        .order("created_at");
      if (error) throw error;
      return data as unknown as SaleItem[];
    },
  });

  // Realtime for sales updates
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel("garcom-sales")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales", filter: `tenant_id=eq.${tenantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["garcom-mesa-sales"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, queryClient]);

  // Fetch tenant PIX data
  const { data: tenantData } = useQuery({
    queryKey: ["garcom-tenant-pix", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("pix_copy_paste, pix_receiver_name, name, address, city, whatsapp_number")
        .eq("id", tenantId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Save representante mutation
  const saveRepresentanteMutation = useMutation({
    mutationFn: async ({ saleId, representante }: { saleId: string; representante: string }) => {
      const { error } = await supabase
        .from("sales")
        .update({ representante: representante || null } as any)
        .eq("id", saleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["garcom-mesa-sales"] });
      toast.success("Representante salvo!");
      setShowRepresentanteModal(false);
    },
  });

  // Print receipt function
  const handlePrintReceipt = () => {
    if (!currentSale || !selectedMesa) return;
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR");
    const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const itemsHtml = existingSaleItems.map(item => `
      <tr>
        <td style="text-align:left;">${item.quantity}x ${item.product_name}</td>
        <td style="text-align:right;">R$ ${(item.unit_price * item.quantity).toFixed(2)}</td>
      </tr>
      ${item.observacao ? `<tr><td colspan="2" style="font-size:10px;color:#666;padding-left:10px;">Obs: ${item.observacao}</td></tr>` : ""}
    `).join("");

    const receiptHtml = `
      <html><head><title>Nota Mesa ${selectedMesa.numero}</title>
      <style>
        @media print { body { margin: 0; } @page { margin: 10mm; } }
        body { font-family: monospace; max-width: 280px; margin: 0 auto; padding: 10px; font-size: 12px; }
        .center { text-align: center; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; }
        .bold { font-weight: bold; }
      </style></head><body>
        <div class="center bold" style="font-size:14px;">${tenantData?.name || "Estabelecimento"}</div>
        ${tenantData?.address ? `<div class="center" style="font-size:10px;">${tenantData.address}${tenantData.city ? ` - ${tenantData.city}` : ""}</div>` : ""}
        ${tenantData?.whatsapp_number ? `<div class="center" style="font-size:10px;">Tel: ${tenantData.whatsapp_number}</div>` : ""}
        <div class="divider"></div>
        <div class="center bold">MESA ${selectedMesa.numero}</div>
        ${currentSale.sale_number ? `<div class="center">Pedido #${currentSale.sale_number}</div>` : ""}
        ${currentSale.representante ? `<div class="center">Representante: ${currentSale.representante}</div>` : ""}
        <div class="center" style="font-size:10px;">${dateStr} ${timeStr}</div>
        <div class="divider"></div>
        <table>${itemsHtml}</table>
        <div class="divider"></div>
        <table>
          <tr class="bold">
            <td>TOTAL</td>
            <td style="text-align:right;font-size:14px;">R$ ${Number(currentSale.valor_total).toFixed(2)}</td>
          </tr>
        </table>
        <div class="divider"></div>
        <div class="center" style="font-size:10px;">Obrigado pela preferência!</div>
      </body></html>
    `;

    const printWindow = window.open("", "_blank", "width=350,height=600");
    if (printWindow) {
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 300);
    }
  };

  const generatedPix = tenantData?.pix_copy_paste && currentSale
    ? generatePixWithAmount(tenantData.pix_copy_paste, Number(currentSale.valor_total))
    : null;

  // Generate QR code when payment modal shows pix step
  useEffect(() => {
    if (paymentStep === "pix" && generatedPix) {
      QRCodeLib.toDataURL(generatedPix, { width: 220, margin: 2, errorCorrectionLevel: "M" })
        .then((url: string) => setQrCodeDataUrl(url))
        .catch(() => setQrCodeDataUrl(null));
    }
  }, [paymentStep, generatedPix]);

  // Register payment mutation
  const registerPaymentMutation = useMutation({
    mutationFn: async ({ method, changeInfo }: { method: string; changeInfo?: string }) => {
      if (!currentSale || !tenantId) throw new Error("Dados inválidos");

      // Insert sale_payment
      const { error: payError } = await supabase
        .from("sale_payments" as any)
        .insert({
          sale_id: currentSale.id,
          tenant_id: tenantId,
          payment_method: method,
          amount: currentSale.valor_total,
        });
      if (payError) throw payError;

      // Update sale financial + operational status
      const updateData: any = {
        financial_status: "paid",
        forma_pagamento: method,
        operational_status: "finished",
      };
      if (changeInfo) {
        updateData.observacao = changeInfo;
      }
      const { error: saleError } = await supabase
        .from("sales")
        .update(updateData)
        .eq("id", currentSale.id);
      if (saleError) throw saleError;

      // Create revenue entry - find or create revenue type
      let { data: revenueType } = await supabase
        .from("revenue_types")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("name", "Venda App")
        .eq("active", true)
        .maybeSingle();

      if (!revenueType) {
        const { data: newType } = await supabase
          .from("revenue_types")
          .insert({ tenant_id: tenantId, name: "Venda App" })
          .select("id")
          .single();
        revenueType = newType;
      }

      if (revenueType) {
        await supabase.from("revenues").insert({
          tenant_id: tenantId,
          revenue_type_id: revenueType.id,
          amount: currentSale.valor_total,
          description: `Venda #${currentSale.sale_number || ""} - Mesa ${selectedMesa?.numero} - ${method}`,
          sale_id: currentSale.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["garcom-mesa-sales"] });
      setShowPaymentModal(false);
      setSelectedMesa(null);
      toast.success("Pagamento registrado com sucesso!");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar pagamento"),
  });

  const handleOpenPayment = () => {
    setPaymentStep("choose");
    setPixCopied(false);
    setQrCodeDataUrl(null);
    setChangeAmount("");
    setShowPaymentModal(true);
  };

  const handleCopyPix = () => {
    if (!generatedPix) return;
    navigator.clipboard.writeText(generatedPix);
    setPixCopied(true);
    toast.success("PIX copiado!");
    setTimeout(() => setPixCopied(false), 3000);
  };

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["garcom-categories", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("id, name, emoji")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .order("position");
      if (error) throw error;
      return data as Category[];
    },
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ["garcom-products", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, promo_price, has_discount, description, product_category_relations(category_id)")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const getMesaStatus = (mesa: Mesa): string => {
    const sale = mesaSales.find((s) => s.mesa_id === mesa.id);
    if (!sale) return "livre";
    if (sale.operational_status === "waiting_payment") return "pagamento";
    if (["preparing", "ready", "delivering"].includes(sale.operational_status)) return "andamento";
    return "aberto";
  };

  const getMesaSale = (mesa: Mesa): MesaSale | undefined => {
    return mesaSales.find((s) => s.mesa_id === mesa.id);
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch = !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || p.product_category_relations?.some((r: any) => r.category_id === selectedCategory);
    return matchesSearch && matchesCategory;
  });

  // Create new sale for mesa
  const createSaleMutation = useMutation({
    mutationFn: async (mesa: Mesa) => {
      const { data, error } = await supabase
        .from("sales")
        .insert({
          tenant_id: tenantId!,
          tipo_pedido: "mesa",
          mesa_id: mesa.id,
          numero_mesa: mesa.numero,
          operational_status: "received",
          financial_status: "pending",
          valor_total: 0,
        } as any)
        .select("id, sale_number")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["garcom-mesa-sales"] });
      toast.success("Pedido criado para a mesa!");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao criar pedido"),
  });

  // Add items to sale
  const addItemsMutation = useMutation({
    mutationFn: async ({ saleId, items }: { saleId: string; items: OrderItem[] }) => {
      try {
        const { data: currentSaleData } = await supabase
          .from("sales")
          .select("valor_total")
          .eq("id", saleId)
          .single();

        const itemsTotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
        const newTotal = (currentSaleData?.valor_total || 0) + itemsTotal;

        const { error: updateError } = await supabase
          .from("sales")
          .update({ valor_total: newTotal } as any)
          .eq("id", saleId);
        if (updateError) throw updateError;

        // Persist items to sale_items table
        const itemsToInsert = items.map((item) => ({
          sale_id: saleId,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          observacao: item.observacao || null,
        }));

        const { error: insertError } = await supabase
          .from("sale_items" as any)
          .insert(itemsToInsert);
        if (insertError) throw insertError;
      } catch (error: any) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["garcom-mesa-sales"] });
      queryClient.invalidateQueries({ queryKey: ["garcom-sale-items"] });
      setOrderItems([]);
      toast.success("Itens adicionados ao pedido!");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao adicionar itens"),
  });

  // Remove existing sale item
  const removeItemMutation = useMutation({
    mutationFn: async (item: SaleItem) => {
      const { error } = await supabase
        .from("sale_items" as any)
        .update({ active: false } as any)
        .eq("id", item.id);
      if (error) throw error;

      // Update sale total
      const { data: saleData } = await supabase
        .from("sales")
        .select("valor_total")
        .eq("id", currentSale!.id)
        .single();

      const newTotal = Math.max(0, (saleData?.valor_total || 0) - item.unit_price * item.quantity);
      const { error: updateError } = await supabase
        .from("sales")
        .update({ valor_total: newTotal } as any)
        .eq("id", currentSale!.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["garcom-mesa-sales"] });
      queryClient.invalidateQueries({ queryKey: ["garcom-sale-items"] });
      toast.success("Item removido!");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover item"),
  });

  const updateSaleStatusMutation = useMutation({
    mutationFn: async ({ saleId, status }: { saleId: string; status: string }) => {
      const { error } = await supabase
        .from("sales")
        .update({ operational_status: status } as any)
        .eq("id", saleId);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["garcom-mesa-sales"] });
      setSendingPayment(false);
      if (status === "waiting_payment") {
        toast.success("Pedido enviado para pagamento!");
      } else if (status === "finished") {
        setSelectedMesa(null);
        toast.success("Pedido finalizado!");
      } else if (status === "cancelled") {
        setSelectedMesa(null);
        toast.success("Pedido cancelado!");
      } else if (status === "received") {
        toast.success("Pedido reaberto! Você pode adicionar mais itens.");
      }
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar status"),
  });

  const handleMesaClick = async (mesa: Mesa) => {
    const status = getMesaStatus(mesa);
    if (status === "livre") {
      // For free tables, ask for representative name first
      setSelectedMesa(mesa);
      setOrderItems([]);
      setRepresentanteInput("");
      setShowRepresentanteModal(true);
      return;
    }
    setSelectedMesa(mesa);
    setOrderItems([]);
    // If existing sale has no representative, prompt for it
    const sale = mesaSales.find((s) => s.mesa_id === mesa.id);
    if (sale && !sale.representante) {
      setRepresentanteInput("");
      setShowRepresentanteModal(true);
    }
  };

  const addToOrder = () => {
    if (!addingProduct) return;
    const effectivePrice = addingProduct.has_discount && addingProduct.promo_price
      ? addingProduct.promo_price
      : addingProduct.price;

    setOrderItems((prev) => {
      const existing = prev.find((i) => i.product_id === addingProduct.id && i.observacao === itemObs);
      if (existing) {
        return prev.map((i) =>
          i === existing ? { ...i, quantity: i.quantity + itemQty } : i
        );
      }
      return [
        ...prev,
        {
          product_id: addingProduct.id,
          product_name: addingProduct.name,
          quantity: itemQty,
          unit_price: effectivePrice,
          observacao: itemObs || undefined,
        },
      ];
    });
    setAddingProduct(null);
    setItemQty(1);
    setItemObs("");
  };

  const handleSaveRepresentante = async () => {
    const name = representanteInput.trim();
    if (!name || !selectedMesa) return;

    if (!currentSale) {
      // Free table: create sale first, then save representative
      try {
        await createSaleMutation.mutateAsync(selectedMesa);
        const { data: newSale } = await supabase
          .from("sales")
          .select("id")
          .eq("mesa_id", selectedMesa.id)
          .eq("tenant_id", tenantId!)
          .eq("active", true)
          .not("operational_status", "in", '("finished","cancelled")')
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (newSale) {
          await supabase.from("sales").update({ representante: name } as any).eq("id", newSale.id);
        }
        queryClient.invalidateQueries({ queryKey: ["garcom-mesa-sales"] });
        setShowRepresentanteModal(false);
        toast.success("Mesa aberta!");
      } catch {
        toast.error("Erro ao abrir mesa");
      }
    } else {
      saveRepresentanteMutation.mutate({ saleId: currentSale.id, representante: name });
    }
  };

  const removeFromOrder = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendItems = () => {
    if (!currentSale || orderItems.length === 0) return;
    addItemsMutation.mutate({ saleId: currentSale.id, items: orderItems });
  };

  // Guard
  if (!user) return <Navigate to="/login" replace />;
  const allowedRoles = ["garcom", "tenant_admin", "colaborador", "superadmin"];
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/admin" replace />;
  }

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const orderTotal = orderItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const existingTotal = existingSaleItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const isPagamento = selectedMesa ? getMesaStatus(selectedMesa) === "pagamento" : false;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Logo" className="w-8 h-8 rounded-lg" />
          <div>
            <h1 className="font-bold text-lg">Painel do Garçom</h1>
            <p className="text-xs text-muted-foreground">{user.name || user.login}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/admin")} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Admin
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Mesa Grid */}
      {!selectedMesa ? (
        <div className="p-4 space-y-4">
          <h2 className="text-lg font-semibold">Mesas</h2>
          {mesas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-center">
                <UtensilsCrossed className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma mesa ativa. Cadastre mesas em Configurações.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {mesas.map((mesa) => {
                const status = getMesaStatus(mesa);
                const colors = MESA_STATUS_COLORS[status];
                const sale = getMesaSale(mesa);
                return (
                  <button
                    key={mesa.id}
                    onClick={() => handleMesaClick(mesa)}
                    className={`relative p-4 rounded-xl border-2 transition-all duration-200 hover:scale-105 hover:shadow-lg ${colors.bg} ${colors.border}`}
                    disabled={createSaleMutation.isPending}
                  >
                    <div className="text-center">
                      <UtensilsCrossed className={`w-6 h-6 mx-auto mb-1 ${colors.text}`} />
                      <p className={`text-2xl font-bold ${colors.text}`}>{mesa.numero}</p>
                      {mesa.identificador && (
                        <p className="text-xs text-muted-foreground truncate">{mesa.identificador}</p>
                      )}
                      <Badge variant="outline" className={`mt-2 text-[10px] ${colors.text} border-current`}>
                        {colors.label}
                      </Badge>
                      {sale && (
                        <p className="text-xs font-medium mt-1">
                          R$ {Number(sale.valor_total).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Mesa Detail View - Show existing items + add button */
        <div className="flex flex-col h-[calc(100vh-60px)]">
          {/* Mesa header */}
          <div className="px-4 py-3 bg-card border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => { setSelectedMesa(null); setOrderItems([]); }}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h2 className="font-bold text-lg">Mesa {selectedMesa.numero}</h2>
                {selectedMesa.identificador && (
                  <p className="text-xs text-muted-foreground">{selectedMesa.identificador}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {currentSale && !isPagamento && (
                <>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowCancelConfirm(true)}
                    className="gap-1"
                  >
                    <X className="w-4 h-4" /> Cancelar
                  </Button>
                  {existingSaleItems.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSendingPayment(true)}
                      className="gap-1"
                    >
                      <CreditCard className="w-4 h-4" /> Enviar p/ Pagamento
                    </Button>
                  )}
                </>
              )}
              {currentSale && isPagamento && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (currentSale) updateSaleStatusMutation.mutate({ saleId: currentSale.id, status: "received" });
                    }}
                    className="gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" /> Reabrir
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleOpenPayment}
                    className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <DollarSign className="w-4 h-4" /> Pagar
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-4">
            {/* Sale summary card */}
            {currentSale && (
              <Card className="border-primary/20">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Total do pedido</p>
                      <p className="text-2xl font-bold">R$ {Number(currentSale.valor_total).toFixed(2)}</p>
                    </div>
                    <Badge variant="outline">
                      {isPagamento ? "Aguardando Pagamento" : "Pedido Aberto"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <User className="w-4 h-4 text-muted-foreground shrink-0" />
                      {currentSale.representante ? (
                        <span className="text-sm truncate">{currentSale.representante}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">Sem representante</span>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRepresentanteInput(currentSale.representante || "");
                          setShowRepresentanteModal(true);
                        }}
                        className="gap-1 h-7 text-xs"
                      >
                        <User className="w-3 h-3" /> {currentSale.representante ? "Editar" : "Definir"}
                      </Button>
                      {existingSaleItems.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePrintReceipt}
                          className="gap-1 h-7 text-xs"
                        >
                          <Printer className="w-3 h-3" /> Nota
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Existing items list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Itens do pedido</h3>
                {!isPagamento && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setShowProductSearch(true);
                      setSearchTerm("");
                      setSelectedCategory(null);
                    }}
                    className="gap-1"
                  >
                    <Plus className="w-4 h-4" /> Adicionar
                  </Button>
                )}
              </div>

              {existingSaleItems.length === 0 && orderItems.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center py-8 text-center">
                    <UtensilsCrossed className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum item adicionado ainda.</p>
                    {!isPagamento && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 gap-1"
                        onClick={() => {
                          setShowProductSearch(true);
                          setSearchTerm("");
                          setSelectedCategory(null);
                        }}
                      >
                        <Plus className="w-4 h-4" /> Adicionar primeiro item
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-1">
                  {/* Already saved items */}
                  {existingSaleItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          <span className="text-primary font-bold">{item.quantity}x</span>{" "}
                          {item.product_name}
                        </p>
                        {item.observacao && (
                          <p className="text-xs text-muted-foreground">Obs: {item.observacao}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">
                          R$ {(item.unit_price * item.quantity).toFixed(2)}
                        </p>
                        {!isPagamento && (
                          <button
                            onClick={() => removeItemMutation.mutate(item)}
                            disabled={removeItemMutation.isPending}
                            className="text-destructive hover:bg-destructive/10 rounded p-1 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Pending new items (not yet sent) */}
                  {orderItems.length > 0 && (
                    <>
                      <div className="pt-2 pb-1">
                        <p className="text-xs font-semibold text-primary uppercase tracking-wide">Novos itens (não enviados)</p>
                      </div>
                      {orderItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              <span className="text-primary font-bold">{item.quantity}x</span>{" "}
                              {item.product_name}
                            </p>
                            {item.observacao && (
                              <p className="text-xs text-muted-foreground">Obs: {item.observacao}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">
                              R$ {(item.unit_price * item.quantity).toFixed(2)}
                            </p>
                            <button onClick={() => removeFromOrder(idx)} className="text-destructive hover:bg-destructive/10 rounded p-1">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Send items footer */}
          {orderItems.length > 0 && (
            <div className="border-t border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Novos itens</p>
                  <span className="font-bold text-lg">R$ {orderTotal.toFixed(2)}</span>
                </div>
                <Button onClick={handleSendItems} disabled={addItemsMutation.isPending} className="gap-2">
                  {addItemsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Enviar Itens
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Product search dialog */}
      <Dialog open={showProductSearch} onOpenChange={setShowProductSearch}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Adicionar Produto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar produto..."
                className="pl-9"
                autoFocus
              />
            </div>

            {/* Category filters */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
                className="text-xs h-7"
              >
                Todos
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.id)}
                  className="text-xs h-7"
                >
                  {cat.emoji} {cat.name}
                </Button>
              ))}
            </div>

            {/* Product list */}
            <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
              {filteredProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum produto encontrado.</p>
              ) : (
                filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      setAddingProduct(product);
                      setItemQty(1);
                      setItemObs("");
                      setShowProductSearch(false);
                    }}
                    className="flex items-center justify-between w-full p-3 rounded-lg border border-border hover:bg-accent transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{product.name}</p>
                      {product.description && (
                        <p className="text-xs text-muted-foreground truncate">{product.description}</p>
                      )}
                    </div>
                    <div className="text-right ml-2 shrink-0">
                      {product.has_discount && product.promo_price ? (
                        <>
                          <p className="text-xs line-through text-muted-foreground">R$ {Number(product.price).toFixed(2)}</p>
                          <p className="font-bold text-sm text-primary">R$ {Number(product.promo_price).toFixed(2)}</p>
                        </>
                      ) : (
                        <p className="font-bold text-sm">R$ {Number(product.price).toFixed(2)}</p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add product quantity/obs dialog */}
      <Dialog open={!!addingProduct} onOpenChange={(open) => !open && setAddingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{addingProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-4">
              <Button variant="outline" size="icon" onClick={() => setItemQty(Math.max(1, itemQty - 1))}>
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-2xl font-bold w-10 text-center">{itemQty}</span>
              <Button variant="outline" size="icon" onClick={() => setItemQty(itemQty + 1)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea
                value={itemObs}
                onChange={(e) => setItemObs(e.target.value)}
                placeholder="Ex: Sem cebola, bem passado..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingProduct(null)}>Cancelar</Button>
            <Button onClick={addToOrder}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm send to payment */}
      <AlertDialog open={sendingPayment} onOpenChange={setSendingPayment}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar pedido para pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O pedido da Mesa {selectedMesa?.numero} será fechado e enviado para pagamento.
              Não será possível adicionar mais itens.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (currentSale) updateSaleStatusMutation.mutate({ saleId: currentSale.id, status: "waiting_payment" });
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm cancel order */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pedido da Mesa {selectedMesa?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os itens serão descartados e a mesa ficará livre novamente. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (currentSale) {
                  updateSaleStatusMutation.mutate({ saleId: currentSale.id, status: "cancelled" });
                  setShowCancelConfirm(false);
                }
              }}
            >
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-sm p-0 gap-0 rounded-2xl overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-2">
              {paymentStep !== "choose" && (
                <button
                  onClick={() => {
                    if (paymentStep === "cash_amount") setPaymentStep("cash_change");
                    else setPaymentStep("choose");
                  }}
                  className="p-1 rounded-lg hover:bg-secondary transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <DialogTitle className="text-base">
                {paymentStep === "choose" && "Forma de pagamento"}
                {paymentStep === "pix" && "Pagamento via PIX"}
                {paymentStep === "cash_change" && "Pagamento em dinheiro"}
                {paymentStep === "cash_amount" && "Troco"}
                {paymentStep === "card_confirm" && "Pagamento via cartão"}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="px-5 pb-5">
            {/* Choose method */}
            {paymentStep === "choose" && currentSale && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground mb-3">
                  Valor do pedido: <span className="font-bold text-foreground">R$ {Number(currentSale.valor_total).toFixed(2)}</span>
                </p>

                {generatedPix && (
                  <button
                    onClick={() => setPaymentStep("pix")}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-primary/50 bg-card transition-all active:scale-[0.98]"
                  >
                    <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <QrCode className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="text-left">
                      <span className="font-semibold text-sm text-foreground">PIX</span>
                      <p className="text-xs text-muted-foreground">QR Code ou Copia e Cola</p>
                    </div>
                  </button>
                )}

                <button
                  onClick={() => { setChangeAmount(""); setPaymentStep("cash_change"); }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-primary/50 bg-card transition-all active:scale-[0.98]"
                >
                  <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                    <Banknote className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div className="text-left">
                    <span className="font-semibold text-sm text-foreground">Dinheiro</span>
                    <p className="text-xs text-muted-foreground">Pagamento em espécie</p>
                  </div>
                </button>

                <button
                  onClick={() => setPaymentStep("card_confirm")}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-primary/50 bg-card transition-all active:scale-[0.98]"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <span className="font-semibold text-sm text-foreground">Cartão</span>
                    <p className="text-xs text-muted-foreground">Crédito ou débito</p>
                  </div>
                </button>
              </div>
            )}

            {/* PIX */}
            {paymentStep === "pix" && generatedPix && currentSale && (
              <div className="space-y-3">
                {tenantData?.pix_receiver_name && (
                  <p className="text-xs text-muted-foreground">
                    👤 Recebedor: <span className="font-medium text-foreground">{tenantData.pix_receiver_name}</span>
                  </p>
                )}

                <div className="flex items-center justify-between bg-primary/10 rounded-lg px-3 py-2">
                  <span className="text-sm text-muted-foreground">Valor</span>
                  <span className="text-lg font-bold text-primary">R$ {Number(currentSale.valor_total).toFixed(2)}</span>
                </div>

                {qrCodeDataUrl && (
                  <div className="flex justify-center">
                    <img src={qrCodeDataUrl} alt="QR Code PIX" className="w-44 h-44 rounded-lg border border-border" />
                  </div>
                )}

                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground mb-1">PIX Copia e Cola:</p>
                  <p className="text-xs font-mono break-all text-foreground leading-relaxed select-all">
                    {generatedPix}
                  </p>
                </div>

                <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={handleCopyPix}>
                  {pixCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {pixCopied ? "Copiado!" : "Copiar PIX"}
                </Button>

                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => registerPaymentMutation.mutate({ method: "pix" })}
                  disabled={registerPaymentMutation.isPending}
                >
                  {registerPaymentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Confirmar pagamento PIX
                </Button>
              </div>
            )}

            {/* Cash - needs change? */}
            {paymentStep === "cash_change" && (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-3">
                    <Banknote className="w-8 h-8 text-yellow-600" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Será necessário troco?</p>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 h-12 text-base"
                    onClick={() => registerPaymentMutation.mutate({ method: "dinheiro" })}
                    disabled={registerPaymentMutation.isPending}
                  >
                    Não
                  </Button>
                  <Button
                    className="flex-1 h-12 text-base"
                    onClick={() => setPaymentStep("cash_amount")}
                  >
                    Sim
                  </Button>
                </div>
              </div>
            )}

            {/* Cash - change amount */}
            {paymentStep === "cash_amount" && currentSale && (
              <div className="space-y-4">
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground mb-1">Valor do pedido: <span className="font-bold text-foreground">R$ {Number(currentSale.valor_total).toFixed(2)}</span></p>
                  <p className="text-sm font-medium text-foreground mt-3">Troco para quanto?</p>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={changeAmount}
                    onChange={(e) => setChangeAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                    placeholder="0,00"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary border border-border text-foreground text-lg font-semibold text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
                    autoFocus
                  />
                </div>
                <Button
                  className="w-full h-12 text-base"
                  onClick={() => {
                    const amount = parseFloat(changeAmount.replace(",", "."));
                    if (isNaN(amount) || amount <= Number(currentSale.valor_total)) {
                      toast.error(`Informe um valor maior que R$ ${Number(currentSale.valor_total).toFixed(2)}`);
                      return;
                    }
                    const troco = (amount - Number(currentSale.valor_total)).toFixed(2);
                    registerPaymentMutation.mutate({ method: "dinheiro", changeInfo: `Troco para R$ ${amount.toFixed(2)} (troco: R$ ${troco})` });
                  }}
                  disabled={registerPaymentMutation.isPending}
                >
                  {registerPaymentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Confirmar
                </Button>
              </div>
            )}

            {/* Card confirm */}
            {paymentStep === "card_confirm" && (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                    <CreditCard className="w-8 h-8 text-blue-600" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-2">Pagamento via cartão</p>
                  <p className="text-xs text-muted-foreground">Crédito ou débito na máquina.</p>
                </div>
                <Button
                  className="w-full h-12 text-base"
                  onClick={() => registerPaymentMutation.mutate({ method: "cartao" })}
                  disabled={registerPaymentMutation.isPending}
                >
                  {registerPaymentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Confirmar pagamento via cartão
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Representante Modal */}
      <Dialog open={showRepresentanteModal} onOpenChange={(open) => {
        if (!open && !currentSale) {
          // If closing without saving on a free table, go back to table list
          setSelectedMesa(null);
        }
        setShowRepresentanteModal(open);
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Representante da Mesa {selectedMesa?.numero}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do representante</Label>
              <Input
                value={representanteInput}
                onChange={(e) => setRepresentanteInput(e.target.value)}
                placeholder="Nome da pessoa..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && representanteInput.trim()) {
                    handleSaveRepresentante();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (!currentSale) setSelectedMesa(null);
              setShowRepresentanteModal(false);
            }}>Cancelar</Button>
            <Button
              onClick={handleSaveRepresentante}
              disabled={!representanteInput.trim() || saveRepresentanteMutation.isPending || createSaleMutation.isPending}
            >
              {(saveRepresentanteMutation.isPending || createSaleMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GarcomPage;
