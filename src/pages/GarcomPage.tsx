import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  ShoppingBag,
  CreditCard,
  LogOut,
  ArrowLeft,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Navigate, useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";

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

interface MesaSale {
  id: string;
  sale_number: number | null;
  operational_status: string;
  financial_status: string;
  valor_total: number;
  mesa_id: string;
  numero_mesa: number;
}

const MESA_STATUS_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  livre: { bg: "bg-muted", border: "border-border", text: "text-muted-foreground", label: "Livre" },
  aberto: { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-300 dark:border-blue-700", text: "text-blue-700 dark:text-blue-300", label: "Pedido Aberto" },
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
  const [closingOrder, setClosingOrder] = useState(false);
  const [sendingPayment, setSendingPayment] = useState(false);

  // Get tenant_id from user
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
        .select("id, sale_number, operational_status, financial_status, valor_total, mesa_id, numero_mesa")
        .eq("tenant_id", tenantId!)
        .eq("tipo_pedido", "mesa")
        .eq("active", true)
        .not("operational_status", "in", '("finished","cancelled")')
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as MesaSale[];
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

  // Fetch categories for selected tenant
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

  // Get mesa status
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

  // Filtered products
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

  // Add items to sale (update total)
  const addItemsMutation = useMutation({
    mutationFn: async ({ saleId, items }: { saleId: string; items: OrderItem[] }) => {
      // Get current sale to add to total
      const { data: currentSale } = await supabase
        .from("sales")
        .select("valor_total")
        .eq("id", saleId)
        .single();

      const itemsTotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
      const newTotal = (currentSale?.valor_total || 0) + itemsTotal;

      // Update sale total
      const { error: updateError } = await supabase
        .from("sales")
        .update({ valor_total: newTotal } as any)
        .eq("id", saleId);
      if (updateError) throw updateError;

      // Create a chat for this sale if it doesn't exist, and add order summary message
      let chatId: string;
      const { data: existingChat } = await supabase
        .from("chats")
        .select("id")
        .eq("sale_id", saleId)
        .eq("active", true)
        .maybeSingle();

      if (existingChat) {
        chatId = existingChat.id;
      } else {
        // Create an internal chat for the mesa order
        // Use a system customer or the first customer for the tenant
        const { data: newChat, error: chatError } = await supabase
          .from("chats")
          .insert({
            tenant_id: tenantId!,
            customer_id: user!.id, // using the waiter's profile id as placeholder
            sale_id: saleId,
            status: "open",
          } as any)
          .select("id")
          .single();
        if (chatError) throw chatError;
        chatId = newChat.id;

        // Link chat to sale
        await supabase.from("sales").update({ chat_id: chatId } as any).eq("id", saleId);
      }

      // Send items as chat message
      const itemsText = items
        .map((item) => `${item.quantity}x ${item.product_name} - R$ ${(item.unit_price * item.quantity).toFixed(2)}${item.observacao ? ` (Obs: ${item.observacao})` : ""}`)
        .join("\n");

      const messageContent = `🍽️ Itens adicionados:\n${itemsText}\n\n💰 Subtotal: R$ ${itemsTotal.toFixed(2)}\n💰 Total acumulado: R$ ${newTotal.toFixed(2)}`;

      await supabase.from("chat_messages").insert({
        chat_id: chatId,
        content: messageContent,
        sender_type: "system",
        message_type: "order_items",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["garcom-mesa-sales"] });
      setOrderItems([]);
      toast.success("Itens adicionados ao pedido!");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao adicionar itens"),
  });

  // Close order / send to payment
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
      setSelectedMesa(null);
      setClosingOrder(false);
      setSendingPayment(false);
      if (status === "waiting_payment") {
        toast.success("Pedido enviado para pagamento!");
      } else if (status === "finished") {
        toast.success("Pedido finalizado!");
      }
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar status"),
  });

  const handleMesaClick = async (mesa: Mesa) => {
    const status = getMesaStatus(mesa);
    if (status === "livre") {
      // Create new sale
      await createSaleMutation.mutateAsync(mesa);
    }
    setSelectedMesa(mesa);
    setOrderItems([]);
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

  const removeFromOrder = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendItems = () => {
    const sale = selectedMesa ? getMesaSale(selectedMesa) : null;
    if (!sale || orderItems.length === 0) return;
    addItemsMutation.mutate({ saleId: sale.id, items: orderItems });
  };

  // Guard: only garcom, tenant_admin, colaborador, superadmin
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
        /* Mesa Detail View */
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
              {getMesaSale(selectedMesa) && getMesaStatus(selectedMesa) !== "pagamento" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSendingPayment(true)}
                    className="gap-1"
                  >
                    <CreditCard className="w-4 h-4" /> Enviar p/ Pagamento
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-4">
            {/* Current order total */}
            {getMesaSale(selectedMesa) && (
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total do pedido</p>
                    <p className="text-2xl font-bold">R$ {Number(getMesaSale(selectedMesa)!.valor_total).toFixed(2)}</p>
                  </div>
                  <Badge variant={getMesaStatus(selectedMesa) === "pagamento" ? "default" : "secondary"}>
                    {MESA_STATUS_COLORS[getMesaStatus(selectedMesa)]?.label}
                  </Badge>
                </CardContent>
              </Card>
            )}

            {/* Categories filter */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
              >
                Todos
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.id)}
                  className="whitespace-nowrap"
                >
                  {cat.emoji} {cat.name}
                </Button>
              ))}
            </div>

            {/* Search */}
            <Input
              placeholder="Buscar produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {/* Products list */}
            <div className="grid gap-2">
              {filteredProducts.map((product) => {
                const effectivePrice = product.has_discount && product.promo_price
                  ? product.promo_price
                  : product.price;
                return (
                  <button
                    key={product.id}
                    onClick={() => {
                      if (getMesaStatus(selectedMesa) === "pagamento") {
                        toast.error("Pedido já enviado para pagamento");
                        return;
                      }
                      setAddingProduct(product);
                      setItemQty(1);
                      setItemObs("");
                    }}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent transition-colors text-left"
                  >
                    <div>
                      <p className="font-medium text-sm">{product.name}</p>
                      {product.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{product.description}</p>
                      )}
                    </div>
                    <div className="text-right">
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
                );
              })}
            </div>
          </div>

          {/* Cart footer */}
          {orderItems.length > 0 && (
            <div className="border-t border-border bg-card p-4 space-y-3">
              <div className="max-h-32 overflow-y-auto space-y-2">
                {orderItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex-1">
                      <span className="font-medium">{item.quantity}x</span> {item.product_name}
                      {item.observacao && <span className="text-xs text-muted-foreground ml-1">({item.observacao})</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">R$ {(item.unit_price * item.quantity).toFixed(2)}</span>
                      <button onClick={() => removeFromOrder(idx)} className="text-destructive">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="font-bold">Total: R$ {orderTotal.toFixed(2)}</span>
                <Button onClick={handleSendItems} disabled={addItemsMutation.isPending} className="gap-2">
                  {addItemsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
                  Enviar Itens
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dialog para adicionar produto */}
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

      {/* Confirmar envio para pagamento */}
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
                const sale = selectedMesa ? getMesaSale(selectedMesa) : null;
                if (sale) updateSaleStatusMutation.mutate({ saleId: sale.id, status: "waiting_payment" });
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GarcomPage;
