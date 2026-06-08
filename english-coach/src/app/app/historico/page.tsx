"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type QuizResult = {
  id: string;
  title: string;
  level: string;
  score: number | null;
  questions: { question: string }[];
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

          return (
            <div
              key={r.id}
              style={{ background: "var(--dark1)", border: "1px solid #1f1f1f", borderRadius: "var(--radius)", padding: "16px 18px" }}
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
                <div className="shrink-0 text-right">
                  {pct != null ? (
                    <>
                      <p className="font-black text-lg" style={{ color: scoreColor }}>{pct}%</p>
                      <p className="text-xs" style={{ color: "var(--gray)" }}>{r.score}/{total} certas</p>
                    </>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(245,200,0,0.1)", color: "var(--yellow)", border: "1px solid rgba(245,200,0,0.2)" }}>
                      Não finalizado
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
