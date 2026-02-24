// Service Worker for Push Notifications (iOS + Android + Desktop)

self.addEventListener("push", function (event) {
  let data = { title: "Sabor Urbano", body: "Atualização do seu pedido" };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      try {
        data.body = event.data.text();
      } catch {
        // fallback to defaults
      }
    }
  }

  const options = {
    body: data.body || "Atualização do seu pedido",
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    vibrate: [200, 100, 200],
    tag: "order-status-" + Date.now(),
    renotify: true,
    requireInteraction: true,
    data: {
      url: "/meus-pedidos",
    },
  };

  event.waitUntil(self.registration.showNotification(data.title || "Sabor Urbano", options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
