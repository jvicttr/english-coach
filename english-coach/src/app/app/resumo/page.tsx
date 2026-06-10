"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type Message = { role: "user" | "assistant"; content: string; translation?: string };
type QuizQuestion = { question: string; options: string[]; correct: number; explanation: string };
type Quiz = { title: string; questions: QuizQuestion[] };
type Screen = "upload" | "loading-pdf" | "chat" | "loading-quiz" | "quiz" | "result";

export default function ResumoAula() {
  const router = useRouter();
  const [isPro, setIsPro] = useState<boolean | null>(null);
  const [screen, setScreen] = useState<Screen>("upload");
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [lessonContext, setLessonContext] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expandedTranslations, setExpandedTranslations] = useState<Set<number>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quiz state
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizSessionId, setQuizSessionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((d) => {
      setIsPro(d.plan === "pro");
    }).catch(() => setIsPro(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function processFile(file: File) {
    if (file.type !== "application/pdf") { setError("Por favor, envie um arquivo PDF."); return; }
    setFileName(file.name);
    setError(null);
    setScreen("loading-pdf");

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      const res = await fetch("/api/resumo-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicStart: true, pdfBase64: base64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao processar o PDF");

      setLessonContext(data.lessonContext);
      setMessages([{ role: "assistant", content: data.reply, translation: data.translation ?? undefined }]);
      setScreen("chat");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado. Tente novamente.");
      setScreen("upload");
    }
  }

  async function sendMessage() {
    if (!input.trim() || isLoading || !lessonContext) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/resumo-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated, lessonContext }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply, translation: data.translation ?? undefined }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Ops, tive um problema. Tente novamente!" }]);
    } finally {
      setIsLoading(false);
    }
  }

  async function generateQuiz() {
    setScreen("loading-quiz");
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, level: "intermediate" }),
      });
      const data = await res.json();
      if (data.quiz) {
        setQuiz(data.quiz);
        setQuizSessionId(data.sessionId ?? null);
        setAnswers(new Array(data.quiz.questions.length).fill(null));
        setCurrentQ(0);
        setScore(0);
        setShowExplanation(false);
        setScreen("quiz");
      } else {
        setScreen("chat");
        setError("Não foi possível gerar o quiz. Tente novamente.");
      }
    } catch {
      setScreen("chat");
      setError("Erro ao gerar o quiz.");
    }
  }

  function selectAnswer(i: number) {
    if (answers[currentQ] !== null) return;
    const updated = [...answers];
    updated[currentQ] = i;
    setAnswers(updated);
    setShowExplanation(true);
  }

  async function nextQuestion() {
    const total = quiz!.questions.length;
    if (currentQ + 1 < total) {
      setCurrentQ((q) => q + 1);
      setShowExplanation(false);
    } else {
      const finalScore = answers.reduce<number>((acc, a, i) => acc + (a === quiz!.questions[i].correct ? 1 : 0), 0);
      setScore(finalScore);
      if (quizSessionId) {
        await fetch("/api/quiz", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: quizSessionId, score: finalScore, answers }),
        });
      }
      setScreen("result");
    }
  }

  function toggleTranslation(i: number) {
    setExpandedTranslations((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  // ── Pro gate ──────────────────────────────────────────────────────────────
  if (isPro === null) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--black)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", gap: "6px" }}>
          {[0, 150, 300].map((d) => (
            <span key={d} style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--yellow)", display: "inline-block", animation: "bounce 0.8s infinite", animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  if (isPro === false) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--black)", fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 20px", borderBottom: "1px solid #1e1e1e" }}>
          <button onClick={() => router.push("/app")} style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "36px", padding: "0 12px", fontSize: ".8rem", fontWeight: 600, color: "var(--gray)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Voltar
          </button>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#fff", marginBottom: ".5rem" }}>Recurso exclusivo do Combo</h2>
          <p style={{ color: "var(--gray)", lineHeight: 1.6, maxWidth: 380, marginBottom: "1.75rem" }}>
            A Revisão de Aula está disponível somente para assinantes do combo <strong style={{ color: "#fff" }}>Aulas ao vivo + JV IA</strong>. Assine e pratique inglês todos os dias com suporte completo.
          </p>
          <a href="/planos" style={{ background: "var(--yellow)", color: "var(--black)", fontWeight: 700, fontSize: ".95rem", padding: ".75rem 2rem", borderRadius: "50px", textDecoration: "none" }}>
            Ver planos →
          </a>
        </div>
      </div>
    );
  }

  // ── Upload Screen ─────────────────────────────────────────────────────────
  if (screen === "upload") {
    return (
      <div style={{ minHeight: "100vh", background: "var(--black)", fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 20px", borderBottom: "1px solid #1e1e1e" }}>
          <button onClick={() => router.push("/app")} style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "36px", padding: "0 12px", fontSize: ".8rem", fontWeight: 600, color: "var(--gray)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Voltar
          </button>
          <span style={{ fontWeight: 700, fontSize: ".95rem", color: "#fff" }}>📄 Revisão de Aula</span>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.25rem" }}>
          <div style={{ width: "100%", maxWidth: 480 }}>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#fff", marginBottom: ".5rem" }}>Revisar minha aula</h1>
            <p style={{ color: "var(--gray)", marginBottom: "2rem", lineHeight: 1.6 }}>
              Envie o PDF da sua aula. O JV IA vai explicar o que foi estudado e você pode tirar dúvidas, praticar e fazer um quiz no final.
            </p>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) processFile(f); }}
              onClick={() => fileInputRef.current?.click()}
              style={{ border: `2px dashed ${dragging ? "var(--yellow)" : "#2a2a2a"}`, borderRadius: "20px", padding: "3rem 2rem", textAlign: "center", cursor: "pointer", transition: "border-color .2s, background .2s", background: dragging ? "rgba(245,200,0,.04)" : "transparent" }}
            >
              <div style={{ fontSize: "2.5rem", marginBottom: ".75rem" }}>📎</div>
              <p style={{ fontWeight: 700, color: "#fff", marginBottom: ".4rem" }}>Clique ou arraste o PDF aqui</p>
              <p style={{ color: "var(--gray)", fontSize: ".85rem" }}>Somente arquivos .pdf</p>
              <input ref={fileInputRef} type="file" accept="application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} style={{ display: "none" }} />
            </div>

            {error && <p style={{ color: "#f87171", marginTop: "1rem", fontSize: ".875rem" }}>{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  // ── Loading PDF Screen ────────────────────────────────────────────────────
  if (screen === "loading-pdf") {
    return (
      <div style={{ minHeight: "100vh", background: "var(--black)", fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
        <div style={{ display: "flex", gap: "6px" }}>
          {[0, 150, 300].map((d) => (
            <span key={d} style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--yellow)", display: "inline-block", animation: "bounce 0.8s infinite", animationDelay: `${d}ms` }} />
          ))}
        </div>
        <p style={{ color: "var(--gray)", fontSize: ".9rem" }}>Analisando <strong style={{ color: "#fff" }}>{fileName}</strong>…</p>
        <p style={{ color: "var(--gray)", fontSize: ".8rem" }}>Isso pode levar alguns segundos.</p>
      </div>
    );
  }

  // ── Loading Quiz Screen ───────────────────────────────────────────────────
  if (screen === "loading-quiz") {
    return (
      <div style={{ minHeight: "100vh", background: "var(--black)", fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
        <div style={{ display: "flex", gap: "6px" }}>
          {[0, 150, 300].map((d) => (
            <span key={d} style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--yellow)", display: "inline-block", animation: "bounce 0.8s infinite", animationDelay: `${d}ms` }} />
          ))}
        </div>
        <p style={{ color: "var(--gray)", fontSize: ".9rem" }}>Gerando seu quiz personalizado...</p>
      </div>
    );
  }

  // ── Quiz Screen ───────────────────────────────────────────────────────────
  if (screen === "quiz" && quiz) {
    const q = quiz.questions[currentQ];
    const chosen = answers[currentQ];
    const total = quiz.questions.length;

    return (
      <div style={{ minHeight: "100vh", background: "var(--black)", fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", padding: "1.5rem 1rem 3rem" }}>
        <div style={{ width: "100%", maxWidth: 520 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
            <div>
              <p style={{ fontSize: ".72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--yellow)" }}>Quiz</p>
              <h2 style={{ fontWeight: 700, color: "#fff", fontSize: "1rem", marginTop: "2px" }}>{quiz.title}</h2>
            </div>
            <span style={{ fontSize: ".875rem", fontWeight: 700, color: "var(--gray)" }}>{currentQ + 1}/{total}</span>
          </div>

          <div style={{ width: "100%", height: "6px", borderRadius: "99px", background: "var(--dark2)", marginBottom: "1.5rem" }}>
            <div style={{ height: "6px", borderRadius: "99px", background: "var(--yellow)", width: `${(currentQ / total) * 100}%`, transition: "width .5s" }} />
          </div>

          <div style={{ padding: "1rem 1.25rem", borderRadius: "16px", background: "var(--dark1)", border: "1px solid #1f1f1f", marginBottom: "1.25rem" }}>
            <p style={{ color: "#fff", fontSize: ".9rem", lineHeight: 1.6, fontWeight: 500 }}>{q.question}</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "1.25rem" }}>
            {q.options.map((opt, i) => {
              let bg = "var(--dark1)", border = "1px solid #2a2a2a", color = "#fff";
              if (chosen !== null) {
                if (i === q.correct) { bg = "rgba(74,222,128,.12)"; border = "1px solid #4ade80"; color = "#4ade80"; }
                else if (i === chosen) { bg = "rgba(248,113,113,.12)"; border = "1px solid #f87171"; color = "#f87171"; }
                else { color = "var(--gray)"; }
              }
              return (
                <button key={i} onClick={() => selectAnswer(i)} disabled={chosen !== null} style={{ background: bg, border, color, borderRadius: "12px", padding: ".75rem 1rem", fontSize: ".875rem", fontWeight: 500, textAlign: "left", cursor: chosen !== null ? "default" : "pointer", transition: "all .15s" }}>
                  <span style={{ fontWeight: 700, opacity: .5, marginRight: "8px" }}>{["A","B","C","D"][i]}</span>{opt}
                </button>
              );
            })}
          </div>

          {showExplanation && (
            <div style={{ padding: ".875rem 1rem", borderRadius: "12px", marginBottom: "1rem", background: chosen === q.correct ? "rgba(74,222,128,.08)" : "rgba(248,113,113,.08)", border: chosen === q.correct ? "1px solid rgba(74,222,128,.25)" : "1px solid rgba(248,113,113,.25)" }}>
              <p style={{ fontWeight: 700, marginBottom: ".25rem", color: chosen === q.correct ? "#4ade80" : "#f87171" }}>{chosen === q.correct ? "✓ Correto!" : "✗ Quase lá!"}</p>
              <p style={{ color: "var(--gray)", fontSize: ".85rem" }}>{q.explanation}</p>
            </div>
          )}

          {chosen !== null && (
            <button onClick={nextQuestion} style={{ width: "100%", padding: ".875rem", borderRadius: "12px", background: "var(--yellow)", color: "var(--black)", fontWeight: 700, fontSize: ".9rem", border: "none", cursor: "pointer" }}>
              {currentQ + 1 < total ? "Próxima →" : "Ver resultado →"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Result Screen ─────────────────────────────────────────────────────────
  if (screen === "result" && quiz) {
    const total = quiz.questions.length;
    const pct = Math.round((score / total) * 100);
    const emoji = pct >= 80 ? "🏆" : pct >= 60 ? "💪" : "📚";
    const msg = pct >= 80 ? "Excelente! Você dominou o conteúdo dessa aula." : pct >= 60 ? "Bom trabalho! Continue revisando." : "Continue assim! Cada revisão te deixa mais próximo da fluência.";
    const scoreColor = pct >= 80 ? "#4ade80" : pct >= 60 ? "var(--yellow)" : "#f87171";

    return (
      <div style={{ minHeight: "100vh", background: "var(--black)", fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem 1rem 3rem" }}>
        <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem", textAlign: "center" }}>
          <div style={{ fontSize: "3rem" }}>{emoji}</div>
          <div>
            <p style={{ fontSize: "3rem", fontWeight: 900, color: scoreColor }}>{pct}%</p>
            <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", marginTop: "4px" }}>{score}/{total} corretas</p>
          </div>
          <p style={{ color: "var(--gray)", fontSize: ".875rem" }}>{msg}</p>

          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px", marginTop: ".5rem" }}>
            {quiz.questions.map((q, i) => {
              const correct = answers[i] === q.correct;
              return (
                <div key={i} style={{ textAlign: "left", padding: ".875rem 1rem", borderRadius: "12px", background: "var(--dark1)", border: `1px solid ${correct ? "rgba(74,222,128,.2)" : "rgba(248,113,113,.2)"}` }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                    <span style={{ color: correct ? "#4ade80" : "#f87171", fontWeight: 700 }}>{correct ? "✓" : "✗"}</span>
                    <div>
                      <p style={{ fontWeight: 500, color: "#fff", fontSize: ".875rem" }}>{q.question}</p>
                      <p style={{ fontSize: ".78rem", color: "var(--gray)", marginTop: "2px" }}>Correto: <span style={{ color: "#4ade80" }}>{q.options[q.correct]}</span></p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: "10px", width: "100%", marginTop: ".5rem" }}>
            <button onClick={() => router.push("/app/progresso")} style={{ flex: 1, padding: ".875rem", borderRadius: "12px", background: "var(--dark2)", color: "var(--gray)", fontWeight: 700, fontSize: ".875rem", border: "1px solid #2a2a2a", cursor: "pointer" }}>
              Ver progresso
            </button>
            <button onClick={() => { setScreen("upload"); setMessages([]); setLessonContext(null); setFileName(null); setQuiz(null); }} style={{ flex: 1, padding: ".875rem", borderRadius: "12px", background: "var(--yellow)", color: "var(--black)", fontWeight: 700, fontSize: ".875rem", border: "none", cursor: "pointer" }}>
              Nova aula
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Chat Screen ───────────────────────────────────────────────────────────
  return (
    <div style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid #1e1e1e", flexShrink: 0, gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button onClick={() => { setScreen("upload"); setMessages([]); setLessonContext(null); setFileName(null); }} style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "36px", padding: "0 10px", display: "flex", alignItems: "center", gap: "5px", fontSize: ".75rem", fontWeight: 600, color: "var(--gray)", cursor: "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ display: "none" }} className="sm:inline">Nova aula</span>
          </button>
          <div>
            <p style={{ fontSize: ".7rem", color: "var(--gray)", marginBottom: "1px" }}>Revisão</p>
            <p style={{ fontSize: ".8rem", fontWeight: 700, color: "#fff", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📎 {fileName}</p>
          </div>
        </div>

        <button
          onClick={generateQuiz}
          disabled={messages.length < 2}
          style={{ background: messages.length >= 2 ? "var(--yellow)" : "var(--dark2)", color: messages.length >= 2 ? "var(--black)" : "var(--gray)", border: messages.length >= 2 ? "none" : "1px solid #2a2a2a", borderRadius: "10px", height: "36px", padding: "0 14px", fontSize: ".75rem", fontWeight: 700, cursor: messages.length >= 2 ? "pointer" : "default", whiteSpace: "nowrap", transition: "all .2s" }}
        >
          🎯 Fazer quiz
        </button>
      </header>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "85%", background: msg.role === "user" ? "var(--yellow)" : "var(--dark1)", color: msg.role === "user" ? "var(--black)" : "#fff", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", padding: ".75rem 1rem", fontSize: ".875rem", lineHeight: 1.6, border: msg.role === "assistant" ? "1px solid #1f1f1f" : "none" }}>
              <p style={{ whiteSpace: "pre-wrap" }}>{msg.content}</p>
              {msg.role === "assistant" && msg.translation && msg.translation !== "—" && (
                <div style={{ marginTop: "8px", borderTop: "1px solid #2a2a2a", paddingTop: "6px" }}>
                  <button onClick={() => toggleTranslation(i)} style={{ background: "transparent", border: "none", color: "var(--gray)", fontSize: ".72rem", cursor: "pointer", padding: 0 }}>
                    {expandedTranslations.has(i) ? "▲ Ocultar tradução" : "▼ Ver tradução"}
                  </button>
                  {expandedTranslations.has(i) && (
                    <p style={{ color: "var(--gray)", fontSize: ".78rem", marginTop: "4px", fontStyle: "italic", lineHeight: 1.5 }}>{msg.translation}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ background: "var(--dark1)", border: "1px solid #1f1f1f", borderRadius: "18px 18px 18px 4px", padding: ".75rem 1rem", display: "flex", gap: "5px", alignItems: "center" }}>
              {[0, 150, 300].map((d) => (
                <span key={d} style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--yellow)", display: "inline-block", animation: "bounce 0.8s infinite", animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "10px 16px 16px", borderTop: "1px solid #1e1e1e", flexShrink: 0 }}>
        {error && <p style={{ color: "#f87171", fontSize: ".78rem", marginBottom: "6px" }}>{error}</p>}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Pergunte sobre a aula..."
            disabled={isLoading}
            style={{ flex: 1, background: "var(--dark1)", border: "1px solid #2a2a2a", borderRadius: "14px", padding: ".75rem 1rem", fontSize: ".9rem", color: "#fff", outline: "none", fontFamily: "'Inter', sans-serif" }}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            style={{ width: "44px", height: "44px", borderRadius: "12px", background: input.trim() && !isLoading ? "var(--yellow)" : "var(--dark2)", border: "none", cursor: input.trim() && !isLoading ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background .15s" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke={input.trim() && !isLoading ? "var(--black)" : "var(--gray)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={input.trim() && !isLoading ? "var(--black)" : "var(--gray)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
