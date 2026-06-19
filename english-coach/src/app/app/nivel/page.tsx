"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const LEVELS = [
  {
    id: "beginner",
    emoji: "🌱",
    label: "Iniciante",
    desc: "Sei pouco ou nada de inglês. Quero começar do zero.",
    examples: ["Hello, how are you?", "My name is...", "I like..."],
  },
  {
    id: "intermediate",
    emoji: "🔥",
    label: "Intermediário",
    desc: "Consigo me virar, mas erro bastante e travo às vezes.",
    examples: ["I was wondering if...", "Could you explain...?", "I've been working on..."],
  },
  {
    id: "advanced",
    emoji: "🚀",
    label: "Avançado",
    desc: "Me comunico bem, quero refinar fluência e vocabulário.",
    examples: ["I'd like to elaborate on...", "That's a fair point, however...", "In retrospect..."],
  },
];

export default function NivelPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function confirm() {
    if (!selected || saving) return;
    setSaving(true);
    try {
      await fetch("/api/level", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: selected }),
      });
      localStorage.setItem("userLevel", selected);
      router.push("/app/conversar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        background: "var(--black)",
        minHeight: "100dvh",
        fontFamily: "'Inter', sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        paddingTop: "calc(65px + 24px)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 480 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Image src="/favicon.png" alt="JV IA" width={52} height={52} style={{ borderRadius: 14, margin: "0 auto 12px" }} />
          <p style={{ fontSize: "1.15rem", fontWeight: 800, color: "#fff", margin: 0 }}>
            Qual é o seu nível de inglês?
          </p>
          <p style={{ fontSize: "0.82rem", color: "var(--gray)", marginTop: 6 }}>
            Vamos calibrar o coach para o seu nível. Você pode mudar depois.
          </p>
        </div>

        {/* Level cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: 24 }}>
          {LEVELS.map((l) => {
            const isSelected = selected === l.id;
            return (
              <button
                key={l.id}
                onClick={() => setSelected(l.id)}
                style={{
                  background: isSelected ? "rgba(245,200,0,0.08)" : "var(--dark1)",
                  border: isSelected ? "1.5px solid var(--yellow)" : "1.5px solid #2a2a2a",
                  borderRadius: 16,
                  padding: "16px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: "1.5rem" }}>{l.emoji}</span>
                  <span style={{ fontSize: "0.95rem", fontWeight: 700, color: isSelected ? "var(--yellow)" : "#fff" }}>
                    {l.label}
                  </span>
                </div>
                <p style={{ fontSize: "0.78rem", color: "var(--gray)", margin: "0 0 10px", lineHeight: 1.4 }}>
                  {l.desc}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {l.examples.map((ex, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: "0.72rem",
                        color: isSelected ? "rgba(245,200,0,0.7)" : "var(--gray2)",
                        background: isSelected ? "rgba(245,200,0,0.06)" : "var(--dark2)",
                        borderRadius: 6,
                        padding: "3px 8px",
                        display: "inline-block",
                        width: "fit-content",
                        fontStyle: "italic",
                      }}
                    >
                      &ldquo;{ex}&rdquo;
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* Confirm button */}
        <button
          onClick={confirm}
          disabled={!selected || saving}
          style={{
            width: "100%",
            padding: "14px",
            background: selected ? "var(--yellow)" : "var(--dark2)",
            color: selected ? "var(--black)" : "var(--gray)",
            border: "none",
            borderRadius: 14,
            fontSize: "0.95rem",
            fontWeight: 800,
            cursor: selected ? "pointer" : "default",
            transition: "all 0.15s",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Salvando..." : "Confirmar meu nível →"}
        </button>
      </div>
    </div>
  );
}
