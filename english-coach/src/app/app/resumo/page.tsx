"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { BottomNavFlex } from "@/components/BottomNav";

type Message = { role: "user" | "assistant"; content: string; translation?: string };
type QuizQuestion = { question: string; options: string[]; correct: number; explanation: string };
type Quiz = { title: string; questions: QuizQuestion[] };
type Screen = "chat" | "loading-quiz" | "loading-flashcards" | "quiz" | "result";

export default function ResumoAula() {
  const router = useRouter();
  const [isPro, setIsPro] = useState<boolean | null>(null);
  const [screen, setScreen] = useState<Screen>("chat");
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [lessonContext, setLessonContext] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micError, setMicError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizSessionId, setQuizSessionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((d) => setIsPro(d.plan === "pro")).catch(() => setIsPro(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-save quiz on tab close or navigation away
  const quizSaveRef = useRef({ screen, quizSessionId, quiz, answers });
  useEffect(() => { quizSaveRef.current = { screen, quizSessionId, quiz, answers }; });
  useEffect(() => {
    const save = () => {
      const s = quizSaveRef.current;
      if (s.screen !== "quiz" || !s.quizSessionId || !s.quiz) return;
      const answered = s.answers.filter((a) => a !== null).length;
      if (answered === 0) return;
      const partialScore = s.answers.reduce<number>((acc, a, i) => acc + (a !== null && a === s.quiz!.questions[i].correct ? 1 : 0), 0);
      navigator.sendBeacon("/api/quiz-abandon", new Blob([JSON.stringify({ sessionId: s.quizSessionId, score: partialScore, answers: s.answers })], { type: "application/json" }));
    };
    window.addEventListener("beforeunload", save);
    return () => { window.removeEventListener("beforeunload", save); save(); };
  }, []);

  async function processFile(file: File) {
    if (file.type !== "application/pdf") { setError("Por favor, envie um arquivo PDF."); return; }
    setFileName(file.name);
    setError(null);
    setLoadingPdf(true);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado. Tente novamente.");
      setFileName(null);
    } finally {
      setLoadingPdf(false);
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

  async function generateFlashcards() {
    setScreen("loading-flashcards");
    try {
      const packName = fileName ? fileName.replace(/\.pdf$/i, "") : "Revisão de Aula";
      await fetch("/api/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, packName }),
      });
      router.push("/app/flashcards");
    } catch {
      setScreen("chat");
      setError("Erro ao gerar os flashcards. Tente novamente.");
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
    const updated = [...answers]; updated[currentQ] = i;
    setAnswers(updated); setShowExplanation(true);
  }

  async function nextQuestion() {
    const total = quiz!.questions.length;
    if (currentQ + 1 < total) { setCurrentQ((q) => q + 1); setShowExplanation(false); }
    else {
      const finalScore = answers.reduce<number>((acc, a, i) => acc + (a === quiz!.questions[i].correct ? 1 : 0), 0);
      setScore(finalScore);
      if (quizSessionId) {
        await fetch("/api/quiz", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: quizSessionId, score: finalScore, answers }) });
      }
      setScreen("result");
    }
  }

  async function startListening() {
    setMicError("");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      setMicError("Permissão de microfone negada. Clique no cadeado na barra de endereço e permita o microfone.");
      return;
    }

    audioChunksRef.current = [];

    const mimeType = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";

    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType, audioBitsPerSecond: 128000 } : {}
    );

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      stream.getTracks().forEach((t) => t.stop());

      const finalMime = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(audioChunksRef.current, { type: finalMime });

      if (blob.size < 1000) {
        setMicError("Nenhuma fala detectada. Fale mais perto do microfone e tente novamente.");
        return;
      }

      setIsTranscribing(true);
      try {
        const ext = finalMime.includes("mp4") ? "mp4" : finalMime.includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `recording.${ext}`, { type: finalMime });
        const form = new FormData();
        form.append("audio", file);

        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = await res.json();
        setIsTranscribing(false);

        if (data.transcript?.trim()) {
          setInput(data.transcript);
          const transcript = data.transcript.trim();
          const userMsg: Message = { role: "user", content: transcript };
          const updated = [...messages, userMsg];
          setMessages(updated);
          setInput("");
          setIsLoading(true);
          try {
            const chatRes = await fetch("/api/resumo-chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ messages: updated, lessonContext }),
            });
            const chatData = await chatRes.json();
            if (!chatRes.ok) throw new Error(chatData.error ?? "Erro");
            setMessages((prev) => [...prev, { role: "assistant", content: chatData.reply, translation: chatData.translation ?? undefined }]);
          } catch {
            setMessages((prev) => [...prev, { role: "assistant", content: "Ops, tive um problema. Tente novamente!" }]);
          } finally {
            setIsLoading(false);
          }
        } else if (data.error) {
          setMicError(`Erro na transcrição: ${data.error}`);
        } else {
          setMicError("Não entendi o áudio. Fale mais perto do microfone e tente novamente.");
        }
      } catch (err) {
        setIsTranscribing(false);
        setMicError(`Erro ao transcrever: ${String(err)}`);
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsListening(true);
    autoStopTimerRef.current = setTimeout(() => stopListening(), 60000);
  }

  function stopListening() {
    if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
    const rec = mediaRecorderRef.current;
    if (rec && rec.state === "recording") rec.stop();
    setIsListening(false);
  }

  function resetChat() {
    setMessages([]); setLessonContext(null); setFileName(null);
    setQuiz(null); setError(null); setScreen("chat");
  }

  // ── Pro gate ─────────────────────────────────────────────────────────────
  if (isPro === null) return (
    <div style={{ minHeight: "100vh", background: "var(--black)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", gap: 6 }}>{[0,150,300].map((d) => <span key={d} style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--yellow)", display: "inline-block", animation: "bounce 0.8s infinite", animationDelay: `${d}ms` }} />)}</div>
    </div>
  );

  if (isPro === false) return (
    <div style={{ minHeight: "100vh", background: "var(--black)", fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem", textAlign: "center" }}>
      <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
      <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#fff", marginBottom: ".5rem" }}>Recurso exclusivo do Combo</h2>
      <p style={{ color: "var(--gray)", lineHeight: 1.6, maxWidth: 380, marginBottom: "1.75rem" }}>
        A Revisão de Aula está disponível somente para assinantes do combo <strong style={{ color: "#fff" }}>Aulas ao vivo + JV IA</strong>.
      </p>
      <a href="/planos" style={{ background: "var(--yellow)", color: "var(--black)", fontWeight: 700, fontSize: ".95rem", padding: ".75rem 2rem", borderRadius: "50px", textDecoration: "none" }}>Ver planos →</a>
    </div>
  );

  // ── Loading screens ───────────────────────────────────────────────────────
  if (screen === "loading-flashcards" || screen === "loading-quiz") return (
    <div style={{ minHeight: "100vh", background: "var(--black)", fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
      <div style={{ display: "flex", gap: 6 }}>{[0,150,300].map((d) => <span key={d} style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--yellow)", display: "inline-block", animation: "bounce 0.8s infinite", animationDelay: `${d}ms` }} />)}</div>
      <p style={{ color: "var(--gray)", fontSize: ".9rem" }}>{screen === "loading-flashcards" ? "Criando seus flashcards..." : "Gerando seu quiz personalizado..."}</p>
    </div>
  );

  // ── Quiz Screen ───────────────────────────────────────────────────────────
  if (screen === "quiz" && quiz) {
    const q = quiz.questions[currentQ]; const chosen = answers[currentQ]; const total = quiz.questions.length;
    return (
      <div className="flex flex-col items-center px-4 pt-6 pb-8 min-h-screen" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif" }}>
        <div className="w-full max-w-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--yellow)" }}>Quiz · Revisão de Aula</p>
              <h2 className="font-bold text-white text-base mt-0.5">{quiz.title}</h2>
            </div>
            <span className="text-sm font-bold" style={{ color: "var(--gray)" }}>{currentQ + 1}/{total}</span>
          </div>
          <div className="w-full h-1.5 rounded-full mb-6" style={{ background: "var(--dark2)" }}>
            <div className="h-1.5 rounded-full transition-all duration-500" style={{ background: "var(--yellow)", width: `${(currentQ / total) * 100}%` }} />
          </div>
          <div className="mb-5 px-4 py-4 rounded-2xl" style={{ background: "var(--dark1)", border: "1px solid #1f1f1f" }}>
            <p className="text-white text-sm leading-relaxed font-medium">{q.question}</p>
          </div>
          <div className="flex flex-col gap-3 mb-5">
            {q.options.map((opt, i) => {
              let bg = "var(--dark1)", border = "1px solid #2a2a2a", color = "#fff";
              if (chosen !== null) {
                if (i === q.correct) { bg = "rgba(74,222,128,.12)"; border = "1px solid #4ade80"; color = "#4ade80"; }
                else if (i === chosen) { bg = "rgba(248,113,113,.12)"; border = "1px solid #f87171"; color = "#f87171"; }
                else { color = "var(--gray)"; }
              }
              return (
                <button key={i} onClick={() => selectAnswer(i)} disabled={chosen !== null} style={{ background: bg, border, color, borderRadius: 12, padding: ".75rem 1rem", fontSize: ".875rem", fontWeight: 500, textAlign: "left", cursor: chosen !== null ? "default" : "pointer", transition: "all .15s" }}>
                  <span style={{ fontWeight: 700, opacity: .5, marginRight: 8 }}>{["A","B","C","D"][i]}</span>{opt}
                </button>
              );
            })}
          </div>
          {showExplanation && (
            <div style={{ padding: ".875rem 1rem", borderRadius: 12, marginBottom: "1rem", background: chosen === q.correct ? "rgba(74,222,128,.08)" : "rgba(248,113,113,.08)", border: chosen === q.correct ? "1px solid rgba(74,222,128,.25)" : "1px solid rgba(248,113,113,.25)" }}>
              <p style={{ fontWeight: 700, marginBottom: ".25rem", color: chosen === q.correct ? "#4ade80" : "#f87171" }}>{chosen === q.correct ? "✓ Correto!" : "✗ Quase lá!"}</p>
              <p style={{ color: "var(--gray)", fontSize: ".85rem" }}>{q.explanation}</p>
            </div>
          )}
          {chosen !== null && (
            <button onClick={nextQuestion} style={{ width: "100%", padding: ".875rem", borderRadius: 12, background: "var(--yellow)", color: "var(--black)", fontWeight: 700, fontSize: ".9rem", border: "none", cursor: "pointer" }}>
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
      <div className="flex flex-col items-center justify-center px-4 py-10 min-h-screen" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif" }}>
        <div className="w-full max-w-lg flex flex-col items-center gap-5 text-center">
          <div style={{ fontSize: "3rem" }}>{emoji}</div>
          <div>
            <p style={{ fontSize: "3rem", fontWeight: 900, color: scoreColor }}>{pct}%</p>
            <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", marginTop: 4 }}>{score}/{total} corretas</p>
          </div>
          <p style={{ color: "var(--gray)", fontSize: ".875rem" }}>{msg}</p>
          <div className="w-full flex flex-col gap-2 mt-1">
            {quiz.questions.map((q, i) => {
              const correct = answers[i] === q.correct;
              return (
                <div key={i} style={{ textAlign: "left", padding: ".875rem 1rem", borderRadius: 12, background: "var(--dark1)", border: `1px solid ${correct ? "rgba(74,222,128,.2)" : "rgba(248,113,113,.2)"}` }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ color: correct ? "#4ade80" : "#f87171", fontWeight: 700 }}>{correct ? "✓" : "✗"}</span>
                    <div>
                      <p style={{ fontWeight: 500, color: "#fff", fontSize: ".875rem" }}>{q.question}</p>
                      <p style={{ fontSize: ".78rem", color: "var(--gray)", marginTop: 2 }}>Correto: <span style={{ color: "#4ade80" }}>{q.options[q.correct]}</span></p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 10, width: "100%", marginTop: ".5rem" }}>
            <button onClick={() => router.push("/app/progresso")} style={{ flex: 1, padding: ".875rem", borderRadius: 12, background: "var(--dark2)", color: "var(--gray)", fontWeight: 700, fontSize: ".875rem", border: "1px solid #2a2a2a", cursor: "pointer" }}>Ver progresso</button>
            <button onClick={resetChat} style={{ flex: 1, padding: ".875rem", borderRadius: 12, background: "var(--yellow)", color: "var(--black)", fontWeight: 700, fontSize: ".875rem", border: "none", cursor: "pointer" }}>Nova aula</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Chat Layout — same shell as conversar ────────────────────────────
  return (
    <div
      className="flex flex-col items-center px-3 pt-3 pb-4 sm:px-4 sm:pt-4 sm:pb-6"
      style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", height: "100dvh", overflow: "hidden" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="w-full max-w-2xl mb-3 flex items-center justify-between gap-2" style={{ position: "relative" }}>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => router.push("/app")}
            style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: 10, height: 36, padding: "0 10px", display: "flex", alignItems: "center", gap: 5, fontSize: ".75rem", fontWeight: 600, color: "var(--gray)", cursor: "pointer" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="hidden sm:inline">Início</span>
          </button>
          <a href="/app" title="Início" style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: 10, height: 36, width: 36, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>
          </a>
          {fileName && messages.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(245,200,0,.1)", border: "1px solid rgba(245,200,0,.25)", borderRadius: 8, padding: "4px 10px", maxWidth: 140, overflow: "hidden" }}>
              <span style={{ fontSize: ".75rem" }}>📄</span>
              <span style={{ fontSize: ".68rem", fontWeight: 600, color: "var(--yellow)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fileName}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {messages.length >= 2 && (
            <>
              <button onClick={generateFlashcards} className="hidden sm:flex items-center" style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: 10, height: 36, padding: "0 14px", fontSize: ".75rem", fontWeight: 700, color: "#fff", cursor: "pointer", gap: 6, whiteSpace: "nowrap" }}>
                🃏 Flashcards
              </button>
              <button onClick={generateQuiz} style={{ background: "var(--yellow)", border: "none", borderRadius: 10, height: 36, padding: "0 14px", fontSize: ".75rem", fontWeight: 700, color: "var(--black)", cursor: "pointer", whiteSpace: "nowrap" }}>
                🎯 Quiz
              </button>
            </>
          )}

          <a href="/planos" style={{ fontSize: ".78rem", fontWeight: 700, color: "var(--yellow)", border: "1px solid rgba(245,200,0,.35)", borderRadius: "50px", padding: ".3rem .8rem", textDecoration: "none", whiteSpace: "nowrap" }}>
            Planos
          </a>

          <button onClick={() => setMobileMenuOpen((v) => !v)} className="flex sm:hidden" style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: 10, height: 36, width: 36, alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            {mobileMenuOpen
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray)" strokeWidth="2.5" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            }
          </button>

          <div style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
            <UserButton />
            <span style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)", fontSize: "0.52rem", fontWeight: 800, background: "linear-gradient(135deg,#f5c800,#e0a800)", color: "#000", padding: "1px 5px", borderRadius: "50px", whiteSpace: "nowrap", lineHeight: 1.4, pointerEvents: "none" }}>PRO</span>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="flex sm:hidden" style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "var(--dark1)", border: "1px solid #2a2a2a", borderRadius: 14, padding: ".5rem", flexDirection: "column", gap: ".35rem", zIndex: 50, minWidth: 200, boxShadow: "0 8px 32px rgba(0,0,0,.5)" }}>
            {messages.length >= 2 && (
              <button onClick={() => { generateFlashcards(); setMobileMenuOpen(false); }} style={{ background: "transparent", border: "none", borderRadius: 10, height: 42, display: "flex", alignItems: "center", gap: 10, padding: "0 12px", cursor: "pointer", width: "100%" }}>
                <span style={{ fontSize: "1rem", width: 24, textAlign: "center" }}>🃏</span>
                <span style={{ fontSize: ".85rem", fontWeight: 600, color: "var(--gray)" }}>Criar Flashcards</span>
              </button>
            )}
            {messages.length > 0 && (
              <button onClick={() => { resetChat(); setMobileMenuOpen(false); }} style={{ background: "transparent", border: "none", borderRadius: 10, height: 42, display: "flex", alignItems: "center", gap: 10, padding: "0 12px", cursor: "pointer", width: "100%" }}>
                <span style={{ fontSize: "1rem", width: 24, textAlign: "center" }}>📄</span>
                <span style={{ fontSize: ".85rem", fontWeight: 600, color: "var(--gray)" }}>Nova aula</span>
              </button>
            )}
          </div>
        )}
      </header>

      {/* ── Chat area ──────────────────────────────────────────────────────── */}
      <div
        className="w-full max-w-2xl flex-1 min-h-0 p-3 sm:p-4 mb-3 overflow-y-auto"
        style={{ background: "var(--dark1)", border: "1px solid #1f1f1f", borderRadius: "var(--radius, 20px)", boxShadow: "var(--shadow)" }}
        onDragOver={(e) => { e.preventDefault(); if (!messages.length) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f && !messages.length) processFile(f); }}
      >
        {/* Empty state — PDF upload */}
        {messages.length === 0 && !loadingPdf && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <div style={{ textAlign: "center", width: "100%", maxWidth: 380 }}>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{ border: `2px dashed ${dragging ? "var(--yellow)" : "#2a2a2a"}`, borderRadius: 18, padding: "2.5rem 1.5rem", cursor: "pointer", transition: "border-color .2s, background .2s", background: dragging ? "rgba(245,200,0,.04)" : "transparent" }}
              >
                <div style={{ fontSize: "2rem", marginBottom: ".6rem" }}>📎</div>
                <p style={{ fontWeight: 700, color: "#fff", marginBottom: ".35rem", fontSize: ".9rem" }}>Clique ou arraste o PDF da aula aqui</p>
                <p style={{ color: "var(--gray)", fontSize: ".78rem" }}>O JV IA vai resumir a aula e você pode tirar dúvidas</p>
                <input ref={fileInputRef} type="file" accept="application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} style={{ display: "none" }} />
              </div>
              {error && <p style={{ color: "#f87171", marginTop: ".75rem", fontSize: ".82rem" }}>{error}</p>}
            </div>
          </div>
        )}

        {/* Loading PDF */}
        {loadingPdf && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
            <div style={{ display: "flex", gap: 6 }}>{[0,150,300].map((d) => <span key={d} style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--yellow)", display: "inline-block", animation: "bounce 0.8s infinite", animationDelay: `${d}ms` }} />)}</div>
            <p style={{ color: "var(--gray)", fontSize: ".88rem" }}>Analisando <strong style={{ color: "#fff" }}>{fileName}</strong>…</p>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div key={i} className={`mb-3 flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-2`}>
            {msg.role === "assistant" && (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--yellow)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".75rem", flexShrink: 0 }}>🎓</div>
            )}
            <div style={{ maxWidth: "80%", padding: "10px 13px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: msg.role === "user" ? "var(--yellow)" : "var(--dark2)", color: msg.role === "user" ? "#000" : "#fff", fontSize: ".875rem", lineHeight: 1.6 }}>
              <p style={{ whiteSpace: "pre-wrap" }}>{msg.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start mb-3">
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--yellow)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".75rem", flexShrink: 0, marginRight: 8 }}>🎓</div>
            <div style={{ background: "var(--dark2)", borderRadius: "18px 18px 18px 4px", padding: "10px 13px", display: "flex", gap: 5, alignItems: "center" }}>
              {[0,150,300].map((d) => <span key={d} style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--yellow)", display: "inline-block", animation: "bounce 0.8s infinite", animationDelay: `${d}ms` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ──────────────────────────────────────────────────────────── */}
      <div className="w-full max-w-2xl flex flex-col gap-1">
        {micError && (
          <p style={{ color: "#f87171", fontSize: ".78rem", padding: "0 4px" }}>{micError}</p>
        )}
        <div className="flex gap-2 items-center">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={messages.length === 0 ? "Envie o PDF acima para começar..." : isListening ? "Gravando..." : isTranscribing ? "Transcrevendo..." : "Pergunte sobre a aula..."}
            disabled={isLoading || messages.length === 0 || isListening || isTranscribing}
            style={{ flex: 1, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 14, padding: ".75rem 1rem", fontSize: ".9rem", color: "#fff", outline: "none", fontFamily: "'Inter', sans-serif", opacity: messages.length === 0 ? 0.5 : 1 }}
          />
          {/* Mic button */}
          <button
            onClick={() => { if (messages.length === 0) return; setMicError(""); isListening ? stopListening() : startListening(); }}
            disabled={isLoading || isTranscribing}
            title={messages.length === 0 ? "Envie o PDF primeiro" : isListening ? "Parar gravação" : "Gravar áudio"}
            style={{
              width: 44, height: 44, borderRadius: 12, border: "none",
              cursor: messages.length === 0 || isLoading || isTranscribing ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background .15s",
              background: isListening ? "#f87171" : "var(--dark2)",
              opacity: messages.length === 0 ? 0.4 : 1,
            }}
          >
            {isTranscribing ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            ) : isListening ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={messages.length === 0 ? "var(--gray)" : "var(--gray)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            )}
          </button>
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim() || messages.length === 0}
            style={{ width: 44, height: 44, borderRadius: 12, background: input.trim() && !isLoading && messages.length > 0 ? "var(--yellow)" : "#1a1a1a", border: "none", cursor: input.trim() && !isLoading && messages.length > 0 ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background .15s" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke={input.trim() && !isLoading && messages.length > 0 ? "var(--black)" : "var(--gray)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={input.trim() && !isLoading && messages.length > 0 ? "var(--black)" : "var(--gray)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>

      <BottomNavFlex className="-mx-3 sm:mx-auto w-full sm:max-w-2xl mt-4" />
    </div>
  );
}
