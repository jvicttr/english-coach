"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import OnboardingTour from "@/components/OnboardingTour";
import LevelSelect from "@/components/LevelSelect";
import QuickTranslator from "@/components/QuickTranslator";
import InstallAppCard from "@/components/InstallAppCard";
import { TRAIL_STEPS, isStepUnlocked, getStartingLevel, getVisibleSteps, type TrailStep } from "@/lib/trilha-steps";

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
  const [trilhaStarted, setTrilhaStarted] = useState(false);
  const [recommendation, setRecommendation] = useState<{ packName: string; hardCount: number } | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    setIsMobileView(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobileView(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("lastTopic");
    if (saved) { try { setLastTopic(JSON.parse(saved)); } catch {} }

    function loadHome() { fetch("/api/home").then((r) => r.json()).then((d) => {
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
      setTrilhaStarted(completedList.length > 0 || activeSessions.length > 0);

      // Check localStorage for a pending trilha step that overrides the database
      const pendingStep = typeof window !== "undefined" ? localStorage.getItem("pendingTrilhaStep") : null;
      if (pendingStep) {
        try {
          const parsed = JSON.parse(pendingStep);
          // Only use it if not yet completed
          if (parsed?.id && !completedIds.has(parsed.id)) activeSessions = [parsed.id];
        } catch {}
      }

      const levelMap: Record<string, string> = { iniciante: "beginner", basico: "basic", intermediario: "intermediate", avancado: "advanced" };
      const userLevel = d.englishLevel ? (levelMap[d.englishLevel] ?? "beginner") : "beginner";
      const startingLevel = getStartingLevel(userLevel);

      // Only show "continue" for sessions that are NOT yet completed
      if (activeSessions.length > 0) {
        const step = TRAIL_STEPS.find((s) => activeSessions.includes(s.id) && !completedIds.has(s.id));
        if (step) { setTrilhaCta({ type: "continue", step }); return; }
      }
      // Só considera passos a partir do nivel de inicio do usuario — mesmo corte da tela da trilha
      const visibleSteps = getVisibleSteps(startingLevel);
      let nextStep: TrailStep | undefined;
      if (completedList.length > 0) {
        const sorted = [...completedList].sort((a, b) => b.completed_at.localeCompare(a.completed_at));
        const lastIdx = visibleSteps.findIndex((s) => s.id === sorted[0].step_id);
        for (let i = lastIdx + 1; i < visibleSteps.length; i++) {
          const s = visibleSteps[i];
          if (!completedIds.has(s.id) && isStepUnlocked(s.id, completedIds, startingLevel)) { nextStep = s; break; }
        }
      }
      if (!nextStep) nextStep = visibleSteps.find((s) => !completedIds.has(s.id) && isStepUnlocked(s.id, completedIds, startingLevel));
      setTrilhaCta(nextStep ? { type: "next", step: nextStep } : null);
    }).catch(() => { setIsPro(false); setTrilhaCta(null); }); }

    loadHome();
    const onVisible = () => { if (document.visibilityState === "visible") loadHome(); };
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(loadHome, 60_000);
    return () => { document.removeEventListener("visibilitychange", onVisible); clearInterval(interval); };
  }, []);

  const streak = streakData?.streak ?? 0;
  const weekDays = streakData?.weekDays ?? [];
  const todayIdx = (new Date().getDay() + 6) % 7; // 0=Mon

  return (
    <>
    {showLevelSelect && <LevelSelect onDone={() => setShowLevelSelect(false)} />}
    <OnboardingTour />
    <div className="app-scroll" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", paddingBottom: "calc(56px + env(safe-area-inset-bottom, 0px))" }}>
      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }`}</style>

      <style>{`
        @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        .sk { background: linear-gradient(90deg,#1a1a1a 25%,#252525 50%,#1a1a1a 75%); background-size: 600px 100%; animation: shimmer 1.4s infinite; border-radius: 6px; }
      `}</style>

      <div style={{ padding: "16px", paddingTop: "calc(65px + 16px + env(safe-area-inset-top))", maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Greeting ──────────────────────────────────────────────────────── */}
        <div>
          <p style={{ fontSize: "0.75rem", color: "var(--gray)", margin: 0 }}>{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
          <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", margin: "2px 0 0" }}>
            {greeting()}{userName ? `, ${userName}` : ""}!
          </p>
        </div>

        {/* ── Adicionar à tela inicial (mobile: destaque no topo) ──────────────── */}
        {isMobileView && <InstallAppCard pulse />}

        {/* ── Streak ─────────────────────────────────────────────────────────── */}
        {isPro === null ? (
          <div style={{ background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="sk" style={{ width: 28, height: 28, borderRadius: 8 }} />
              <div>
                <div className="sk" style={{ height: 10, width: 90, marginBottom: 6 }} />
                <div className="sk" style={{ height: 14, width: 130 }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, overflow: "hidden", flexShrink: 1 }}>
              {Array.from({ length: 7 }, (_, i) => <div key={i} className="sk" style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0 }} />)}
            </div>
          </div>
        ) : (
        <a href="/app/progresso" style={{ background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", textDecoration: "none", cursor: "pointer", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "1.4rem", lineHeight: 1 }}>🔥</span>
              <div>
                <p style={{ fontSize: "0.65rem", color: "var(--gray)", margin: 0, fontWeight: 600 }}>Sequência atual</p>
                <p style={{ fontSize: "0.9rem", fontWeight: 800, color: "#fff", margin: 0 }}>
                  {streak > 0 ? `${streak} dia${streak !== 1 ? "s seguidos" : " seguido"}` : "Pratique hoje para começar!"}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, overflow: "hidden", flexShrink: 1 }}>
              {weekDays.map((done, i) => {
                const isToday = i === todayIdx;
                return (
                  <div key={i} style={{ width: 24, height: 24, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.58rem", fontWeight: 700, background: done ? "var(--yellow)" : isToday ? "rgba(245,200,0,.15)" : "#1a1a1a", color: done ? "#000" : isToday ? "var(--yellow)" : "#333", border: isToday && !done ? "1px solid rgba(245,200,0,.4)" : "none" }}>
                    {DAYS[((i + 1) % 7)].charAt(0)}
                  </div>
                );
              })}
            </div>
        </a>
        )}


        {/* ── Recommendation ─────────────────────────────────────────────────── */}
        {isPro !== null && recommendation && (
          <a href="/app/flashcards" style={{ background: "rgba(248,113,113,.06)", border: "1px solid rgba(248,113,113,.25)", borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="#f87171"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "0.78rem", fontWeight: 800, color: "#f87171", margin: 0 }}>Você tem dificuldade em "{recommendation.packName}"</p>
              <p style={{ fontSize: "0.68rem", color: "rgba(248,113,113,.65)", margin: "1px 0 0" }}>{recommendation.hardCount} palavras difíceis — revisar agora →</p>
            </div>
          </a>
        )}


        {/* ── Trilha CTA (smart) ─────────────────────────────────────────────── */}
        {isPro === null ? (
          <div style={{ background: "#1a1400", borderRadius: 16, padding: "14px 16px", height: 68, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ height: 10, width: 80, borderRadius: 6, background: "linear-gradient(90deg,#2a2000 25%,#3a2e00 50%,#2a2000 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite", marginBottom: 8 }} />
              <div style={{ height: 15, width: 180, borderRadius: 6, background: "linear-gradient(90deg,#2a2000 25%,#3a2e00 50%,#2a2000 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite" }} />
            </div>
          </div>
        ) : trilhaCta ? (
          <button
            onClick={() => router.push("/app/trilha")}
            style={{ background: "var(--yellow)", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", textDecoration: "none", width: "100%", border: "none", cursor: "pointer", textAlign: "left" }}
          >
            <div>
              <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "rgba(0,0,0,.5)", margin: 0 }}>
                {!trilhaStarted ? "Começar trilha de aprendizado" : trilhaCta.type === "continue" ? "Continuar trilha" : "Próximo tópico"}
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
              {Array.from({ length: 2 }, (_, i) => (
                <div key={i} style={{ background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "14px 14px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="sk" style={{ width: 36, height: 36, borderRadius: 10 }} />
                  <div>
                    <div className="sk" style={{ height: 12, width: "55%", marginBottom: 6 }} />
                    <div className="sk" style={{ height: 10, width: "75%" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {[
              {
                href: "/app/conversar",
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
                title: "Conversar",
                desc: "Conversa livre ou por tópico",
                iconBg: "rgba(96,165,250,.12)",
                badge: null,
              },
              {
                href: isPro === true ? "/app/roleplay" : "/planos",
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2v4l4-4h4a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" fill="rgba(167,139,250,.1)"/><path d="M19 9h2a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v3l-3-3h-3a2 2 0 0 1-2-2v-1" fill="rgba(167,139,250,.08)"/></svg>,
                title: "Role-play",
                desc: isPro === true ? "Situações reais" : "Exclusivo Pro",
                iconBg: "rgba(167,139,250,.12)",
                badge: isPro === false ? { label: "🔒 Pro", color: "var(--yellow)", bg: "rgba(245,200,0,.1)" } : null,
              },
            ].map((card) => (
              <a key={card.title} href={card.href} style={{ background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "14px 14px 12px", textDecoration: "none", display: "flex", flexDirection: "column", gap: 8, transition: "border-color .2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(245,200,0,.2)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: card.iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {card.icon}
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

        {/* ── Quick Translator ───────────────────────────────────────────────── */}
        <QuickTranslator />

        {/* ── PRO exclusive ──────────────────────────────────────────────────── */}
        {isPro === true && (
          <a href="/app/resumo" style={{ background: "var(--dark1)", border: "1px solid rgba(245,200,0,.2)", borderRadius: 16, padding: "14px 16px", textDecoration: "none", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(245,200,0,.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff", margin: 0 }}>Revisão de Aula</p>
              </div>
              <p style={{ fontSize: "0.72rem", color: "var(--gray)", margin: "2px 0 0" }}>Envie o PDF da sua aula e tire dúvidas</p>
            </div>
            <svg style={{ marginLeft: "auto", flexShrink: 0 }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        )}

        {/* ── Adicionar à tela inicial (some sozinho se já instalado) ─────────── */}
        {!isMobileView && <InstallAppCard />}

        {/* ── No-content CTA ─────────────────────────────────────────────────── */}
        {isPro !== null && streak === 0 && !lastTopic && (
          <div style={{ background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "20px 16px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(245,200,0,.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
            </div>
            <p style={{ fontWeight: 700, color: "#fff", fontSize: "0.95rem", margin: 0 }}>Boas-vindas ao JV IA!</p>
            <p style={{ color: "var(--gray)", fontSize: "0.8rem", margin: 0, lineHeight: 1.5 }}>Escolha uma atividade acima para começar a praticar inglês agora.</p>
          </div>
        )}
      </div>

      {/* Botão FAB Mensagens */}
      <button
        onClick={() => router.push("/app/mensagens")}
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

    </div>
    </>
  );
}
