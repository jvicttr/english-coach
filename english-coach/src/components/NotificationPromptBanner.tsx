"use client";

import { useState, useEffect } from "react";

type PermState = "loading" | "default" | "denied" | "granted";

const DISMISSED_KEY = "notif-banner-dismissed";
const SUBSCRIBED_KEY = "push-subscribed";

export default function NotificationPromptBanner() {
  const [perm, setPerm] = useState<PermState>("loading");
  const [dismissed, setDismissed] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    // Permanently dismissed by the user (× button) — never show again
    if (localStorage.getItem(DISMISSED_KEY) === "1") {
      setDismissed(true);
      return;
    }

    // Already subscribed and confirmed in a previous session — hide banner
    if (localStorage.getItem(SUBSCRIBED_KEY) === "1") {
      setDismissed(true);
      return;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (!("Notification" in window)) {
      if (isIOS) setPerm("default");
      else setDismissed(true); // not supported, hide
      return;
    }

    // On iOS, Notification.permission can incorrectly report "granted" before
    // the user has actually been asked. Show the banner until confirmed.
    if (isIOS && Notification.permission !== "denied") {
      setPerm("default");
      return;
    }

    if (Notification.permission === "granted") {
      setDismissed(true); // already granted on non-iOS, no banner needed
      return;
    }

    setPerm(Notification.permission as PermState);

    const handler = () => setPerm(Notification.permission as PermState);
    navigator.permissions
      ?.query({ name: "notifications" })
      .then((status) => status.addEventListener("change", handler))
      .catch(() => {});
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  const enable = async () => {
    setRequesting(true);
    try {
      if ("Notification" in window) {
        // Must be called directly from the user gesture — iOS blocks async wrappers
        const result = await Notification.requestPermission();
        if (result === "granted") {
          localStorage.setItem(SUBSCRIBED_KEY, "1");
          localStorage.setItem(DISMISSED_KEY, "1");
          setPerm("granted");
          // Register subscription with OneSignal
          window.OneSignalDeferred = window.OneSignalDeferred || [];
          window.OneSignalDeferred.push(async (OneSignal: OneSignalType) => {
            try { await OneSignal.Slidedown?.promptPush({ force: false }); } catch { /* ignore */ }
          });
          // Show success message briefly then hide permanently
          setTimeout(() => setDismissed(true), 2500);
        } else {
          setPerm(result as PermState);
        }
      } else {
        setPerm("denied");
      }
    } catch {
      setPerm("denied");
    } finally {
      setRequesting(false);
    }
  };

  if (perm === "loading" || dismissed) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 62,
        left: 12,
        right: 12,
        zIndex: 150,
        background: perm === "denied" ? "#1a1010" : perm === "granted" ? "#0d1f0d" : "#141200",
        border: `1px solid ${perm === "denied" ? "#5a1a1a" : perm === "granted" ? "#1a4d1a" : "#3a2e00"}`,
        borderRadius: 14,
        padding: "14px 16px",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
      }}
    >
      <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>
        {perm === "denied" ? "🔕" : perm === "granted" ? "✅" : "🔔"}
      </span>

      <div style={{ flex: 1 }}>
        {perm === "default" && (
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
        )}

        {perm === "granted" && (
          <>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#4ade80", marginBottom: 2 }}>
              Notificações ativadas!
            </div>
            <div style={{ fontSize: 12, color: "#aaa" }}>
              Você vai receber mensagens e lembretes diários.
            </div>
          </>
        )}

        {perm === "denied" && (
          <>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 4 }}>
              Notificações bloqueadas
            </div>
            <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.55 }}>
              Vá em{" "}
              <strong style={{ color: "#F5C800" }}>Ajustes → Notificações → JV IA</strong>{" "}
              e ative as notificações.
            </div>
          </>
        )}
      </div>

      <button
        onClick={dismiss}
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
