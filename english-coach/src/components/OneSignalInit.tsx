"use client";

import { useEffect } from "react";

export default function OneSignalInit() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal: OneSignalType) {
      await OneSignal.init({
        appId: "bd73670e-ac08-4c40-8519-2dc5bd677db7",
        safari_web_id: "web.onesignal.auto.bd73670e-ac08-4c40-8519-2dc5bd677db7",
        notifyButton: { enable: false },
        promptOptions: {
          slidedown: {
            prompts: [
              {
                type: "push",
                autoPrompt: true,
                timeDelay: 5,
                pageViews: 1,
                text: {
                  actionMessage: "Quer receber lembretes diários para praticar inglês?",
                  acceptButton: "Sim, quero!",
                  cancelButton: "Agora não",
                },
              },
            ],
          },
        },
      });
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
