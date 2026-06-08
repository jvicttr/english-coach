"use client";

import { useState, useRef, useEffect } from "react";
import { UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

type Correction = { wrong: string; right: string; phonetic: string; wrongSentence?: string; rightSentence?: string };
type Message = { role: "user" | "assistant"; content: string; translation?: string; correction?: Correction };
type Level = "beginner" | "intermediate" | "advanced" | null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;

type QuizQuestion = {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};

type Quiz = {
  title: string;
  questions: QuizQuestion[];
};

type AppScreen = "chat" | "loading-quiz" | "quiz" | "result";

const LEVEL_LABEL: Record<NonNullable<Level>, string> = {
  beginner: "Básico",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

export default function Home() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [level, setLevel] = useState<Level>(null);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [micError, setMicError] = useState("");
  const [pendingSpeak, setPendingSpeak] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [isPro, setIsPro] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("userPlan") === "pro";
  });

  // Quiz state
  const [screen, setScreen] = useState<AppScreen>("chat");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizSessionId, setQuizSessionId] = useState<string | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const recognitionRef = useRef<AnySpeechRecognition>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((d) => {
      const pro = d.plan === "pro";
      setIsPro(pro);
      localStorage.setItem("userPlan", d.plan ?? "free");
    });
  }, []);

  function stripEmojis(text: string): string {
    return text
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
      .replace(/[\u{2600}-\u{27BF}]/gu, "")
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);

  function unlockAudio() {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    const audio = new Audio();
    audioRef.current = audio;
    audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    audio.play().then(() => { audio.pause(); audio.currentTime = 0; }).catch(() => {});
  }

  // Splits message into segments: { text, lang }
  // Removes 🗣️ lines entirely; for 💬 lines, reads English part with "en" and PT part with "pt"
  function splitSpeechSegments(text: string): { text: string; lang: "en" | "pt" }[] {
    const segments: { text: string; lang: "en" | "pt" }[] = [];
    const lines = text.split("\n");
    const enLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip pronunciation hints entirely
      if (trimmed.startsWith("🗣️")) continue;

      // 💬 correction: "We don't say X, we say Y! English explanation. / Explicação em português."
      if (trimmed.startsWith("💬")) {
        const slashIdx = trimmed.indexOf(" / ");
        if (slashIdx !== -1) {
          const enPart = trimmed.slice(0, slashIdx).replace(/^💬\s*/, "").trim();
          const ptPart = trimmed.slice(slashIdx + 3).trim();
          if (enLines.length > 0) {
            segments.push({ text: enLines.join(" ").trim(), lang: "en" });
            enLines.length = 0;
          }
          if (enPart) segments.push({ text: enPart, lang: "en" });
          if (ptPart) segments.push({ text: ptPart, lang: "pt" });
        } else {
          enLines.push(trimmed.replace(/^💬\s*/, ""));
        }
        continue;
      }

      enLines.push(trimmed);
    }

    if (enLines.length > 0) {
      const joined = enLines.join(" ").trim();
      if (joined) segments.push({ text: joined, lang: "en" });
    }

    return segments.filter((s) => s.text.length > 0);
  }

  // Check if MediaSource streaming is supported (not on iOS Safari)
  function supportsMediaSourceAudio(): boolean {
    if (typeof MediaSource === "undefined") return false;
    // iOS Safari reports MediaSource but doesn't support audio/mpeg streaming
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as Record<string, unknown>).MSStream;
    if (isIOS) return false;
    return MediaSource.isTypeSupported("audio/mpeg");
  }

  // Streaming playback: starts playing as first chunks arrive (~300-500ms faster)
  function playStream(res: Response): Promise<boolean> {
    return new Promise((resolve) => {
      const mediaSource = new MediaSource();
      const url = URL.createObjectURL(mediaSource);
      const player = audioRef.current ?? new Audio();
      audioRef.current = player;
      player.src = url;

      mediaSource.addEventListener("sourceopen", async () => {
        URL.revokeObjectURL(url);
        let sourceBuffer: SourceBuffer;
        try {
          sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
        } catch {
          resolve(false);
          return;
        }

        const queue: ArrayBuffer[] = [];
        let appending = false;
        let streamDone = false;

        function appendNext() {
          if (appending || queue.length === 0) return;
          appending = true;
          sourceBuffer.appendBuffer(queue.shift()!);
        }

        sourceBuffer.addEventListener("updateend", () => {
          appending = false;
          if (queue.length > 0) {
            appendNext();
          } else if (streamDone && mediaSource.readyState === "open") {
            mediaSource.endOfStream();
          }
        });

        // Start playing as soon as enough data is buffered
        player.oncanplay = () => { player.play().catch(() => {}); };
        player.onended = () => resolve(true);
        player.onerror = () => resolve(false);

        try {
          const reader = res.body!.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) { streamDone = true; if (!appending && queue.length === 0 && mediaSource.readyState === "open") mediaSource.endOfStream(); break; }
            if (value) { queue.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)); appendNext(); }
          }
        } catch {
          resolve(false);
        }
      }, { once: true });

      player.play().catch(() => {});
    });
  }

  // Fallback: wait for full blob (iOS Safari)
  async function playBlob(res: Response): Promise<boolean> {
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    return new Promise((resolve) => {
      const player = audioRef.current ?? new Audio();
      audioRef.current = player;
      player.src = url;
      player.onended = () => { URL.revokeObjectURL(url); resolve(true); };
      player.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
      player.play().catch(() => { URL.revokeObjectURL(url); resolve(false); });
    });
  }

  async function fetchAudioUrl(text: string, lang: "en" | "pt", speed: number): Promise<string | null> {
    const clean = stripEmojis(text);
    if (!clean) return null;
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean, speed, lang }),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  async function fetchAndPlay(text: string, lang: "en" | "pt", speed: number): Promise<boolean> {
    const clean = stripEmojis(text);
    if (!clean) return true;
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean, speed, lang }),
    });
    if (!res.ok) return false;
    if (supportsMediaSourceAudio()) return playStream(res);
    return playBlob(res);
  }

  function playUrl(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      const player = audioRef.current ?? new Audio();
      audioRef.current = player;
      player.src = url;
      player.onended = () => { URL.revokeObjectURL(url); resolve(true); };
      player.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
      player.play().catch(() => { URL.revokeObjectURL(url); resolve(false); });
    });
  }

  async function speak(text: string, slow = false) {
    const audio = audioRef.current;
    if (audio && !audio.paused) audio.pause();

    const speed = slow ? 0.4 : level === "beginner" ? 0.85 : level === "advanced" ? 1.05 : 1.0;
    const segments = splitSpeechSegments(text);
    if (segments.length === 0) return;

    setIsSpeaking(true);
    setPendingSpeak(null);
    try {
      for (const seg of segments) {
        const ok = await fetchAndPlay(seg.text, seg.lang, speed);
        if (!ok) { setPendingSpeak(text); return; }
      }
    } finally {
      setIsSpeaking(false);
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return;
    unlockAudio();
    const userMessage: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages, level }),
      });
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Ops, tive um problema. Tente enviar de novo!" }]);
        return;
      }
      const data = await res.json();
      if (data.limitReached) { setLimitReached(true); setMessages((prev) => prev.slice(0, -1)); return; }
      if (!data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Ops, não consegui responder. Tente de novo!" }]);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply, translation: data.translation ?? undefined, correction: data.correction ?? undefined }]);
      if (data.detectedLevel) setLevel(data.detectedLevel as Level);
      speak(data.reply);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Erro de conexão. Verifique sua internet e tente novamente." }]);
    } finally {
      setIsLoading(false);
    }
  }

  async function endConversation() {
    if (messages.length < 2) return;
    setScreen("loading-quiz");
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, level }),
      });
      const data = await res.json();
      if (data.quiz) {
        setQuiz(data.quiz);
        setQuizSessionId(data.sessionId ?? null);
        setAnswers(new Array(data.quiz.questions.length).fill(null));
        setCurrentQ(0);
        setShowExplanation(false);
        setScore(0);
        setScreen("quiz");
      } else {
        setScreen("chat");
        setMicError("Não foi possível gerar o quiz. Tente novamente!");
      }
    } catch {
      setScreen("chat");
      setMicError("Erro ao gerar o quiz. Verifique sua conexão e tente novamente.");
    }
  }

  function selectAnswer(optionIndex: number) {
    if (answers[currentQ] !== null) return;
    const newAnswers = [...answers];
    newAnswers[currentQ] = optionIndex;
    setAnswers(newAnswers);
    setShowExplanation(true);
  }

  async function nextQuestion() {
    setShowExplanation(false);
    if (currentQ + 1 < (quiz?.questions.length ?? 0)) {
      setCurrentQ(currentQ + 1);
    } else {
      // Calculate score and finish
      const finalScore = answers.reduce<number>((acc, a, i) => {
        return acc + (a === quiz!.questions[i].correct ? 1 : 0);
      }, 0);
      setScore(finalScore);
      setScreen("result");
      // Save to Supabase
      if (quizSessionId) {
        await fetch("/api/quiz", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: quizSessionId, score: finalScore, answers }),
        });
      }
    }
  }

  function restartChat() {
    setMessages([]);
    setInput("");
    setLevel(null);
    setQuiz(null);
    setQuizSessionId(null);
    setAnswers([]);
    setCurrentQ(0);
    setShowExplanation(false);
    setScore(0);
    setScreen("chat");
  }

  async function startListening() {
    setMicError("");
    unlockAudio();
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsSpeaking(false);
    }

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
          sendMessage(data.transcript);
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

  // ── Loading Quiz Screen ──────────────────────────────────────────────────
  if (screen === "loading-quiz") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif" }}>
        <div className="flex gap-1.5">
          {[0, 150, 300].map((d) => (
            <span key={d} className="w-3 h-3 rounded-full animate-bounce" style={{ background: "var(--yellow)", animationDelay: `${d}ms` }} />
          ))}
        </div>
        <p className="text-sm font-medium" style={{ color: "var(--gray)" }}>Gerando seu quiz personalizado...</p>
      </div>
    );
  }

  // ── Quiz Screen ──────────────────────────────────────────────────────────
  if (screen === "quiz" && quiz) {
    const q = quiz.questions[currentQ];
    const chosen = answers[currentQ];
    const total = quiz.questions.length;

    return (
      <div className="flex flex-col items-center px-4 pt-6 pb-8 min-h-screen" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif" }}>
        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--yellow)" }}>Quiz</p>
              <h2 className="font-bold text-white text-base mt-0.5">{quiz.title}</h2>
            </div>
            <span className="text-sm font-bold" style={{ color: "var(--gray)" }}>{currentQ + 1}/{total}</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 rounded-full mb-6" style={{ background: "var(--dark2)" }}>
            <div
              className="h-1.5 rounded-full transition-all duration-500"
              style={{ background: "var(--yellow)", width: `${((currentQ) / total) * 100}%` }}
            />
          </div>

          {/* Question */}
          <div className="mb-6 px-4 py-4 rounded-2xl" style={{ background: "var(--dark1)", border: "1px solid #1f1f1f" }}>
            <p className="text-white text-sm leading-relaxed font-medium">{q.question}</p>
          </div>

          {/* Options */}
          <div className="flex flex-col gap-3 mb-6">
            {q.options.map((opt, i) => {
              let bg = "var(--dark1)";
              let border = "1px solid #2a2a2a";
              let color = "var(--white)";

              if (chosen !== null) {
                if (i === q.correct) { bg = "rgba(74,222,128,0.12)"; border = "1px solid #4ade80"; color = "#4ade80"; }
                else if (i === chosen && chosen !== q.correct) { bg = "rgba(248,113,113,0.12)"; border = "1px solid #f87171"; color = "#f87171"; }
                else { color = "var(--gray)"; }
              }

              return (
                <button
                  key={i}
                  onClick={() => selectAnswer(i)}
                  disabled={chosen !== null}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all"
                  style={{ background: bg, border, color, cursor: chosen !== null ? "default" : "pointer" }}
                >
                  <span className="font-bold mr-2" style={{ opacity: 0.5 }}>{["A", "B", "C", "D"][i]}</span>
                  {opt}
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {showExplanation && (
            <div className="mb-5 px-4 py-3 rounded-xl text-sm" style={{ background: chosen === q.correct ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)", border: chosen === q.correct ? "1px solid rgba(74,222,128,0.25)" : "1px solid rgba(248,113,113,0.25)" }}>
              <p className="font-bold mb-1" style={{ color: chosen === q.correct ? "#4ade80" : "#f87171" }}>
                {chosen === q.correct ? "✓ Correto!" : "✗ Quase lá!"}
              </p>
              <p style={{ color: "var(--gray)" }}>{q.explanation}</p>
            </div>
          )}

          {/* Next button */}
          {chosen !== null && (
            <button
              onClick={nextQuestion}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all"
              style={{ background: "var(--yellow)", color: "var(--black)" }}
            >
              {currentQ + 1 < total ? "Próxima →" : "Ver resultado →"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Result Screen ────────────────────────────────────────────────────────
  if (screen === "result" && quiz) {
    const total = quiz.questions.length;
    const pct = Math.round((score / total) * 100);
    const emoji = pct >= 80 ? "🏆" : pct >= 60 ? "💪" : "📚";
    const msg = pct >= 80 ? "Excelente! Você dominou essa conversa." : pct >= 60 ? "Bom trabalho! Continue praticando." : "Continue assim! Cada conversa te deixa melhor.";
    const scoreColor = pct >= 80 ? "#4ade80" : pct >= 60 ? "var(--yellow)" : "#f87171";

    return (
      <div className="flex flex-col items-center justify-center px-4 pt-6 pb-8 min-h-screen" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif" }}>
        <div className="w-full max-w-lg flex flex-col items-center text-center gap-5">
          <div className="text-5xl">{emoji}</div>
          <div>
            <p className="font-black text-5xl" style={{ color: scoreColor }}>{pct}%</p>
            <p className="text-lg font-bold text-white mt-1">{score}/{total} corretas</p>
          </div>
          <p className="text-sm" style={{ color: "var(--gray)" }}>{msg}</p>

          {/* Review answers */}
          <div className="w-full flex flex-col gap-2 mt-2">
            {quiz.questions.map((q, i) => {
              const correct = answers[i] === q.correct;
              return (
                <div key={i} className="text-left px-4 py-3 rounded-xl text-sm" style={{ background: "var(--dark1)", border: `1px solid ${correct ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}` }}>
                  <div className="flex items-start gap-2">
                    <span>{correct ? "✓" : "✗"}</span>
                    <div>
                      <p className="font-medium text-white">{q.question}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--gray)" }}>
                        Resposta correta: <span style={{ color: "#4ade80" }}>{q.options[q.correct]}</span>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 w-full mt-2">
            <button
              onClick={() => router.push("/app/historico")}
              className="flex-1 py-3 rounded-xl font-bold text-sm"
              style={{ background: "var(--dark2)", color: "var(--gray)", border: "1px solid #2a2a2a" }}
            >
              Ver histórico
            </button>
            <button
              onClick={restartChat}
              className="flex-1 py-3 rounded-xl font-bold text-sm"
              style={{ background: "var(--yellow)", color: "var(--black)" }}
            >
              Nova conversa
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Chat Screen ──────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col items-center px-3 pt-3 pb-4 sm:px-4 sm:pt-4 sm:pb-6"
      style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", height: "100dvh", overflow: "hidden" }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="w-full max-w-2xl mb-3 flex items-center justify-between gap-2">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0" style={{ background: "var(--yellow)", color: "var(--black)" }}>
            JV
          </div>
          <span className="font-bold text-white text-sm leading-none">
            Fale Inglês <span style={{ color: "var(--yellow)" }}>JV</span>
          </span>
        </div>

        {/* Ações — direita */}
        <div className="flex items-center gap-2 shrink-0">
          {isPro && (
            <span style={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.5px", background: "linear-gradient(135deg, #f5c800, #e0a800)", color: "#000", padding: "3px 8px", borderRadius: "50px", boxShadow: "0 0 8px rgba(245,200,0,0.4)" }}>
              PRO
            </span>
          )}
          <button
            onClick={() => router.push("/app/historico")}
            title="Histórico de quizzes"
            style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", cursor: "pointer" }}
          >
            🏆
          </button>

          <a
            href="/planos"
            style={{ fontSize: ".78rem", fontWeight: 700, color: "var(--yellow)", border: "1px solid rgba(245,200,0,.35)", borderRadius: "50px", padding: ".3rem .8rem", textDecoration: "none", whiteSpace: "nowrap" }}
          >
            Planos
          </a>

          <UserButton />
        </div>
      </header>

      {/* ── Chat area ──────────────────────────────────────── */}
      <div
        className="w-full max-w-2xl flex-1 min-h-0 p-3 sm:p-4 mb-3 overflow-y-auto"
        style={{ background: "var(--dark1)", border: "1px solid #1f1f1f", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-6 gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl" style={{ background: "var(--yellow)", color: "var(--black)" }}>JV</div>
            <div>
              <p className="font-semibold text-white">Pronto para praticar!</p>
              <p className="text-sm mt-1 max-w-xs" style={{ color: "var(--gray)" }}>
                Use o microfone para falar em inglês ou escreva uma mensagem.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`mb-3 flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-2`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 mb-0.5" style={{ background: "var(--yellow)", color: "var(--black)" }}>JV</div>
            )}
            <div
              className="max-w-[82%] sm:max-w-[78%] px-3 sm:px-4 py-2.5 text-sm leading-relaxed"
              style={
                msg.role === "user"
                  ? { background: "var(--yellow)", color: "var(--black)", borderRadius: "18px 18px 4px 18px", fontWeight: 500 }
                  : { background: "var(--dark2)", color: "var(--white)", borderRadius: "18px 18px 18px 4px", border: "1px solid #2a2a2a" }
              }
            >
              {msg.content}
              {msg.role === "assistant" && msg.translation && (
                <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.08)", color: "var(--gray)", fontSize: "0.78rem", fontStyle: "italic" }}>
                  🇧🇷 {msg.translation}
                </div>
              )}
              {msg.role === "assistant" && msg.correction && (() => {
                const c = msg.correction;
                // Highlight wrong/right part within the full sentence
                function highlight(sentence: string, part: string, color: string) {
                  if (!sentence) return <span style={{ color }}>{part}</span>;
                  const idx = sentence.toLowerCase().indexOf(part.toLowerCase());
                  if (idx === -1) return <span>{sentence}</span>;
                  return (
                    <>
                      {sentence.slice(0, idx)}
                      <span style={{ color, fontWeight: 700 }}>{sentence.slice(idx, idx + part.length)}</span>
                      {sentence.slice(idx + part.length)}
                    </>
                  );
                }
                return (
                  <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--gray)", marginBottom: "2px" }}>Correção</div>
                    <div style={{ fontSize: "0.8rem", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "8px", padding: "5px 10px", lineHeight: 1.5 }}>
                      ❌ {highlight(c.wrongSentence ?? c.wrong, c.wrong, "#f87171")}
                    </div>
                    <div style={{ fontSize: "0.8rem", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: "8px", padding: "5px 10px", lineHeight: 1.5 }}>
                      ✅ {highlight(c.rightSentence ?? c.right, c.right, "#4ade80")}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--gray)", fontStyle: "italic", paddingLeft: "4px" }}>
                      🗣️ {c.phonetic}
                    </div>
                  </div>
                );
              })()}
              {msg.role === "assistant" && (
                <div style={{ marginTop: "8px", display: "flex", gap: "6px" }}>
                  <button
                    onClick={() => speak(msg.content)}
                    disabled={isSpeaking || isLoading}
                    title="Ouvir novamente"
                    style={{ background: "transparent", border: "1px solid #3a3a3a", borderRadius: "50px", padding: "2px 10px", fontSize: "0.72rem", color: "var(--gray)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", opacity: isSpeaking || isLoading ? 0.4 : 1 }}
                  >
                    🔊 Ouvir
                  </button>
                  <button
                    onClick={() => speak(msg.content, true)}
                    disabled={isSpeaking || isLoading}
                    title="Repetir devagar"
                    style={{ background: "transparent", border: "1px solid #3a3a3a", borderRadius: "50px", padding: "2px 10px", fontSize: "0.72rem", color: "var(--gray)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", opacity: isSpeaking || isLoading ? 0.4 : 1 }}
                  >
                    🐢 Devagar
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-end gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0" style={{ background: "var(--yellow)", color: "var(--black)" }}>JV</div>
            <div className="px-4 py-3 text-sm" style={{ background: "var(--dark2)", borderRadius: "18px 18px 18px 4px", border: "1px solid #2a2a2a" }}>
              <span className="flex gap-1 items-center">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--yellow)", animationDelay: `${d}ms` }} />
                ))}
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Áudio bloqueado ────────────────────────────────── */}
      {pendingSpeak && !isSpeaking && (
        <div className="w-full max-w-2xl mb-2">
          <button
            onClick={() => { const t = pendingSpeak; setPendingSpeak(null); speak(t); }}
            className="w-full py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "rgba(245,200,0,0.1)", border: "1px solid rgba(245,200,0,0.35)", color: "var(--yellow)" }}
          >
            🔊 Toque para ouvir a resposta
          </button>
        </div>
      )}

      {/* ── Encerrar conversa ──────────────────────────────── */}
      {messages.length >= 2 && !limitReached && (
        <div className="w-full max-w-2xl mb-2">
          <button
            onClick={endConversation}
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
            style={{ background: "transparent", border: "1px solid rgba(245,200,0,0.3)", color: "var(--yellow)" }}
          >
            🎯 Encerrar conversa e fazer quiz
          </button>
        </div>
      )}

      {/* ── Limite diário ─────────────────────────────────── */}
      {limitReached && (
        <div className="w-full max-w-2xl mb-3 px-4 py-5 flex flex-col items-center gap-3 text-center" style={{ background: "var(--dark2)", border: "1px solid rgba(245,200,0,.3)", borderRadius: "var(--radius)" }}>
          <div className="text-2xl">🎯</div>
          <div>
            <p className="font-bold text-white text-sm">Você usou suas 10 mensagens de hoje</p>
            <p className="text-xs mt-1" style={{ color: "var(--gray)" }}>Assine o Coach IA por R$ 47/mês e pratique sem limites todos os dias.</p>
          </div>
          <a href="/planos" className="px-5 py-2 rounded-full text-sm font-bold transition-all" style={{ background: "var(--yellow)", color: "var(--black)" }}>
            Assinar Coach IA — R$ 47/mês
          </a>
        </div>
      )}

      {/* ── Mic error ──────────────────────────────────────── */}
      {micError && (
        <div className="w-full max-w-2xl mb-3 px-3 sm:px-4 py-2.5 flex gap-2 items-start text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius)" }}>
          <span>🎙️</span>
          <span style={{ color: "#fca5a5" }}>{micError}</span>
          <button onClick={() => setMicError("")} className="ml-auto text-xs shrink-0" style={{ color: "var(--gray2)" }}>✕</button>
        </div>
      )}

      {/* ── Input ──────────────────────────────────────────── */}
      <div className="-mx-3 sm:mx-auto w-full sm:max-w-2xl flex gap-2 items-end px-3 sm:px-0 pb-1 sm:pb-0" style={{ background: "var(--black)" }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
          placeholder="Digite aqui..."
          rows={1}
          className="flex-1 resize-none outline-none transition"
          style={{ background: "var(--dark1)", color: "var(--white)", border: "1px solid #2a2a2a", borderRadius: "var(--radius)", padding: "12px 16px", fontFamily: "'Inter', sans-serif", fontSize: "16px" }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--yellow)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
        />

        <button
          onClick={isListening ? stopListening : startListening}
          disabled={isLoading || isSpeaking || isTranscribing || limitReached}
          title={isListening ? "Clique para parar e enviar" : "Clique para falar"}
          className="w-12 h-12 flex items-center justify-center transition-all shrink-0 disabled:opacity-40"
          style={{ background: isListening ? "#ef4444" : isTranscribing ? "var(--dark2)" : "var(--yellow)", borderRadius: "var(--radius)", boxShadow: isListening ? "0 0 20px rgba(239,68,68,0.5)" : "none", transform: isListening ? "scale(1.08)" : "scale(1)" }}
        >
          {isTranscribing ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" style={{ color: "var(--yellow)" }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" style={{ color: isListening ? "white" : "var(--black)" }}>
              {isListening ? (
                <rect x="6" y="6" width="12" height="12" rx="2" />
              ) : (
                <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-7 9h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.93V21h2v2H9v-2h2v-2.07A7 7 0 0 1 5 12z" />
              )}
            </svg>
          )}
        </button>

        <button
          onClick={() => sendMessage(input)}
          disabled={isLoading || !input.trim() || limitReached}
          className="w-12 h-12 flex items-center justify-center transition-all shrink-0 disabled:opacity-40"
          style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "var(--radius)" }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--yellow)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m-7 7 7-7 7 7" />
          </svg>
        </button>
      </div>

      {/* ── Status ─────────────────────────────────────────── */}
      <div className="mt-1.5 h-3.5 text-[11px] text-center">
        {isListening
          ? <span style={{ color: "#ef4444" }}>● Gravando — toque em ⏹ para enviar</span>
          : isTranscribing
          ? <span style={{ color: "var(--yellow)" }}>● Reconhecendo sua voz...</span>
          : isSpeaking
          ? <span style={{ color: "var(--yellow)" }}>● Coach falando...</span>
          : <span style={{ color: "var(--gray2)", opacity: 0.6 }}>● Toque em 🎙️ para gravar sua voz</span>
        }
      </div>
    </div>
  );
}
