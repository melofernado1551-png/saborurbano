import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, Receipt, QrCode, Copy, Check, Paperclip, FileText, Image as ImageIcon, XCircle, PackageCheck, Star, Wallet } from "lucide-react";
import { toast } from "sonner";
import { generatePixWithAmount } from "@/lib/pixUtils";
import QRCodeLib from "qrcode";
import { CancelOrderModal, CANCEL_REASONS } from "@/components/CancelOrderModal";
import PaymentMethodModal from "@/components/PaymentMethodModal";
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

const STATUS_LABELS: Record<string, { label: string; emoji: string }> = {
  received: { label: "Pedido recebido", emoji: "📥" },
  preparing: { label: "Em preparo", emoji: "👨‍🍳" },
  ready: { label: "Pronto", emoji: "✅" },
  delivering: { label: "Saiu para entrega", emoji: "🛵" },
  delivering_pending: { label: "Aguardando sua confirmação", emoji: "📦" },
  finished: { label: "Finalizado", emoji: "✅" },
  cancelled: { label: "Cancelado", emoji: "❌" },
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
  
  const [showPayments, setShowPayments] = useState(false);
  const [showPixPayment, setShowPixPayment] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [showConfirmDelivery, setShowConfirmDelivery] = useState(false);
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

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

  // Check if review already exists
  const { data: existingReview } = useQuery({
    queryKey: ["customer-sale-review", chat?.sale_id],
    enabled: !!chat?.sale_id && !!customer,
    queryFn: async () => {
      const { data } = await supabase.from("sale_reviews").select("id").eq("sale_id", chat!.sale_id!).eq("customer_id", customer!.id).maybeSingle();
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

  // Receipt upload handler
  const handleUploadReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatId || !customer || !sale) return;

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

  // Cancel order handler
  const handleCancelOrder = async (reason: string, comment: string) => {
    if (!sale || !chatId || !customer) return;

    // Block cancellation if already finished or paid+closed
    if (sale.operational_status === "finished" || sale.operational_status === "cancelled") {
      toast.error("Este pedido não pode mais ser cancelado.");
      return;
    }

    setCancellingOrder(true);
    try {
      const reasonLabel = CANCEL_REASONS.find((r) => r.value === reason)?.label || reason;

      // Update sale
      const { error: updateErr } = await supabase.from("sales").update({
        operational_status: "cancelled",
        cancel_reason: reason,
        cancel_comment: comment || null,
        canceled_by: "cliente",
        canceled_at: new Date().toISOString(),
      } as any).eq("id", sale.id);
      if (updateErr) throw updateErr;

      // Send cancellation message
      await supabase.from("chat_messages").insert({
        chat_id: chatId,
        sender_id: customer.id,
        sender_type: "system",
        content: `❌ Pedido cancelado pelo cliente\nMotivo: ${reasonLabel}${comment ? `\nObs: ${comment}` : ""}`,
        message_type: "status_update",
        metadata: {},
      });

      // Close chat
      await supabase.from("chats").update({ active: false, status: "closed", updated_at: new Date().toISOString() }).eq("id", chatId);

      toast.success("Pedido cancelado com sucesso.");
      setShowCancelModal(false);
      queryClient.invalidateQueries({ queryKey: ["customer-sale", chat?.sale_id] });
      queryClient.invalidateQueries({ queryKey: ["chat-messages", chatId] });
      queryClient.invalidateQueries({ queryKey: ["customer-chat", chatId] });
    } catch (err) {
      console.error("Erro ao cancelar pedido:", err);
      toast.error("Erro ao cancelar pedido. Tente novamente.");
    } finally {
      setCancellingOrder(false);
    }
  };

  const canCancel = sale && sale.operational_status !== "finished" && sale.operational_status !== "cancelled" && sale.operational_status !== "delivering_pending" && sale.financial_status !== "paid";

  // Confirm delivery handler
  const handleConfirmDelivery = async () => {
    if (!sale || !chatId || !customer) return;
    if (sale.operational_status !== "delivering_pending") {
      toast.error("O pedido não está aguardando confirmação.");
      return;
    }
    setConfirmingDelivery(true);
    try {
      const { error: updateErr } = await supabase.from("sales").update({
        operational_status: "finished",
        delivered_confirmed_at: new Date().toISOString(),
        delivered_confirmed_by: "cliente",
      } as any).eq("id", sale.id);
      if (updateErr) throw updateErr;

      await supabase.from("chat_messages").insert({
        chat_id: chatId,
        sender_id: customer.id,
        sender_type: "system",
        content: "✅ Pedido finalizado. Obrigado por comprar conosco!",
        message_type: "status_update",
        metadata: {},
      });

      setShowConfirmDelivery(false);
      queryClient.invalidateQueries({ queryKey: ["customer-sale", chat?.sale_id] });
      queryClient.invalidateQueries({ queryKey: ["chat-messages", chatId] });
      queryClient.invalidateQueries({ queryKey: ["customer-chat", chatId] });

      // Show review screen
      setReviewRating(0);
      setReviewComment("");
      setShowReview(true);
    } catch (err) {
      console.error("Erro ao confirmar entrega:", err);
      toast.error("Erro ao confirmar entrega. Tente novamente.");
    } finally {
      setConfirmingDelivery(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!sale || !customer || !chat || reviewRating === 0) return;
    setSubmittingReview(true);
    try {
      const { error } = await supabase.from("sale_reviews").insert({
        sale_id: sale.id,
        customer_id: customer.id,
        tenant_id: chat.tenant_id,
        rating: reviewRating,
        comment: reviewComment.trim() || null,
      } as any);
      if (error) throw error;

      // Send review message in chat
      const stars = "⭐".repeat(reviewRating);
      const reviewMsg = `${stars} Avaliação: ${reviewRating}/5${reviewComment.trim() ? `\n💬 "${reviewComment.trim()}"` : ""}`;
      await supabase.from("chat_messages").insert({
        chat_id: chatId!,
        sender_id: customer.id,
        sender_type: "system",
        content: reviewMsg,
        message_type: "review",
        metadata: { rating: reviewRating },
      });

      // Close chat after review
      await supabase.from("chats").update({ active: false, status: "closed", updated_at: new Date().toISOString() }).eq("id", chatId!);

      toast.success("Obrigado pela sua avaliação!");
      setShowReview(false);
      queryClient.invalidateQueries({ queryKey: ["chat-messages", chatId] });
      queryClient.invalidateQueries({ queryKey: ["customer-sale-review", chat?.sale_id] });
      queryClient.invalidateQueries({ queryKey: ["customer-chat", chatId] });
    } catch (err) {
      console.error("Erro ao enviar avaliação:", err);
      toast.error("Erro ao enviar avaliação.");
    } finally {
      setSubmittingReview(false);
    }
  };

  // Payment method handlers
  const handleSelectPix = async () => {
    if (!sale || !chatId || !customer) return;
    try {
      await supabase.from("sales").update({ forma_pagamento: "pix" } as any).eq("id", sale.id);
      await supabase.from("chat_messages").insert({
        chat_id: chatId,
        sender_id: customer.id,
        sender_type: "system",
        content: "💳 Pagamento via PIX selecionado. Aguardando confirmação.",
        message_type: "payment_method",
        metadata: { payment_method: "pix" },
      });
      queryClient.invalidateQueries({ queryKey: ["customer-sale", chat?.sale_id] });
      queryClient.invalidateQueries({ queryKey: ["chat-messages", chatId] });
    } catch {
      toast.error("Erro ao registrar forma de pagamento.");
    }
  };

  const handleSelectCash = async (needsChange: boolean, changeAmount: number | null) => {
    if (!sale || !chatId || !customer) return;
    try {
      await supabase.from("sales").update({
        forma_pagamento: "dinheiro",
        observacao: needsChange && changeAmount
          ? `Troco para R$ ${changeAmount.toFixed(2)}`
          : sale.observacao,
      } as any).eq("id", sale.id);

      let content = "💵 Pagamento em dinheiro selecionado.";
      if (needsChange && changeAmount) {
        content += `\n💰 Troco necessário para: R$ ${changeAmount.toFixed(2)}`;
      } else {
        content += "\n✅ Não precisa de troco.";
      }

      await supabase.from("chat_messages").insert({
        chat_id: chatId,
        sender_id: customer.id,
        sender_type: "system",
        content,
        message_type: "payment_method",
        metadata: { payment_method: "dinheiro", needs_change: needsChange, change_amount: changeAmount },
      });
      queryClient.invalidateQueries({ queryKey: ["customer-sale", chat?.sale_id] });
      queryClient.invalidateQueries({ queryKey: ["chat-messages", chatId] });
      toast.success("Forma de pagamento registrada!");
    } catch {
      toast.error("Erro ao registrar forma de pagamento.");
    }
  };

  const handleSelectCard = async () => {
    if (!sale || !chatId || !customer) return;
    try {
      await supabase.from("sales").update({ forma_pagamento: "cartao" } as any).eq("id", sale.id);
      await supabase.from("chat_messages").insert({
        chat_id: chatId,
        sender_id: customer.id,
        sender_type: "system",
        content: "💳 Pagamento via cartão selecionado. O entregador levará a máquina.",
        message_type: "payment_method",
        metadata: { payment_method: "cartao" },
      });
      queryClient.invalidateQueries({ queryKey: ["customer-sale", chat?.sale_id] });
      queryClient.invalidateQueries({ queryKey: ["chat-messages", chatId] });
      toast.success("Forma de pagamento registrada!");
    } catch {
      toast.error("Erro ao registrar forma de pagamento.");
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
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${sale.operational_status === "cancelled" ? "bg-destructive text-destructive-foreground" : "bg-secondary text-foreground"}`}>
                  {operationalStatus.emoji} {operationalStatus.label}
                </span>
              )}
              {financialStatus && sale.operational_status !== "cancelled" && (
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${financialStatus.color}`}>
                  {financialStatus.emoji} {financialStatus.label}
                </span>
              )}
              {sale.financial_status !== "paid" && totalPaid > 0 && sale.operational_status !== "cancelled" && (
                <span className="text-xs text-muted-foreground">
                  💰 R$ {totalPaid.toFixed(2)} / R$ {Number(sale.valor_total).toFixed(2)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Payment details - always visible when there are payments */}
        {sale && payments.length > 0 && sale.operational_status !== "cancelled" && (
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

        {/* Delivery code display */}
        {sale && (sale.operational_status === "delivering" || sale.operational_status === "delivering_pending") && (sale as any).delivery_code && (
          <div className="px-4 py-2 border-t border-border bg-primary/5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground">🔑 Seu código de recebimento:</span>
              <span className="font-mono font-bold text-lg text-primary tracking-widest">{(sale as any).delivery_code}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Apresente este código ao entregador</p>
          </div>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {allMessages.map((msg) => {
          const isCustomer = msg.sender_type === "customer";
          const isTenant = msg.sender_type === "tenant";
          const isSystem = ["order_summary", "address_confirmation", "status_update", "payment_registered", "payment_method"].includes(msg.message_type);
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

      {/* Confirm delivery button - only when delivering_pending and no existing review */}
      {sale && sale.operational_status === "delivering_pending" && !existingReview && (
        <div className="px-4 pb-2">
          <button
            onClick={() => setShowConfirmDelivery(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-md"
          >
            <PackageCheck className="w-5 h-5" />
            Confirmar recebimento
          </button>
        </div>
      )}

      {/* Payment + Cancel buttons */}
      {sale && sale.operational_status !== "cancelled" && sale.operational_status !== "finished" && sale.operational_status !== "delivering_pending" && (
        <div className="px-4 pb-2 space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            className="hidden"
            onChange={handleUploadReceipt}
          />
          {(sale.financial_status === "pending" || sale.financial_status === "partial") && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-md active:scale-[0.98]"
            >
              <Wallet className="w-5 h-5" />
              PAGAR
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-destructive/30 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Cancelar pedido
            </button>
          )}
        </div>
      )}

      {/* Input - hidden when order is finished or cancelled or chat is closed */}
      {(sale && (sale.operational_status === "finished" || sale.operational_status === "cancelled")) || (chat && chat.status === "closed") ? (
        <div className="border-t border-border p-4 bg-secondary/50">
          <p className="text-center text-sm text-muted-foreground">
            {sale?.operational_status === "cancelled" ? "❌ Pedido cancelado" : "✅ Pedido finalizado"} — chat encerrado.
          </p>
        </div>
      ) : (
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
      )}

      {/* Cancel Order Modal */}
      <CancelOrderModal
        open={showCancelModal}
        onOpenChange={setShowCancelModal}
        onConfirm={handleCancelOrder}
        isLoading={cancellingOrder}
      />

      {/* Confirm delivery modal */}
      <AlertDialog open={showConfirmDelivery} onOpenChange={setShowConfirmDelivery}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar recebimento</AlertDialogTitle>
            <AlertDialogDescription>
              Você confirma que recebeu o pedido corretamente?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelivery}
              disabled={confirmingDelivery}
            >
              {confirmingDelivery ? "Confirmando..." : "Confirmar entrega"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Review modal */}
      <AlertDialog open={showReview} onOpenChange={(open) => { if (!open) setShowReview(false); }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center">Como foi seu pedido?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Avalie sua experiência com {tenant?.name || "o estabelecimento"}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Stars */}
          <div className="flex justify-center gap-2 py-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setReviewRating(star)}
                onMouseEnter={() => setReviewHover(star)}
                onMouseLeave={() => setReviewHover(0)}
                className="transition-transform hover:scale-110 active:scale-95"
              >
                <Star
                  className={`w-9 h-9 transition-colors ${
                    star <= (reviewHover || reviewRating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground/30"
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Comment */}
          <textarea
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder="Deixe um comentário (opcional)..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />

          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={handleSubmitReview}
              disabled={reviewRating === 0 || submittingReview}
              className="w-full"
            >
              {submittingReview ? "Enviando..." : "Enviar avaliação"}
            </AlertDialogAction>
            <AlertDialogCancel
              onClick={() => setShowReview(false)}
              className="w-full mt-0"
            >
              Pular
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Method Modal */}
      <PaymentMethodModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        generatedPix={generatedPix}
        pixAmount={pixAmount}
        tenantPixReceiver={tenantPixReceiver}
        saleTotal={sale ? Number(sale.valor_total) : 0}
        onSelectPix={handleSelectPix}
        onSelectCash={handleSelectCash}
        onSelectCard={handleSelectCard}
        onUploadReceipt={() => fileInputRef.current?.click()}
        uploadingReceipt={uploadingReceipt}
      />
    </div>
  );
};

export default CustomerChatPage;
