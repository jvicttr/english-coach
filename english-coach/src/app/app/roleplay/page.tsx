"use client";

import { useState, useRef, useEffect } from "react";
import { UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Image from "next/image";

type Correction = { wrong: string; right: string; phonetic: string; wrongSentence?: string; rightSentence?: string };
type CorrectionList = Correction[];
type Message = { role: "user" | "assistant"; content: string; translation?: string; correction?: Correction; corrections?: CorrectionList };
type Level = "beginner" | "intermediate" | "advanced" | null;
type AnySpeechRecognition = any; // eslint-disable-line @typescript-eslint/no-explicit-any
type AppScreen = "scenarios" | "chat" | "loading-quiz" | "loading-flashcards" | "quiz" | "result";

type QuizQuestion = { question: string; options: string[]; correct: number; explanation: string };
type Quiz = { title: string; questions: QuizQuestion[] };

type Scenario = {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  color: string;
};

const SCENARIOS: Scenario[] = [
  { id: "job_interview",  emoji: "💼", name: "Entrevista de Emprego", desc: "Responda perguntas como candidato",     color: "#60a5fa" },
  { id: "hotel",          emoji: "🏨", name: "Hotel — Check-in",     desc: "Faça o check-in em inglês",            color: "#a78bfa" },
  { id: "restaurant",     emoji: "🍽️", name: "Restaurante",          desc: "Peça comida e interaja com o garçom",  color: "#fb7185" },
  { id: "airport",        emoji: "✈️", name: "Aeroporto",            desc: "Check-in e embarque em inglês",        color: "#4ade80" },
  { id: "doctor",         emoji: "🏥", name: "Médico",               desc: "Consulta médica em inglês",            color: "#f87171" },
  { id: "shopping",       emoji: "🛍️", name: "Loja — Atendimento",   desc: "Compras e atendimento em inglês",      color: "#fbbf24" },
  { id: "phone_call",     emoji: "📞", name: "Ligação — Suporte",    desc: "Lide com suporte ao cliente",          color: "#34d399" },
  { id: "meeting",        emoji: "📋", name: "Reunião de Trabalho",  desc: "Participe de uma reunião em inglês",   color: "#f97316" },
];

export default function RolePlay() {
  const router = useRouter();
  const [screen, setScreen] = useState<AppScreen>("scenarios");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [visibleTranslations, setVisibleTranslations] = useState<Set<number>>(new Set());
  const [input, setInput] = useState("");
  const [level, setLevel] = useState<Level>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micError, setMicError] = useState("");
  const [pendingSpeak, setPendingSpeak] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizSessionId, setQuizSessionId] = useState<string | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const recognitionRef = useRef<AnySpeechRecognition>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((d) => {
      const pro = d.plan === "pro";
      setIsPro(pro);
      if (!pro) router.replace("/planos");
    });
  }, [router]);

  const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

  function getAudio(): HTMLAudioElement {
    if (!audioRef.current) audioRef.current = new Audio();
    return audioRef.current;
  }

  function unlockAudio() {
    const a = getAudio();
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    a.src = SILENT_WAV;
    a.play().then(() => a.pause()).catch(() => {});
  }

  function stripEmojis(text: string): string {
    return text.replace(/[\u{1F000}-\u{1FFFF}]/gu, "").replace(/[\u{2600}-\u{27BF}]/gu, "").replace(/[\u{1F300}-\u{1F9FF}]/gu, "").replace(/\s{2,}/g, " ").trim();
  }

  function supportsMediaSourceAudio(): boolean {
    if (typeof MediaSource === "undefined") return false;
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as Record<string, unknown>).MSStream;
    if (isIOS) return false;
    return MediaSource.isTypeSupported("audio/mpeg");
  }

  function playStream(res: Response): Promise<boolean> {
    return new Promise((resolve) => {
      let resolved = false;
      const done = (v: boolean) => { if (!resolved) { resolved = true; resolve(v); } };
      const timeout = setTimeout(() => done(false), 12000);
      const player = getAudio();
      if (!player.paused) player.pause();
      const mediaSource = new MediaSource();
      const url = URL.createObjectURL(mediaSource);
      player.src = url;
      player.play().catch(() => {});
      mediaSource.addEventListener("sourceopen", async () => {
        URL.revokeObjectURL(url);
        let sourceBuffer: SourceBuffer;
        try { sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg"); } catch { clearTimeout(timeout); done(false); return; }
        const queue: ArrayBuffer[] = [];
        let appending = false;
        let streamDone = false;
        function appendNext() { if (appending || queue.length === 0) return; appending = true; sourceBuffer.appendBuffer(queue.shift()!); }
        sourceBuffer.addEventListener("updateend", () => { appending = false; if (queue.length > 0) appendNext(); else if (streamDone && mediaSource.readyState === "open") mediaSource.endOfStream(); });
        player.onended = () => { clearTimeout(timeout); done(true); };
        player.onerror = () => { clearTimeout(timeout); done(false); };
        try {
          const reader = res.body!.getReader();
          while (true) {
            const { done: streamEnd, value } = await reader.read();
            if (streamEnd) { streamDone = true; if (!appending && queue.length === 0 && mediaSource.readyState === "open") mediaSource.endOfStream(); break; }
            if (value) { queue.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)); appendNext(); }
          }
        } catch { clearTimeout(timeout); done(false); }
      }, { once: true });
      mediaSource.addEventListener("error" as keyof MediaSourceEventMap, () => { clearTimeout(timeout); done(false); });
    });
  }

  async function playBlob(res: Response): Promise<boolean> {
    const player = getAudio();
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    return new Promise((resolve) => {
      let resolved = false;
      const done = (v: boolean) => { if (!resolved) { resolved = true; URL.revokeObjectURL(url); resolve(v); } };
      const timeout = setTimeout(() => done(false), 12000);
      if (!player.paused) player.pause();
      player.src = url;
      player.onended = () => { clearTimeout(timeout); done(true); };
      player.onerror = () => { clearTimeout(timeout); done(false); };
      player.play().catch(() => { clearTimeout(timeout); done(false); });
    });
  }

  async function fetchAndPlay(text: string, lang: "en" | "pt", speed: number): Promise<boolean> {
    const clean = stripEmojis(text);
    if (!clean) return true;
    const controller = new AbortController();
    const ttsTimeout = setTimeout(() => controller.abort(), 9000);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, speed, lang }),
        signal: controller.signal,
      });
      clearTimeout(ttsTimeout);
      if (!res.ok) return false;
      if (supportsMediaSourceAudio()) return playStream(res);
      return playBlob(res);
    } catch {
      clearTimeout(ttsTimeout);
      return false;
    }
  }

  function splitSpeechSegments(text: string): { text: string; lang: "en" | "pt" }[] {
    const segments: { text: string; lang: "en" | "pt" }[] = [];
    const lines = text.split("\n");
    const enLines: string[] = [];
    function expandBrTags(line: string, lang: "en" | "pt", out: { text: string; lang: "en" | "pt" }[]) {
      const parts = line.split(/(\[BR:[^\]]+\])/g);
      for (const part of parts) {
        const brMatch = part.match(/^\[BR:([^\]]+)\]$/);
        if (brMatch) { out.push({ text: brMatch[1].trim(), lang: "pt" }); }
        else if (part.trim()) { out.push({ text: part.trim(), lang }); }
      }
    }
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("🗣️")) continue;
      if (trimmed.startsWith("💬")) {
        const slashIdx = trimmed.indexOf(" / ");
        if (slashIdx !== -1) {
          const enPart = trimmed.slice(0, slashIdx).replace(/^💬\s*/, "").trim();
          const ptPart = trimmed.slice(slashIdx + 3).trim();
          if (enLines.length > 0) { expandBrTags(enLines.join(" ").trim(), "en", segments); enLines.length = 0; }
          if (enPart) expandBrTags(enPart, "en", segments);
          if (ptPart) segments.push({ text: ptPart, lang: "pt" });
        } else { enLines.push(trimmed.replace(/^💬\s*/, "")); }
        continue;
      }
      enLines.push(trimmed);
    }
    if (enLines.length > 0) expandBrTags(enLines.join(" ").trim(), "en", segments);
    return segments.filter((s) => s.text.length > 0);
  }

  async function speak(text: string, slow = false) {
    const player = getAudio();
    if (!player.paused) player.pause();
    const speed = slow ? 0.75 : level === "beginner" ? 0.78 : level === "advanced" ? 0.95 : 0.9;
    const segments = splitSpeechSegments(text);
    if (segments.length === 0) return;
    if (!supportsMediaSourceAudio()) {
      player.src = SILENT_WAV;
      player.play().catch(() => {});
    }
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

  async function startScenario(sc: Scenario) {
    setScenario(sc);
    setScreen("chat");
    unlockAudio();
    setIsLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [], level, topic: "free", topicStart: true, roleplay: true, scenario: sc.id }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.limitReached) { setLimitReached(true); return; }
      if (data.reply) setMessages([{ role: "assistant", content: data.reply, translation: data.translation ?? undefined }]);
      if (data.detectedLevel) setLevel(data.detectedLevel as Level);
    } finally {
      setIsLoading(false);
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
        body: JSON.stringify({ messages: updatedMessages, level, topic: "free", roleplay: true, scenario: scenario?.id }),
      });
      if (!res.ok) { setMessages((prev) => [...prev, { role: "assistant", content: "Ops, tive um problema. Tente enviar de novo!" }]); return; }
      const data = await res.json();
      if (data.limitReached) { setLimitReached(true); setMessages((prev) => prev.slice(0, -1)); return; }
      if (!data.reply) { setMessages((prev) => [...prev, { role: "assistant", content: "Ops, não consegui responder. Tente de novo!" }]); return; }
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply, translation: data.translation ?? undefined, corrections: data.corrections?.length ? data.corrections : undefined }]);
      if (data.detectedLevel) setLevel(data.detectedLevel as Level);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Erro de conexão. Verifique sua internet e tente novamente." }]);
    } finally {
      setIsLoading(false);
    }
  }

  async function endConversation(mode: "quiz" | "flashcards") {
    if (messages.length < 2) return;
    if (mode === "quiz") {
      setScreen("loading-quiz");
      try {
        const res = await fetch("/api/quiz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages, level }) });
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
        setMicError("Erro ao gerar o quiz.");
      }
    } else {
      setScreen("loading-flashcards");
      try {
        await fetch("/api/flashcards/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages, topic: scenario?.id, packName: scenario?.name ?? "Role-play" }) });
        router.push("/app/flashcards");
      } catch {
        setScreen("chat");
        setMicError("Erro ao gerar os flashcards. Verifique sua conexão e tente novamente.");
      }
    }
  }

  function selectAnswer(i: number) {
    if (answers[currentQ] !== null) return;
    const newAnswers = [...answers];
    newAnswers[currentQ] = i;
    setAnswers(newAnswers);
    setShowExplanation(true);
  }

  async function nextQuestion() {
    setShowExplanation(false);
    if (currentQ + 1 < (quiz?.questions.length ?? 0)) {
      setCurrentQ(currentQ + 1);
    } else {
      const finalScore = answers.reduce<number>((acc, a, i) => acc + (a === quiz!.questions[i].correct ? 1 : 0), 0);
      setScore(finalScore);
      setScreen("result");
      if (quizSessionId) {
        await fetch("/api/quiz", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: quizSessionId, score: finalScore, answers }) });
      }
    }
  }

  function restartChat() {
    setMessages([]); setInput(""); setLevel(null); setQuiz(null); setQuizSessionId(null);
    setAnswers([]); setCurrentQ(0); setShowExplanation(false); setScore(0); setScreen("scenarios");
    setScenario(null); setLimitReached(false);
  }

  async function startListening() {
    setMicError("");
    unlockAudio();
    if (audioRef.current && !audioRef.current.paused) { audioRef.current.pause(); setIsSpeaking(false); }
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch { setMicError("Permissão de microfone negada. Clique no cadeado e permita o microfone."); return; }
    audioChunksRef.current = [];
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 128000 } : {});
    recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      stream.getTracks().forEach((t) => t.stop());
      const finalMime = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(audioChunksRef.current, { type: finalMime });
      if (blob.size < 1000) { setMicError("Nenhuma fala detectada. Fale mais perto do microfone."); return; }
      setIsTranscribing(true);
      try {
        const ext = finalMime.includes("mp4") ? "mp4" : finalMime.includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `recording.${ext}`, { type: finalMime });
        const form = new FormData();
        form.append("audio", file);
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = await res.json();
        setIsTranscribing(false);
        if (data.transcript?.trim()) { setInput(data.transcript); sendMessage(data.transcript); }
        else if (data.error) { setMicError(`Erro na transcrição: ${data.error}`); }
        else { setMicError("Não entendi o áudio. Tente novamente."); }
      } catch (err) { setIsTranscribing(false); setMicError(`Erro ao transcrever: ${String(err)}`); }
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

  const BottomNav = () => (
    <nav className="-mx-3 sm:mx-auto w-full sm:max-w-2xl mt-1" style={{ background: "#0d0d0d", borderTop: "1px solid #1e1e1e", display: "grid", gridTemplateColumns: "repeat(4,1fr)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      {[
        { href: "/app", icon: "🏠", label: "Início", active: false },
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
  );

  // ── Loading Quiz ─────────────────────────────────────────────────────────
  if (screen === "loading-quiz") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif" }}>
        <div className="flex gap-1.5">
          {[0, 150, 300].map((d) => <span key={d} className="w-3 h-3 rounded-full animate-bounce" style={{ background: "var(--yellow)", animationDelay: `${d}ms` }} />)}
        </div>
        <p className="text-sm font-medium" style={{ color: "var(--gray)" }}>Gerando seu quiz personalizado...</p>
      </div>
    );
  }

  // ── Loading Flashcards ────────────────────────────────────────────────────
  if (screen === "loading-flashcards") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif" }}>
        <div className="flex gap-1.5">
          {[0, 150, 300].map((d) => <span key={d} className="w-3 h-3 rounded-full animate-bounce" style={{ background: "var(--yellow)", animationDelay: `${d}ms` }} />)}
        </div>
        <p className="text-sm font-medium" style={{ color: "var(--gray)" }}>Criando seus flashcards...</p>
      </div>
    );
  }

  // ── Quiz ─────────────────────────────────────────────────────────────────
  if (screen === "quiz" && quiz) {
    const q = quiz.questions[currentQ];
    const chosen = answers[currentQ];
    const total = quiz.questions.length;
    return (
      <div className="flex flex-col items-center px-4 pt-6 pb-8 min-h-screen" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif" }}>
        <div className="w-full max-w-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--yellow)" }}>Quiz</p>
              <h2 className="font-bold text-white text-base mt-0.5">{quiz.title}</h2>
            </div>
            <span className="text-sm font-bold" style={{ color: "var(--gray)" }}>{currentQ + 1}/{total}</span>
          </div>
          <div className="w-full h-1.5 rounded-full mb-6" style={{ background: "var(--dark2)" }}>
            <div className="h-1.5 rounded-full transition-all duration-500" style={{ background: "var(--yellow)", width: `${(currentQ / total) * 100}%` }} />
          </div>
          <div className="mb-6 px-4 py-4 rounded-2xl" style={{ background: "var(--dark1)", border: "1px solid #1f1f1f" }}>
            <p className="text-white text-sm leading-relaxed font-medium">{q.question}</p>
          </div>
          <div className="flex flex-col gap-3 mb-6">
            {q.options.map((opt, i) => {
              let bg = "var(--dark1)", border = "1px solid #2a2a2a", color = "var(--white)";
              if (chosen !== null) {
                if (i === q.correct) { bg = "rgba(74,222,128,0.12)"; border = "1px solid #4ade80"; color = "#4ade80"; }
                else if (i === chosen && chosen !== q.correct) { bg = "rgba(248,113,113,0.12)"; border = "1px solid #f87171"; color = "#f87171"; }
                else { color = "var(--gray)"; }
              }
              return (
                <button key={i} onClick={() => selectAnswer(i)} disabled={chosen !== null} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all" style={{ background: bg, border, color, cursor: chosen !== null ? "default" : "pointer" }}>
                  <span className="font-bold mr-2" style={{ opacity: 0.5 }}>{["A","B","C","D"][i]}</span>{opt}
                </button>
              );
            })}
          </div>
          {showExplanation && (
            <div className="mb-5 px-4 py-3 rounded-xl text-sm" style={{ background: chosen === q.correct ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)", border: chosen === q.correct ? "1px solid rgba(74,222,128,0.25)" : "1px solid rgba(248,113,113,0.25)" }}>
              <p className="font-bold mb-1" style={{ color: chosen === q.correct ? "#4ade80" : "#f87171" }}>{chosen === q.correct ? "✓ Correto!" : "✗ Quase lá!"}</p>
              <p style={{ color: "var(--gray)" }}>{q.explanation}</p>
            </div>
          )}
          {chosen !== null && (
            <button onClick={nextQuestion} className="w-full py-3 rounded-xl font-bold text-sm" style={{ background: "var(--yellow)", color: "var(--black)" }}>
              {currentQ + 1 < total ? "Próxima →" : "Ver resultado →"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Result ───────────────────────────────────────────────────────────────
  if (screen === "result" && quiz) {
    const total = quiz.questions.length;
    const pct = Math.round((score / total) * 100);
    const emoji = pct >= 80 ? "🏆" : pct >= 60 ? "💪" : "📚";
    const msg = pct >= 80 ? "Excelente! Você dominou esse cenário." : pct >= 60 ? "Bom trabalho! Continue praticando." : "Continue assim! Cada conversa te deixa melhor.";
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
          <div className="w-full flex flex-col gap-2 mt-2">
            {quiz.questions.map((q, i) => {
              const correct = answers[i] === q.correct;
              return (
                <div key={i} className="text-left px-4 py-3 rounded-xl text-sm" style={{ background: "var(--dark1)", border: `1px solid ${correct ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}` }}>
                  <div className="flex items-start gap-2">
                    <span>{correct ? "✓" : "✗"}</span>
                    <div>
                      <p className="font-medium text-white">{q.question}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--gray)" }}>Resposta correta: <span style={{ color: "#4ade80" }}>{q.options[q.correct]}</span></p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-3 w-full mt-2">
            <button onClick={() => window.location.href = "/app/historico"} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: "var(--dark2)", color: "var(--gray)", border: "1px solid #2a2a2a" }}>Ver histórico</button>
            <button onClick={restartChat} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: "var(--yellow)", color: "var(--black)" }}>Novo cenário</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Scenario picker ──────────────────────────────────────────────────────
  if (screen === "scenarios") {
    return (
      <div className="flex flex-col items-center px-3 pt-3 pb-4 sm:px-4 sm:pt-4 sm:pb-6" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", minHeight: "100dvh" }}>
        <header className="w-full max-w-2xl mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <a href="/app" style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "36px", width: 36, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </a>
            <span style={{ fontWeight: 800, color: "#fff", fontSize: "0.95rem" }}>🎭 Role-play</span>
          </div>
          <div style={{ position: "relative", display: "inline-flex" }}>
            <UserButton />
            {isPro && <span style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)", fontSize: "0.52rem", fontWeight: 800, letterSpacing: "0.4px", background: "linear-gradient(135deg, #f5c800, #e0a800)", color: "#000", padding: "1px 5px", borderRadius: "50px", whiteSpace: "nowrap", lineHeight: 1.4, pointerEvents: "none" }}>PRO</span>}
          </div>
        </header>

        <div className="w-full max-w-2xl flex-1">
          <div className="mb-5">
            <p className="font-bold text-white text-sm mb-1">Escolha um cenário</p>
            <p className="text-xs" style={{ color: "var(--gray)" }}>Pratique inglês em situações reais do dia a dia</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.6rem" }}>
            {SCENARIOS.map((sc) => (
              <button
                key={sc.id}
                onClick={() => startScenario(sc)}
                className="text-left transition-all active:scale-95"
                style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "14px", padding: "12px", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = sc.color + "66")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
              >
                <div style={{ fontSize: "1.4rem", marginBottom: 6 }}>{sc.emoji}</div>
                <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fff", lineHeight: 1.3, marginBottom: 3 }}>{sc.name}</p>
                <p style={{ fontSize: "0.68rem", color: "var(--gray)", lineHeight: 1.3 }}>{sc.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <BottomNav />
      </div>
    );
  }

  // ── Chat ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center px-3 pt-3 pb-4 sm:px-4 sm:pt-4 sm:pb-6" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", height: "100dvh", overflow: "hidden" }}>
      <header className="w-full max-w-2xl mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => { setScreen("scenarios"); setMessages([]); setScenario(null); }} style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "36px", padding: "0 10px", display: "flex", alignItems: "center", gap: "5px", fontSize: "0.75rem", fontWeight: 600, color: "var(--gray)", cursor: "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="hidden sm:inline">Cenários</span>
          </button>
        </div>
        <div className="flex items-center gap-2" style={{ flex: 1, justifyContent: "center" }}>
          {scenario && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: "1rem" }}>{scenario.emoji}</span>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: scenario.color }}>{scenario.name}</span>
            </div>
          )}
        </div>
        <div style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
          <UserButton />
          {isPro && <span style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)", fontSize: "0.52rem", fontWeight: 800, background: "linear-gradient(135deg, #f5c800, #e0a800)", color: "#000", padding: "1px 5px", borderRadius: "50px", whiteSpace: "nowrap", lineHeight: 1.4, pointerEvents: "none" }}>PRO</span>}
        </div>
      </header>

      <div className="w-full max-w-2xl flex-1 min-h-0 p-3 sm:p-4 mb-3 overflow-y-auto" style={{ background: "var(--dark1)", border: "1px solid #1f1f1f", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" }}>
        {messages.length === 0 && isLoading && (
          <div className="flex flex-col items-center justify-center gap-3" style={{ minHeight: "60%", paddingBottom: "20%" }}>
            <div className="text-3xl">{scenario?.emoji}</div>
            <div className="flex gap-1.5">
              {[0, 150, 300].map((d) => <span key={d} className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--yellow)", animationDelay: `${d}ms` }} />)}
            </div>
            <p className="text-xs" style={{ color: "var(--gray)" }}>Preparando o cenário...</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`mb-3 flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-2`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mb-0.5 overflow-hidden">
                <Image src="/logo-jv.png" alt="JV" width={28} height={28} style={{ borderRadius: "6px" }} />
              </div>
            )}
            <div className="max-w-[82%] sm:max-w-[78%] px-3 sm:px-4 py-2.5 text-sm leading-relaxed"
              style={msg.role === "user"
                ? { background: "var(--yellow)", color: "var(--black)", borderRadius: "18px 18px 4px 18px", fontWeight: 500 }
                : { background: "var(--dark2)", color: "var(--white)", borderRadius: "18px 18px 18px 4px", border: "1px solid #2a2a2a" }
              }>
              {msg.content}
              {msg.role === "assistant" && msg.translation && (
                <div style={{ marginTop: "8px" }}>
                  {visibleTranslations.has(i) ? (
                    <div style={{ paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.08)", color: "var(--gray)", fontSize: "0.78rem", fontStyle: "italic" }}>
                      🇧🇷 {msg.translation}
                    </div>
                  ) : (
                    <button
                      onClick={() => setVisibleTranslations(prev => new Set(prev).add(i))}
                      style={{ background: "transparent", border: "1px solid #3a3a3a", borderRadius: "50px", padding: "2px 10px", fontSize: "0.72rem", color: "var(--gray)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      🇧🇷 Ver tradução
                    </button>
                  )}
                </div>
              )}
              {msg.role === "assistant" && (
                <div style={{ marginTop: "8px", display: "flex", gap: "6px" }}>
                  <button onClick={() => { unlockAudio(); speak(msg.content); }} disabled={isSpeaking || isLoading} style={{ background: "transparent", border: "1px solid #3a3a3a", borderRadius: "50px", padding: "2px 10px", fontSize: "0.72rem", color: "var(--gray)", cursor: "pointer", opacity: isSpeaking || isLoading ? 0.4 : 1 }}>🔊 Ouvir</button>
                  <button onClick={() => { unlockAudio(); speak(msg.content, true); }} disabled={isSpeaking || isLoading} style={{ background: "transparent", border: "1px solid #3a3a3a", borderRadius: "50px", padding: "2px 10px", fontSize: "0.72rem", color: "var(--gray)", cursor: "pointer", opacity: isSpeaking || isLoading ? 0.4 : 1 }}>🐢 Devagar</button>
                </div>
              )}
              {msg.role === "assistant" && msg.corrections && msg.corrections.length > 0 && (
                <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--gray)" }}>
                    {msg.corrections.length === 1 ? "Correção" : `${msg.corrections.length} Correções`}
                  </div>
                  {msg.corrections.map((c, ci) => {
                    const wrongWords = (c.wrongSentence ?? c.wrong).split(" ");
                    const rightWords = (c.rightSentence ?? c.right).split(" ");
                    const maxLen = Math.max(wrongWords.length, rightWords.length);
                    const wrongHighlighted = wrongWords.map((w, i) => {
                      const changed = w.toLowerCase().replace(/[^a-z]/g, "") !== (rightWords[i] ?? "").toLowerCase().replace(/[^a-z]/g, "");
                      return changed ? <span key={i} style={{ color: "#f87171", fontWeight: 700 }}>{w} </span> : <span key={i}>{w} </span>;
                    });
                    const rightHighlighted = Array.from({ length: maxLen }, (_, i) => {
                      const rw = rightWords[i] ?? ""; const ww = wrongWords[i] ?? "";
                      const changed = rw.toLowerCase().replace(/[^a-z]/g, "") !== ww.toLowerCase().replace(/[^a-z]/g, "");
                      return changed ? <span key={i} style={{ color: "#4ade80", fontWeight: 700 }}>{rw} </span> : <span key={i}>{rw} </span>;
                    });
                    const correctedSentence = c.rightSentence ?? c.right;
                    return (
                      <div key={ci} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        {msg.corrections!.length > 1 && (
                          <div style={{ fontSize: "0.68rem", color: "var(--gray)", opacity: 0.6 }}>Erro {ci + 1}: <span style={{ color: "#f87171" }}>{c.wrong}</span> → <span style={{ color: "#4ade80" }}>{c.right}</span></div>
                        )}
                        <div style={{ fontSize: "0.8rem", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "8px", padding: "5px 10px", lineHeight: 1.5 }}>❌ {wrongHighlighted}</div>
                        <div style={{ fontSize: "0.8rem", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: "8px", padding: "5px 10px", lineHeight: 1.5 }}>✅ {rightHighlighted}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--gray)", fontStyle: "italic", paddingLeft: "4px" }}>🗣️ {c.phonetic}</div>
                        <div style={{ display: "flex", gap: "6px", marginTop: "2px" }}>
                          <button
                            onClick={() => { unlockAudio(); speak(correctedSentence); }}
                            disabled={isSpeaking || isLoading}
                            title="Ouvir a frase corrigida"
                            style={{ background: "transparent", border: "1px solid rgba(74,222,128,0.3)", borderRadius: "50px", padding: "2px 10px", fontSize: "0.68rem", color: "#4ade80", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", opacity: isSpeaking || isLoading ? 0.4 : 1 }}
                          >
                            🔊 Ouvir
                          </button>
                          <button
                            onClick={() => { unlockAudio(); speak(correctedSentence, true); }}
                            disabled={isSpeaking || isLoading}
                            title="Ouvir a frase corrigida devagar"
                            style={{ background: "transparent", border: "1px solid rgba(74,222,128,0.3)", borderRadius: "50px", padding: "2px 10px", fontSize: "0.68rem", color: "#4ade80", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", opacity: isSpeaking || isLoading ? 0.4 : 1 }}
                          >
                            🐢 Devagar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && messages.length > 0 && (
          <div className="flex items-end gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
              <Image src="/logo-jv.png" alt="JV" width={28} height={28} style={{ borderRadius: "6px" }} />
            </div>
            <div className="px-4 py-3 text-sm" style={{ background: "var(--dark2)", borderRadius: "18px 18px 18px 4px", border: "1px solid #2a2a2a" }}>
              <span className="flex gap-1 items-center">
                {[0, 150, 300].map((d) => <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--yellow)", animationDelay: `${d}ms` }} />)}
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {isSpeaking && (
        <div className="w-full max-w-2xl mb-2 flex justify-center">
          <button
            onClick={() => { const p = getAudio(); p.pause(); setIsSpeaking(false); setPendingSpeak(null); }}
            style={{ background: "transparent", border: "1px solid #3a3a3a", borderRadius: "50px", padding: "4px 14px", fontSize: "0.7rem", color: "var(--gray)", cursor: "pointer" }}
          >
            ✕ Parar áudio
          </button>
        </div>
      )}

      {pendingSpeak && !isSpeaking && (
        <div className="w-full max-w-2xl mb-2">
          <button onClick={() => { const t = pendingSpeak; setPendingSpeak(null); speak(t); }} className="w-full py-2.5 rounded-xl text-sm font-bold" style={{ background: "rgba(245,200,0,0.1)", border: "1px solid rgba(245,200,0,0.35)", color: "var(--yellow)" }}>🔊 Toque para ouvir a resposta</button>
        </div>
      )}

      {messages.length >= 2 && !limitReached && (
        <div className="w-full max-w-2xl mb-2 flex gap-2">
          <button onClick={() => endConversation("quiz")} disabled={isLoading} className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40" style={{ background: "transparent", border: "1px solid rgba(245,200,0,0.3)", color: "var(--yellow)" }}>
            🎯 Fazer quiz
          </button>
          <button onClick={() => endConversation("flashcards")} disabled={isLoading} className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40" style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "var(--white)" }}>
            🃏 Criar flashcards
          </button>
        </div>
      )}

      {limitReached && (
        <div className="w-full max-w-2xl mb-3 px-4 py-5 flex flex-col items-center gap-3 text-center" style={{ background: "var(--dark2)", border: "1px solid rgba(245,200,0,.3)", borderRadius: "var(--radius)" }}>
          <div className="text-2xl">🎯</div>
          <p className="font-bold text-white text-sm">Você usou suas 10 mensagens de hoje</p>
          <a href="/planos" className="px-5 py-2 rounded-full text-sm font-bold" style={{ background: "var(--yellow)", color: "var(--black)" }}>Assinar JV IA — R$ 47/mês</a>
        </div>
      )}

      {micError && (
        <div className="w-full max-w-2xl mb-3 px-3 py-2.5 flex gap-2 items-start text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius)" }}>
          <span>🎙️</span><span style={{ color: "#fca5a5" }}>{micError}</span>
          <button onClick={() => setMicError("")} className="ml-auto text-xs shrink-0" style={{ color: "var(--gray2)" }}>✕</button>
        </div>
      )}

      <div className="-mx-3 sm:mx-auto w-full sm:max-w-2xl flex gap-2 items-end px-3 sm:px-0 pb-1 sm:pb-0" style={{ background: "var(--black)" }}>
        <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }} placeholder="Digite aqui..." disabled={limitReached} rows={1} className="flex-1 resize-none outline-none transition" style={{ background: "var(--dark1)", color: "var(--white)", border: "1px solid #2a2a2a", borderRadius: "var(--radius)", padding: "12px 16px", fontFamily: "'Inter', sans-serif", fontSize: "16px" }} onFocus={(e) => (e.currentTarget.style.borderColor = "var(--yellow)")} onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")} />
        <button onClick={isListening ? stopListening : startListening} disabled={isLoading || isSpeaking || isTranscribing || limitReached} className="w-12 h-12 flex items-center justify-center transition-all shrink-0 disabled:opacity-40" style={{ background: isListening ? "#ef4444" : isTranscribing ? "var(--dark2)" : "var(--yellow)", borderRadius: "var(--radius)", boxShadow: isListening ? "0 0 20px rgba(239,68,68,0.5)" : "none" }}>
          {isTranscribing ? <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" style={{ color: "var(--yellow)" }}><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
            : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" style={{ color: isListening ? "white" : "var(--black)" }}>{isListening ? <rect x="6" y="6" width="12" height="12" rx="2" /> : <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-7 9h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.93V21h2v2H9v-2h2v-2.07A7 7 0 0 1 5 12z" />}</svg>}
        </button>
        <button onClick={() => sendMessage(input)} disabled={isLoading || !input.trim() || limitReached} className="w-12 h-12 flex items-center justify-center transition-all shrink-0 disabled:opacity-40" style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "var(--radius)" }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--yellow)" }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m-7 7 7-7 7 7" /></svg>
        </button>
      </div>

      <div className="mt-1.5 h-3.5 text-[11px] text-center">
        {isListening ? <span style={{ color: "#ef4444" }}>● Gravando — toque em ⏹ para enviar</span>
          : isTranscribing ? <span style={{ color: "var(--yellow)" }}>● Reconhecendo sua voz...</span>
          : isSpeaking ? <span style={{ color: "var(--yellow)" }}>● Coach falando...</span>
          : <span style={{ color: "var(--gray2)", opacity: 0.6 }}>● Toque em 🎙️ para gravar sua voz</span>}
      </div>

      <BottomNav />
    </div>
  );
}
