"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TRAIL_STEPS, LEVEL_INFO, isStepUnlocked, getStartingLevel, type TrailLevel, type TrailStep } from "@/lib/trilha-steps";

function getPrerequisiteTitle(step: TrailStep): string | null {
  if (step.order > 1) {
    const prev = TRAIL_STEPS.find((s) => s.level === step.level && s.order === step.order - 1);
    return prev ? prev.title : null;
  }
  const levelsOrder: TrailLevel[] = ["A1", "A2", "B1", "B2", "C1"];
  const levelIdx = levelsOrder.indexOf(step.level);
  if (levelIdx <= 0) return null;
  const prevLevel = levelsOrder[levelIdx - 1];
  const prevLevelSteps = TRAIL_STEPS.filter((s) => s.level === prevLevel);
  const lastStep = prevLevelSteps[prevLevelSteps.length - 1];
  return lastStep ? `todas as etapas de ${LEVEL_INFO[prevLevel]?.label ?? prevLevel}` : null;
}

const LEVELS_ORDER: TrailLevel[] = ["A1", "A2", "B1", "B2", "C1"];

type Progress = { step_id: string; score: number; total: number }[];

export default function TrilhaPage() {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress>([]);
  const [userLevel, setUserLevel] = useState<string>("beginner");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TrailStep | null>(null);
  function scanSavedSessions(): Set<string> {
    const sessions = new Set<string>();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("trilhaContinue_")) {
        try {
          const val = JSON.parse(localStorage.getItem(key)!);
          if (val?.messages?.length > 0) sessions.add(key.replace("trilhaContinue_", ""));
        } catch {}
      }
    }
    return sessions;
  }

  const [savedSessions, setSavedSessions] = useState<Set<string>>(() =>
    typeof window !== "undefined" ? scanSavedSessions() : new Set<string>()
  );

  // Rescan on every mount (handles Next.js router cache serving stale component)
  useEffect(() => {
    setSavedSessions(scanSavedSessions());
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/me").then((r) => r.json()),
      fetch("/api/trilha").then((r) => r.json()),
    ]).then(([me, trilha]) => {
      if (me.plan !== "pro") { router.replace("/planos"); return; }
      const levelMap: Record<string, string> = {
        iniciante: "beginner",
        basico: "basic",
        intermediario: "intermediate",
        avancado: "advanced",
      };
      const mapped = me.englishLevel ? (levelMap[me.englishLevel] ?? "beginner") : "beginner";
      setUserLevel(mapped);
      setProgress(trilha.completed ?? []);
      // activeSessions comes from /api/trilha (same call, no extra round-trip)
      const supabaseSessions = new Set<string>(trilha.activeSessions ?? []);
      const localSessions = scanSavedSessions();
      setSavedSessions(new Set([...supabaseSessions, ...localSessions]));
      setLoading(false);
    });
  }, [router]);

  const completedIds = new Set(progress.map((p) => p.step_id));

  function startStep(step: TrailStep) {
    // Try to restore previous phase if it exists (user was in middle of trilha step)
    let phase: "chat1" | "flashcards" | "quiz" | "chat2" = "chat1";

    try {
      const sessionRes = localStorage.getItem(`trilhaContinue_${step.id}`);
      if (sessionRes) {
        const parsed = JSON.parse(sessionRes);
        if (parsed?.phase) {
          phase = parsed.phase;
        }
      }
    } catch {}

    localStorage.setItem("pendingTrilhaStep", JSON.stringify({ ...step, phase }));
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
      <div style={{ background: "var(--black)", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", paddingTop: 65 }}>
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
    <div className="app-scroll" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", paddingTop: 65, paddingBottom: 80 }}>
      <style>{`
        @keyframes pulse-ring { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.15);opacity:.6} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        .trilha-container { max-width: 640px; margin: 0 auto; padding: 12px 16px 0; }
        .trilha-step-btn { min-width: 200px; max-width: 300px; }
        .trilha-step-row { padding-left: var(--row-pl, 40px); padding-right: var(--row-pr, 0px); }
        @media (min-width: 768px) {
          .trilha-container { max-width: 860px; }
          .trilha-step-btn { min-width: 280px; max-width: 420px; }
        }
        @media (min-width: 1280px) {
          .trilha-container { max-width: 1000px; }
          .trilha-step-btn { min-width: 320px; max-width: 500px; }
        }
      `}</style>

      {/* Subheader com título + progresso */}
      <div style={{ padding: "10px 16px 10px", borderBottom: "1px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: "0.95rem", color: "#fff" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/><polyline points="10 12 14 16 10 20"/></svg>
          Trilha
        </div>
        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--gray)" }}>{completedCount}/{totalSteps} etapas</span>
      </div>

      {/* Overall progress bar */}
      <div style={{ height: 3, background: "var(--dark2)" }}>
        <div style={{ height: 3, background: "var(--yellow)", width: `${totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0}%`, transition: "width .5s ease" }} />
      </div>

      <div className="trilha-container">
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
                          className="trilha-step-btn"
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
                              {state === "completed" && stepProgress && stepProgress.total > 0 && stepProgress.score > 0
                              ? `✓ ${Math.round((stepProgress.score / stepProgress.total) * 100)}%`
                              : state === "completed" ? "✓ Concluída"
                              : state === "active" ? "Disponível"
                              : (() => { const req = getPrerequisiteTitle(step); return req ? `Complete "${req}" primeiro` : "Bloqueado"; })()}
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
                              {stepProgress.total > 0 && stepProgress.score > 0 && <span style={{ fontSize: "0.72rem", color: "#4ade80", fontWeight: 700 }}>{stepProgress.score}/{stepProgress.total} no quiz</span>}
                            </div>
                          )}
                          {(() => {
                            const hasSaved = savedSessions.has(step.id);
                            return (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {state === "completed" && (
                                  <button
                                    onClick={() => {
                                      localStorage.setItem("pendingTrilhaStep", JSON.stringify({ ...step, phase: "review" }));
                                      router.push("/app/conversar");
                                    }}
                                    style={{ width: "100%", padding: "12px", background: "rgba(74,222,128,0.08)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 12, fontSize: "0.85rem", fontWeight: 800, cursor: "pointer" }}
                                  >
                                    👁 Revisar conversa, flashcards e quiz
                                  </button>
                                )}
                                <button
                                  onClick={async () => {
                                    if (state === "completed") {
                                      // Clear old score so refazer saves a fresh result
                                      await fetch("/api/trilha", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stepId: step.id }) });
                                    }
                                    startStep(step);
                                  }}
                                  style={{ width: "100%", padding: "12px", background: state === "completed" ? "var(--dark2)" : info.color, color: state === "completed" ? "var(--gray)" : "#000", border: "none", borderRadius: 12, fontSize: "0.85rem", fontWeight: 800, cursor: "pointer" }}
                                >
                                  {state === "completed" ? "↺ Refazer etapa" : hasSaved ? "▶ Continuar de onde parou" : "▶ Começar conversa"}
                                </button>
                              </div>
                            );
                          })()}
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

      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
