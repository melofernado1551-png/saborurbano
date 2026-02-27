import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, MapPin, Pencil, Trash2, X, Save } from "lucide-react";

interface CustomerAddressesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect?: (address: any) => void;
  selectMode?: boolean;
  tenantId?: string;
}

const CustomerAddressesModal = ({ open, onOpenChange, onSelect, selectMode = false, tenantId }: CustomerAddressesModalProps) => {
  const { customer } = useCustomerAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    label: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    neighborhood_id: "",
    city: "",
    reference: "",
  });

  // Fetch tenant info (city)
  const { data: tenant } = useQuery({
    queryKey: ["tenant-info-address", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("city")
        .eq("id", tenantId!)
        .single();
      if (error) throw error;
      return data as { city: string | null };
    },
  });

  const tenantCity = tenant?.city || "";

  // Fetch tenant neighborhoods for select mode
  const { data: neighborhoods = [] } = useQuery({
    queryKey: ["tenant-neighborhoods-customer", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_neighborhoods")
        .select("id, name, shipping_fee")
        .eq("tenant_id", tenantId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["customer-addresses", customer?.id],
    enabled: !!customer?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_addresses")
        .select("*")
        .eq("customer_id", customer!.id)
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      const payload = {
        label: values.label,
        street: values.street,
        number: values.number,
        complement: values.complement || null,
        neighborhood: values.neighborhood,
        neighborhood_id: values.neighborhood_id || null,
        city: values.city,
        reference: values.reference || null,
        tenant_id: tenantId || null,
      };
      if (editingId) {
        const { error } = await supabase
          .from("customer_addresses")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("customer_addresses")
          .insert({ ...payload, customer_id: customer!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-addresses"] });
      toast.success(editingId ? "Endereço atualizado!" : "Endereço adicionado!");
      resetForm();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("customer_addresses")
        .update({ active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-addresses"] });
      toast.success("Endereço removido!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const resetForm = () => {
    setForm({ label: "", street: "", number: "", complement: "", neighborhood: "", neighborhood_id: "", city: "", reference: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (addr: any) => {
    setForm({
      label: addr.label || "",
      street: addr.street || "",
      number: addr.number || "",
      complement: addr.complement || "",
      neighborhood: addr.neighborhood || "",
      neighborhood_id: addr.neighborhood_id || "",
      city: addr.city || "",
      reference: addr.reference || "",
    });
    setEditingId(addr.id);
    setShowForm(true);
  };

  const handleNeighborhoodSelect = (neighborhoodId: string) => {
    const n = neighborhoods.find((nb: any) => nb.id === neighborhoodId);
    if (n) {
      setForm((prev) => ({ ...prev, neighborhood: n.name, neighborhood_id: n.id }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer?.id) {
      toast.error("Você precisa estar logado para salvar um endereço");
      return;
    }
    if (!form.label || !form.street || !form.number || !form.neighborhood || !(form.city || tenantCity)) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    // If tenant has neighborhoods, require selection from list
    if (neighborhoods.length > 0 && !form.neighborhood_id) {
      toast.error("Selecione um bairro da lista");
      return;
    }
    saveMutation.mutate({ ...form, city: form.city || tenantCity });
  };

  const hasNeighborhoods = neighborhoods.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            {selectMode ? "Selecionar Endereço" : "Meus Endereços"}
          </DialogTitle>
        </DialogHeader>

        {showForm ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Nome do endereço *</Label>
                <Input placeholder="Ex: Casa, Trabalho" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />
              </div>

              {/* Neighborhood: select from tenant list or free text */}
              <div className="col-span-2 sm:col-span-1 space-y-1.5">
                <Label>Bairro *</Label>
                {hasNeighborhoods ? (
                  <Select value={form.neighborhood_id} onValueChange={handleNeighborhoodSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o bairro" />
                    </SelectTrigger>
                    <SelectContent>
                      {neighborhoods.map((n: any) => (
                        <SelectItem key={n.id} value={n.id}>
                          {n.name} — R$ {Number(n.shipping_fee).toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input placeholder="Bairro" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} required />
                )}
              </div>

              <div className="col-span-2 sm:col-span-1 space-y-1.5">
                <Label>Cidade *</Label>
                <Input placeholder="Cidade" value={form.city || tenantCity} onChange={(e) => setForm({ ...form, city: e.target.value })} required readOnly={!!tenantCity} className={tenantCity ? "bg-muted" : ""} />
              </div>

              <div className="col-span-2 sm:col-span-1 space-y-1.5">
                <Label>Rua *</Label>
                <Input placeholder="Rua, Avenida..." value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Número *</Label>
                <Input placeholder="123" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Complemento</Label>
                <Input placeholder="Apto, Bloco..." value={form.complement} onChange={(e) => setForm({ ...form, complement: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Referência</Label>
                <Input placeholder="Próximo a..." value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={resetForm} className="flex-1 gap-1">
                <X className="w-4 h-4" /> Cancelar
              </Button>
              <Button type="submit" className="flex-1 gap-1" disabled={saveMutation.isPending}>
                <Save className="w-4 h-4" /> {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <Button variant="outline" className="w-full gap-2" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4" /> Novo endereço
            </Button>

            {isLoading ? (
              <p className="text-center text-muted-foreground py-4">Carregando...</p>
            ) : addresses.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum endereço cadastrado</p>
            ) : (
              addresses.map((addr: any) => {
                // In select mode, find shipping fee for this neighborhood
                const neighborhoodInfo = addr.neighborhood_id
                  ? neighborhoods.find((n: any) => n.id === addr.neighborhood_id)
                  : null;

                return (
                  <div
                    key={addr.id}
                    className={`p-4 rounded-xl border border-border bg-card space-y-1 ${selectMode ? "cursor-pointer hover:border-primary transition-colors" : ""}`}
                    onClick={() => {
                      if (selectMode) {
                        onSelect?.({
                          ...addr,
                          shipping_fee: neighborhoodInfo?.shipping_fee ?? null,
                        });
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{addr.label}</span>
                      {!selectMode && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(addr)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(addr.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {addr.street}, {addr.number}
                      {addr.complement ? ` - ${addr.complement}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {addr.neighborhood} - {addr.city}
                    </p>
                    {neighborhoodInfo && selectMode && (
                      <p className="text-xs font-semibold text-primary">
                        Frete: {Number(neighborhoodInfo.shipping_fee) === 0 ? "Grátis" : `R$ ${Number(neighborhoodInfo.shipping_fee).toFixed(2)}`}
                      </p>
                    )}
                    {addr.reference && <p className="text-xs text-muted-foreground italic">Ref: {addr.reference}</p>}
                  </div>
                );
              })
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CustomerAddressesModal;
