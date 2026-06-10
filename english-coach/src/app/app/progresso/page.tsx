"use client";

import { useState, useEffect } from "react";
import { UserButton } from "@clerk/nextjs";

type QuizResult = {
  id: string;
  title: string;
  level: string;
  score: number | null;
  questions: { question: string; options: string[]; correct: number; explanation: string }[];
  answers: (number | null)[] | null;
  completed_at: string | null;
  created_at: string;
};

const LEVEL_LABEL: Record<string, string> = { beginner: "Básico", intermediate: "Intermediário", advanced: "Avançado" };
const LEVEL_COLOR: Record<string, string> = { beginner: "#60a5fa", intermediate: "#F5C800", advanced: "#4ade80" };
const DAY_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function calcStreak(results: QuizResult[]): number {
  const completed = results.filter((r) => r.score != null);
  if (completed.length === 0) return 0;
  const days = [...new Set(completed.map((r) => new Date(r.created_at).toLocaleDateString("pt-BR")))].sort((a, b) => {
    const [da, ma, ya] = a.split("/").map(Number);
    const [db, mb, yb] = b.split("/").map(Number);
    return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
  });
  const today = new Date().toLocaleDateString("pt-BR");
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("pt-BR");
  if (days[0] !== today && days[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const [dp, mp, yp] = days[i - 1].split("/").map(Number);
    const [dc, mc, yc] = days[i].split("/").map(Number);
    const prev = new Date(yp, mp - 1, dp);
    const curr = new Date(yc, mc - 1, dc);
    if (Math.round((prev.getTime() - curr.getTime()) / 86400000) === 1) streak++;
    else break;
  }
  return streak;
}

function getWeekDays(): Date[] {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export default function Progresso() {
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [flashcardCount, setFlashcardCount] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch("/api/quiz-history").then((r) => r.json()),
      fetch("/api/flashcards").then((r) => r.json()),
    ]).then(([quizData, fcData]) => {
      setResults(quizData.results ?? []);
      setFlashcardCount(fcData.pending ?? 0);
      setLoading(false);
    });
  }, []);

  const streak = calcStreak(results);
  const completed = results.filter((r) => r.score != null);
  const totalSessions = completed.length;
  const avgScore = totalSessions > 0
    ? Math.round(completed.reduce((acc, r) => acc + Math.round((r.score! / r.questions.length) * 100), 0) / totalSessions)
    : 0;

  const weekDays = getWeekDays();
  const weekScores = weekDays.map((day) => {
    const dayStr = day.toLocaleDateString("pt-BR");
    const dayResults = completed.filter((r) => new Date(r.created_at).toLocaleDateString("pt-BR") === dayStr);
    if (dayResults.length === 0) return null;
    return Math.round(dayResults.reduce((acc, r) => acc + Math.round((r.score! / r.questions.length) * 100), 0) / dayResults.length);
  });

  const weekTotal = weekScores.filter((s) => s !== null).length;
  const last5 = completed.slice(0, 5);

  const BottomNav = () => (
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0d0d0d", borderTop: "1px solid #1e1e1e", display: "grid", gridTemplateColumns: "repeat(4,1fr)", paddingBottom: "env(safe-area-inset-bottom, 0px)", zIndex: 50 }}>
      {[
        { href: "/app", icon: "🏠", label: "Início", active: false },
        { href: "/app/conversar", icon: "💬", label: "Conversar", active: false },
        { href: "/app/flashcards", icon: "🃏", label: "Flashcards", active: false },
        { href: "/app/progresso", icon: "📊", label: "Progresso", active: true },
      ].map((item) => (
        <a key={item.href} href={item.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 0 10px", textDecoration: "none" }}>
          <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
          <span style={{ fontSize: "0.6rem", fontWeight: 700, color: item.active ? "var(--yellow)" : "#444" }}>{item.label}</span>
        </a>
      ))}
    </nav>
  );

  if (loading) {
    return (
      <div style={{ background: "var(--black)", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 150, 300].map((d) => <span key={d} style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--yellow)", display: "inline-block", animation: "bounce .8s infinite", animationDelay: `${d}ms` }} />)}
        </div>
        <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }`}</style>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--black)", minHeight: "100dvh", fontFamily: "'Inter', sans-serif", paddingBottom: 80 }}>
      <header style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1e1e1e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/app" style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "36px", width: 36, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
          <span style={{ fontWeight: 800, color: "#fff", fontSize: "0.95rem" }}>📊 Meu progresso</span>
        </div>
        <UserButton />
      </header>

      <div style={{ padding: "16px", maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Stats cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {[
            { emoji: "🔥", label: "Sequência", value: streak > 0 ? `${streak} dia${streak !== 1 ? "s" : ""}` : "—", color: streak > 0 ? "#f97316" : "var(--gray)" },
            { emoji: "📝", label: "Total de sessões", value: String(totalSessions), color: "var(--yellow)" },
            { emoji: "🎯", label: "Média geral", value: totalSessions > 0 ? `${avgScore}%` : "—", color: avgScore >= 80 ? "#4ade80" : avgScore >= 60 ? "var(--yellow)" : avgScore > 0 ? "#f87171" : "var(--gray)" },
            { emoji: "🃏", label: "Flashcards pendentes", value: String(flashcardCount), color: flashcardCount > 0 ? "#60a5fa" : "var(--gray)" },
          ].map((stat) => (
            <div key={stat.label} style={{ background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "14px 16px" }}>
              <p style={{ fontSize: "0.7rem", color: "var(--gray)", marginBottom: 6, fontWeight: 600 }}>{stat.emoji} {stat.label}</p>
              <p style={{ fontSize: "1.6rem", fontWeight: 900, color: stat.color, margin: 0, lineHeight: 1 }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Weekly chart */}
        <div style={{ background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ fontWeight: 700, color: "#fff", fontSize: "0.9rem", margin: 0 }}>Esta semana</p>
            <span style={{ fontSize: "0.75rem", color: "var(--gray)" }}>{weekTotal} sessão{weekTotal !== 1 ? "ões" : ""}</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
            {weekDays.map((day, i) => {
              const score = weekScores[i];
              const isToday = day.toDateString() === new Date().toDateString();
              const height = score !== null ? Math.max(8, (score / 100) * 72) : 6;
              const color = score === null ? "#1e1e1e" : score >= 80 ? "#4ade80" : score >= 60 ? "var(--yellow)" : "#f87171";
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 72 }}>
                    <div style={{ background: color, borderRadius: 4, height, transition: "height .3s ease", width: "100%" }} />
                    {score !== null && (
                      <span style={{ position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)", fontSize: "0.6rem", fontWeight: 700, color, whiteSpace: "nowrap" }}>{score}%</span>
                    )}
                  </div>
                  <span style={{ fontSize: "0.6rem", color: isToday ? "var(--yellow)" : "var(--gray)", fontWeight: isToday ? 700 : 400 }}>
                    {DAY_LABEL[day.getDay()]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent sessions */}
        {last5.length > 0 && (
          <div style={{ background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ fontWeight: 700, color: "#fff", fontSize: "0.9rem", margin: 0 }}>Últimas sessões</p>
              <a href="/app/historico" style={{ fontSize: "0.75rem", color: "var(--yellow)", textDecoration: "none", fontWeight: 600 }}>Ver tudo →</a>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {last5.map((r) => {
                const pct = r.score != null ? Math.round((r.score / r.questions.length) * 100) : null;
                const scoreColor = pct == null ? "var(--gray)" : pct >= 80 ? "#4ade80" : pct >= 60 ? "var(--yellow)" : "#f87171";
                return (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "var(--dark2)", borderRadius: 10, border: "1px solid #2a2a2a" }}>
                    <div>
                      <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#fff", margin: 0 }}>{r.title}</p>
                      <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
                        <span style={{ fontSize: "0.65rem", color: LEVEL_COLOR[r.level] ?? "var(--gray)", fontWeight: 600 }}>{LEVEL_LABEL[r.level] ?? r.level}</span>
                        <span style={{ fontSize: "0.65rem", color: "var(--gray2)" }}>
                          {new Date(r.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: "1rem", fontWeight: 900, color: scoreColor, margin: 0 }}>
                        {pct != null ? `${pct}%` : "—"}
                      </p>
                      {r.score != null && (
                        <p style={{ fontSize: "0.6rem", color: "var(--gray)", margin: 0 }}>{r.score}/{r.questions.length}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {totalSessions === 0 && (
          <div style={{ textAlign: "center", padding: "32px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: "2.5rem" }}>📊</div>
            <p style={{ color: "#fff", fontWeight: 700, fontSize: "1rem", margin: 0 }}>Nenhuma sessão ainda</p>
            <p style={{ color: "var(--gray)", fontSize: "0.875rem", margin: 0 }}>Converse e faça quizzes para ver seu progresso aqui.</p>
            <a href="/app/conversar" style={{ background: "var(--yellow)", color: "#000", padding: "0.75rem 2rem", borderRadius: "50px", textDecoration: "none", fontWeight: 800, fontSize: "0.9rem" }}>
              Começar agora
            </a>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
