"use client";

import { useState, useRef } from "react";

type Direction = "pt-en" | "en-pt" | "auto";

type TranslationResult = {
  detected_lang: "pt" | "en" | null;
  translation: string;
  phonetic: string | null;
  type: string;
  example: string | null;
  example_pt: string | null;
  note: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  word: "palavra",
  phrase: "expressão",
  expression: "expressão",
  phrasal_verb: "phrasal verb",
  sentence: "frase",
};

const LANG_INFO = {
  pt: { flag: "🇧🇷", label: "Português" },
  en: { flag: "🇺🇸", label: "English" },
};

export default function QuickTranslator() {
  const [direction, setDirection] = useState<Direction>("auto");
  const [input, setInput] = useState("");
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Derive display labels
  const fromLabel = direction === "auto"
    ? (result?.detected_lang ? LANG_INFO[result.detected_lang] : { flag: "🌐", label: "Auto" })
    : direction === "pt-en" ? LANG_INFO.pt : LANG_INFO.en;
  const toLabel = direction === "auto"
    ? (result?.detected_lang ? LANG_INFO[result.detected_lang === "pt" ? "en" : "pt"] : { flag: "✨", label: "detectar" })
    : direction === "pt-en" ? LANG_INFO.en : LANG_INFO.pt;

  async function translate(text: string, dir: Direction) {
    if (!text.trim()) { setResult(null); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/translate-quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), direction: dir }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResult(data);
    } catch {
      setError("Não foi possível traduzir. Tente novamente.");
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
      if (debounceRef.current) clearTimeout(debounceRef.current);
      translate(input, direction);
    }
  }

  function cycleDirection() {
    const next: Direction = direction === "auto" ? "pt-en" : direction === "pt-en" ? "en-pt" : "auto";
    setDirection(next);
    setResult(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function swapLangs() {
    if (direction === "auto") { cycleDirection(); return; }
    const newDir: Direction = direction === "pt-en" ? "en-pt" : "pt-en";
    setDirection(newDir);
    if (result?.translation) {
      setInput(result.translation);
      setResult(null);
    } else {
      setResult(null);
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function clear() {
    setInput("");
    setResult(null);
    setError("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const hasResult = result && !loading;
  const placeholder = direction === "en-pt" ? "Type in English…" : "Digite em português… (ou inglês)";

  return (
    <div style={{ background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px 8px", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: "0.78rem" }}>🔤</span>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--gray)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Tradução rápida</span>
        </div>

        {/* Direction toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#111", borderRadius: 50, padding: "3px 8px 3px 6px" }}>
          <span style={{ fontSize: "0.73rem", color: direction === "auto" && !result ? "#888" : "#ccc" }}>{fromLabel.flag} {fromLabel.label}</span>
          <button
            onClick={swapLangs}
            title={direction === "auto" ? "Clique para fixar o idioma" : "Inverter idioma"}
            style={{ background: "rgba(245,200,0,.1)", border: "1px solid rgba(245,200,0,.25)", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(245,200,0,.2)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(245,200,0,.1)")}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
            </svg>
          </button>
          <span style={{ fontSize: "0.73rem", color: direction === "auto" && !result ? "#555" : "#ccc" }}>{toLabel.flag} {toLabel.label}</span>
          {/* Auto badge */}
          <button
            onClick={cycleDirection}
            title="Alternar: Auto / PT→EN / EN→PT"
            style={{ marginLeft: 2, background: direction === "auto" ? "rgba(245,200,0,.15)" : "transparent", border: "1px solid " + (direction === "auto" ? "rgba(245,200,0,.4)" : "#333"), borderRadius: 50, padding: "1px 7px", fontSize: "0.62rem", fontWeight: 700, color: direction === "auto" ? "var(--yellow)" : "#555", cursor: "pointer", transition: "all 0.15s" }}
          >
            Auto
          </button>
        </div>
      </div>

      {/* Input */}
      <div style={{ position: "relative", padding: "10px 14px 0" }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          maxLength={300}
          style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: "0.95rem", fontFamily: "'Inter', sans-serif", lineHeight: 1.5, resize: "none", boxSizing: "border-box", padding: 0 }}
        />
        {input && (
          <button onClick={clear} style={{ position: "absolute", top: 10, right: 14, background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: "1rem", lineHeight: 1, padding: 2 }} title="Limpar">✕</button>
        )}
      </div>

      {/* Translate button */}
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "6px 14px 10px", borderBottom: hasResult || loading || error ? "1px solid #1a1a1a" : "none" }}>
        <button
          onClick={() => translate(input, direction)}
          disabled={!input.trim() || loading}
          style={{ background: input.trim() && !loading ? "var(--yellow)" : "#1e1e1e", color: input.trim() && !loading ? "#000" : "#444", border: "none", borderRadius: 50, padding: "5px 16px", fontSize: "0.78rem", fontWeight: 800, cursor: input.trim() && !loading ? "pointer" : "default", transition: "all 0.15s" }}
        >
          {loading ? <Dots /> : "Traduzir →"}
        </button>
      </div>

      {error && <div style={{ padding: "8px 14px 12px" }}><p style={{ fontSize: "0.78rem", color: "#f87171", margin: 0 }}>{error}</p></div>}

      {hasResult && <ResultPanel result={result!} />}

      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}`}</style>
    </div>
  );
}

export function ResultPanel({ result, onUse }: { result: TranslationResult; onUse?: (t: string) => void }) {
  return (
    <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      {result.type && result.type !== "sentence" && (
        <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--yellow)", background: "rgba(245,200,0,.1)", border: "1px solid rgba(245,200,0,.2)", borderRadius: 50, padding: "2px 9px", width: "fit-content", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {TYPE_LABELS[result.type] ?? result.type}
        </span>
      )}
      <div>
        <p style={{ fontSize: "1.05rem", fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1.3 }}>{result.translation}</p>
        {result.phonetic && <p style={{ fontSize: "0.77rem", color: "var(--yellow)", margin: "3px 0 0", opacity: 0.8, fontStyle: "italic" }}>{result.phonetic}</p>}
      </div>
      {result.example && (
        <div style={{ background: "#111", borderRadius: 10, padding: "8px 12px", borderLeft: "2px solid rgba(245,200,0,.3)" }}>
          <p style={{ fontSize: "0.78rem", color: "#ddd", margin: 0, lineHeight: 1.5, fontStyle: "italic" }}>"{result.example}"</p>
          {result.example_pt && <p style={{ fontSize: "0.72rem", color: "var(--gray)", margin: "4px 0 0", lineHeight: 1.4 }}>🇧🇷 {result.example_pt}</p>}
        </div>
      )}
      {result.note && (
        <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
          <span style={{ fontSize: "0.78rem", flexShrink: 0, marginTop: 1 }}>💡</span>
          <p style={{ fontSize: "0.73rem", color: "var(--gray)", margin: 0, lineHeight: 1.5 }}>{result.note}</p>
        </div>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <CopyButton text={result.translation} />
        {onUse && (
          <button
            onClick={() => onUse(result.translation)}
            style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(245,200,0,.1)", border: "1px solid rgba(245,200,0,.3)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", color: "var(--yellow)", fontSize: "0.72rem", fontWeight: 700, transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(245,200,0,.18)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(245,200,0,.1)")}
          >
            ↗ Usar no chat
          </button>
        )}
      </div>
    </div>
  );
}

export function Dots() {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
      {[0, 120, 240].map(d => (
        <span key={d} style={{ width: 4, height: 4, borderRadius: "50%", background: "#666", display: "inline-block", animation: "bounce .8s infinite", animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <button onClick={copy} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "1px solid #2a2a2a", borderRadius: 8, padding: "4px 10px", cursor: "pointer", color: copied ? "#4ade80" : "var(--gray)", fontSize: "0.72rem", transition: "color 0.2s, border-color 0.2s", borderColor: copied ? "rgba(74,222,128,.3)" : "#2a2a2a" }}>
      {copied
        ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> Copiado!</>
        : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar</>
      }
    </button>
  );
}
