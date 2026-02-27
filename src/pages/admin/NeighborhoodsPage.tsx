import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/contexts/AdminContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface Neighborhood {
  id: string;
  name: string;
  shipping_fee: number;
  active: boolean;
}

const NeighborhoodsPage = () => {
  const { effectiveTenantId } = useAdmin();
  const tenantId = effectiveTenantId;
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", shipping_fee: "" });

  const { data: neighborhoods = [], isLoading } = useQuery({
    queryKey: ["tenant-neighborhoods", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_neighborhoods")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data as Neighborhood[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: { name: string; shipping_fee: number }) => {
      if (editingId) {
        const { error } = await supabase
          .from("tenant_neighborhoods")
          .update(values)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tenant_neighborhoods")
          .insert({ ...values, tenant_id: tenantId! });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-neighborhoods"] });
      toast.success(editingId ? "Bairro atualizado!" : "Bairro adicionado!");
      closeDialog();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tenant_neighborhoods")
        .update({ active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-neighborhoods"] });
      toast.success("Bairro removido!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm({ name: "", shipping_fee: "" });
  };

  const openEdit = (n: Neighborhood) => {
    setForm({ name: n.name, shipping_fee: String(n.shipping_fee) });
    setEditingId(n.id);
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Informe o nome do bairro");
      return;
    }
    const fee = parseFloat(form.shipping_fee);
    if (isNaN(fee) || fee < 0) {
      toast.error("Informe um valor de frete válido");
      return;
    }
    saveMutation.mutate({ name: form.name.trim(), shipping_fee: fee });
  };

  if (!tenantId) {
    return <p className="text-center py-20 text-muted-foreground">Sem estabelecimento selecionado</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="w-6 h-6 text-primary" />
            Bairros Atendidos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre os bairros e o valor de frete para cada um
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Bairro
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : neighborhoods.length === 0 ? (
        <div className="text-center py-16">
          <MapPin className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum bairro cadastrado</p>
          <p className="text-sm text-muted-foreground mt-1">
            Adicione bairros para que os clientes possam selecionar na entrega
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {neighborhoods.map((n) => (
            <div key={n.id} className="p-4 rounded-xl border border-border bg-card flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{n.name}</p>
                <p className="text-sm text-primary font-bold mt-0.5">
                  {n.shipping_fee === 0 ? "Frete Grátis" : `R$ ${Number(n.shipping_fee).toFixed(2)}`}
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(n)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => {
                    if (confirm(`Remover bairro "${n.name}"?`)) deleteMutation.mutate(n.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Bairro" : "Novo Bairro"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do bairro *</Label>
              <Input
                placeholder="Ex: Centro, Pirajá..."
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valor do frete (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="5.00"
                value={form.shipping_fee}
                onChange={(e) => setForm({ ...form, shipping_fee: e.target.value })}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NeighborhoodsPage;
