import { useState } from "react";
import { useAdmin } from "@/contexts/AdminContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
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

interface Mesa {
  id: string;
  tenant_id: string;
  numero: number;
  identificador: string | null;
  active: boolean;
}

const MesasPage = () => {
  const { effectiveTenantId } = useAdmin();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMesa, setEditingMesa] = useState<Mesa | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [numero, setNumero] = useState("");
  const [identificador, setIdentificador] = useState("");

  const { data: mesas = [], isLoading } = useQuery({
    queryKey: ["mesas", effectiveTenantId],
    enabled: !!effectiveTenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mesas" as any)
        .select("*")
        .eq("tenant_id", effectiveTenantId!)
        .order("numero");
      if (error) throw error;
      return data as unknown as Mesa[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const num = parseInt(numero);
      if (isNaN(num) || num <= 0) throw new Error("Número inválido");

      if (editingMesa) {
        const { error } = await supabase
          .from("mesas" as any)
          .update({ numero: num, identificador: identificador || null } as any)
          .eq("id", editingMesa.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("mesas" as any)
          .insert({ tenant_id: effectiveTenantId!, numero: num, identificador: identificador || null } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      toast.success(editingMesa ? "Mesa atualizada!" : "Mesa cadastrada!");
      closeDialog();
    },
    onError: (e: any) => {
      if (e.message?.includes("unique") || e.message?.includes("duplicate")) {
        toast.error("Já existe uma mesa com esse número!");
      } else {
        toast.error(e.message || "Erro ao salvar mesa");
      }
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("mesas" as any)
        .update({ active } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("mesas" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      toast.success("Mesa removida!");
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover"),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingMesa(null);
    setNumero("");
    setIdentificador("");
  };

  const openEdit = (mesa: Mesa) => {
    setEditingMesa(mesa);
    setNumero(String(mesa.numero));
    setIdentificador(mesa.identificador || "");
    setDialogOpen(true);
  };

  if (!effectiveTenantId) {
    return <div className="text-center py-12 text-muted-foreground">Selecione um estabelecimento</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mesas</h1>
          <p className="text-sm text-muted-foreground">Gerencie as mesas do seu estabelecimento</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Mesa
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : mesas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <UtensilsCrossed className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">Nenhuma mesa cadastrada</h3>
            <p className="text-sm text-muted-foreground mb-4">Cadastre as mesas do seu salão para usar o painel do garçom</p>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Cadastrar Mesa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mesas.map((mesa) => (
            <Card key={mesa.id} className={!mesa.active ? "opacity-60" : ""}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {mesa.numero}
                  </div>
                  <div>
                    <p className="font-medium">Mesa {mesa.numero}</p>
                    {mesa.identificador && (
                      <p className="text-xs text-muted-foreground">{mesa.identificador}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={mesa.active}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: mesa.id, active: checked })}
                  />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(mesa)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteId(mesa.id)} className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog para criar/editar mesa */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMesa ? "Editar Mesa" : "Nova Mesa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Número da Mesa *</Label>
              <Input
                type="number"
                min="1"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Ex: 1, 2, 10..."
              />
            </div>
            <div className="space-y-2">
              <Label>Identificador (opcional)</Label>
              <Input
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="Ex: Área externa, Mezanino..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !numero}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover mesa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Mesas com pedidos vinculados não poderão ser removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MesasPage;
