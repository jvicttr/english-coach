"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PushNavigationHandler() {
  const router = useRouter();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "NAVIGATE" && event.data?.url) {
        const path = event.data.url.replace(window.location.origin, "");
        router.push(path);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [router]);

  return null;
}
