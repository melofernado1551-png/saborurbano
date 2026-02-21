import { useAdmin } from "@/contexts/AdminContext";
import { Construction, Building2 } from "lucide-react";

interface Props {
  title: string;
}

const PlaceholderPage = ({ title }: Props) => {
  const { effectiveTenantId } = useAdmin();

  if (!effectiveTenantId) {
    return (
      <div className="text-center py-20">
        <Building2 className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold mb-1">Selecione um restaurante</h3>
        <p className="text-muted-foreground text-sm">Escolha um restaurante para continuar.</p>
      </div>
    );
  }

  return (
    <div className="text-center py-20">
      <Construction className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-muted-foreground text-sm">Esta funcionalidade está em desenvolvimento.</p>
    </div>
  );
};

export default PlaceholderPage;
