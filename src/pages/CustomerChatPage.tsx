import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, MapPin, ChevronDown, Receipt, QrCode, Copy, Check, Paperclip, FileText, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { generatePixWithAmount } from "@/lib/pixUtils";
import QRCodeLib from "qrcode";

const STATUS_LABELS: Record<string, { label: string; emoji: string }> = {
  received: { label: "Pedido recebido", emoji: "📥" },
  preparing: { label: "Em preparo", emoji: "👨‍🍳" },
  delivering: { label: "Saiu para entrega", emoji: "🛵" },
  finished: { label: "Finalizado", emoji: "✅" },
};

const FINANCIAL_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  pending: { label: "Pendente de pagamento", color: "bg-destructive text-destructive-foreground", emoji: "🔴" },
  awaiting_check: { label: "Aguardando conferência", color: "bg-yellow-500 text-white", emoji: "🟡" },
  partial: { label: "Parcialmente pago", color: "bg-yellow-500 text-white", emoji: "🟡" },
  paid: { label: "Pago / Quitado", color: "bg-green-600 text-white", emoji: "🟢" },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];

const CustomerChatPage = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { customer, session, isInactive } = useCustomerAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showAddresses, setShowAddresses] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [showPixPayment, setShowPixPayment] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);
  const [sendingPix, setSendingPix] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const pixSentRef = useRef(false);

  // Fetch chat
  const { data: chat } = useQuery({
    queryKey: ["customer-chat", chatId],
    enabled: !!chatId && !!session?.user,
    queryFn: async () => {
      const { data, error } = await supabase.from("chats").select("*").eq("id", chatId!).single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch sale
  const { data: sale } = useQuery({
    queryKey: ["customer-sale", chat?.sale_id],
    enabled: !!chat?.sale_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*").eq("id", chat!.sale_id!).single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch tenant
  const { data: tenant } = useQuery({
    queryKey: ["chat-tenant", chat?.tenant_id],
    enabled: !!chat?.tenant_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("id, name, logo_url, slug, pix_copy_paste, pix_receiver_name").eq("id", chat!.tenant_id).single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch messages
  const { data: messages = [] } = useQuery({
    queryKey: ["chat-messages", chatId],
    enabled: !!chatId && !!session?.user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("chat_id", chatId!)
        .eq("active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch addresses
  const { data: addresses = [] } = useQuery({
    queryKey: ["customer-addresses-chat", customer?.id],
    enabled: !!customer?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_addresses")
        .select("*")
        .eq("customer_id", customer!.id)
        .eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch payments
  const { data: payments = [] } = useQuery({
    queryKey: ["customer-sale-payments", sale?.id],
    enabled: !!sale?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_payments")
        .select("*")
        .eq("sale_id", sale!.id)
        .eq("active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Clear optimistic messages only when they appear in real messages
  useEffect(() => {
    if (optimisticMessages.length === 0) return;
    setOptimisticMessages((prev) =>
      prev.filter(
        (opt) => !messages.some((real) => real.content === opt.content && real.sender_id === opt.sender_id)
      )
    );
  }, [messages]);

  // Realtime
  useEffect(() => {
    if (!chatId) return;
    const channel = supabase
      .channel(`chat-${chatId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `chat_id=eq.${chatId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["chat-messages", chatId] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sales", filter: `chat_id=eq.${chatId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["customer-sale", chat?.sale_id] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sale_payments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["customer-sale-payments", sale?.id] });
        queryClient.invalidateQueries({ queryKey: ["customer-sale", chat?.sale_id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chatId, chat?.sale_id, sale?.id, queryClient]);

  // Combined messages for display
  const allMessages = [...messages, ...optimisticMessages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length]);

  const handleSend = useCallback(async () => {
    if (!message.trim() || !chatId || !customer) return;
    const content = message.trim();
    setMessage("");

    const optimistic = {
      id: `optimistic-${Date.now()}`,
      chat_id: chatId,
      sender_id: customer.id,
      sender_type: "customer",
      content,
      message_type: "text",
      metadata: {},
      created_at: new Date().toISOString(),
      active: true,
      _optimistic: true,
    };
    setOptimisticMessages((prev) => [...prev, optimistic]);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    setSending(true);
    try {
      const { error } = await supabase.from("chat_messages").insert({
        chat_id: chatId,
        sender_id: customer.id,
        sender_type: "customer",
        content,
        message_type: "text",
      });
      if (error) throw error;
      await queryClient.refetchQueries({ queryKey: ["chat-messages", chatId] });
    } catch {
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      toast.error("Erro ao enviar mensagem");
      setMessage(content);
    } finally {
      setSending(false);
    }
  }, [message, chatId, customer, queryClient]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  };

  const handleSelectAddress = async (addr: any) => {
    if (!chatId || !customer || !sale) return;
    try {
      const addressData = {
        label: addr.label,
        street: addr.street,
        number: addr.number,
        complement: addr.complement,
        neighborhood: addr.neighborhood,
        city: addr.city,
        reference: addr.reference,
      };
      await supabase.from("sales").update({ delivery_address: addressData }).eq("id", sale.id);
      const addrText = `${addr.street}, ${addr.number}${addr.complement ? ` - ${addr.complement}` : ""} — ${addr.neighborhood}, ${addr.city}${addr.reference ? ` (Ref: ${addr.reference})` : ""}`;
      await supabase.from("chat_messages").insert({
        chat_id: chatId,
        sender_id: customer.id,
        sender_type: "customer",
        content: `📍 **Endereço de entrega:**\n${addr.label}: ${addrText}`,
        message_type: "address_confirmation",
      });
      setShowAddresses(false);
      toast.success("Endereço confirmado!");
      queryClient.invalidateQueries({ queryKey: ["customer-sale", sale.id] });
    } catch {
      toast.error("Erro ao selecionar endereço");
    }
  };

  // Receipt upload handler
  const handleUploadReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatId || !customer || !sale) return;

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Formato não suportado. Envie JPG, PNG ou PDF.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande. Limite: 5MB.");
      return;
    }

    setUploadingReceipt(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${sale.id}/${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("payment-receipts")
        .upload(filePath, file, { upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("payment-receipts")
        .getPublicUrl(filePath);

      const fileUrl = urlData.publicUrl;
      const isImage = file.type.startsWith("image/");

      // Send receipt message
      await supabase.from("chat_messages").insert({
        chat_id: chatId,
        sender_id: customer.id,
        sender_type: "customer",
        content: `📎 Comprovante de pagamento enviado pelo cliente`,
        message_type: "payment_receipt",
        metadata: {
          file_url: fileUrl,
          file_type: isImage ? "image" : "pdf",
          file_name: file.name,
          sale_id: sale.id,
        },
      });

      // Update sale status to awaiting_check
      await supabase.from("sales").update({ financial_status: "awaiting_check" }).eq("id", sale.id);

      toast.success("Comprovante enviado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["chat-messages", chatId] });
      queryClient.invalidateQueries({ queryKey: ["customer-sale", chat?.sale_id] });
    } catch (err) {
      console.error("Erro ao enviar comprovante:", err);
      toast.error("Erro ao enviar comprovante. Tente novamente.");
    } finally {
      setUploadingReceipt(false);
    }
  };

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = sale ? Number(sale.valor_total) - totalPaid : 0;

  const operationalStatus = sale ? STATUS_LABELS[sale.operational_status] || { label: sale.operational_status, emoji: "📋" } : null;
  const financialStatus = sale ? FINANCIAL_LABELS[sale.financial_status] || FINANCIAL_LABELS.pending : null;

  // PIX dynamic generation
  const tenantPixBase = (tenant as any)?.pix_copy_paste as string | null;
  const tenantPixReceiver = (tenant as any)?.pix_receiver_name as string | null;
  const saleAmount = sale ? Number(sale.valor_total) : 0;
  const generatedPix = tenantPixBase && saleAmount > 0
    ? generatePixWithAmount(tenantPixBase, saleAmount - totalPaid > 0 ? saleAmount - totalPaid : saleAmount)
    : null;
  const pixAmount = saleAmount - totalPaid > 0 ? saleAmount - totalPaid : saleAmount;

  // Generate QR Code when PIX code changes
  useEffect(() => {
    if (!generatedPix) {
      setQrCodeDataUrl(null);
      return;
    }
    QRCodeLib.toDataURL(generatedPix, { width: 250, margin: 2, errorCorrectionLevel: "M" })
      .then((url: string) => setQrCodeDataUrl(url))
      .catch(() => setQrCodeDataUrl(null));
  }, [generatedPix]);

  const handleCopyPix = () => {
    if (!generatedPix) return;
    navigator.clipboard.writeText(generatedPix);
    setPixCopied(true);
    toast.success("PIX copiado!");
    setTimeout(() => setPixCopied(false), 3000);
  };

  const handleSendPixInChat = async () => {
    if (!generatedPix || !chatId || !customer || !sale) return;

    // Check if a pix_payment message was already sent for this chat
    const alreadySent = messages.some((m: any) => m.message_type === "pix_payment");
    if (alreadySent) return;

    setSendingPix(true);
    try {
      const content = `💠 **Pagamento via PIX**\n\n💰 Valor: R$ ${pixAmount.toFixed(2)}\n${tenantPixReceiver ? `👤 Recebedor: ${tenantPixReceiver}\n` : ""}\n📋 PIX Copia e Cola:\n\`${generatedPix}\`\n\n_Copie o código acima e cole no app do seu banco._`;
      await supabase.from("chat_messages").insert({
        chat_id: chatId,
        sender_id: null,
        sender_type: "system",
        content,
        message_type: "pix_payment",
      });
      // Keep PIX section open
      queryClient.invalidateQueries({ queryKey: ["chat-messages", chatId] });
    } catch {
      toast.error("Erro ao enviar PIX no chat");
    } finally {
      setSendingPix(false);
    }
  };

  // Render message content with receipt support
  const renderMessageContent = (msg: any) => {
    if (msg.message_type === "payment_receipt") {
      const meta = msg.metadata as any;
      const fileUrl = meta?.file_url;
      const fileType = meta?.file_type;
      const fileName = meta?.file_name;

      return (
        <div>
          <p className="text-sm mb-2">{msg.content}</p>
          {fileType === "image" && fileUrl ? (
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block">
              <img
                src={fileUrl}
                alt="Comprovante"
                className="rounded-lg max-w-[200px] max-h-[250px] object-cover border border-border cursor-pointer hover:opacity-90 transition-opacity"
              />
            </a>
          ) : fileType === "pdf" && fileUrl ? (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 border border-border hover:bg-secondary transition-colors"
            >
              <FileText className="w-5 h-5 text-destructive" />
              <span className="text-xs font-medium truncate">{fileName || "Comprovante.pdf"}</span>
              <span className="text-xs text-primary ml-auto">Abrir</span>
            </a>
          ) : (
            <p className="text-sm">{msg.content}</p>
          )}
        </div>
      );
    }
    return <p className="whitespace-pre-wrap break-words">{msg.content}</p>;
  };

  if (!session?.user || isInactive) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">{isInactive ? "🚫" : "🔒"}</div>
          <p className="text-muted-foreground">
            {isInactive ? "Seu acesso está indisponível. Entre em contato com o estabelecimento." : "Faça login para acessar o chat"}
          </p>
          <Button onClick={() => navigate("/")} variant="outline" className="mt-4">Voltar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-2 space-y-1.5">
          {/* Row 1: Back + tenant info */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            {tenant && (
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden flex-shrink-0">
                  {tenant.logo_url ? (
                    <img src={tenant.logo_url} alt={tenant.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-bold text-muted-foreground">
                      {tenant.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h1 className="font-semibold text-sm text-foreground truncate">{tenant.name}</h1>
                  {sale && <p className="text-xs text-muted-foreground">Pedido #{sale.sale_number}</p>}
                </div>
              </div>
            )}
          </div>

          {/* Row 2: Status badges */}
          {sale && (
            <div className="flex items-center gap-2 flex-wrap pl-1">
              {operationalStatus && (
                <span className="px-2.5 py-1 rounded-full bg-secondary text-foreground text-xs font-medium">
                  {operationalStatus.emoji} {operationalStatus.label}
                </span>
              )}
              {financialStatus && (
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${financialStatus.color}`}>
                  {financialStatus.emoji} {financialStatus.label}
                </span>
              )}
              {sale.financial_status !== "paid" && totalPaid > 0 && (
                <span className="text-xs text-muted-foreground">
                  💰 R$ {totalPaid.toFixed(2)} / R$ {Number(sale.valor_total).toFixed(2)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Payment details - always visible when there are payments */}
        {sale && payments.length > 0 && (
          <div className="px-4 py-2 border-t border-border bg-secondary/30">
            <div className="space-y-1.5 px-1">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs px-3 py-1.5">
                  <span className="font-medium text-foreground">R$ {Number(p.amount).toFixed(2)}</span>
                  <span className="text-muted-foreground">{PAYMENT_METHOD_LABELS[p.payment_method] || p.payment_method}</span>
                  <span className="text-muted-foreground">
                    {new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {allMessages.map((msg) => {
          const isCustomer = msg.sender_type === "customer";
          const isTenant = msg.sender_type === "tenant";
          const isSystem = ["order_summary", "address_confirmation", "status_update", "payment_registered"].includes(msg.message_type);
          const senderName = (msg.metadata as any)?.sender_name;

          return (
            <div key={msg.id} className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[80%]">
                {isTenant && senderName && (
                  <p className="text-[11px] text-muted-foreground mb-0.5 text-left px-1">{senderName}</p>
                )}
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm ${
                    isSystem
                      ? "bg-accent border border-border text-foreground"
                      : isCustomer
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-foreground"
                  } ${msg._optimistic ? "opacity-70" : ""}`}
                >
                  {renderMessageContent(msg)}
                  <p className={`text-[10px] mt-1 ${isCustomer ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Address selector */}
      {sale && !sale.delivery_address && addresses.length > 0 && (
        <div className="px-4 pb-2">
          <button
            onClick={() => setShowAddresses(!showAddresses)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-accent border border-border text-sm font-medium text-foreground"
          >
            <span className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Selecionar endereço de entrega
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showAddresses ? "rotate-180" : ""}`} />
          </button>
          {showAddresses && (
            <div className="mt-2 space-y-2">
              {addresses.map((addr) => (
                <button
                  key={addr.id}
                  onClick={() => handleSelectAddress(addr)}
                  className="w-full text-left px-4 py-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors"
                >
                  <p className="font-medium text-sm text-foreground">{addr.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {addr.street}, {addr.number}{addr.complement ? ` - ${addr.complement}` : ""} — {addr.neighborhood}, {addr.city}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {sale?.delivery_address && (
        <div className="px-4 pb-2">
          <div className="px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-sm">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <MapPin className="w-3.5 h-3.5 text-green-600" />
              Endereço confirmado: {(sale.delivery_address as any)?.label}
            </p>
          </div>
        </div>
      )}

      {/* PIX Payment option */}
      {sale && sale.financial_status !== "paid" && generatedPix && (
        <div className="px-4 pb-2">
          {!showPixPayment ? (
            <button
              onClick={() => {
                setShowPixPayment(true);
                if (!pixSentRef.current) {
                  pixSentRef.current = true;
                  handleSendPixInChat();
                }
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-accent border border-border text-sm font-medium text-foreground hover:border-primary/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-primary" />
                Pagar com PIX
              </span>
              <span className="text-xs text-muted-foreground">R$ {pixAmount.toFixed(2)}</span>
            </button>
          ) : (
            <div className="p-4 rounded-xl bg-accent border border-border space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-primary" />
                  PIX Copia e Cola
                </h3>
                <button onClick={() => setShowPixPayment(false)} className="text-xs text-muted-foreground hover:text-foreground">
                  Fechar
                </button>
              </div>

              {tenantPixReceiver && (
                <p className="text-xs text-muted-foreground">
                  👤 Recebedor: <span className="font-medium text-foreground">{tenantPixReceiver}</span>
                </p>
              )}

              <div className="flex items-center justify-between bg-primary/10 rounded-lg px-3 py-2">
                <span className="text-sm text-muted-foreground">Valor</span>
                <span className="text-lg font-bold text-primary">R$ {pixAmount.toFixed(2)}</span>
              </div>

              {/* QR Code */}
              {qrCodeDataUrl && (
                <div className="flex justify-center">
                  <img src={qrCodeDataUrl} alt="QR Code PIX" className="w-48 h-48 rounded-lg border border-border" />
                </div>
              )}

              <div className="bg-secondary rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground mb-1">PIX Copia e Cola:</p>
                <p className="text-xs font-mono break-all text-foreground leading-relaxed select-all">
                  {generatedPix}
                </p>
              </div>

              <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={handleCopyPix}
                >
                  {pixCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {pixCopied ? "Copiado!" : "Copiar PIX"}
                </Button>
            </div>
          )}
        </div>
      )}

      {/* Upload receipt button */}
      {sale && (sale.financial_status === "pending" || sale.financial_status === "partial") && (
        <div className="px-4 pb-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            className="hidden"
            onChange={handleUploadReceipt}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingReceipt}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent border border-border text-sm font-medium text-foreground hover:border-primary/50 transition-colors disabled:opacity-50"
          >
            <Paperclip className="w-4 h-4 text-primary" />
            {uploadingReceipt ? "Enviando comprovante..." : "Enviar comprovante de pagamento"}
          </button>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border p-4 bg-card">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            rows={1}
            className="flex-1 min-h-[40px] max-h-[120px] px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
          <Button
            size="icon"
            className="h-10 w-10 rounded-xl flex-shrink-0"
            onClick={handleSend}
            disabled={!message.trim() || sending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CustomerChatPage;
