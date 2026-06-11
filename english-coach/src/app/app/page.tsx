"use client";

import { useState, useEffect } from "react";
import { UserButton } from "@clerk/nextjs";
import Image from "next/image";

type QuizResult = {
  id: string;
  score: number | null;
  questions: unknown[];
  created_at: string;
};

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
  const [results, setResults] = useState<QuizResult[]>([]);
  const [flashcardPending, setFlashcardPending] = useState(0);
  const [lastTopic, setLastTopic] = useState<TopicDef | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

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

    Promise.all([
      fetch("/api/quiz-history").then((r) => r.json()),
      fetch("/api/flashcards").then((r) => r.json()),
      fetch("/api/me").then((r) => r.json()),
    ]).then(([quizData, fcData, meData]) => {
      setResults(quizData.results ?? []);
      setFlashcardPending(fcData.pending ?? 0);
      setIsPro(meData.plan === "pro");
      setUserName(meData.firstName ?? "");
      setLoading(false);
    });
  }, []);

  const { streak, weekDays } = calcStreak(results);
  const todayIdx = (new Date().getDay() + 6) % 7; // 0=Mon

  return (
    <div style={{ background: "var(--black)", minHeight: "100dvh", fontFamily: "'Inter', sans-serif", paddingBottom: 70 }}>
      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{ padding: "14px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1e1e1e", position: "sticky", top: 0, background: "#0d0d0d", zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href="https://www.faleinglesjv.com" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, background: "var(--dark2)", border: "1px solid #2a2a2a", textDecoration: "none", flexShrink: 0 }} title="Voltar ao site">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
          <Image src="/favicon.png" alt="JV IA" width={28} height={28} style={{ borderRadius: 8 }} />
          <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff" }}>JV <span style={{ color: "var(--yellow)" }}>IA</span></span>
          <span style={{ fontSize: "0.55rem", fontWeight: 800, color: "#000", background: "var(--yellow)", borderRadius: "50px", padding: "1px 6px", letterSpacing: "0.3px", lineHeight: 1.6 }}>2.0</span>
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

          {!loading && isPro && (
            <div style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
              <UserButton appearance={{ elements: { avatarBox: { width: 38, height: 38 } } }} />
              <span style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)", fontSize: "0.52rem", fontWeight: 800, letterSpacing: "0.4px", background: "linear-gradient(135deg, #f5c800, #e0a800)", color: "#000", padding: "1px 5px", borderRadius: "50px", whiteSpace: "nowrap", lineHeight: 1.4, pointerEvents: "none" }}>
                PRO
              </span>
            </div>
          )}
          {(loading || !isPro) && (
            <div style={{ flexShrink: 0 }}>
              <UserButton appearance={{ elements: { avatarBox: { width: 38, height: 38 } } }} />
            </div>
          )}
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

      <div style={{ padding: "16px", maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Greeting ──────────────────────────────────────────────────────── */}
        <div>
          <p style={{ fontSize: "0.75rem", color: "var(--gray)", margin: 0 }}>{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
          <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", margin: "2px 0 0" }}>
            {greeting()}{userName ? `, ${userName}` : ""}!
          </p>
        </div>

        {/* ── Streak ─────────────────────────────────────────────────────────── */}
        {!loading && (
          <div style={{ background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "1.4rem" }}>🔥</span>
              <div>
                <p style={{ fontSize: "0.65rem", color: "var(--gray)", margin: 0, fontWeight: 600 }}>Sequência atual</p>
                <p style={{ fontSize: "0.9rem", fontWeight: 800, color: "#fff", margin: 0 }}>
                  {streak > 0 ? `${streak} dia${streak !== 1 ? "s" : ""} seguidos` : "Pratique hoje para começar!"}
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
          </div>
        )}

        {/* ── Continue ───────────────────────────────────────────────────────── */}
        {lastTopic && (
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
                href: isPro ? "/app/roleplay" : "/planos",
                emoji: "🎭",
                title: "Role-play",
                desc: isPro ? "Situações reais" : "Exclusivo Pro",
                iconBg: "rgba(167,139,250,.12)",
                iconColor: "#a78bfa",
                badge: !isPro ? { label: "🔒 Pro", color: "var(--yellow)", bg: "rgba(245,200,0,.1)" } : null,
              },
              {
                href: isPro ? "/app/flashcards" : "/planos",
                emoji: "🃏",
                title: "Flashcards",
                desc: isPro ? (flashcardPending > 0 ? `${flashcardPending} para revisar` : "Revisar vocabulário") : "Exclusivo Pro",
                iconBg: "rgba(74,222,128,.12)",
                iconColor: "#4ade80",
                badge: !isPro ? { label: "🔒 Pro", color: "var(--yellow)", bg: "rgba(245,200,0,.1)" } : (flashcardPending > 0 ? { label: `${flashcardPending} pendentes`, color: "#4ade80", bg: "rgba(74,222,128,.12)" } : null),
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
        {isPro && (
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
        {!loading && results.length === 0 && !lastTopic && (
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
          { href: "/app/conversar", icon: "💬", label: "Conversar", active: false },
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
  );
}
