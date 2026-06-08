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

export default function Historico() {
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/quiz-history")
      .then((r) => r.json())
      .then((d) => { setResults(d.results ?? []); setLoading(false); });
  }, []);

  return (
    <div
      className="flex flex-col items-center px-3 pt-4 pb-8 min-h-screen"
      style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif" }}
    >
      {/* Header */}
      <header className="w-full max-w-2xl mb-6 flex items-center gap-3">
        <button
          onClick={() => router.push("/app")}
          style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "8px 14px", color: "var(--gray)", fontSize: "0.82rem", cursor: "pointer" }}
        >
          ← Voltar
        </button>
        <h1 className="font-bold text-white text-lg">Histórico de Quizzes</h1>
      </header>

      {loading && (
        <div className="text-sm mt-10" style={{ color: "var(--gray)" }}>Carregando...</div>
      )}

      {!loading && results.length === 0 && (
        <div className="flex flex-col items-center mt-16 gap-3 text-center">
          <div className="text-4xl">📭</div>
          <p className="font-semibold text-white">Nenhum quiz ainda</p>
          <p className="text-sm" style={{ color: "var(--gray)" }}>Encerre uma conversa para gerar seu primeiro quiz!</p>
        </div>
      )}

      <div className="w-full max-w-2xl flex flex-col gap-3">
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
              {/* Card header — clickable */}
              <button
                onClick={() => setExpanded(isOpen ? null : r.id)}
                className="w-full text-left"
                style={{ padding: "16px 18px", background: "transparent", border: "none", cursor: "pointer" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{r.title}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--gray)" }}>
                      {new Date(r.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      {" · "}
                      {LEVEL_LABEL[r.level] ?? r.level}
                      {" · "}
                      {total} perguntas
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {pct != null ? (
                      <div className="text-right">
                        <p className="font-black text-lg" style={{ color: scoreColor }}>{pct}%</p>
                        <p className="text-xs" style={{ color: "var(--gray)" }}>{r.score}/{total} certas</p>
                      </div>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(245,200,0,0.1)", color: "var(--yellow)", border: "1px solid rgba(245,200,0,0.2)" }}>
                        Não finalizado
                      </span>
                    )}
                    <span style={{ color: "var(--gray)", fontSize: "0.8rem", transition: "transform 0.2s", display: "inline-block", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                      ▼
                    </span>
                  </div>
                </div>
              </button>

              {/* Expandable questions */}
              {isOpen && (
                <div style={{ borderTop: "1px solid #1f1f1f", padding: "16px 18px" }}>
                  <div className="flex flex-col gap-4">
                    {r.questions.map((q, i) => {
                      const chosen = r.answers?.[i] ?? null;
                      const correct = chosen === q.correct;

                      return (
                        <div key={i}>
                          {/* Question */}
                          <div className="flex items-start gap-2 mb-2">
                            <span
                              className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                              style={{ background: chosen === null ? "var(--dark2)" : correct ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)", color: chosen === null ? "var(--gray)" : correct ? "#4ade80" : "#f87171" }}
                            >
                              {chosen === null ? i + 1 : correct ? "✓" : "✗"}
                            </span>
                            <p className="text-sm text-white font-medium">{q.question}</p>
                          </div>

                          {/* Options */}
                          <div className="flex flex-col gap-1.5 pl-7">
                            {q.options.map((opt, j) => {
                              const isCorrect = j === q.correct;
                              const isChosen = j === chosen;
                              let color = "var(--gray)";
                              let border = "1px solid #2a2a2a";
                              let bg = "transparent";

                              if (isCorrect) { color = "#4ade80"; border = "1px solid rgba(74,222,128,0.3)"; bg = "rgba(74,222,128,0.06)"; }
                              else if (isChosen && !isCorrect) { color = "#f87171"; border = "1px solid rgba(248,113,113,0.3)"; bg = "rgba(248,113,113,0.06)"; }

                              return (
                                <div
                                  key={j}
                                  className="px-3 py-2 rounded-lg text-xs"
                                  style={{ background: bg, border, color }}
                                >
                                  <span className="font-bold mr-1.5" style={{ opacity: 0.6 }}>{["A", "B", "C", "D"][j]}</span>
                                  {opt}
                                  {isChosen && !isCorrect && <span className="ml-2 opacity-70">← sua resposta</span>}
                                </div>
                              );
                            })}
                          </div>

                          {/* Explanation */}
                          {chosen !== null && (
                            <p className="text-xs mt-2 pl-7" style={{ color: "var(--gray)", fontStyle: "italic" }}>
                              {q.explanation}
                            </p>
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
    </div>
  );
}
