"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import { TRAIL_STEPS, LEVEL_INFO, isStepUnlocked, getStartingLevel, type TrailLevel, type TrailStep } from "@/lib/trilha-steps";

const LEVELS_ORDER: TrailLevel[] = ["A1", "A2", "B1", "B2", "C1"];

type Progress = { step_id: string; score: number; total: number }[];

export default function TrilhaPage() {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress>([]);
  const [userLevel, setUserLevel] = useState<string>("beginner");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TrailStep | null>(null);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/me").then((r) => r.json()),
      fetch("/api/trilha").then((r) => r.json()),
    ]).then(([me, trilha]) => {
      if (me.plan !== "pro") { router.replace("/planos"); return; }
      setIsPro(true);
      setUserLevel(me.level ?? localStorage.getItem("userLevel") ?? "beginner");
      setProgress(trilha.completed ?? []);
      setLoading(false);
    });
  }, [router]);

  const completedIds = new Set(progress.map((p) => p.step_id));

  function startStep(step: TrailStep) {
    localStorage.setItem("pendingTrilhaStep", JSON.stringify(step));
    router.push("/app/conversar");
  }

  function getStepState(step: TrailStep): "completed" | "active" | "locked" {
    if (completedIds.has(step.id)) return "completed";
    if (isStepUnlocked(step.id, completedIds, startingLevel)) return "active";
    return "locked";
  }

  // Determine which levels are visible based on user level
  const startingLevel = getStartingLevel(userLevel);
  const startingIdx = LEVELS_ORDER.indexOf(startingLevel);
  const visibleLevels = LEVELS_ORDER.slice(startingIdx);

  if (loading) {
    return (
      <div style={{ background: "var(--black)", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 150, 300].map((d) => (
            <span key={d} style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--yellow)", display: "inline-block", animation: "bounce .8s infinite", animationDelay: `${d}ms` }} />
          ))}
        </div>
        <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>
      </div>
    );
  }

  const totalSteps = visibleLevels.reduce((acc, l) => acc + TRAIL_STEPS.filter((s) => s.level === l).length, 0);
  const completedCount = visibleLevels.reduce((acc, l) => acc + TRAIL_STEPS.filter((s) => s.level === l && completedIds.has(s.id)).length, 0);

  return (
    <div style={{ background: "var(--black)", minHeight: "100dvh", fontFamily: "'Inter', sans-serif", paddingBottom: 80 }}>
      <style>{`
        @keyframes pulse-ring { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.15);opacity:.6} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
      `}</style>

      {/* Header */}
      <header style={{ padding: "14px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1e1e1e", position: "sticky", top: 0, background: "#0d0d0d", zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href="/app" style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "36px", width: 36, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
          <Image src="/favicon.png" alt="JV IA" width={28} height={28} style={{ borderRadius: 8 }} />
          <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff" }}>Trilha</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Progress summary */}
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--gray)" }}>{completedCount}/{totalSteps} etapas</span>
          <div style={{ position: "relative", display: "inline-flex" }}>
            <UserButton />
            {isPro && <span style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)", fontSize: "0.52rem", fontWeight: 800, background: "linear-gradient(135deg,#f5c800,#e0a800)", color: "#000", padding: "1px 5px", borderRadius: "50px", whiteSpace: "nowrap", lineHeight: 1.4, pointerEvents: "none" }}>PRO</span>}
          </div>
        </div>
      </header>

      {/* Overall progress bar */}
      <div style={{ height: 3, background: "var(--dark2)" }}>
        <div style={{ height: 3, background: "var(--yellow)", width: `${totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0}%`, transition: "width .5s ease" }} />
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px 0" }}>
        {visibleLevels.map((levelId, levelIdx) => {
          const info = LEVEL_INFO[levelId];
          const steps = TRAIL_STEPS.filter((s) => s.level === levelId);
          const levelCompleted = steps.filter((s) => completedIds.has(s.id)).length;
          const isLevelLocked = steps[0] ? getStepState(steps[0]) === "locked" : false;

          return (
            <div key={levelId} style={{ marginBottom: 8 }}>
              {/* Level banner */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, marginTop: levelIdx > 0 ? 16 : 0 }}>
                <div style={{ height: 1, flex: 1, background: isLevelLocked ? "#1f1f1f" : info.color + "33" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: isLevelLocked ? "var(--dark1)" : info.color + "15", border: `1px solid ${isLevelLocked ? "#2a2a2a" : info.color + "40"}`, borderRadius: 50, padding: "6px 16px" }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 900, letterSpacing: "0.08em", color: isLevelLocked ? "var(--gray2)" : info.color }}>{info.label}</span>
                  <span style={{ fontSize: "0.65rem", color: isLevelLocked ? "#333" : "rgba(255,255,255,.5)", fontWeight: 600 }}>{info.sublabel}</span>
                  {!isLevelLocked && <span style={{ fontSize: "0.65rem", color: isLevelLocked ? "#333" : info.color, fontWeight: 700 }}>{levelCompleted}/{steps.length}</span>}
                </div>
                <div style={{ height: 1, flex: 1, background: isLevelLocked ? "#1f1f1f" : info.color + "33" }} />
              </div>

              {/* Steps */}
              <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                {steps.map((step, stepIdx) => {
                  const state = getStepState(step);
                  const isSelected = selected?.id === step.id;
                  const stepProgress = progress.find((p) => p.step_id === step.id);
                  const isEven = stepIdx % 2 === 0;

                  return (
                    <div key={step.id} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      {/* Connector line */}
                      {stepIdx > 0 && (
                        <div style={{ width: 2, height: 24, background: state === "locked" ? "#1f1f1f" : completedIds.has(steps[stepIdx - 1].id) ? info.color + "60" : "#2a2a2a" }} />
                      )}

                      {/* Step row */}
                      <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: isEven ? "flex-start" : "flex-end", paddingLeft: isEven ? 40 : 0, paddingRight: isEven ? 0 : 40 }}>
                        <button
                          onClick={() => {
                            if (state === "locked") return;
                            setSelected(isSelected ? null : step);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            background: state === "completed" ? "rgba(74,222,128,.1)" : state === "active" ? info.color + "18" : "var(--dark1)",
                            border: `2px solid ${state === "completed" ? "#4ade80" : state === "active" ? info.color : "#1f1f1f"}`,
                            borderRadius: 16,
                            padding: "10px 14px",
                            cursor: state === "locked" ? "default" : "pointer",
                            opacity: state === "locked" ? 0.35 : 1,
                            minWidth: 200,
                            maxWidth: 240,
                            textAlign: "left",
                            transition: "all .15s",
                            animation: state === "active" && !isSelected ? "pulse-ring 2s ease-in-out infinite" : "none",
                            boxShadow: isSelected ? `0 0 0 3px ${info.color}50` : "none",
                          }}
                        >
                          {/* Circle indicator */}
                          <div style={{
                            width: 36, height: 36, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                            background: state === "completed" ? "#4ade80" : state === "active" ? info.color : "#1f1f1f",
                            fontSize: state === "completed" ? "1rem" : "1.1rem",
                          }}>
                            {state === "completed" ? "✓" : state === "locked" ? "🔒" : step.emoji}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: "0.8rem", fontWeight: 700, color: state === "locked" ? "#333" : "#fff", margin: 0, lineHeight: 1.2 }}>{step.title}</p>
                            <p style={{ fontSize: "0.65rem", color: state === "completed" ? "#4ade8099" : state === "active" ? info.color + "99" : "#333", margin: "2px 0 0", lineHeight: 1.3 }}>
                              {state === "completed" && stepProgress ? `✓ ${Math.round((stepProgress.score / stepProgress.total) * 100)}%` : state === "active" ? "Disponível" : "Bloqueado"}
                            </p>
                          </div>
                        </button>
                      </div>

                      {/* Expanded step card */}
                      {isSelected && state !== "locked" && (
                        <div style={{ width: "100%", marginTop: 8, background: "var(--dark1)", border: `1px solid ${info.color}40`, borderRadius: 16, padding: "16px", animation: "fadeIn .2s ease" }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                            <span style={{ fontSize: "2rem" }}>{step.emoji}</span>
                            <div>
                              <p style={{ fontSize: "0.9rem", fontWeight: 800, color: "#fff", margin: 0 }}>{step.title}</p>
                              <p style={{ fontSize: "0.75rem", color: "var(--gray)", margin: "4px 0 0", lineHeight: 1.4 }}>{step.desc}</p>
                            </div>
                          </div>
                          {state === "completed" && stepProgress && (
                            <div style={{ marginBottom: 10, padding: "8px 12px", background: "rgba(74,222,128,.08)", border: "1px solid rgba(74,222,128,.2)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: "0.72rem", color: "#4ade80", fontWeight: 600 }}>✓ Concluída</span>
                              <span style={{ fontSize: "0.72rem", color: "#4ade80", fontWeight: 700 }}>{stepProgress.score}/{stepProgress.total} no quiz</span>
                            </div>
                          )}
                          <button
                            onClick={() => startStep(step)}
                            style={{ width: "100%", padding: "12px", background: state === "completed" ? "var(--dark2)" : info.color, color: state === "completed" ? "var(--gray)" : "#000", border: "none", borderRadius: 12, fontSize: "0.85rem", fontWeight: 800, cursor: "pointer" }}
                          >
                            {state === "completed" ? "↺ Refazer etapa" : "▶ Começar conversa"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Level completion badge */}
                {levelCompleted === steps.length && steps.length > 0 && (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, background: info.color + "15", border: `1px solid ${info.color}40`, borderRadius: 50, padding: "8px 20px" }}>
                    <span style={{ fontSize: "1rem" }}>🏆</span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: info.color }}>{info.label} Completo!</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Bottom spacer */}
        <div style={{ height: 32 }} />
      </div>

      {/* Bottom Nav */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0d0d0d", borderTop: "1px solid #1e1e1e", display: "grid", gridTemplateColumns: "repeat(4,1fr)", paddingBottom: "env(safe-area-inset-bottom, 0px)", zIndex: 50 }}>
        {[
          { href: "/app",           icon: "🏠", label: "Início",     active: false },
          { href: "/app/trilha",    icon: "🗺️", label: "Trilha",     active: true  },
          { href: "/app/flashcards",icon: "🃏", label: "Flashcards", active: false },
          { href: "/app/progresso", icon: "📊", label: "Progresso",  active: false },
        ].map((item) => (
          <a key={item.href} href={item.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 0 10px", textDecoration: "none" }}>
            <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
            <span style={{ fontSize: "0.6rem", fontWeight: 700, color: item.active ? "var(--yellow)" : "#444" }}>{item.label}</span>
          </a>
        ))}
      </nav>

      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
