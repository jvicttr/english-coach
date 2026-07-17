"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { TIERS } from "@/lib/tiers";
import { onTierUp } from "@/lib/tierEvents";

export default function TierUpModal() {
  const [mounted, setMounted] = useState(false);
  const [tierId, setTierId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => onTierUp((id) => {
    setTierId(id);
    setSharing(false);
    setPosting(false);
    setPosted(false);
  }), []);

  const tier = tierId ? TIERS.find((t) => t.id === tierId) : null;

  if (!mounted || !tier) return null;

  function close() {
    setTierId(null);
  }

  function startShare() {
    if (!tier) return;
    setText(`🎉 Acabei de alcançar o tier ${tier.emoji} ${tier.label} no Fale Inglês JV! Bora praticar inglês também?`);
    setSharing(true);
  }

  async function publish() {
    if (posting || posted) return;
    setPosting(true);
    try {
      await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, isShare: true }),
      });
      setPosted(true);
      setTimeout(close, 1100);
    } catch {
      setPosting(false);
    }
  }

  return createPortal(
    <div
      onClick={close}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 320, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--dark1)", border: `1px solid ${tier.color}55`, borderRadius: 24, padding: "28px 22px", width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center", animation: "tierUpPop .35s cubic-bezier(.34,1.56,.64,1)", boxShadow: `0 0 60px ${tier.color}33` }}
      >
        {!sharing ? (
          <>
            <div style={{ fontSize: "3.5rem", lineHeight: 1 }}>{tier.emoji}</div>
            <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--yellow)", margin: 0, textTransform: "uppercase", letterSpacing: 1 }}>Novo tier alcançado!</p>
            <p style={{ fontSize: "1.4rem", fontWeight: 900, color: tier.color, margin: 0 }}>{tier.label}</p>
            <p style={{ fontSize: "0.85rem", color: "var(--gray)", margin: 0 }}>{tier.desc}</p>
            <div style={{ display: "flex", gap: 10, width: "100%", marginTop: 8 }}>
              <button
                onClick={close}
                style={{ flex: 1, background: "var(--dark2)", border: "1px solid #2a2a2a", color: "var(--gray)", padding: "0.75rem", borderRadius: 50, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}
              >
                Fechar
              </button>
              <button
                onClick={startShare}
                style={{ flex: 1, background: "var(--yellow)", color: "#000", border: "none", padding: "0.75rem", borderRadius: 50, fontWeight: 800, fontSize: "0.85rem", cursor: "pointer" }}
              >
                🌐 Compartilhar
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", margin: 0 }}>🌐 Compartilhar na comunidade</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={posting || posted}
              rows={4}
              style={{ width: "100%", background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 12, padding: "10px 12px", color: "#fff", fontSize: "0.85rem", fontFamily: "inherit", resize: "none", outline: "none" }}
            />
            <div style={{ display: "flex", gap: 10, width: "100%" }}>
              <button
                onClick={close}
                disabled={posting || posted}
                style={{ flex: 1, background: "var(--dark2)", border: "1px solid #2a2a2a", color: "var(--gray)", padding: "0.75rem", borderRadius: 50, fontWeight: 700, fontSize: "0.85rem", cursor: posting || posted ? "default" : "pointer" }}
              >
                Agora não
              </button>
              <button
                onClick={publish}
                disabled={posting || posted}
                style={{ flex: 1, background: posted ? "rgba(74,222,128,.15)" : "var(--yellow)", color: posted ? "#4ade80" : "#000", border: posted ? "1px solid rgba(74,222,128,.5)" : "none", padding: "0.75rem", borderRadius: 50, fontWeight: 800, fontSize: "0.85rem", cursor: posting || posted ? "default" : "pointer" }}
              >
                {posted ? "✅ Publicado!" : posting ? "Publicando..." : "Publicar"}
              </button>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes tierUpPop{from{transform:scale(.8);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
    </div>,
    document.body
  );
}
