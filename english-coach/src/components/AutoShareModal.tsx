"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function AutoShareModal({
  open,
  content,
  transcript,
  onClose,
}: {
  open: boolean;
  content: string;
  transcript: string;
  onClose: () => void;
}) {
  const [text, setText] = useState(content);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (open) {
      setText(content);
      setPosting(false);
      setPosted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !mounted) return null;

  async function publish() {
    if (posting || posted) return;
    setPosting(true);
    try {
      await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, transcript, isShare: true }),
      });
      setPosted(true);
      setTimeout(onClose, 1100);
    } catch {
      setPosting(false);
    }
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--dark1)", border: "1px solid #2a2a2a", borderBottom: "none", borderRadius: "20px 20px 0 0", padding: "20px 18px calc(20px + env(safe-area-inset-bottom))", width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, animation: "autoShareSlideUp .25s ease" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", margin: 0 }}>🌐 Compartilhar na comunidade</p>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--gray)", fontSize: "1.1rem", cursor: "pointer", lineHeight: 1, padding: 4 }}>✕</button>
        </div>
        <p style={{ fontSize: "0.75rem", color: "var(--gray)", margin: 0 }}>
          Seu resultado está pronto pra postar. Edite o texto se quiser antes de publicar.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={posting || posted}
          rows={4}
          style={{ background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 12, padding: "10px 12px", color: "#fff", fontSize: "0.85rem", fontFamily: "inherit", resize: "none", outline: "none" }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
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
      </div>
      <style>{`@keyframes autoShareSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>,
    document.body
  );
}
