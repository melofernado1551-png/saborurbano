import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const CANCEL_REASONS = [
  { value: "desisti_do_pedido", label: "Desisti do pedido" },
  { value: "demorou_demais", label: "Demorou demais" },
  { value: "encontrei_preco_melhor", label: "Encontrei uma loja/preço melhor" },
  { value: "erro_no_pedido", label: "Erro no pedido" },
  { value: "outro", label: "Outro" },
];

interface CancelOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string, comment: string) => Promise<void>;
  isLoading?: boolean;
}

const CancelOrderModal = ({ open, onOpenChange, onConfirm, isLoading }: CancelOrderModalProps) => {
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");

  const handleConfirm = async () => {
    if (!reason) return;
    await onConfirm(reason, comment);
    setReason("");
    setComment("");
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      setReason("");
      setComment("");
    }
    onOpenChange(val);
  };

  const reasonLabel = CANCEL_REASONS.find((r) => r.value === reason)?.label || reason;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Por que você deseja cancelar o pedido?</DialogTitle>
          <DialogDescription>
            Selecione o motivo do cancelamento. Essa informação nos ajuda a melhorar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
            {CANCEL_REASONS.map((r) => (
              <div key={r.value} className="flex items-center space-x-3 rounded-lg border border-border p-3 hover:bg-secondary/50 transition-colors">
                <RadioGroupItem value={r.value} id={`cancel-${r.value}`} />
                <Label htmlFor={`cancel-${r.value}`} className="flex-1 cursor-pointer text-sm">
                  {r.label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          {reason === "outro" && (
            <Textarea
              placeholder="Descreva o motivo..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="resize-none"
              rows={3}
            />
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!reason || isLoading}
          >
            {isLoading ? "Cancelando..." : "Confirmar cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export { CancelOrderModal, CANCEL_REASONS };
