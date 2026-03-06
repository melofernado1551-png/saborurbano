import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";

const PushNotificationButton = () => {
  const { customer } = useCustomerAuth();
  const { permission, subscribe, loading } = usePushNotifications(customer?.id);

  if (permission === "granted") {
    return (
      <Button variant="outline" disabled className="gap-2">
        <Bell className="w-4 h-4 text-green-500" />
        Notificações ativas
      </Button>
    );
  }

  return (
    <Button variant="outline" className="gap-2" onClick={subscribe} disabled={loading}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellOff className="w-4 h-4" />}
      Ativar notificações
    </Button>
  );
};

export default PushNotificationButton;
