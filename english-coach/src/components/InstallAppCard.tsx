"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useUser } from "@clerk/nextjs";
import { initInstallPromptCapture, hasDeferredPrompt, subscribeInstallPrompt, triggerInstallPrompt, isInstallTestMode } from "@/lib/installPrompt";

type Env = {
  isIOS: boolean;
  isAndroid: boolean;
  isMac: boolean;
  isMobile: boolean;
  isSafari: boolean;
  isFirefox: boolean;
};

function detectEnv(): Env {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isMac = /Macintosh/.test(ua) && !isIOS;
  const isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(ua);
  const isFirefox = /Firefox|FxiOS/.test(ua);
  return { isIOS, isAndroid, isMac, isMobile: isIOS || isAndroid, isSafari, isFirefox };
}

export default function InstallAppCard({ pulse = false }: { pulse?: boolean }) {
  const { user } = useUser();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [env, setEnv] = useState<Env | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [rewardMsg, setRewardMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    initInstallPromptCapture();

    const isStandalone =
      (navigator as any).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    if (isStandalone) return;

    setEnv(detectEnv());
    setVisible(true);
    setCanPrompt(hasDeferredPrompt());
    return subscribeInstallPrompt(setCanPrompt);
  }, []);

  async function grantInstallReward() {
    if (isInstallTestMode(user?.id)) {
      setRewardMsg("🧪 (teste) App instalado — XP não concedido");
      setTimeout(() => setVisible(false), 2800);
      return;
    }
    try {
      const res = await fetch("/api/install-reward", { method: "POST" });
      const data = await res.json();
      setRewardMsg(data.awarded ? "🎉 +1000 XP! App instalado" : "✅ App instalado!");
    } catch {
      setRewardMsg("✅ App instalado!");
    }
    setTimeout(() => setVisible(false), 2800);
  }

  async function handleClick() {
    if (canPrompt) {
      setInstalling(true);
      const outcome = await triggerInstallPrompt();
      setInstalling(false);
      setCanPrompt(hasDeferredPrompt());
      if (outcome === "unavailable") setShowModal(true);
      else if (outcome === "accepted") grantInstallReward();
      return;
    }
    setShowModal(true);
  }

  if (!mounted || !visible || !env) return null;

  return (
    <>
      {pulse && (
        <style>{`
          @keyframes installPulseBorder {
            0%, 100% { border-color: rgba(245,200,0,.25); box-shadow: 0 0 0 0 rgba(245,200,0,.25); }
            50% { border-color: var(--yellow); box-shadow: 0 0 0 4px rgba(245,200,0,.12); }
          }
        `}</style>
      )}
      <button
        onClick={handleClick}
        disabled={installing || !!rewardMsg}
        style={{ background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, width: "100%", cursor: installing || rewardMsg ? "default" : "pointer", textAlign: "left", opacity: installing ? 0.7 : 1, ...(pulse && !rewardMsg ? { animation: "installPulseBorder 1.8s ease-in-out infinite" } : {}) }}
      >
        <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(245,200,0,.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: "1.2rem" }}>{rewardMsg ? "🎉" : "📲"}</span>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "0.85rem", fontWeight: 700, color: rewardMsg ? "var(--yellow)" : "#fff", margin: 0 }}>
            {rewardMsg ?? (installing ? "Instalando…" : "Adicionar à tela inicial")}
          </p>
          {!rewardMsg && (
            <p style={{ fontSize: "0.72rem", color: "var(--gray)", margin: "2px 0 0" }}>Ganhe 1000 XP de bônus + acesso rápido e notificações</p>
          )}
        </div>
        {!rewardMsg && (
          <svg style={{ flexShrink: 0 }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        )}
      </button>

      {showModal && typeof document !== "undefined" && createPortal(
        <InstallInstructionsModal env={env} onClose={() => setShowModal(false)} />,
        document.body
      )}
    </>
  );
}

function InstallInstructionsModal({ env, onClose }: { env: Env; onClose: () => void }) {
  const { isIOS, isAndroid, isMac, isSafari, isFirefox } = env;

  let title = "Adicionar à tela inicial";
  let steps: string[];

  if (isIOS && isSafari) {
    steps = [
      'Toque no ícone de Compartilhar (□↑) na barra do Safari.',
      "Role e toque em \"Adicionar à Tela de Início\".",
      'Toque em "Adicionar" para confirmar.',
    ];
  } else if (isIOS && !isSafari) {
    steps = [
      "O iPhone só permite instalar apps direto pelo Safari.",
      "Copie o link e abra www.faleinglesjv.com no Safari.",
      'Toque em Compartilhar → "Adicionar à Tela de Início".',
    ];
  } else if (isAndroid) {
    steps = [
      "Toque no menu (⋮) no canto do navegador.",
      'Escolha "Adicionar à tela inicial" ou "Instalar app".',
      "Confirme para instalar.",
    ];
  } else if (isMac && isSafari) {
    title = "Adicionar ao Dock";
    steps = [
      'No menu "Arquivo" do Safari, clique em "Adicionar ao Dock".',
      "Confirme o nome e clique em Adicionar.",
    ];
  } else if (isFirefox) {
    title = "Instalar o app";
    steps = [
      "O Firefox não suporta instalar este app diretamente.",
      "Abra este site no Chrome ou Edge para instalar.",
    ];
  } else {
    title = "Instalar o app";
    steps = [
      "Clique no ícone de instalar (⊕) na barra de endereço.",
      'Ou abra o menu (⋮) do navegador e escolha "Instalar JV IA".',
    ];
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 201, width: "calc(100% - 32px)", maxWidth: 420 }}>
        <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 20, padding: "24px 20px" }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: "2rem", marginBottom: 10 }}>📲</div>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#fff", margin: "0 0 4px" }}>{title}</h2>
            <p style={{ fontSize: "0.78rem", color: "#666", margin: 0 }}>Acesso rápido e notificações direto no seu dispositivo</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 14, padding: "12px 14px" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--yellow)", flexShrink: 0 }}>{i + 1}</span>
                <p style={{ fontSize: "0.82rem", color: "#ddd", margin: 0, lineHeight: 1.5 }}>{s}</p>
              </div>
            ))}
          </div>

          <button
            onClick={onClose}
            style={{ width: "100%", background: "var(--yellow)", border: "none", borderRadius: 14, padding: "13px", fontSize: "0.85rem", fontWeight: 800, color: "#000", cursor: "pointer" }}
          >
            Entendido
          </button>
        </div>
      </div>
    </>
  );
}
