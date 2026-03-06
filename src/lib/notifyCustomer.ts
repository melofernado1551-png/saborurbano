import { supabase } from "@/integrations/supabase/client";

const STATUS_NOTIFICATIONS: Record<string, { title: string; body: string }> = {
  confirmed: { title: "✅ Pedido confirmado!", body: "Seu pedido foi aceito e está sendo preparado." },
  preparing: { title: "👨‍🍳 Preparando seu pedido", body: "A cozinha já está no seu pedido!" },
  delivering: { title: "🛵 Saiu para entrega!", body: "Seu pedido está a caminho!" },
  ready: { title: "🎉 Pedido pronto!", body: "Pronto para retirada." },
  new_message: { title: "💬 Nova mensagem", body: "Você tem uma mensagem sobre seu pedido." },
};

export async function notifyCustomer(customerId: string, status: string, chatId: string) {
  try {
    const notification = STATUS_NOTIFICATIONS[status];
    if (!notification) return;

    const { data: sub } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("customer_id", customerId)
      .maybeSingle();

    if (!sub?.subscription) return;

    const subscription = JSON.parse(sub.subscription);

    await supabase.functions.invoke("send-push", {
      body: {
        subscription,
        title: notification.title,
        body: notification.body,
        url: `/chat/${chatId}`,
      },
    });
  } catch (err) {
    console.error("Erro ao enviar push notification:", err);
  }
}
