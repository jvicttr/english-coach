"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";

const FIREBASE_CONFIG = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export default function FCMInit() {
  const { user } = useUser();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (!FIREBASE_CONFIG.projectId || !VAPID_KEY) return;

    // Pede permissão e registra o token após 4s
    const timer = setTimeout(async () => {
      try {
        console.log("[FCM] iniciando...");
        const permission = await Notification.requestPermission();
        console.log("[FCM] permissão:", permission);
        if (permission !== "granted") return;

        const { initializeApp, getApps } = await import("firebase/app");
        const { getMessaging, getToken } = await import("firebase/messaging");

        const app = getApps().length > 0 ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
        const sw  = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        console.log("[FCM] SW registrado:", sw);

        // Passa a config para o service worker
        sw.active?.postMessage({ type: "FIREBASE_CONFIG", config: FIREBASE_CONFIG });
        sw.installing?.postMessage({ type: "FIREBASE_CONFIG", config: FIREBASE_CONFIG });

        const messaging = getMessaging(app);
        const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: sw });
        console.log("[FCM] token:", token);

        if (token) {
          const res = await fetch("/api/fcm/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          console.log("[FCM] register response:", res.status);
        }
      } catch (err) {
        console.error("[FCM] erro:", err);
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [user?.id]);

  return null;
}
