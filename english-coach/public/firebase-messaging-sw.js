importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(clients.claim()));

let pendingNavUrl = null;

// Configuração injetada pelo FCMInit via postMessage
let messaging;

self.addEventListener("message", (event) => {
  if (event.data?.type === "FIREBASE_CONFIG") {
    if (!firebase.apps.length) {
      firebase.initializeApp(event.data.config);
    }
    messaging = firebase.messaging();
  }
  if (event.data?.type === "GET_PENDING_NAV") {
    event.source.postMessage({ type: "NAVIGATE", url: pendingNavUrl });
    pendingNavUrl = null;
  }
});

// Recebe notificações quando o app está em background
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { return; }

  const title = payload.notification?.title ?? payload.data?.title ?? payload.title ?? "JV IA";
  const body  = payload.notification?.body  ?? payload.data?.body  ?? payload.body  ?? "";
  const icon  = payload.notification?.icon  ?? payload.icon  ?? "/favicon.png";
  const url   = payload.fcm_options?.link   ?? payload.data?.url ?? payload.url   ?? "/app";

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
  pendingNavUrl = url;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      if (list.length > 0) {
        list[0].focus();
        list[0].postMessage({ type: "NAVIGATE", url });
      } else {
        clients.openWindow(url);
      }
    })
  );
});
