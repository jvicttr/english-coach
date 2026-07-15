"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { LEVEL_OPTIONS as LEVELS } from "@/lib/levels";

interface LevelSelectProps {
  onDone: (level: string) => void;
}

export default function LevelSelect({ onDone }: LevelSelectProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  async function handleConfirm() {
    if (!selected) return;
    setSaving(true);
    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: selected }),
    });
    onDone(selected);
  }

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(4px)",
      }} />

      {/* Card */}
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 201, width: "calc(100% - 32px)", maxWidth: 420,
      }}>
        <div style={{
          background: "#141414", border: "1px solid #2a2a2a",
          borderRadius: 20, padding: "28px 20px 24px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: "2rem", marginBottom: 10 }}>🎯</div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>
              Qual é o seu nível de inglês?
            </h2>
            <p style={{ fontSize: "0.82rem", color: "#666", margin: 0 }}>
              Vamos personalizar sua experiência
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {LEVELS.map((lvl) => {
              const isSelected = selected === lvl.id;
              return (
                <button
                  key={lvl.id}
                  onClick={() => setSelected(lvl.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 16px", borderRadius: 14, cursor: "pointer",
                    background: isSelected ? `${lvl.color}15` : "#1a1a1a",
                    border: `1.5px solid ${isSelected ? lvl.color : "#2a2a2a"}`,
                    transition: "all 0.15s ease", textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: "1.4rem" }}>{lvl.emoji}</span>
                  <div>
                    <div style={{ fontSize: "0.9rem", fontWeight: 700, color: isSelected ? lvl.color : "#fff" }}>
                      {lvl.label}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#666", marginTop: 2 }}>
                      {lvl.desc}
                    </div>
                  </div>
                  {isSelected && (
                    <div style={{ marginLeft: "auto", width: 20, height: 20, borderRadius: "50%", background: lvl.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleConfirm}
            disabled={!selected || saving}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 12,
              background: selected ? "var(--yellow)" : "#222",
              border: "none", color: selected ? "#000" : "#444",
              fontSize: "0.9rem", fontWeight: 800, cursor: selected ? "pointer" : "not-allowed",
              transition: "all 0.2s ease",
            }}
          >
            {saving ? "Salvando..." : "Confirmar →"}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
