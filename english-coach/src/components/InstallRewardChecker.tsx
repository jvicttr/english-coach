"use client";

import { useEffect, useState } from "react";

const CHECKED_KEY = "install-reward-checked";

export default function InstallRewardChecker() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    // Já rodou nesse dispositivo/navegador — o servidor também dedupa via badge, mas evita a chamada à toa
    if (localStorage.getItem(CHECKED_KEY)) return;

    const isStandalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    if (!isStandalone) return;

    localStorage.setItem(CHECKED_KEY, "1");

    fetch("/api/install-reward", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.awarded) {
          setMsg("🎉 +1000 XP! Você instalou o app");
          setTimeout(() => setMsg(null), 4000);
        }
      })
      .catch(() => {});
  }, []);

  if (!msg) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "calc(70px + env(safe-area-inset-top))",
        left: 12,
        right: 12,
        zIndex: 300,
        background: "#141200",
        border: "1px solid rgba(245,200,0,.4)",
        borderRadius: 14,
        padding: "14px 16px",
        textAlign: "center",
        boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
      }}
    >
      <p style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--yellow)", margin: 0 }}>{msg}</p>
    </div>
  );
}
