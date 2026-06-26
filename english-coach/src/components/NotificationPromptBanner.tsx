"use client";

import { useState, useEffect } from "react";

type PermState = "loading" | "default" | "denied" | "granted";

export default function NotificationPromptBanner() {
  const [perm, setPerm] = useState<PermState>("loading");
  const [dismissed, setDismissed] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) {
      setPerm("granted"); // not supported, hide banner
      return;
    }
    setPerm(Notification.permission as PermState);

    // Listen for changes (e.g. user unblocks in settings while page is open)
    const handler = () => setPerm(Notification.permission as PermState);
    navigator.permissions
      ?.query({ name: "notifications" })
      .then((status) => status.addEventListener("change", handler))
      .catch(() => {});
  }, []);

  const enable = async () => {
    setRequesting(true);
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: OneSignalType) => {
      try {
        await OneSignal.Slidedown?.promptPush({ force: true });
      } catch {
        // Fallback: use native browser prompt
        await Notification.requestPermission();
      }
      setPerm(Notification.permission as PermState);
      setRequesting(false);
    });
  };

  if (perm === "loading" || perm === "granted" || dismissed) return null;

  return (
    <div
      style={{
        margin: "12px 16px 0",
        background: perm === "denied" ? "#1a1010" : "#141200",
        border: `1px solid ${perm === "denied" ? "#5a1a1a" : "#3a2e00"}`,
        borderRadius: 14,
        padding: "14px 16px",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>
        {perm === "denied" ? "🔕" : "🔔"}
      </span>

      <div style={{ flex: 1 }}>
        {perm === "default" ? (
          <>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 4 }}>
              Ative as notificações
            </div>
            <div style={{ fontSize: 12, color: "#aaa", marginBottom: 10, lineHeight: 1.5 }}>
              Receba aviso quando alguém te mandar mensagem e lembretes para praticar.
            </div>
            <button
              onClick={enable}
              disabled={requesting}
              style={{
                background: "#F5C800",
                color: "#000",
                fontWeight: 800,
                fontSize: 13,
                border: "none",
                borderRadius: 50,
                padding: "8px 20px",
                cursor: requesting ? "wait" : "pointer",
                opacity: requesting ? 0.7 : 1,
              }}
            >
              {requesting ? "Aguarde..." : "Ativar notificações"}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 4 }}>
              Notificações bloqueadas
            </div>
            <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.55 }}>
              Para receber mensagens e lembretes, vá nas{" "}
              <strong style={{ color: "#F5C800" }}>configurações do seu navegador</strong>,
              encontre este site e permita notificações.
            </div>
          </>
        )}
      </div>

      <button
        onClick={() => setDismissed(true)}
        style={{
          background: "none",
          border: "none",
          color: "#555",
          fontSize: 20,
          cursor: "pointer",
          padding: 0,
          lineHeight: 1,
          flexShrink: 0,
        }}
        aria-label="Fechar"
      >
        ×
      </button>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OneSignalType = any;

declare global {
  interface Window {
    OneSignalDeferred: ((os: OneSignalType) => void)[];
  }
}
