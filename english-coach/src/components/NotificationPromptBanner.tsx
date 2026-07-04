"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { markNotifFlowDone } from "@/lib/onboardingSequence";

const DISMISSED_KEY = "notif-popup-dismissed";
const DISMISS_DAYS = 3;

type Status = "idle" | "loading" | "done" | "denied";

export default function NotificationPromptBanner() {
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    check();
  }, []);

  async function check() {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) { markNotifFlowDone(); return; }
    if (Notification.permission === "denied") { markNotifFlowDone(); return; }

    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|OPiOS/.test(navigator.userAgent);
    const isStandalone = (window.navigator as any).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
    if (isIOS && isSafari && !isStandalone) { markNotifFlowDone(); return; } // não dá pra ativar push numa aba do Safari fora do PWA

    const dismissedAt = localStorage.getItem(DISMISSED_KEY);
    if (dismissedAt) {
      const days = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (days < DISMISS_DAYS) { markNotifFlowDone(); return; }
    }

    try {
      const res = await fetch("/api/webpush/register");
      const data = await res.json();
      if (data.active) { markNotifFlowDone(); return; } // já tem subscription ativa no novo sistema
    } catch {
      markNotifFlowDone();
      return;
    }

    setShow(true);
    // Não chama markNotifFlowDone() aqui — só quando o pop-up for de fato fechado (dismiss/enable),
    // para o tour esperar essa interação terminar antes de aparecer.
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setShow(false);
    markNotifFlowDone();
  }

  async function enable() {
    setStatus("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        // Fica visível até o usuário clicar "Entendido" (dismiss), que marca o fluxo como concluído
        return;
      }

      const sw = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      await navigator.serviceWorker.ready;

      const vapidPublicKey = process.env.NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY!;
      const keyBytes = Uint8Array.from(atob(vapidPublicKey.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

      const existingSub = await sw.pushManager.getSubscription();
      if (existingSub) await existingSub.unsubscribe();

      const subscription = await sw.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes,
      });
      await fetch("/api/webpush/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      setStatus("done");
      setTimeout(() => { setShow(false); markNotifFlowDone(); }, 1800);
    } catch {
      setStatus("idle");
    }
  }

  if (!show || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        onClick={status === "loading" ? undefined : dismiss}
        style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}
      />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 201, width: "calc(100% - 32px)", maxWidth: 400 }}>
        <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 20, padding: "28px 20px 22px", textAlign: "center" }}>
          <div style={{ fontSize: "2.2rem", marginBottom: 12 }}>
            {status === "done" ? "✅" : status === "denied" ? "🔕" : "🔔"}
          </div>

          {status === "denied" ? (
            <>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>Notificações bloqueadas</h2>
              <p style={{ fontSize: "0.82rem", color: "#999", margin: "0 0 20px", lineHeight: 1.5 }}>
                Ative manualmente nas configurações do seu navegador (Ajustes → Notificações → JV IA).
              </p>
            </>
          ) : status === "done" ? (
            <>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#4ade80", margin: "0 0 8px" }}>Notificações ativadas!</h2>
              <p style={{ fontSize: "0.82rem", color: "#999", margin: 0, lineHeight: 1.5 }}>
                Você vai receber mensagens, menções, seguidores e lembretes de streak.
              </p>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>Ative as notificações</h2>
              <p style={{ fontSize: "0.82rem", color: "#999", margin: "0 0 20px", lineHeight: 1.5 }}>
                Fique sabendo na hora de mensagens diretas, menções, novos seguidores e não perca seu streak.
              </p>
            </>
          )}

          {status !== "done" && status !== "denied" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={enable}
                disabled={status === "loading"}
                style={{ background: "var(--yellow)", border: "none", borderRadius: 14, padding: "13px", fontSize: "0.85rem", fontWeight: 800, color: "#000", cursor: status === "loading" ? "wait" : "pointer", opacity: status === "loading" ? 0.7 : 1 }}
              >
                {status === "loading" ? "Ativando…" : "Ativar notificações"}
              </button>
              <button onClick={dismiss} style={{ background: "transparent", border: "none", color: "#666", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", padding: "4px" }}>
                Agora não
              </button>
            </div>
          )}

          {(status === "done" || status === "denied") && (
            <button
              onClick={dismiss}
              style={{
                marginTop: status === "denied" ? 4 : 0,
                width: "100%",
                background: status === "denied" ? "var(--yellow)" : "transparent",
                border: status === "denied" ? "none" : "1px solid #2a2a2a",
                borderRadius: 14,
                padding: "12px",
                fontSize: "0.82rem",
                fontWeight: 700,
                color: status === "denied" ? "#000" : "#999",
                cursor: "pointer",
              }}
            >
              Entendido
            </button>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
