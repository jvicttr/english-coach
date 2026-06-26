"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";

export default function OneSignalInit() {
  const { user } = useUser();

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal: OneSignalType) {
      await OneSignal.init({
        appId: "bd73670e-ac08-4c40-8519-2dc5bd677db7",
        notifyButton: { enable: false },
        allowLocalhostAsSecureOrigin: false,
      });

      // Show push permission prompt if not decided yet
      const isSubscribed = OneSignal.Notifications?.permission;
      if (!isSubscribed) {
        setTimeout(async () => {
          await OneSignal.Slidedown?.promptPush({
            force: false,
            slidedownPromptOptions: {
              actionMessage: "Ative notificações para receber mensagens e lembretes diários 🔔",
              acceptButtonText: "Ativar",
              cancelButtonText: "Agora não",
            },
          });
        }, 4000);
      }
    });

    if (!document.querySelector('script[src*="OneSignalSDK.page"]')) {
      const script = document.createElement("script");
      script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
      script.defer = true;
      document.head.appendChild(script);
    }
  }, []);

  // Link OneSignal subscription to the Clerk user ID (external_id)
  // This enables targeting the user by ID without storing player_ids
  useEffect(() => {
    if (!user?.id) return;

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal: OneSignalType) {
      try {
        await OneSignal.login(user.id);
      } catch {
        // SDK not yet ready or user already linked — safe to ignore
      }
    });
  }, [user?.id]);

  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OneSignalType = any;

declare global {
  interface Window {
    OneSignalDeferred: ((os: OneSignalType) => void)[];
  }
}
