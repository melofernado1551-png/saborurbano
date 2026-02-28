import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, Banknote, CreditCard, Copy, Check, ArrowLeft, Paperclip } from "lucide-react";
import { toast } from "sonner";
import QRCodeLib from "qrcode";
import { useEffect } from "react";

interface PaymentMethodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  generatedPix: string | null;
  pixAmount: number;
  tenantPixReceiver: string | null;
  saleTotal: number;
  onSelectPix: () => void;
  onSelectCash: (needsChange: boolean, changeAmount: number | null) => void;
  onSelectCard: () => void;
  onUploadReceipt: () => void;
  uploadingReceipt: boolean;
}

type Step = "choose" | "pix" | "cash_change" | "cash_amount" | "card_confirm";

const PaymentMethodModal = ({
  open,
  onOpenChange,
  generatedPix,
  pixAmount,
  tenantPixReceiver,
  saleTotal,
  onSelectPix,
  onSelectCash,
  onSelectCard,
  onUploadReceipt,
  uploadingReceipt,
}: PaymentMethodModalProps) => {
  const [step, setStep] = useState<Step>("choose");
  const [pixCopied, setPixCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [needsChange, setNeedsChange] = useState<boolean | null>(null);
  const [changeAmount, setChangeAmount] = useState("");

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setStep("choose");
      setPixCopied(false);
      setNeedsChange(null);
      setChangeAmount("");
    }
  }, [open]);

  // Generate QR when showing pix step
  useEffect(() => {
    if (step === "pix" && generatedPix) {
      QRCodeLib.toDataURL(generatedPix, { width: 220, margin: 2, errorCorrectionLevel: "M" })
        .then((url: string) => setQrCodeDataUrl(url))
        .catch(() => setQrCodeDataUrl(null));
    }
  }, [step, generatedPix]);

  const handleCopyPix = () => {
    if (!generatedPix) return;
    navigator.clipboard.writeText(generatedPix);
    setPixCopied(true);
    toast.success("PIX copiado!");
    setTimeout(() => setPixCopied(false), 3000);
  };

  const handleConfirmPix = () => {
    onSelectPix();
    onOpenChange(false);
  };

  const handleCashChangeAnswer = (answer: boolean) => {
    setNeedsChange(answer);
    if (answer) {
      setStep("cash_amount");
    } else {
      onSelectCash(false, null);
      onOpenChange(false);
    }
  };

  const handleCashConfirm = () => {
    const amount = parseFloat(changeAmount.replace(",", "."));
    if (isNaN(amount) || amount <= saleTotal) {
      toast.error(`Informe um valor maior que R$ ${saleTotal.toFixed(2)}`);
      return;
    }
    onSelectCash(true, amount);
    onOpenChange(false);
  };

  const handleCardConfirm = () => {
    onSelectCard();
    onOpenChange(false);
  };

  const goBack = () => {
    if (step === "cash_amount") setStep("cash_change");
    else setStep("choose");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 gap-0 rounded-2xl overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            {step !== "choose" && (
              <button onClick={goBack} className="p-1 rounded-lg hover:bg-secondary transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <DialogTitle className="text-base">
              {step === "choose" && "Forma de pagamento"}
              {step === "pix" && "Pagamento via PIX"}
              {step === "cash_change" && "Pagamento em dinheiro"}
              {step === "cash_amount" && "Troco"}
              {step === "card_confirm" && "Pagamento via cartão"}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="px-5 pb-5">
          {/* Step: Choose method */}
          {step === "choose" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground mb-3">
                Valor do pedido: <span className="font-bold text-foreground">R$ {pixAmount.toFixed(2)}</span>
              </p>

              {generatedPix && (
                <button
                  onClick={() => setStep("pix")}
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
                onClick={() => { setNeedsChange(null); setChangeAmount(""); setStep("cash_change"); }}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-primary/50 bg-card transition-all active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                  <Banknote className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="text-left">
                  <span className="font-semibold text-sm text-foreground">Dinheiro</span>
                  <p className="text-xs text-muted-foreground">Pagamento na entrega</p>
                </div>
              </button>

              <button
                onClick={() => setStep("card_confirm")}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-primary/50 bg-card transition-all active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-left">
                  <span className="font-semibold text-sm text-foreground">Cartão</span>
                  <p className="text-xs text-muted-foreground">Crédito ou débito na entrega</p>
                </div>
              </button>
            </div>
          )}

          {/* Step: PIX */}
          {step === "pix" && generatedPix && (
            <div className="space-y-3">
              {tenantPixReceiver && (
                <p className="text-xs text-muted-foreground">
                  👤 Recebedor: <span className="font-medium text-foreground">{tenantPixReceiver}</span>
                </p>
              )}

              <div className="flex items-center justify-between bg-primary/10 rounded-lg px-3 py-2">
                <span className="text-sm text-muted-foreground">Valor</span>
                <span className="text-lg font-bold text-primary">R$ {pixAmount.toFixed(2)}</span>
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

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => { onUploadReceipt(); }}
                  disabled={uploadingReceipt}
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  {uploadingReceipt ? "Enviando..." : "Enviar comprovante"}
                </Button>
                <Button size="sm" className="flex-1" onClick={handleConfirmPix}>
                  Confirmar PIX
                </Button>
              </div>
            </div>
          )}

          {/* Step: Cash - needs change? */}
          {step === "cash_change" && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-3">
                  <Banknote className="w-8 h-8 text-yellow-600" />
                </div>
                <p className="text-sm font-medium text-foreground">Será necessário levar troco?</p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-12 text-base"
                  onClick={() => handleCashChangeAnswer(false)}
                >
                  Não
                </Button>
                <Button
                  className="flex-1 h-12 text-base"
                  onClick={() => handleCashChangeAnswer(true)}
                >
                  Sim
                </Button>
              </div>
            </div>
          )}

          {/* Step: Cash - change amount */}
          {step === "cash_amount" && (
            <div className="space-y-4">
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground mb-1">Valor do pedido: <span className="font-bold text-foreground">R$ {saleTotal.toFixed(2)}</span></p>
                <p className="text-sm font-medium text-foreground mt-3">Troco para quanto?</p>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={changeAmount}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.,]/g, "");
                    setChangeAmount(val);
                  }}
                  placeholder="0,00"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary border border-border text-foreground text-lg font-semibold text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
              </div>
              <Button className="w-full h-12 text-base" onClick={handleCashConfirm}>
                Confirmar
              </Button>
            </div>
          )}

          {/* Step: Card confirm */}
          {step === "card_confirm" && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                  <CreditCard className="w-8 h-8 text-blue-600" />
                </div>
                <p className="text-sm font-medium text-foreground mb-2">Pagamento na entrega</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  O entregador levará a máquina de cartão para realizar o pagamento no momento da entrega.
                </p>
              </div>
              <Button className="w-full h-12 text-base" onClick={handleCardConfirm}>
                Confirmar pagamento via cartão
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentMethodModal;
