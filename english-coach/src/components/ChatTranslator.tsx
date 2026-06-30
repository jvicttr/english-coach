"use client";

import { useState, useRef, useEffect } from "react";
import { Dots, ResultPanel } from "./QuickTranslator";

type TranslationResult = {
  detected_lang: "pt" | "en" | null;
  translation: string;
  phonetic: string | null;
  type: string;
  example: string | null;
  example_pt: string | null;
  note: string | null;
};

const LANG_INFO = {
  pt: { flag: "🇧🇷", label: "Português" },
  en: { flag: "🇺🇸", label: "English" },
};

interface Props {
  /** Called when user clicks "Usar no chat" — receives the translated text */
  onUse: (text: string) => void;
}

export default function ChatTranslator({ onUse }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  async function translate(text: string) {
    if (!text.trim()) { setResult(null); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/translate-quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), direction: "auto" }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResult(data);
    } catch {
      setError("Erro ao traduzir.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInput(val);
    setError("");
    if (!val.trim()) setResult(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      translate(input);
    }
  }

  function handleUse(text: string) {
    onUse(text);
    setOpen(false);
    setInput("");
    setResult(null);
  }

  function toggle() {
    setOpen(o => {
      if (o) { setInput(""); setResult(null); setError(""); }
      return !o;
    });
  }

  const fromFlag = result?.detected_lang ? LANG_INFO[result.detected_lang].flag : "🌐";
  const toFlag   = result?.detected_lang ? LANG_INFO[result.detected_lang === "pt" ? "en" : "pt"].flag : "✨";

  return (
    <div style={{ position: "relative" }}>
      {/* Floating panel */}
      {open && (
        <div
          ref={panelRef}
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: 0,
            width: 300,
            background: "#161616",
            border: "1px solid #2a2a2a",
            borderRadius: 14,
            boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
            zIndex: 200,
            overflow: "hidden",
          }}
        >
          {/* Panel header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px 6px", borderBottom: "1px solid #1e1e1e" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: "0.7rem" }}>🔤</span>
              <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--gray)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Tradução</span>
              {result?.detected_lang && (
                <span style={{ fontSize: "0.68rem", color: "#555" }}>
                  {fromFlag} → {toFlag}
                </span>
              )}
              {!result?.detected_lang && (
                <span style={{ fontSize: "0.65rem", color: "#444", fontStyle: "italic" }}>auto-detect</span>
              )}
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: "0.9rem", lineHeight: 1, padding: 2 }}>✕</button>
          </div>

          {/* Input */}
          <div style={{ position: "relative", padding: "8px 12px 0" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Digite em português ou inglês…"
              rows={2}
              maxLength={300}
              style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: "0.88rem", fontFamily: "'Inter', sans-serif", lineHeight: 1.5, resize: "none", boxSizing: "border-box", padding: 0 }}
            />
            {input && (
              <button onClick={() => { setInput(""); setResult(null); inputRef.current?.focus(); }}
                style={{ position: "absolute", top: 8, right: 12, background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: "0.85rem", lineHeight: 1, padding: 2 }}>✕</button>
            )}
          </div>

          {/* Translate row */}
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "4px 12px 8px", borderBottom: (result || loading || error) ? "1px solid #1e1e1e" : "none" }}>
            <button
              onClick={() => translate(input)}
              disabled={!input.trim() || loading}
              style={{ background: input.trim() && !loading ? "var(--yellow)" : "#1e1e1e", color: input.trim() && !loading ? "#000" : "#444", border: "none", borderRadius: 50, padding: "4px 14px", fontSize: "0.72rem", fontWeight: 800, cursor: input.trim() && !loading ? "pointer" : "default", transition: "all 0.15s" }}
            >
              {loading ? <Dots /> : "Traduzir →"}
            </button>
          </div>

          {error && <div style={{ padding: "6px 12px 8px" }}><p style={{ fontSize: "0.72rem", color: "#f87171", margin: 0 }}>{error}</p></div>}

          {result && !loading && (
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              <ResultPanel result={result} onUse={handleUse} />
            </div>
          )}
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={toggle}
        title="Tradutor rápido"
        style={{
          width: 44,
          height: 44,
          background: open ? "rgba(245,200,0,.15)" : "var(--dark2)",
          border: open ? "1px solid rgba(245,200,0,.4)" : "1px solid #2a2a2a",
          borderRadius: "var(--radius)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flexShrink: 0,
          transition: "all 0.15s",
          fontSize: "1.1rem",
        }}
        onMouseEnter={e => { if (!open) { e.currentTarget.style.borderColor = "rgba(245,200,0,.3)"; e.currentTarget.style.background = "rgba(245,200,0,.08)"; } }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.background = "var(--dark2)"; } }}
      >
        🔤
      </button>
    </div>
  );
}
