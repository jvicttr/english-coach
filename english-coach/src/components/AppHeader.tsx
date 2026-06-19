"use client";

import { useState, useEffect } from "react";
import { UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import Image from "next/image";

export function AppHeader() {
  const pathname = usePathname();
  const [isPro, setIsPro] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setIsPro(d.plan === "pro" || d.plan === "combo"));
  }, []);

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/portal", { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error ?? `Erro ${res.status}`);
        return;
      }
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error ?? "Sem URL retornada");
    } catch (e) {
      alert("Erro ao abrir portal: " + String(e));
    } finally {
      setPortalLoading(false);
    }
  }

  const isHome = pathname === "/app";

  return (
    <>
      <header
        style={{
          padding: "14px 16px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #1e1e1e",
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          background: "#0d0d0d",
          zIndex: 100,
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a
            href={isHome ? "https://www.faleinglesjv.com" : "/app"}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, background: "var(--dark2)", border: "1px solid #2a2a2a", textDecoration: "none", flexShrink: 0 }}
            title={isHome ? "Voltar ao site" : "Início"}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7L9 12" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <Image src="/favicon.png" alt="JV IA" width={28} height={28} style={{ borderRadius: 8 }} />
          <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff" }}>
            JV <span style={{ color: "var(--yellow)" }}>IA</span>
          </span>
          <span style={{ fontSize: "0.55rem", fontWeight: 800, color: "#000", background: "var(--yellow)", borderRadius: "50px", padding: "1px 6px", letterSpacing: "0.3px", lineHeight: 1.6 }}>
            8.0
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a
            href="/planos"
            style={{ fontSize: ".75rem", fontWeight: 700, color: "var(--yellow)", border: "1px solid rgba(245,200,0,.35)", borderRadius: "50px", padding: ".25rem .75rem", textDecoration: "none" }}
          >
            Planos
          </a>

          <button
            onClick={() => setMenuOpen((v) => !v)}
            style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: 8, width: 32, height: 32, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer", flexShrink: 0 }}
          >
            {menuOpen ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2L12 12M12 2L2 12" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <>
                <span style={{ width: 14, height: 2, background: "var(--gray)", borderRadius: 2 }} />
                <span style={{ width: 14, height: 2, background: "var(--gray)", borderRadius: 2 }} />
                <span style={{ width: 14, height: 2, background: "var(--gray)", borderRadius: 2 }} />
              </>
            )}
          </button>

          <div style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
            <UserButton appearance={{ elements: { avatarBox: { width: 38, height: 38 } } }} />
            {isPro && (
              <span style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)", fontSize: "0.52rem", fontWeight: 800, letterSpacing: "0.4px", background: "linear-gradient(135deg, #f5c800, #e0a800)", color: "#000", padding: "1px 5px", borderRadius: "50px", whiteSpace: "nowrap", lineHeight: 1.4, pointerEvents: "none" }}>
                PRO
              </span>
            )}
          </div>
        </div>
      </header>

      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
          <div style={{ position: "fixed", top: 62, right: 16, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 14, padding: "6px 0", zIndex: 95, minWidth: 200, boxShadow: "0 8px 32px rgba(0,0,0,.6)" }}>
            {isPro && (
              <button
                onClick={() => { setMenuOpen(false); openPortal(); }}
                disabled={portalLoading}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", color: "#fff", fontSize: "0.9rem", fontWeight: 600, background: "transparent", border: "none", cursor: "pointer", width: "100%" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: "1.1rem" }}>👤</span>
                {portalLoading ? "Abrindo..." : "Portal do Aluno"}
              </button>
            )}
            {[
              { href: "/app/progresso", icon: "🏆", label: "Progresso" },
              { href: "/app/resumo", icon: "📄", label: "Revisão de Aula" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", textDecoration: "none", color: "#fff", fontSize: "0.9rem", fontWeight: 600 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
                {item.label}
              </a>
            ))}
          </div>
        </>
      )}
    </>
  );
}
