"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Básico",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

const LEVEL_COLOR: Record<string, string> = {
  beginner: "#60a5fa",
  intermediate: "#F5C800",
  advanced: "#4ade80",
};

// ── Streak calculator ────────────────────────────────────────────────────────
function calcStreak(results: QuizResult[]): number {
  const completed = results.filter((r) => r.score != null);
  if (completed.length === 0) return 0;

  const days = [...new Set(
    completed.map((r) => new Date(r.created_at).toLocaleDateString("pt-BR"))
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
    const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

// ── SVG Sparkline ────────────────────────────────────────────────────────────
function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const W = 280, H = 64, pad = 8;
  const min = 0, max = 100;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / (max - min)) * (H - pad * 2);
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

// ── Main page ────────────────────────────────────────────────────────────────
export default function Historico() {
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();

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

  useEffect(() => {
    fetch("/api/quiz-history")
      .then((r) => r.json())
      .then((d) => { setResults(d.results ?? []); setLoading(false); });
  }, []);

  const completed = results.filter((r) => r.score != null && r.questions?.length);
  const scores = completed.map((r) => Math.round((r.score! / r.questions.length) * 100));
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const best = scores.length ? Math.max(...scores) : null;
  const streak = calcStreak(results);
  const last10 = [...scores].reverse().slice(-10);

  // Level distribution
  const levelCounts = completed.reduce<Record<string, number>>((acc, r) => {
    acc[r.level] = (acc[r.level] ?? 0) + 1;
    return acc;
  }, {});
  const dominantLevel = Object.entries(levelCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <div
      className="flex flex-col items-center px-3 pt-4 pb-10 min-h-screen"
      style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── Header ── */}
      <header className="w-full max-w-2xl mb-5 flex items-center gap-3">
        <button
          onClick={() => router.push("/app")}
          style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "8px 14px", color: "var(--gray)", fontSize: "0.82rem", cursor: "pointer" }}
        >
          ← Voltar
        </button>
        <h1 className="font-bold text-white text-lg">Meu Progresso</h1>
      </header>

      {loading && (
        <div className="flex gap-1.5 mt-16">
          {[0, 150, 300].map((d) => (
            <span key={d} className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ background: "var(--yellow)", animationDelay: `${d}ms` }} />
          ))}
        </div>
      )}

      {!loading && (
        <div className="w-full max-w-2xl flex flex-col gap-4">

          {/* ── Stats row ── */}
          {completed.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem" }}>

              {/* Streak */}
              <div style={{ background: "var(--dark1)", border: "1px solid #1f1f1f", borderRadius: "var(--radius)", padding: "1rem 1.2rem" }}>
                <div style={{ fontSize: "2rem", lineHeight: 1 }}>{streak > 0 ? "🔥" : "💤"}</div>
                <div style={{ fontSize: "1.8rem", fontWeight: 900, color: streak > 0 ? "#f97316" : "var(--gray)", lineHeight: 1.1, marginTop: "0.4rem" }}>
                  {streak}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--gray)", marginTop: "0.2rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {streak === 1 ? "dia seguido" : "dias seguidos"}
                </div>
              </div>

              {/* Avg score */}
              <div style={{ background: "var(--dark1)", border: "1px solid #1f1f1f", borderRadius: "var(--radius)", padding: "1rem 1.2rem" }}>
                <div style={{ fontSize: "2rem", lineHeight: 1 }}>📊</div>
                <div style={{ fontSize: "1.8rem", fontWeight: 900, color: avg != null && avg >= 70 ? "#4ade80" : avg != null && avg >= 50 ? "var(--yellow)" : "#f87171", lineHeight: 1.1, marginTop: "0.4rem" }}>
                  {avg != null ? `${avg}%` : "—"}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--gray)", marginTop: "0.2rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  média geral
                </div>
              </div>

              {/* Best score */}
              <div style={{ background: "var(--dark1)", border: "1px solid #1f1f1f", borderRadius: "var(--radius)", padding: "1rem 1.2rem" }}>
                <div style={{ fontSize: "2rem", lineHeight: 1 }}>🏆</div>
                <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#4ade80", lineHeight: 1.1, marginTop: "0.4rem" }}>
                  {best != null ? `${best}%` : "—"}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--gray)", marginTop: "0.2rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  melhor resultado
                </div>
              </div>

              {/* Level */}
              <div style={{ background: "var(--dark1)", border: "1px solid #1f1f1f", borderRadius: "var(--radius)", padding: "1rem 1.2rem" }}>
                <div style={{ fontSize: "2rem", lineHeight: 1 }}>🎯</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: dominantLevel ? LEVEL_COLOR[dominantLevel] : "var(--gray)", lineHeight: 1.1, marginTop: "0.4rem" }}>
                  {dominantLevel ? LEVEL_LABEL[dominantLevel] : "—"}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--gray)", marginTop: "0.2rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {completed.length} quiz{completed.length !== 1 ? "zes" : ""}
                </div>
              </div>
            </div>
          )}

          {/* ── Score evolution chart ── */}
          {last10.length >= 2 && (
            <div style={{ background: "var(--dark1)", border: "1px solid #1f1f1f", borderRadius: "var(--radius)", padding: "1.2rem 1.4rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--white)" }}>Evolução dos quizzes</p>
                  <p style={{ fontSize: "0.72rem", color: "var(--gray)", marginTop: "2px" }}>Últimos {last10.length} resultados</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {last10.length >= 2 && (
                    <span style={{
                      fontSize: "0.72rem", fontWeight: 700, padding: "2px 8px", borderRadius: "50px",
                      background: last10[last10.length - 1] >= last10[0] ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)",
                      color: last10[last10.length - 1] >= last10[0] ? "#4ade80" : "#f87171",
                    }}>
                      {last10[last10.length - 1] >= last10[0] ? "↑" : "↓"} {Math.abs(last10[last10.length - 1] - last10[0])}pp
                    </span>
                  )}
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <Sparkline data={last10} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
                <span style={{ fontSize: "0.65rem", color: "var(--gray2)" }}>mais antigo</span>
                <span style={{ fontSize: "0.65rem", color: "var(--gray2)" }}>mais recente</span>
              </div>
            </div>
          )}

          {/* ── Empty state ── */}
          {completed.length === 0 && (
            <div className="flex flex-col items-center mt-8 gap-3 text-center">
              <div className="text-4xl">📭</div>
              <p className="font-semibold text-white">Nenhum quiz ainda</p>
              <p className="text-sm" style={{ color: "var(--gray)" }}>Encerre uma conversa para gerar seu primeiro quiz!</p>
            </div>
          )}

          {/* ── Quiz list ── */}
          {results.length > 0 && (
            <>
              <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--gray)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "0.25rem" }}>
                Progresso detalhado
              </p>
              <div className="flex flex-col gap-3">
                {results.map((r) => {
                  const total = r.questions?.length ?? 0;
                  const pct = r.score != null && total > 0 ? Math.round((r.score / total) * 100) : null;
                  const scoreColor = pct == null ? "var(--gray)" : pct >= 80 ? "#4ade80" : pct >= 50 ? "var(--yellow)" : "#f87171";
                  const isOpen = expanded === r.id;

                  return (
                    <div
                      key={r.id}
                      style={{ background: "var(--dark1)", border: "1px solid #1f1f1f", borderRadius: "var(--radius)", overflow: "hidden" }}
                    >
                      <button
                        onClick={() => setExpanded(isOpen ? null : r.id)}
                        className="w-full text-left"
                        style={{ padding: "14px 16px", background: "transparent", border: "none", cursor: "pointer" }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white text-sm truncate">{r.title}</p>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "0.68rem", color: "var(--gray)" }}>
                                {new Date(r.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                              </span>
                              <span style={{ fontSize: "0.68rem", background: `${LEVEL_COLOR[r.level] ?? "#999"}22`, color: LEVEL_COLOR[r.level] ?? "var(--gray)", padding: "1px 7px", borderRadius: "50px", fontWeight: 600 }}>
                                {LEVEL_LABEL[r.level] ?? r.level}
                              </span>
                              <span style={{ fontSize: "0.68rem", color: "var(--gray2)" }}>{total} perguntas</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {pct != null ? (
                              <div className="text-right">
                                <p className="font-black text-lg" style={{ color: scoreColor }}>{pct}%</p>
                                <p className="text-xs" style={{ color: "var(--gray)" }}>{r.score}/{total}</p>
                              </div>
                            ) : (
                              <span className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(245,200,0,0.1)", color: "var(--yellow)", border: "1px solid rgba(245,200,0,0.2)" }}>
                                Incompleto
                              </span>
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
                        <div style={{ borderTop: "1px solid #1f1f1f", padding: "14px 16px" }}>
                          <div className="flex flex-col gap-4">
                            {r.questions.map((q, i) => {
                              const chosen = r.answers?.[i] ?? null;
                              const correct = chosen === q.correct;
                              return (
                                <div key={i}>
                                  <div className="flex items-start gap-2 mb-2">
                                    <span
                                      className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                                      style={{ background: chosen === null ? "var(--dark2)" : correct ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)", color: chosen === null ? "var(--gray)" : correct ? "#4ade80" : "#f87171" }}
                                    >
                                      {chosen === null ? i + 1 : correct ? "✓" : "✗"}
                                    </span>
                                    <p className="text-sm text-white font-medium">{q.question}</p>
                                  </div>
                                  <div className="flex flex-col gap-1.5 pl-7">
                                    {q.options.map((opt, j) => {
                                      const isCorrect = j === q.correct;
                                      const isChosen = j === chosen;
                                      let color = "var(--gray)", border = "1px solid #2a2a2a", bg = "transparent";
                                      if (isCorrect) { color = "#4ade80"; border = "1px solid rgba(74,222,128,0.3)"; bg = "rgba(74,222,128,0.06)"; }
                                      else if (isChosen && !isCorrect) { color = "#f87171"; border = "1px solid rgba(248,113,113,0.3)"; bg = "rgba(248,113,113,0.06)"; }
                                      return (
                                        <div key={j} className="px-3 py-2 rounded-lg text-xs" style={{ background: bg, border, color }}>
                                          <span className="font-bold mr-1.5" style={{ opacity: 0.6 }}>{["A","B","C","D"][j]}</span>
                                          {opt}
                                          {isChosen && !isCorrect && <span className="ml-2 opacity-70">← sua resposta</span>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {chosen !== null && (
                                    <p className="text-xs mt-2 pl-7" style={{ color: "var(--gray)", fontStyle: "italic" }}>{q.explanation}</p>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
