"use client";

import { useEffect } from "react";

export default function OneSignalInit() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal: OneSignalType) {
      await OneSignal.init({
        appId: "bd73670e-ac08-4c40-8519-2dc5bd677db7",
        notifyButton: { enable: false },
        allowLocalhostAsSecureOrigin: false,
      });

      // Show push permission prompt after 5s if not yet decided
      setTimeout(async () => {
        const permission = OneSignal.Notifications?.permission;
        if (!permission) {
          await OneSignal.Slidedown?.promptPush({
            force: false,
            slidedownPromptOptions: {
              actionMessage: "Receba lembretes diários para praticar inglês!",
              acceptButtonText: "Sim, quero!",
              cancelButtonText: "Agora não",
            },
          });
        }
      }, 5000);
    });

    const script = document.createElement("script");
    script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OneSignalType = any;

declare global {
  interface Window {
    OneSignalDeferred: ((os: OneSignalType) => void)[];
  }
}
