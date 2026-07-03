"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PushNavigationHandler() {
  const router = useRouter();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const askPending = () => {
      navigator.serviceWorker.ready.then((reg) => {
        reg.active?.postMessage({ type: "GET_PENDING_NAV" });
      });
    };

    const handler = (event: MessageEvent) => {
      if (event.data?.type === "NAVIGATE" && event.data?.url) {
        const path = event.data.url.replace(window.location.origin, "");
        router.push(path);
      }
    };

    navigator.serviceWorker.addEventListener("message", handler);

    // Busca URL pendente ao montar (app foi aberto pelo clique na notificação)
    askPending();

    // Busca URL pendente quando app volta ao foco (estava em background)
    const onVisible = () => {
      if (document.visibilityState === "visible") askPending();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handler);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
