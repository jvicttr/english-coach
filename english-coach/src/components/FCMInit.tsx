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

    // Se já tem permissão, registra o token silenciosamente
    const timer = setTimeout(async () => {
      if (Notification.permission !== "granted") return;
      try {
        const { initializeApp, getApps } = await import("firebase/app");
        const { getMessaging, getToken } = await import("firebase/messaging");

        const app = getApps().length > 0 ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
        const sw  = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

        sw.active?.postMessage({ type: "FIREBASE_CONFIG", config: FIREBASE_CONFIG });
        sw.installing?.postMessage({ type: "FIREBASE_CONFIG", config: FIREBASE_CONFIG });

        const messaging = getMessaging(app);
        const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: sw });

        if (token) {
          await fetch("/api/fcm/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
        }
      } catch {
        // silencioso
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [user?.id]);

  return null;
}
