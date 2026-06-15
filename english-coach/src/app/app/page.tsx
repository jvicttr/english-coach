"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import OnboardingTour from "@/components/OnboardingTour";
import LevelSelect from "@/components/LevelSelect";
import { TRAIL_STEPS, isStepUnlocked, getStartingLevel, type TrailStep } from "@/lib/trilha-steps";

type QuizResult = {
  id: string;
  score: number | null;
  questions: unknown[];
  created_at: string;
};

type TierInfo = { id: string; label: string; emoji: string; color: string; min: number; max: number };
type XpData = { totalXp: number; tier: TierInfo; nextTier: TierInfo | null; badges: { earned: boolean }[] };

type TopicDef = { id: string; emoji: string; label: string; desc: string; color: string };

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function calcStreak(results: QuizResult[]): { streak: number; weekDays: boolean[] } {
  const completed = results.filter((r) => r.score != null);
  const today = new Date();

  // Week row — Mon to Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return completed.some((r) => new Date(r.created_at).toLocaleDateString("pt-BR") === d.toLocaleDateString("pt-BR"));
  });

  if (completed.length === 0) return { streak: 0, weekDays };
  const days = [...new Set(completed.map((r) => new Date(r.created_at).toLocaleDateString("pt-BR")))].sort((a, b) => {
    const [da, ma, ya] = a.split("/").map(Number);
    const [db, mb, yb] = b.split("/").map(Number);
    return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
  });
  const todayStr = today.toLocaleDateString("pt-BR");
  const yesterdayStr = new Date(Date.now() - 86400000).toLocaleDateString("pt-BR");
  if (days[0] !== todayStr && days[0] !== yesterdayStr) return { streak: 0, weekDays };
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const [dp, mp, yp] = days[i - 1].split("/").map(Number);
    const [dc, mc, yc] = days[i].split("/").map(Number);
    if (Math.round((new Date(yp, mp - 1, dp).getTime() - new Date(yc, mc - 1, dc).getTime()) / 86400000) === 1) streak++;
    else break;
  }
  return { streak, weekDays };
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function AppHome() {
  const router = useRouter();
  const [results, setResults] = useState<QuizResult[]>([]);
  const [streakData, setStreakData] = useState<{ streak: number; weekDays: boolean[] } | null>(null);
  const [flashcardPending, setFlashcardPending] = useState(0);
  const [lastTopic, setLastTopic] = useState<TopicDef | null>(null);
  const [isPro, setIsPro] = useState<boolean | null>(null); // null = still loading
  const [userName, setUserName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [xpData, setXpData] = useState<XpData | null>(null);
  const [trilhaCta, setTrilhaCta] = useState<{ type: "continue" | "next"; step: TrailStep } | null | undefined>(undefined);

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/portal", { method: "POST" });
      if (!res.ok) {
        const text = await res.text();
        let msg = `Erro ${res.status}`;
        try { msg = JSON.parse(text).error ?? msg; } catch { /* not JSON */ }
        alert(msg);
        return;
      }
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error ?? "Sem URL retornada pelo Stripe");
    } catch (e) {
      alert("Erro ao abrir o portal: " + String(e));
    } finally {
      setPortalLoading(false);
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem("lastTopic");
    if (saved) { try { setLastTopic(JSON.parse(saved)); } catch {} }

    // Fetch all in parallel but update state independently so each section
    // renders as soon as its own data arrives — no fetch blocks another.
    fetch("/api/quiz-history").then((r) => r.json()).then((d) => setResults(d.results ?? [])).catch(() => {});
    fetch("/api/streak").then((r) => r.json()).then((d) => setStreakData(d)).catch(() => {});
    fetch("/api/flashcards").then((r) => r.json()).then((d) => setFlashcardPending(d.pending ?? 0)).catch(() => {});
    fetch("/api/me").then((r) => r.json()).then((d) => {
      setIsPro(d.plan === "pro");
      setUserName(d.firstName ?? "");
      if (d.plan === "pro") {
        // Load trilha state to build smart CTA card
        fetch("/api/trilha").then((r) => r.json()).then((trilha) => {
          const completedIds = new Set<string>((trilha.completed ?? []).map((c: { step_id: string }) => c.step_id));
          const activeSessions: string[] = trilha.activeSessions ?? [];
          const levelMap: Record<string, string> = { iniciante: "beginner", basico: "basic", intermediario: "intermediate", avancado: "advanced" };
          const userLevel = d.englishLevel ? (levelMap[d.englishLevel] ?? "beginner") : "beginner";
          const startingLevel = getStartingLevel(userLevel);
          // Priority 1: step with active in-progress session
          if (activeSessions.length > 0) {
            const step = TRAIL_STEPS.find((s) => s.id === activeSessions[0]);
            if (step) { setTrilhaCta({ type: "continue", step }); return; }
          }
          // Priority 2: step right after the most recently completed one
          const completedList: { step_id: string; completed_at: string }[] = trilha.completed ?? [];
          let nextStep: TrailStep | undefined;
          if (completedList.length > 0) {
            // Sort by completed_at descending to find most recently completed
            const sorted = [...completedList].sort((a, b) => b.completed_at.localeCompare(a.completed_at));
            const lastCompletedId = sorted[0].step_id;
            const lastIdx = TRAIL_STEPS.findIndex((s) => s.id === lastCompletedId);
            // Walk forward from that position to find next incomplete unlocked step
            for (let i = lastIdx + 1; i < TRAIL_STEPS.length; i++) {
              const s = TRAIL_STEPS[i];
              if (!completedIds.has(s.id) && isStepUnlocked(s.id, completedIds, startingLevel)) {
                nextStep = s;
                break;
              }
            }
          }
          // Fallback: first unlocked incomplete step (for users who haven't completed anything)
          if (!nextStep) nextStep = TRAIL_STEPS.find((s) => !completedIds.has(s.id) && isStepUnlocked(s.id, completedIds, startingLevel));
          if (nextStep) setTrilhaCta({ type: "next", step: nextStep });
          else setTrilhaCta(null);
        }).catch(() => { setTrilhaCta(null); });
      } else {
        setTrilhaCta(null);
      }
    }).catch(() => { setTrilhaCta(null); });
    fetch("/api/profile").then((r) => r.json()).then((d) => {
      if (!d.level) setShowLevelSelect(true);
    }).catch(() => {});
    fetch("/api/conquistas").then((r) => r.json()).then((xp) => {
      if (xp?.totalXp !== undefined) setXpData(xp);
    }).catch(() => {});
  }, []);

  const { streak: quizStreak, weekDays: quizWeekDays } = calcStreak(results);
  const streak = streakData?.streak ?? quizStreak;
  const weekDays = streakData?.weekDays ?? quizWeekDays;
  const todayIdx = (new Date().getDay() + 6) % 7; // 0=Mon

  return (
    <>
    {showLevelSelect && <LevelSelect onDone={() => setShowLevelSelect(false)} />}
    <OnboardingTour />
    <div className="app-scroll" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", paddingBottom: 70 }}>
      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{ padding: "14px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1e1e1e", position: "fixed", top: 0, left: 0, right: 0, background: "#0d0d0d", zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href="https://www.faleinglesjv.com" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, background: "var(--dark2)", border: "1px solid #2a2a2a", textDecoration: "none", flexShrink: 0 }} title="Voltar ao site">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
          <Image src="/favicon.png" alt="JV IA" width={28} height={28} style={{ borderRadius: 8 }} />
          <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff" }}>JV <span style={{ color: "var(--yellow)" }}>IA</span></span>
          <span style={{ fontSize: "0.55rem", fontWeight: 800, color: "#000", background: "var(--yellow)", borderRadius: "50px", padding: "1px 6px", letterSpacing: "0.3px", lineHeight: 1.6 }}>4.5</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

          <a href="/planos" style={{ fontSize: ".75rem", fontWeight: 700, color: "var(--yellow)", border: "1px solid rgba(245,200,0,.35)", borderRadius: "50px", padding: ".25rem .75rem", textDecoration: "none" }}>
            Planos
          </a>

          {/* Hambúrguer */}
          <button onClick={() => setMenuOpen((v) => !v)} style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: 8, width: 32, height: 32, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer", flexShrink: 0 }}>
            {menuOpen ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2L12 12M12 2L2 12" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round"/></svg>
            ) : (
              <>
                <span style={{ width: 14, height: 2, background: "var(--gray)", borderRadius: 2 }} />
                <span style={{ width: 14, height: 2, background: "var(--gray)", borderRadius: 2 }} />
                <span style={{ width: 14, height: 2, background: "var(--gray)", borderRadius: 2 }} />
              </>
            )}
          </button>

          <div style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
            <UserButton appearance={{ elements: { avatarBox: { width: 38, height: 38 } } }} />
            {isPro === true && (
              <span style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)", fontSize: "0.52rem", fontWeight: 800, letterSpacing: "0.4px", background: "linear-gradient(135deg, #f5c800, #e0a800)", color: "#000", padding: "1px 5px", borderRadius: "50px", whiteSpace: "nowrap", lineHeight: 1.4, pointerEvents: "none" }}>
                PRO
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Dropdown menu ──────────────────────────────────────────────────── */}
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
          <div style={{ position: "fixed", top: 62, right: 16, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 14, padding: "6px 0", zIndex: 95, minWidth: 200, boxShadow: "0 8px 32px rgba(0,0,0,.6)" }}>
            <button onClick={() => { setMenuOpen(false); openPortal(); }} disabled={portalLoading} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", textDecoration: "none", color: "#fff", fontSize: "0.9rem", fontWeight: 600, background: "transparent", border: "none", cursor: "pointer", width: "100%" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: "1.1rem" }}>👤</span>
              {portalLoading ? "Abrindo..." : "Portal do Aluno"}
            </button>
            {[
              { href: "/app/progresso", icon: "🏆", label: "Progresso" },
              { href: "/app/resumo", icon: "📄", label: "Revisão de Aula" },
            ].map((item) => (
              <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", textDecoration: "none", color: "#fff", fontSize: "0.9rem", fontWeight: 600 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
                {item.label}
              </a>
            ))}
          </div>
        </>
      )}

      <div style={{ padding: "16px", paddingTop: "calc(64px + 16px)", maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

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
                <p style={{ fontSize: "0.9rem", fontWeight: 800, color: "#fff", margin: 0 }}>
                  {streak > 0 ? `${streak} dia${streak !== 1 ? "s seguidos" : " seguido"}` : "Pratique hoje para começar!"}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
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

        {/* ── XP & Tier ─────────────────────────────────────────────────────── */}
        {xpData && (
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
        {trilhaCta ? (
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
        {isPro !== null && results.length === 0 && !lastTopic && (
          <div style={{ background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "20px 16px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: "2rem" }}>👋</div>
            <p style={{ fontWeight: 700, color: "#fff", fontSize: "0.95rem", margin: 0 }}>Boas-vindas ao JV IA!</p>
            <p style={{ color: "var(--gray)", fontSize: "0.8rem", margin: 0, lineHeight: 1.5 }}>Escolha uma atividade acima para começar a praticar inglês agora.</p>
          </div>
        )}
      </div>

      {/* ── Bottom Nav ─────────────────────────────────────────────────────── */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0d0d0d", borderTop: "1px solid #1e1e1e", display: "grid", gridTemplateColumns: "repeat(4,1fr)", paddingBottom: "env(safe-area-inset-bottom, 0px)", zIndex: 50 }}>
        {[
          { href: "/app", icon: "🏠", label: "Início", active: true },
          { href: "/app/trilha", icon: "🗺️", label: "Trilha", active: false },
          { href: "/app/flashcards", icon: "🃏", label: "Flashcards", active: false },
          { href: "/app/progresso", icon: "📊", label: "Progresso", active: false },
        ].map((item) => (
          <a key={item.href} href={item.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 0 10px", textDecoration: "none" }}>
            <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
            <span style={{ fontSize: "0.6rem", fontWeight: 700, color: item.active ? "var(--yellow)" : "#444" }}>{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
    </>
  );
}
