"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

const TOUR_KEY = "jvia_tour_done";

const STEPS = [
  {
    emoji: "👋",
    title: "Bem-vindo ao JV IA!",
    desc: "Seu coach de inglês com inteligência artificial. Vamos te mostrar como funciona em menos de 1 minuto.",
    highlight: null,
  },
  {
    emoji: "🗺️",
    title: "Trilha de Aprendizado",
    desc: "Comece pela Trilha! São 40 passos do A1 ao C1. Cada passo tem uma conversa guiada e um quiz para desbloquear o próximo.",
    highlight: "nav-trilha",
  },
  {
    emoji: "💬",
    title: "Converse com a IA",
    desc: "Pratique inglês conversando livremente ou escolha um tema. A IA corrige, explica e adapta ao seu nível.",
    highlight: "card-conversar",
  },
  {
    emoji: "🃏",
    title: "Flashcards Inteligentes",
    desc: "Palavras novas viram flashcards automaticamente após cada conversa. Revise com repetição espaçada para memorizar de verdade.",
    highlight: "nav-flashcards",
  },
  {
    emoji: "📊",
    title: "Acompanhe seu Progresso",
    desc: "Veja sua sequência de dias, média nos quizzes e evolução ao longo do tempo. Quanto mais você pratica, mais cresce!",
    highlight: "nav-progresso",
  },
];

export default function OnboardingTour() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem(TOUR_KEY)) {
      setTimeout(() => setVisible(true), 800);
    }
  }, []);

  function finish() {
    localStorage.setItem(TOUR_KEY, "1");
    setVisible(false);
  }

  function next() {
    if (step >= STEPS.length - 1) { finish(); return; }
    setAnimating(true);
    setTimeout(() => {
      setStep((s) => s + 1);
      setAnimating(false);
    }, 200);
  }

  function prev() {
    if (step === 0) return;
    setAnimating(true);
    setTimeout(() => {
      setStep((s) => s - 1);
      setAnimating(false);
    }, 200);
  }

  if (!mounted || !visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return createPortal(
    <>
      <style>{`
        @keyframes tour-fade-in {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes tour-fade-out {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-8px) scale(0.97); }
        }
        .tour-card {
          animation: tour-fade-in 0.3s cubic-bezier(.22,1,.36,1) both;
        }
        .tour-card.animating {
          animation: tour-fade-out 0.18s ease both;
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={finish}
        style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Card */}
      <div
        className={`tour-card${animating ? " animating" : ""}`}
        style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          zIndex: 201, width: "calc(100% - 32px)", maxWidth: 400,
          background: "#141414", border: "1px solid #2a2a2a",
          borderRadius: 20, padding: "24px 20px 20px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 20 : 6, height: 6, borderRadius: 99,
                background: i === step ? "var(--yellow)" : "#333",
                transition: "all 0.3s ease",
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>{current.emoji}</div>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#fff", margin: "0 0 10px" }}>
            {current.title}
          </h2>
          <p style={{ fontSize: "0.85rem", color: "#999", lineHeight: 1.6, margin: 0 }}>
            {current.desc}
          </p>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          {step > 0 && (
            <button
              onClick={prev}
              style={{
                flex: 1, padding: "12px 0", borderRadius: 12,
                background: "transparent", border: "1px solid #2a2a2a",
                color: "#666", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer",
              }}
            >
              ← Voltar
            </button>
          )}
          <button
            onClick={next}
            style={{
              flex: 2, padding: "12px 0", borderRadius: 12,
              background: "var(--yellow)", border: "none",
              color: "#000", fontSize: "0.85rem", fontWeight: 800, cursor: "pointer",
            }}
          >
            {isLast ? "Começar agora 🚀" : "Próximo →"}
          </button>
        </div>

        {/* Skip */}
        {!isLast && (
          <button
            onClick={finish}
            style={{
              display: "block", margin: "12px auto 0", background: "none", border: "none",
              color: "#444", fontSize: "0.72rem", cursor: "pointer", fontWeight: 600,
            }}
          >
            Pular tour
          </button>
        )}
      </div>
    </>,
    document.body
  );
}
