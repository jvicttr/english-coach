"use client";

import { useState, useEffect } from "react";

let deferredPrompt: any = null;

export default function IOSInstallBanner() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua);
    const isAndroid = /Android/.test(ua);
    const isStandalone =
      (navigator as any).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;

    if (isStandalone) return;

    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed) {
      const days = (Date.now() - parseInt(dismissed)) / (1000 * 60 * 60 * 24);
      if (days < 7) return;
    }

    if (isIOS) {
      setPlatform("ios");
      setTimeout(() => setShow(true), 3000);
    } else if (isAndroid) {
      const handler = (e: Event) => {
        e.preventDefault();
        deferredPrompt = e;
        setPlatform("android");
        setTimeout(() => setShow(true), 3000);
      };
      window.addEventListener("beforeinstallprompt", handler as any);
      return () => window.removeEventListener("beforeinstallprompt", handler as any);
    }
  }, []);

  function close() {
    localStorage.setItem("pwa-install-dismissed", String(Date.now()));
    setShow(false);
  }

  async function installAndroid() {
    if (!deferredPrompt) { close(); return; }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (outcome === "accepted") setShow(false);
    else close();
  }

  if (!show || !platform) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 80,
      left: 12,
      right: 12,
      background: "#1a1a1a",
      border: "1px solid #2a2a2a",
      borderRadius: 18,
      padding: "16px 16px 16px 18px",
      zIndex: 9999,
      display: "flex",
      alignItems: "flex-start",
      gap: 14,
      boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
    }}>
      <img src="/icon-192.png" alt="JV IA" style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0 }} />

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 5 }}>
          Adicione o JV IA à tela inicial
        </div>

        {platform === "ios" ? (
          <div style={{ fontSize: 12, color: "#999", lineHeight: 1.55 }}>
            Toque em{" "}
            <span style={{ color: "#F5C800", fontWeight: 600 }}>
              Compartilhar{" "}
              <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="#F5C800" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline", verticalAlign: "middle" }}>
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
            </span>{" "}
            e depois em{" "}
            <span style={{ color: "#F5C800", fontWeight: 600 }}>Adicionar à Tela de Início</span>{" "}
            para acesso rápido e notificações.
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#999", lineHeight: 1.55 }}>
            Instale o app para acesso rápido e receber notificações de mensagens e streak.
          </div>
        )}

        {platform === "android" && (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={close} style={{ flex: 1, background: "transparent", border: "1px solid #2a2a2a", borderRadius: 10, padding: "9px", fontSize: "0.78rem", color: "#666", cursor: "pointer", fontWeight: 600 }}>
              Agora não
            </button>
            <button onClick={installAndroid} style={{ flex: 2, background: "#F5C800", border: "none", borderRadius: 10, padding: "9px", fontSize: "0.78rem", color: "#000", cursor: "pointer", fontWeight: 800 }}>
              Instalar app
            </button>
          </div>
        )}

        {platform === "ios" && (
          <button onClick={close} style={{ background: "none", border: "none", color: "#F5C800", cursor: "pointer", fontSize: "0.78rem", fontWeight: 700, padding: "8px 0 0", display: "block" }}>
            Entendido
          </button>
        )}
      </div>

      <button onClick={close} style={{ background: "none", border: "none", color: "#555", fontSize: 22, cursor: "pointer", padding: "0 0 0 4px", lineHeight: 1, flexShrink: 0 }}>×</button>
    </div>
  );
}
