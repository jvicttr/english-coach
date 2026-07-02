self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { return; }

  const title = payload.title ?? "JV IA";
  const body  = payload.body  ?? "";
  const icon  = payload.icon  ?? "/favicon.png";
  const url   = payload.url   ?? "/app";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: "/favicon.png",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/app";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
