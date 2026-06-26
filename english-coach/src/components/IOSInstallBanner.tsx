"use client";

import { useState, useEffect } from "react";

export default function IOSInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const dismissed = localStorage.getItem("ios-banner-dismissed");

    if (isIOS && !isStandalone && !dismissed) {
      // Delay slightly so the page is rendered first
      const t = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(t);
    }
  }, []);

  if (!show) return null;

  return (
    <div
      style={{
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
      }}
    >
      <span style={{ fontSize: 30, lineHeight: 1, flexShrink: 0 }}>📲</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 5 }}>
          Instale o app para receber notificações no iPhone
        </div>
        <div style={{ fontSize: 12, color: "#999", lineHeight: 1.55 }}>
          Toque em{" "}
          <span style={{ color: "#F5C800", fontWeight: 600 }}>
            Compartilhar&nbsp;
            <svg
              viewBox="0 0 24 24"
              width={12}
              height={12}
              fill="none"
              stroke="#F5C800"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: "inline", verticalAlign: "middle" }}
            >
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </span>{" "}
          na barra inferior do Safari, depois{" "}
          <span style={{ color: "#F5C800", fontWeight: 600 }}>
            Adicionar à Tela de Início
          </span>
        </div>
      </div>
      <button
        onClick={() => {
          localStorage.setItem("ios-banner-dismissed", "1");
          setShow(false);
        }}
        style={{
          background: "none",
          border: "none",
          color: "#555",
          fontSize: 22,
          cursor: "pointer",
          padding: "0 0 0 4px",
          lineHeight: 1,
          flexShrink: 0,
          alignSelf: "flex-start",
        }}
        aria-label="Fechar"
      >
        ×
      </button>
    </div>
  );
}
