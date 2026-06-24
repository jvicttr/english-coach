"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import OnboardingTour from "@/components/OnboardingTour";
import LevelSelect from "@/components/LevelSelect";
import { StartConversationModal } from "@/components/StartConversationModal";
import { TRAIL_STEPS, isStepUnlocked, getStartingLevel, type TrailStep } from "@/lib/trilha-steps";

type TierInfo = { id: string; label: string; emoji: string; color: string; min: number; max: number };
type XpData = { totalXp: number; tier: TierInfo; nextTier: TierInfo | null; badges: { earned: boolean }[] };

type TopicDef = { id: string; emoji: string; label: string; desc: string; color: string };

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function AppHome() {
  const router = useRouter();
  const [streakData, setStreakData] = useState<{ streak: number; weekDays: boolean[] } | null>(null);
  const [flashcardPending, setFlashcardPending] = useState(0);
  const [lastTopic, setLastTopic] = useState<TopicDef | null>(null);
  const [isPro, setIsPro] = useState<boolean | null>(null); // null = still loading
  const [userName, setUserName] = useState("");
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [xpData, setXpData] = useState<XpData | null>(null);
  const [trilhaCta, setTrilhaCta] = useState<{ type: "continue" | "next"; step: TrailStep } | null | undefined>(undefined);
  const [recommendation, setRecommendation] = useState<{ packName: string; hardCount: number } | null>(null);
  const [showStartChat, setShowStartChat] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("lastTopic");
    if (saved) { try { setLastTopic(JSON.parse(saved)); } catch {} }

    fetch("/api/home").then((r) => r.json()).then((d) => {
      setUserName(d.firstName ?? "");
      setIsPro(d.isPro ?? false);
      setStreakData({ streak: d.streak ?? 0, weekDays: d.weekDays ?? [] });
      setFlashcardPending(d.flashcardPending ?? 0);
      if (d.recommendation) setRecommendation(d.recommendation);
      if (!d.hasLevel) setShowLevelSelect(true);
      if (d.totalXp !== undefined) setXpData({ totalXp: d.totalXp, tier: d.tier, nextTier: d.nextTier, badges: d.badges });

      // Compute trilha CTA from returned data
      const completedList: { step_id: string; completed_at: string }[] = d.trilhaCompleted ?? [];
      const completedIds = new Set<string>(completedList.map((c) => c.step_id));
      let activeSessions: string[] = d.trilhaActiveSessions ?? [];

      // Check localStorage first for pending trilha step (faster than database)
      const pendingStep = typeof window !== "undefined" ? localStorage.getItem("pendingTrilhaStep") : null;
      if (pendingStep) {
        try {
          const parsed = JSON.parse(pendingStep);
          if (parsed?.id) activeSessions = [parsed.id];
        } catch {}
      }

      const levelMap: Record<string, string> = { iniciante: "beginner", basico: "basic", intermediario: "intermediate", avancado: "advanced" };
      const userLevel = d.englishLevel ? (levelMap[d.englishLevel] ?? "beginner") : "beginner";
      const startingLevel = getStartingLevel(userLevel);

      if (activeSessions.length > 0) {
        const step = TRAIL_STEPS.find((s) => s.id === activeSessions[0]);
        if (step) { setTrilhaCta({ type: "continue", step }); return; }
      }
      let nextStep: TrailStep | undefined;
      if (completedList.length > 0) {
        const sorted = [...completedList].sort((a, b) => b.completed_at.localeCompare(a.completed_at));
        const lastIdx = TRAIL_STEPS.findIndex((s) => s.id === sorted[0].step_id);
        for (let i = lastIdx + 1; i < TRAIL_STEPS.length; i++) {
          const s = TRAIL_STEPS[i];
          if (!completedIds.has(s.id) && isStepUnlocked(s.id, completedIds, startingLevel)) { nextStep = s; break; }
        }
      }
      if (!nextStep) nextStep = TRAIL_STEPS.find((s) => !completedIds.has(s.id) && isStepUnlocked(s.id, completedIds, startingLevel));
      setTrilhaCta(nextStep ? { type: "next", step: nextStep } : null);
    }).catch(() => { setIsPro(false); setTrilhaCta(null); });
  }, []);

  const streak = streakData?.streak ?? 0;
  const weekDays = streakData?.weekDays ?? [];
  const todayIdx = (new Date().getDay() + 6) % 7; // 0=Mon

  return (
    <>
    {showLevelSelect && <LevelSelect onDone={() => setShowLevelSelect(false)} />}
    <OnboardingTour />
    <div className="app-scroll" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", paddingBottom: 70 }}>
      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }`}</style>

      <style>{`@keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }`}</style>

      <div style={{ padding: "16px", paddingTop: "calc(65px + 16px)", maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Greeting ──────────────────────────────────────────────────────── */}
        <div>
          <p style={{ fontSize: "0.75rem", color: "var(--gray)", margin: 0 }}>{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
          <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", margin: "2px 0 0" }}>
            {greeting()}{userName ? `, ${userName}` : ""}!
          </p>
        </div>

        {/* ── Streak ─────────────────────────────────────────────────────────── */}
        <a href="/app/progresso" style={{ background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", textDecoration: "none", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "1.4rem" }}>🔥</span>
              <div>
                <p style={{ fontSize: "0.65rem", color: "var(--gray)", margin: 0, fontWeight: 600 }}>Sequência atual</p>
                {isPro === null ? (
                  <div style={{ height: 14, width: 120, borderRadius: 6, background: "linear-gradient(90deg,#1e1e1e 25%,#2a2a2a 50%,#1e1e1e 75%)", backgroundSize: "400px 100%", animation: "shimmer 1.2s infinite", marginTop: 3 }} />
                ) : (
                  <p style={{ fontSize: "0.9rem", fontWeight: 800, color: "#fff", margin: 0 }}>
                    {streak > 0 ? `${streak} dia${streak !== 1 ? "s seguidos" : " seguido"}` : "Pratique hoje para começar!"}
                  </p>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {isPro === null
                ? Array.from({ length: 7 }, (_, i) => (
                    <div key={i} style={{ width: 24, height: 24, borderRadius: 7, background: "#1a1a1a" }} />
                  ))
                : weekDays.map((done, i) => {
                    const isToday = i === todayIdx;
                    return (
                      <div key={i} style={{ width: 24, height: 24, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.58rem", fontWeight: 700, background: done ? "var(--yellow)" : isToday ? "rgba(245,200,0,.15)" : "#1a1a1a", color: done ? "#000" : isToday ? "var(--yellow)" : "#333", border: isToday && !done ? "1px solid rgba(245,200,0,.4)" : "none" }}>
                        {DAYS[((i + 1) % 7)].charAt(0)}
                      </div>
                    );
                  })}
            </div>
        </a>

        {/* ── Streak warning ─────────────────────────────────────────────────── */}
        {isPro !== null && streak > 0 && !weekDays[todayIdx] && (
          <a href="/app/conversar" style={{ background: "rgba(245,200,0,.06)", border: "1px solid rgba(245,200,0,.3)", borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <span style={{ fontSize: "1.3rem" }}>⚡</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--yellow)", margin: 0 }}>Sua sequência de {streak} dia{streak !== 1 ? "s" : ""} está em risco!</p>
              <p style={{ fontSize: "0.68rem", color: "rgba(245,200,0,.65)", margin: "1px 0 0" }}>Pratique agora para não perder →</p>
            </div>
          </a>
        )}

        {/* ── Recommendation ─────────────────────────────────────────────────── */}
        {isPro !== null && recommendation && (
          <a href="/app/flashcards" style={{ background: "rgba(248,113,113,.06)", border: "1px solid rgba(248,113,113,.25)", borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <span style={{ fontSize: "1.3rem" }}>🎯</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "0.78rem", fontWeight: 800, color: "#f87171", margin: 0 }}>Você tem dificuldade em "{recommendation.packName}"</p>
              <p style={{ fontSize: "0.68rem", color: "rgba(248,113,113,.65)", margin: "1px 0 0" }}>{recommendation.hardCount} palavras difíceis — revisar agora →</p>
            </div>
          </a>
        )}

        {/* ── XP & Tier ─────────────────────────────────────────────────────── */}
        {isPro === null ? (
          <div style={{ background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(90deg,#1e1e1e 25%,#2a2a2a 50%,#1e1e1e 75%)", backgroundSize: "400px 100%", animation: "shimmer 1.2s infinite", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 12, width: "50%", borderRadius: 6, background: "linear-gradient(90deg,#1e1e1e 25%,#2a2a2a 50%,#1e1e1e 75%)", backgroundSize: "400px 100%", animation: "shimmer 1.2s infinite", marginBottom: 8 }} />
              <div style={{ height: 5, borderRadius: 99, background: "linear-gradient(90deg,#1e1e1e 25%,#2a2a2a 50%,#1e1e1e 75%)", backgroundSize: "400px 100%", animation: "shimmer 1.2s infinite" }} />
            </div>
          </div>
        ) : xpData && (
          <a href="/app/conquistas" style={{ textDecoration: "none", display: "block" }}>
            <div style={{ background: "var(--dark1)", border: `1px solid ${xpData.tier.color}35`, borderRadius: 16, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: "1.6rem", lineHeight: 1 }}>{xpData.tier.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                  <p style={{ fontSize: "0.75rem", fontWeight: 800, color: xpData.tier.color, margin: 0 }}>{xpData.tier.label} · {xpData.totalXp.toLocaleString("pt-BR")} XP</p>
                  <p style={{ fontSize: "0.65rem", color: "var(--gray)", margin: 0 }}>
                    {xpData.badges.filter((b) => b.earned).length}/{xpData.badges.length} badges 🏅
                  </p>
                </div>
                {xpData.nextTier ? (
                  <div style={{ height: 5, background: "#1f1f1f", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: 5, background: xpData.tier.color, borderRadius: 99, width: `${Math.min(100, ((xpData.totalXp - xpData.tier.min) / (xpData.nextTier.min - xpData.tier.min)) * 100)}%`, transition: "width .8s ease" }} />
                  </div>
                ) : (
                  <p style={{ fontSize: "0.65rem", color: xpData.tier.color, margin: 0, fontWeight: 700 }}>✨ Tier máximo!</p>
                )}
                {xpData.nextTier && (
                  <p style={{ fontSize: "0.6rem", color: "var(--gray2)", margin: "3px 0 0" }}>
                    faltam {(xpData.nextTier.min - xpData.totalXp).toLocaleString("pt-BR")} XP para {xpData.nextTier.emoji} {xpData.nextTier.label}
                  </p>
                )}
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
          </a>
        )}

        {/* ── Trilha CTA (smart) ─────────────────────────────────────────────── */}
        {isPro === null ? (
          <div style={{ background: "#1a1400", borderRadius: 16, padding: "14px 16px", height: 68, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ height: 10, width: 80, borderRadius: 6, background: "linear-gradient(90deg,#2a2000 25%,#3a2e00 50%,#2a2000 75%)", backgroundSize: "400px 100%", animation: "shimmer 1.2s infinite", marginBottom: 8 }} />
              <div style={{ height: 14, width: 160, borderRadius: 6, background: "linear-gradient(90deg,#2a2000 25%,#3a2e00 50%,#2a2000 75%)", backgroundSize: "400px 100%", animation: "shimmer 1.2s infinite" }} />
            </div>
          </div>
        ) : trilhaCta ? (
          <button
            onClick={() => {
              if (trilhaCta.type === "continue") {
                localStorage.setItem("pendingTrilhaStep", JSON.stringify({ ...trilhaCta.step, phase: "chat1" }));
                router.push("/app/conversar");
              } else {
                router.push("/app/trilha");
              }
            }}
            style={{ background: "var(--yellow)", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", textDecoration: "none", width: "100%", border: "none", cursor: "pointer", textAlign: "left" }}
          >
            <div>
              <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "rgba(0,0,0,.5)", margin: 0 }}>
                {trilhaCta.type === "continue" ? "▶ Continuar trilha" : "🗺️ Próximo tópico"}
              </p>
              <p style={{ fontSize: "1rem", fontWeight: 800, color: "#000", margin: "2px 0 0" }}>
                {trilhaCta.step.emoji} {trilhaCta.step.title}
              </p>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        ) : trilhaCta === null && lastTopic && (
          <a href="/app/conversar" style={{ background: "var(--yellow)", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", textDecoration: "none" }}>
            <div>
              <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "rgba(0,0,0,.5)", margin: 0 }}>Continuar praticando</p>
              <p style={{ fontSize: "1rem", fontWeight: 800, color: "#000", margin: "2px 0 0" }}>
                {lastTopic.emoji} {lastTopic.label}
              </p>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        )}

        {/* ── Activities ─────────────────────────────────────────────────────── */}
        <div>
          <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--gray)", marginBottom: 10 }}>Atividades</p>
          {isPro === null ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} style={{ background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "14px 14px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(90deg,#1e1e1e 25%,#2a2a2a 50%,#1e1e1e 75%)", backgroundSize: "400px 100%", animation: "shimmer 1.2s infinite" }} />
                  <div>
                    <div style={{ height: 12, width: "60%", borderRadius: 6, background: "linear-gradient(90deg,#1e1e1e 25%,#2a2a2a 50%,#1e1e1e 75%)", backgroundSize: "400px 100%", animation: "shimmer 1.2s infinite", marginBottom: 6 }} />
                    <div style={{ height: 10, width: "80%", borderRadius: 6, background: "linear-gradient(90deg,#1e1e1e 25%,#2a2a2a 50%,#1e1e1e 75%)", backgroundSize: "400px 100%", animation: "shimmer 1.2s infinite" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {[
              {
                href: "/app/conversar",
                emoji: "💬",
                title: "Conversar",
                desc: "Conversa livre ou por tópico",
                iconBg: "rgba(96,165,250,.12)",
                iconColor: "#60a5fa",
                badge: null,
              },
              {
                href: isPro === true ? "/app/roleplay" : "/planos",
                emoji: "🎭",
                title: "Role-play",
                desc: isPro === true ? "Situações reais" : "Exclusivo Pro",
                iconBg: "rgba(167,139,250,.12)",
                iconColor: "#a78bfa",
                badge: isPro === false ? { label: "🔒 Pro", color: "var(--yellow)", bg: "rgba(245,200,0,.1)" } : null,
              },
              {
                href: isPro === true ? "/app/flashcards" : "/planos",
                emoji: "🃏",
                title: "Flashcards",
                desc: isPro === true ? (flashcardPending > 0 ? `${flashcardPending} para revisar` : "Revisar vocabulário") : "Exclusivo Pro",
                iconBg: "rgba(74,222,128,.12)",
                iconColor: "#4ade80",
                badge: isPro === false ? { label: "🔒 Pro", color: "var(--yellow)", bg: "rgba(245,200,0,.1)" } : (flashcardPending > 0 ? { label: `${flashcardPending} pendentes`, color: "#4ade80", bg: "rgba(74,222,128,.12)" } : null),
              },
              {
                href: "/app/progresso",
                emoji: "📊",
                title: "Progresso",
                desc: "Relatório semanal",
                iconBg: "rgba(251,191,36,.12)",
                iconColor: "#fbbf24",
                badge: null,
              },
            ].map((card) => (
              <a key={card.title} href={card.href} style={{ background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "14px 14px 12px", textDecoration: "none", display: "flex", flexDirection: "column", gap: 8, transition: "border-color .2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(245,200,0,.2)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: card.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>
                  {card.emoji}
                </div>
                <div>
                  <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff", margin: 0 }}>{card.title}</p>
                  <p style={{ fontSize: "0.72rem", color: "var(--gray)", margin: "2px 0 0" }}>{card.desc}</p>
                </div>
                {card.badge && (
                  <span style={{ background: card.badge.bg, color: card.badge.color, fontSize: "0.65rem", fontWeight: 700, padding: "2px 8px", borderRadius: "50px", display: "inline-block", width: "fit-content" }}>
                    {card.badge.label}
                  </span>
                )}
              </a>
            ))}
          </div>
          )}
        </div>

        {/* ── PRO exclusive ──────────────────────────────────────────────────── */}
        {isPro === true && (
          <a href="/app/resumo" style={{ background: "var(--dark1)", border: "1px solid rgba(245,200,0,.2)", borderRadius: 16, padding: "14px 16px", textDecoration: "none", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(245,200,0,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>📄</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff", margin: 0 }}>Revisão de Aula</p>
                <span style={{ background: "rgba(245,200,0,.12)", color: "var(--yellow)", fontSize: "0.62rem", fontWeight: 700, padding: "1px 7px", borderRadius: "50px" }}>Exclusivo Combo</span>
              </div>
              <p style={{ fontSize: "0.72rem", color: "var(--gray)", margin: "2px 0 0" }}>Envie o PDF da sua aula e tire dúvidas</p>
            </div>
            <svg style={{ marginLeft: "auto", flexShrink: 0 }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        )}

        {/* ── No-content CTA ─────────────────────────────────────────────────── */}
        {isPro !== null && streak === 0 && !lastTopic && (
          <div style={{ background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "20px 16px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: "2rem" }}>👋</div>
            <p style={{ fontWeight: 700, color: "#fff", fontSize: "0.95rem", margin: 0 }}>Boas-vindas ao JV IA!</p>
            <p style={{ color: "var(--gray)", fontSize: "0.8rem", margin: 0, lineHeight: 1.5 }}>Escolha uma atividade acima para começar a praticar inglês agora.</p>
          </div>
        )}
      </div>

      {/* Botão FAB Mensagens */}
      <button
        onClick={() => setShowStartChat(true)}
        style={{
          position: "fixed",
          bottom: "100px",
          right: "max(20px, calc((100vw - 600px) / 6))",
          width: "46px",
          height: "46px",
          borderRadius: "14px",
          background: "rgba(17,17,17,0.6)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.07)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
          zIndex: 40,
          transition: "border-color 0.15s, background 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "rgba(245,200,0,0.3)";
          e.currentTarget.style.background = "rgba(30,30,30,0.75)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
          e.currentTarget.style.background = "rgba(17,17,17,0.6)";
        }}
        title="Mensagens"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>

      <StartConversationModal isOpen={showStartChat} onClose={() => setShowStartChat(false)} />
    </div>
    </>
  );
}
