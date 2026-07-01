"use client";

import { useState, useEffect } from "react";

type QuizQuestion = {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};

type QuizResult = {
  id: string;
  title: string;
  level: string;
  score: number | null;
  questions: QuizQuestion[];
  answers: (number | null)[] | null;
  completed_at: string | null;
  created_at: string;
};

type Flashcard = {
  id: string;
  word: string;
  translation: string;
  topic: string | null;
  next_review: string;
  created_at?: string;
};

const LEVEL_LABEL: Record<string, string> = { beginner: "Básico", intermediate: "Intermediário", advanced: "Avançado" };
const LEVEL_COLOR: Record<string, string> = { beginner: "#60a5fa", intermediate: "#F5C800", advanced: "#4ade80" };
const DAY_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function toLocalDateStr(isoStr: string): string {
  // Parse UTC timestamp and format in user's local timezone
  return new Date(isoStr).toLocaleDateString("pt-BR");
}

function calcStreak(results: QuizResult[]): number {
  const completed = results.filter((r) => r.score != null);
  if (completed.length === 0) return 0;
  // Use completed_at when available (when quiz was finished), fallback to created_at
  const days = [...new Set(
    completed.map((r) => toLocalDateStr(r.completed_at ?? r.created_at))
  )].sort((a, b) => {
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

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const W = 280, H = 64, pad = 8;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2);
    const y = H - pad - (v / 100) * (H - pad * 2);
    return [x, y] as [number, number];
  });
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = line + ` L${pts[pts.length - 1][0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5C800" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#F5C800" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sg)" />
      <path d={line} fill="none" stroke="#F5C800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="4" fill="#F5C800" />
    </svg>
  );
}

type TrilhaProgress = { step_id: string; score: number; total: number; completed_at: string };

export default function Progresso() {
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [trilhaProgress, setTrilhaProgress] = useState<TrilhaProgress[]>([]);
  const [showAllFlashcards, setShowAllFlashcards] = useState(false);
  const [showFlashcardsSection, setShowFlashcardsSection] = useState(false);
  const [showQuizSection, setShowQuizSection] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [sharedIds, setSharedIds] = useState<Set<string>>(new Set());
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [realStreak, setRealStreak] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/quiz-history").then((r) => r.json()),
      fetch("/api/flashcards").then((r) => (r.ok ? r.json() : { cards: [] })),
      fetch("/api/trilha").then((r) => r.json()),
      fetch("/api/streak").then((r) => r.json()),
    ]).then(([quizData, fcData, trilhaData, streakData]) => {
      setResults(quizData.results ?? []);
      setFlashcards(fcData.cards ?? []);
      setTrilhaProgress(trilhaData.completed ?? []);
      setRealStreak(streakData.streak ?? 0);
      setLoading(false);
    });
  }, []);

  async function deleteQuiz(id: string) {
    if (!confirm("Apagar este quiz do histórico?")) return;
    setDeleting(id);
    await fetch("/api/quiz-history", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setResults((prev) => prev.filter((r) => r.id !== id));
    setDeleting(null);
  }

  const completed = results.filter((r) => r.score != null && r.questions?.length);
  const scores = completed.map((r) => Math.round((r.score! / r.questions.length) * 100));
  const streak = realStreak ?? calcStreak(results);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const bestScore = scores.length ? Math.max(...scores) : null;
  const last10 = [...scores].reverse().slice(-10);

  const levelCounts = completed.reduce<Record<string, number>>((acc, r) => {
    acc[r.level] = (acc[r.level] ?? 0) + 1;
    return acc;
  }, {});
  const dominantLevel = Object.entries(levelCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  // Topics breakdown
  const topicCounts = completed.reduce<Record<string, { count: number; totalScore: number }>>((acc, r) => {
    const topic = r.title ?? "Outro";
    if (!acc[topic]) acc[topic] = { count: 0, totalScore: 0 };
    acc[topic].count++;
    acc[topic].totalScore += Math.round((r.score! / r.questions.length) * 100);
    return acc;
  }, {});
  const topTopics = Object.entries(topicCounts)
    .map(([name, d]) => ({ name, count: d.count, avg: Math.round(d.totalScore / d.count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Flashcard stats
  const today = new Date().toISOString().split("T")[0];
  const fcPending = flashcards.filter((f) => f.next_review <= today).length;
  const fcMastered = flashcards.filter((f) => f.next_review > today).length;

  // Trilha stats
  const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1"];
  const trilhaByLevel = LEVEL_ORDER.map((lvl) => {
    const total = 8; // ~8 steps per level
    const done = trilhaProgress.filter((p) => p.step_id.startsWith(lvl.toLowerCase())).length;
    return { lvl, done, total };
  });
  const trilhaTotal = trilhaProgress.length;

  const weekDays = getWeekDays();
  const weekScores = weekDays.map((day) => {
    const dayStr = day.toLocaleDateString("pt-BR");
    const dayResults = completed.filter((r) => toLocalDateStr(r.completed_at ?? r.created_at) === dayStr);
    if (dayResults.length === 0) return null;
    return Math.round(dayResults.reduce((acc, r) => acc + Math.round((r.score! / r.questions.length) * 100), 0) / dayResults.length);
  });
  const weekTotal = weekScores.filter((s) => s !== null).length;

  if (loading) {
    return (
      <div style={{ background: "var(--black)", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "calc(65px + env(safe-area-inset-top))" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 150, 300].map((d) => <span key={d} style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--yellow)", display: "inline-block", animation: "bounce .8s infinite", animationDelay: `${d}ms` }} />)}
        </div>
        <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }`}</style>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", minHeight: "100dvh", paddingTop: "calc(65px + env(safe-area-inset-top))", paddingBottom: "calc(56px + env(safe-area-inset-bottom, 0px))" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #1e1e1e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, color: "#fff", fontSize: "0.95rem" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          Meu Progresso
        </div>
      </div>

      <div style={{ padding: "16px", maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Stats cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {[
            { emoji: "🔥", label: "Sequência", value: streak > 0 ? `${streak} dia${streak !== 1 ? "s" : ""}` : "—", color: streak > 0 ? "#f97316" : "var(--gray)" },
            { emoji: "📝", label: "Total de sessões", value: String(completed.length), color: "var(--yellow)" },
            { emoji: "🎯", label: "Média geral", value: completed.length > 0 ? `${avgScore}%` : "—", color: avgScore >= 80 ? "#4ade80" : avgScore >= 60 ? "var(--yellow)" : avgScore > 0 ? "#f87171" : "var(--gray)" },
            { emoji: "🏆", label: "Melhor resultado", value: bestScore != null ? `${bestScore}%` : "—", color: "#4ade80" },
          ].map((stat) => (
            <div key={stat.label} style={{ background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "14px 16px" }}>
              <p style={{ fontSize: "0.7rem", color: "var(--gray)", marginBottom: 6, fontWeight: 600 }}>{stat.emoji} {stat.label}</p>
              <p style={{ fontSize: "1.6rem", fontWeight: 900, color: stat.color, margin: 0, lineHeight: 1 }}>{stat.value}</p>
              {stat.label === "Total de sessões" && dominantLevel && (
                <p style={{ fontSize: "0.6rem", color: LEVEL_COLOR[dominantLevel], margin: "5px 0 0", fontWeight: 700 }}>{LEVEL_LABEL[dominantLevel]}</p>
              )}
            </div>
          ))}
        </div>

        {/* Flashcards list — toggle */}
        {flashcards.length > 0 && (
          <div style={{ background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, overflow: "hidden" }}>
            <button
              onClick={() => setShowFlashcardsSection(v => !v)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", background: "transparent", border: "none", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700, color: "#fff", fontSize: "0.9rem" }}>🃏 Flashcards criados</span>
                <span style={{ fontSize: "0.7rem", background: "#2a2a2a", color: "var(--gray)", borderRadius: 20, padding: "2px 8px", fontWeight: 600 }}>{flashcards.length}</span>
              </div>
              <span style={{ color: "var(--gray)", fontSize: "0.8rem", display: "inline-block", transform: showFlashcardsSection ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▼</span>
            </button>
            {showFlashcardsSection && (
              <div style={{ padding: "0 16px 16px" }}>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                  <a href="/app/flashcards" style={{ fontSize: "0.75rem", color: "var(--yellow)", textDecoration: "none", fontWeight: 600 }}>Revisar →</a>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(showAllFlashcards ? flashcards : flashcards.slice(0, 5)).map((fc) => {
                    const today = new Date().toISOString().split("T")[0];
                    const isPending = fc.next_review <= today;
                    return (
                      <div key={fc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "var(--dark2)", borderRadius: 10, border: "1px solid #2a2a2a" }}>
                        <div>
                          <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff", margin: 0 }}>{fc.word}</p>
                          <p style={{ fontSize: "0.72rem", color: "var(--gray)", margin: "2px 0 0" }}>{fc.translation}</p>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                          {fc.topic && (
                            <span style={{ fontSize: "0.6rem", background: "rgba(96,165,250,.12)", color: "#60a5fa", borderRadius: 6, padding: "2px 7px", fontWeight: 600 }}>#{fc.topic}</span>
                          )}
                          <span style={{ fontSize: "0.6rem", color: isPending ? "#f97316" : "var(--gray2)", fontWeight: 600 }}>
                            {isPending ? "Revisar hoje" : `Próxima: ${new Date(fc.next_review + "T12:00:00").toLocaleDateString("pt-BR")}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {flashcards.length > 5 && (
                  <button
                    onClick={() => setShowAllFlashcards(v => !v)}
                    style={{ marginTop: 12, width: "100%", background: "none", border: "1px solid #2a2a2a", borderRadius: 10, color: "var(--gray)", fontSize: "0.75rem", fontWeight: 600, padding: "8px 0", cursor: "pointer" }}
                  >
                    {showAllFlashcards ? "Ver menos" : `Ver todos os ${flashcards.length} flashcards`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Quiz list — toggle */}
        {results.length > 0 && (
          <div style={{ background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, overflow: "hidden" }}>
            <button
              onClick={() => setShowQuizSection(v => !v)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", background: "transparent", border: "none", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700, color: "#fff", fontSize: "0.9rem" }}>📝 Histórico de quizzes</span>
                <span style={{ fontSize: "0.7rem", background: "#2a2a2a", color: "var(--gray)", borderRadius: 20, padding: "2px 8px", fontWeight: 600 }}>{results.length}</span>
              </div>
              <span style={{ color: "var(--gray)", fontSize: "0.8rem", display: "inline-block", transform: showQuizSection ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▼</span>
            </button>
            {showQuizSection && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 16px 16px" }}>
            {results.map((r) => {
              const total = r.questions?.length ?? 0;
              const pct = r.score != null && total > 0 ? Math.round((r.score / total) * 100) : null;
              const scoreColor = pct == null ? "var(--gray)" : pct >= 80 ? "#4ade80" : pct >= 50 ? "var(--yellow)" : "#f87171";
              const isOpen = expanded === r.id;
              return (
                <div key={r.id} style={{ background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, overflow: "hidden" }}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                    style={{ width: "100%", textAlign: "left", padding: "14px 16px", background: "transparent", border: "none", cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.68rem", color: "var(--gray)" }}>
                            {new Date(r.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                          <span style={{ fontSize: "0.68rem", background: `${LEVEL_COLOR[r.level] ?? "#999"}22`, color: LEVEL_COLOR[r.level] ?? "var(--gray)", padding: "1px 7px", borderRadius: "50px", fontWeight: 600 }}>
                            {LEVEL_LABEL[r.level] ?? r.level}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        {pct != null ? (
                          <div style={{ textAlign: "right" }}>
                            <p style={{ fontSize: "1.1rem", fontWeight: 900, color: scoreColor, margin: 0 }}>{pct}%</p>
                            <p style={{ fontSize: "0.6rem", color: "var(--gray)", margin: 0 }}>{r.score}/{total}</p>
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.68rem", padding: "2px 8px", borderRadius: "50px", background: "rgba(245,200,0,0.1)", color: "var(--yellow)", border: "1px solid rgba(245,200,0,0.2)" }}>Incompleto</span>
                        )}
                        <span style={{ color: "var(--gray)", fontSize: "0.8rem", display: "inline-block", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▼</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteQuiz(r.id); }}
                          disabled={deleting === r.id}
                          title="Apagar quiz"
                          style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "0.9rem", opacity: deleting === r.id ? 0.4 : 0.5, padding: "2px 4px" }}
                        >🗑️</button>
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div style={{ borderTop: "1px solid #1e1e1e", padding: "14px 16px" }}>
                      {pct != null && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (sharingId === r.id || sharedIds.has(r.id)) return;
                            setSharingId(r.id);
                            const resultEmoji = pct >= 80 ? "🏆" : pct >= 60 ? "💪" : "📚";
                            const content = `${resultEmoji} Just scored ${r.score}/${total} (${pct}%) on a quiz!\n\n"${r.title}"`;
                            const quizTranscript = JSON.stringify({
                              type: "quiz_result",
                              title: r.title,
                              score: r.score,
                              total,
                              questions: r.questions.map((q, i) => ({
                                question: q.question,
                                options: q.options,
                                correct: q.correct,
                                userAnswer: r.answers?.[i] ?? null,
                                explanation: q.explanation,
                              })),
                            });
                            await fetch("/api/community/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content, transcript: quizTranscript, isShare: true }) });
                            setSharingId(null);
                            setSharedIds((prev) => new Set([...prev, r.id]));
                          }}
                          disabled={sharingId === r.id || sharedIds.has(r.id)}
                          style={{ width: "100%", marginBottom: 14, padding: "9px 0", borderRadius: 10, border: `1px solid ${sharedIds.has(r.id) ? "rgba(74,222,128,.3)" : "#2a2a2a"}`, background: sharedIds.has(r.id) ? "rgba(74,222,128,.1)" : "rgba(255,255,255,.04)", color: sharedIds.has(r.id) ? "#4ade80" : "var(--gray)", fontSize: "0.78rem", fontWeight: 700, cursor: sharingId === r.id || sharedIds.has(r.id) ? "default" : "pointer" }}
                        >
                          {sharedIds.has(r.id) ? "✓ Compartilhado na comunidade!" : sharingId === r.id ? "Compartilhando..." : "🌐 Compartilhar resultado na comunidade"}
                        </button>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {r.questions.map((q, i) => {
                          const chosen = r.answers?.[i] ?? null;
                          const correct = chosen === q.correct;
                          return (
                            <div key={i}>
                              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                                <span style={{
                                  flexShrink: 0, width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: "0.72rem", fontWeight: 700, marginTop: 2,
                                  background: chosen === null ? "var(--dark2)" : correct ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)",
                                  color: chosen === null ? "var(--gray)" : correct ? "#4ade80" : "#f87171",
                                }}>
                                  {chosen === null ? i + 1 : correct ? "✓" : "✗"}
                                </span>
                                <p style={{ fontSize: "0.85rem", color: "#fff", fontWeight: 600, margin: 0 }}>{q.question}</p>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 28 }}>
                                {q.options.map((opt, j) => {
                                  const isCorrect = j === q.correct;
                                  const isChosen = j === chosen;
                                  let color = "var(--gray)", border = "1px solid #2a2a2a", bg = "transparent";
                                  if (isCorrect) { color = "#4ade80"; border = "1px solid rgba(74,222,128,0.3)"; bg = "rgba(74,222,128,0.06)"; }
                                  else if (isChosen && !isCorrect) { color = "#f87171"; border = "1px solid rgba(248,113,113,0.3)"; bg = "rgba(248,113,113,0.06)"; }
                                  return (
                                    <div key={j} style={{ padding: "8px 12px", borderRadius: 10, background: bg, border, color, fontSize: "0.8rem" }}>
                                      <span style={{ fontWeight: 700, marginRight: 6, opacity: 0.6 }}>{["A","B","C","D"][j]}</span>
                                      {opt}
                                      {isChosen && !isCorrect && <span style={{ marginLeft: 8, opacity: 0.7 }}>← sua resposta</span>}
                                    </div>
                                  );
                                })}
                              </div>
                              {chosen !== null && (
                                <p style={{ fontSize: "0.75rem", marginTop: 8, paddingLeft: 28, color: "var(--gray)", fontStyle: "italic" }}>{q.explanation}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {completed.length === 0 && (
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

    </div>
  );
}
