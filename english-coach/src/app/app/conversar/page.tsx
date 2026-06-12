"use client";

import { useState, useRef, useEffect } from "react";
import { UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { TrailStep } from "@/lib/trilha-steps";

type Correction = { wrong: string; right: string; phonetic: string; wrongSentence?: string; rightSentence?: string };
type CorrectionList = Correction[];
type Message = { role: "user" | "assistant"; content: string; translation?: string; correction?: Correction; corrections?: CorrectionList };
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

type AppScreen = "chat" | "loading-quiz" | "loading-flashcards" | "quiz" | "result" | "trail-fc" | "trail-complete";

type TrilhaFlashcard = {
  word: string;
  translation: string;
  phonetic: string | null;
  example: string | null;
  example_translation: string | null;
};

type TopicDef = {
  id: string;
  emoji: string;
  label: string;
  desc: string;
  color: string;
};

const TOPICS: TopicDef[] = [
  { id: "free",    emoji: "💬", label: "Conversa Livre",       desc: "Papo natural, qualquer assunto",       color: "#F5C800" },
  { id: "work",    emoji: "💼", label: "Trabalho & Carreira",  desc: "Reuniões, entrevistas, e-mails",       color: "#60a5fa" },
  { id: "travel",  emoji: "✈️", label: "Viagens & Turismo",    desc: "Aeroporto, hotel, direções",           color: "#4ade80" },
  { id: "movies",  emoji: "🎬", label: "Filmes & Séries",      desc: "Fale sobre o que está assistindo",     color: "#a78bfa" },
  { id: "phrasal", emoji: "🔥", label: "Phrasal Verbs",        desc: "Give up, go on, figure out...",        color: "#f97316" },
  { id: "food",    emoji: "🍽️", label: "Comida & Restaurantes", desc: "Pedir, descrever, recomendar",        color: "#fb7185" },
  { id: "tech",    emoji: "📱", label: "Tecnologia",           desc: "Apps, redes sociais, gadgets",         color: "#34d399" },
  { id: "daily",   emoji: "🏠", label: "Rotina & Cotidiano",   desc: "Manhã, trabalho, fim de semana",       color: "#fbbf24" },
];

const LEVEL_LABEL: Record<NonNullable<Level>, string> = {
  beginner: "Básico",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

export default function Home() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [visibleTranslations, setVisibleTranslations] = useState<Set<number>>(new Set());
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
  const [pendingCoupon, setPendingCoupon] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [topic, setTopic] = useState<TopicDef | null>(null);
  const [trilhaStep, setTrilhaStep] = useState<TrailStep | null>(null);
  const [trilhaPhase, setTrilhaPhase] = useState<"chat1" | "chat2" | null>(null);
  const [trilhaMsgCount, setTrilhaMsgCount] = useState(0);
  const [trilhaChat1Messages, setTrilhaChat1Messages] = useState<Message[]>([]);
  const [trilhaFlashcards, setTrilhaFlashcards] = useState<TrilhaFlashcard[]>([]);
  const [fcIndex, setFcIndex] = useState(0);
  const [fcFlipped, setFcFlipped] = useState(false);
  const [fcShowTranslation, setFcShowTranslation] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      // Load saved level
      if (d.level) {
        setLevel(d.level as Level);
        localStorage.setItem("userLevel", d.level);
      } else if (!localStorage.getItem("userLevel")) {
        router.replace("/app/nivel");
      } else {
        setLevel(localStorage.getItem("userLevel") as Level);
      }
      // Check for pending discount coupon
      if (!pro) {
        const coupon = localStorage.getItem("jv_coupon");
        if (coupon) setPendingCoupon(coupon);
      }
      // Check for pending trilha step
      const pendingStep = localStorage.getItem("pendingTrilhaStep");
      if (pendingStep) {
        try {
          const parsed = JSON.parse(pendingStep);
          localStorage.removeItem("pendingTrilhaStep");
          const phase: "chat1" | "chat2" = parsed.phase ?? "chat1";
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { phase: _p, ...step } = parsed;
          setTrilhaStep(step as TrailStep);
          setTrilhaPhase(phase);
          const freeTopic = TOPICS.find((t) => t.id === "free")!;
          setTopic(freeTopic);
          // Auto-start: AI opens the conversation
          const ctx = phase === "chat2"
            ? `${(step as TrailStep).context}\n\nPRACTICE SESSION — The student has already had an initial conversation on this topic and just reviewed the key vocabulary with flashcards. Now guide a warm follow-up practice where they naturally use the vocabulary they studied. Be encouraging.`
            : (step as TrailStep).context;
          setIsLoading(true);
          fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: [], level: d.level ?? localStorage.getItem("userLevel") ?? null, topic: "free", topicStart: true, stepContext: ctx }),
          }).then((r) => r.json()).then((chatData) => {
            if (chatData.reply) {
              setMessages([{ role: "assistant", content: chatData.reply, translation: chatData.translation ?? undefined }]);
            }
          }).finally(() => setIsLoading(false));
        } catch {}
      }
    });
  }, [router]);

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
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "Sem URL retornada pelo Stripe");
      }
    } catch (e) {
      alert("Erro ao abrir o portal: " + String(e));
    } finally {
      setPortalLoading(false);
    }
  }

  async function activateCoupon() {
    if (!pendingCoupon) return;
    setCouponLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coupon: pendingCoupon }),
      });
      const data = await res.json();
      if (data.url) {
        localStorage.removeItem("jv_coupon");
        window.location.href = data.url;
      }
    } finally {
      setCouponLoading(false);
    }
  }

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
  const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

  // Returns the persistent Audio element, creating it once
  function getAudio(): HTMLAudioElement {
    if (!audioRef.current) audioRef.current = new Audio();
    return audioRef.current;
  }

  // Must be called synchronously inside a user-gesture handler (onClick).
  // Plays a silent clip on the persistent element so the browser marks it as
  // "user-activated" — subsequent async play() calls on the same element work.
  function unlockAudio() {
    const a = getAudio();
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    a.src = SILENT_WAV;
    a.play().then(() => a.pause()).catch(() => {});
  }

  // Splits message into segments: { text, lang }
  // Handles: 🗣️ (skip), 💬 (en/pt split), [BR:word] inline PT tags
  function splitSpeechSegments(text: string): { text: string; lang: "en" | "pt" }[] {
    const segments: { text: string; lang: "en" | "pt" }[] = [];
    const lines = text.split("\n");
    const enLines: string[] = [];

    // Expands [BR:word] tags in a line into alternating en/pt segments
    function expandBrTags(line: string, lang: "en" | "pt", out: { text: string; lang: "en" | "pt" }[]) {
      const parts = line.split(/(\[BR:[^\]]+\])/g);
      for (const part of parts) {
        const brMatch = part.match(/^\[BR:([^\]]+)\]$/);
        if (brMatch) {
          out.push({ text: brMatch[1].trim(), lang: "pt" });
        } else if (part.trim()) {
          out.push({ text: part.trim(), lang });
        }
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
          if (enLines.length > 0) {
            expandBrTags(enLines.join(" ").trim(), "en", segments);
            enLines.length = 0;
          }
          if (enPart) expandBrTags(enPart, "en", segments);
          if (ptPart) segments.push({ text: ptPart, lang: "pt" });
        } else {
          enLines.push(trimmed.replace(/^💬\s*/, ""));
        }
        continue;
      }

      enLines.push(trimmed);
    }

    if (enLines.length > 0) {
      expandBrTags(enLines.join(" ").trim(), "en", segments);
    }

    return segments.filter((s) => s.text.length > 0);
  }

  function supportsMediaSourceAudio(): boolean {
    if (typeof MediaSource === "undefined") return false;
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as Record<string, unknown>).MSStream;
    if (isIOS) return false;
    return MediaSource.isTypeSupported("audio/mpeg");
  }

  // Streaming via MediaSource — reuses the persistent audio element.
  // play() is called immediately (before sourceopen) so it stays within the
  // user-gesture activation window on browsers that need it.
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

      // Call play() NOW — still within the user-gesture context. It will
      // buffer until there's data; this is what prevents the autoplay block.
      player.play().catch(() => {});

      mediaSource.addEventListener("sourceopen", async () => {
        URL.revokeObjectURL(url);
        let sourceBuffer: SourceBuffer;
        try {
          sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
        } catch {
          clearTimeout(timeout); done(false); return;
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
          if (queue.length > 0) appendNext();
          else if (streamDone && mediaSource.readyState === "open") mediaSource.endOfStream();
        });

        player.onended = () => { clearTimeout(timeout); done(true); };
        player.onerror = () => { clearTimeout(timeout); done(false); };

        try {
          const reader = res.body!.getReader();
          while (true) {
            const { done: streamEnd, value } = await reader.read();
            if (streamEnd) {
              streamDone = true;
              if (!appending && queue.length === 0 && mediaSource.readyState === "open") mediaSource.endOfStream();
              break;
            }
            if (value) { queue.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)); appendNext(); }
          }
        } catch { clearTimeout(timeout); done(false); }
      }, { once: true });

      mediaSource.addEventListener("error" as keyof MediaSourceEventMap, () => { clearTimeout(timeout); done(false); });
    });
  }

  // Fallback for iOS Safari: fetch full blob then play on the persistent element.
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

  async function speak(text: string, slow = false) {
    const player = getAudio();
    if (!player.paused) player.pause();

    const speed = slow ? 0.75 : level === "beginner" ? 0.78 : level === "advanced" ? 0.95 : 0.9;
    const segments = splitSpeechSegments(text);
    if (segments.length === 0) return;

    // For non-streaming (iOS): call play() here synchronously so the browser
    // activates the element before the async fetch begins.
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

  async function startTopic(t: TopicDef) {
    setTopic(t);
    localStorage.setItem("lastTopic", JSON.stringify(t));
    if (t.id === "free") return; // free chat: wait for user input
    unlockAudio();
    setIsLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [], level, topic: t.id, topicStart: true, stepContext: trilhaStep?.context }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.limitReached) { setLimitReached(true); return; }
      if (data.reply) {
        setMessages([{ role: "assistant", content: data.reply, translation: data.translation ?? undefined }]);
      }
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
    if (trilhaStep) setTrilhaMsgCount((c) => c + 1);
    setIsLoading(true);
    try {
      const activeStepContext = trilhaStep
        ? trilhaPhase === "chat2"
          ? `${trilhaStep.context}\n\nPRACTICE SESSION — The student reviewed flashcards from the first conversation. Guide a natural follow-up practice where they use the vocabulary they studied.`
          : trilhaStep.context
        : undefined;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages, level, topic: topic?.id ?? "free", stepContext: activeStepContext }),
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
    } else {
      setScreen("loading-flashcards");
      try {
        await fetch("/api/flashcards/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages, topic: topic?.id, packName: topic?.label ?? "Conversa livre" }),
        });
        router.push("/app/flashcards");
      } catch {
        setScreen("chat");
        setMicError("Erro ao gerar os flashcards. Verifique sua conexão e tente novamente.");
      }
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
      // Trilha: quiz score is saved but step is only marked complete after chat2 (via finalizePractice)
      // Non-trilha: mark step complete immediately if score ≥70%
      if (trilhaStep && trilhaPhase !== "chat1" && finalScore / (quiz?.questions.length ?? 1) >= 0.7) {
        await fetch("/api/trilha", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepId: trilhaStep.id, score: finalScore, total: quiz?.questions.length ?? 0 }),
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
    setTopic(null);
    setTrilhaStep(null);
    setTrilhaPhase(null);
    setTrilhaMsgCount(0);
    setTrilhaChat1Messages([]);
    setTrilhaFlashcards([]);
    setFcIndex(0);
    setFcFlipped(false);
    setFcShowTranslation(false);
    setLimitReached(false);
  }

  async function proceedToFlashcards() {
    if (!trilhaStep) return;
    setTrilhaChat1Messages(messages); // save chat1 messages for quiz generation later
    setScreen("loading-flashcards");
    try {
      const res = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, topic: "free", packName: trilhaStep.title }),
      });
      const data = await res.json();
      if (data.cards && data.cards.length > 0) {
        setTrilhaFlashcards(data.cards);
        setFcIndex(0);
        setFcFlipped(false);
        setScreen("trail-fc");
      } else {
        // Flashcard generation failed — go straight to quiz with saved messages
        await generateTrailQuiz(messages);
      }
    } catch {
      await generateTrailQuiz(messages);
    }
  }

  async function generateTrailQuiz(msgs: Message[]) {
    setScreen("loading-quiz");
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs, level }),
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
        await startChat2();
      }
    } catch {
      await startChat2();
    }
  }

  async function startChat2() {
    if (!trilhaStep) return;
    setMessages([]);
    setInput("");
    setQuiz(null);
    setQuizSessionId(null);
    setAnswers([]);
    setCurrentQ(0);
    setShowExplanation(false);
    setScore(0);
    setTrilhaFlashcards([]);
    setFcIndex(0);
    setFcFlipped(false);
    setFcShowTranslation(false);
    setTrilhaPhase("chat2");
    setTrilhaMsgCount(0);
    setScreen("chat");
    const ctx = `${trilhaStep.context}\n\nPRACTICE SESSION — The student has already had an initial conversation on this topic and just reviewed the key vocabulary with flashcards. Now guide a warm follow-up practice where they naturally use the vocabulary they studied. Be encouraging.`;
    setIsLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [], level, topic: "free", topicStart: true, stepContext: ctx }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.reply) {
        setMessages([{ role: "assistant", content: data.reply, translation: data.translation ?? undefined }]);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function finalizePractice() {
    if (!trilhaStep) return;
    await fetch("/api/trilha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId: trilhaStep.id, score: score, total: quiz?.questions.length ?? 5 }),
    });
    setScreen("trail-complete");
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

  // ── Loading Flashcards Screen ─────────────────────────────────────────────
  if (screen === "loading-flashcards") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif" }}>
        <div className="flex gap-1.5">
          {[0, 150, 300].map((d) => (
            <span key={d} className="w-3 h-3 rounded-full animate-bounce" style={{ background: "var(--yellow)", animationDelay: `${d}ms` }} />
          ))}
        </div>
        <p className="text-sm font-medium" style={{ color: "var(--gray)" }}>Criando seus flashcards...</p>
      </div>
    );
  }

  // ── Trail Flashcard Review Screen ─────────────────────────────────────────
  if (screen === "trail-fc" && trilhaFlashcards.length > 0) {
    const card = trilhaFlashcards[fcIndex];
    const isLast = fcIndex === trilhaFlashcards.length - 1;
    const allDone = fcIndex >= trilhaFlashcards.length;

    return (
      <div className="flex flex-col items-center px-4 pt-6 pb-8 min-h-screen" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif" }}>
        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--yellow)" }}>Revisão de Vocabulário</p>
              <h2 className="font-bold text-white text-base mt-0.5">{trilhaStep?.emoji} {trilhaStep?.title}</h2>
            </div>
            <span className="text-sm font-bold" style={{ color: "var(--gray)" }}>{Math.min(fcIndex + 1, trilhaFlashcards.length)}/{trilhaFlashcards.length}</span>
          </div>

          {/* Phase indicator */}
          <div className="mb-5 flex items-center gap-2 text-xs" style={{ color: "var(--gray)" }}>
            <span style={{ color: "#4ade80", fontWeight: 700 }}>✓ Fase 1</span>
            <span style={{ color: "var(--gray2)" }}>›</span>
            <span style={{ color: "var(--yellow)", fontWeight: 700 }}>● Fase 2 · Vocabulário</span>
            <span style={{ color: "var(--gray2)" }}>›</span>
            <span>Fase 3 · Prática</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 rounded-full mb-6" style={{ background: "var(--dark2)" }}>
            <div className="h-1.5 rounded-full transition-all duration-500" style={{ background: "var(--yellow)", width: `${(Math.min(fcIndex, trilhaFlashcards.length) / trilhaFlashcards.length) * 100}%` }} />
          </div>

          {!allDone ? (
            <>
              {/* Flip Card */}
              <div
                onClick={() => setFcFlipped((v) => !v)}
                style={{ cursor: "pointer", perspective: "1000px", marginBottom: 24 }}
              >
                <div style={{
                  position: "relative", minHeight: 220, transition: "transform 0.45s", transformStyle: "preserve-3d",
                  transform: fcFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                }}>
                  {/* Front */}
                  <div style={{
                    position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                    background: "var(--dark1)", border: "1px solid #2a2a2a", borderRadius: 20,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, gap: 10,
                  }}>
                    <p style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff", textAlign: "center" }}>{card.word}</p>
                    {card.phonetic && <p style={{ fontSize: "0.8rem", color: "var(--gray)", fontStyle: "italic" }}>/{card.phonetic}/</p>}
                    <button
                      onClick={(e) => { e.stopPropagation(); speak(card.word); }}
                      style={{ marginTop: 4, background: "rgba(245,200,0,0.1)", border: "1px solid rgba(245,200,0,0.3)", borderRadius: 10, padding: "6px 16px", color: "var(--yellow)", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
                    >
                      🔊 Ouvir pronúncia
                    </button>
                    <p style={{ fontSize: "0.72rem", color: "var(--gray2)", marginTop: 4 }}>Toque no card para ver a tradução</p>
                  </div>
                  {/* Back */}
                  <div style={{
                    position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                    background: "var(--dark1)", border: "1px solid rgba(245,200,0,0.3)", borderRadius: 20,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, gap: 12,
                  }}>
                    <p style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--yellow)", textAlign: "center" }}>{card.translation}</p>
                    {card.example && (
                      <div style={{ textAlign: "center", marginTop: 4, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                        <p style={{ fontSize: "0.8rem", color: "var(--white)", fontStyle: "italic", lineHeight: 1.5 }}>&ldquo;{card.example}&rdquo;</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); speak(card.example!); }}
                          style={{ background: "rgba(245,200,0,0.1)", border: "1px solid rgba(245,200,0,0.3)", borderRadius: 10, padding: "5px 14px", color: "var(--yellow)", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}
                        >
                          🔊 Ouvir frase
                        </button>
                        {card.example_translation && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setFcShowTranslation((v) => !v); }}
                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "5px 14px", color: "var(--gray)", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer" }}
                          >
                            {fcShowTranslation ? "🙈 Ocultar tradução" : "🌐 Ver tradução da frase"}
                          </button>
                        )}
                        {fcShowTranslation && card.example_translation && (
                          <p style={{ fontSize: "0.72rem", color: "var(--gray)", fontStyle: "normal" }}>{card.example_translation}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Next button (only shown after flipping) */}
              {fcFlipped && (
                <button
                  onClick={() => {
                    if (isLast) {
                      setFcIndex(trilhaFlashcards.length); // trigger allDone
                    } else {
                      setFcIndex((i) => i + 1);
                      setFcFlipped(false);
                      setFcShowTranslation(false);
                    }
                  }}
                  className="w-full py-3 rounded-xl font-bold text-sm"
                  style={{ background: "var(--yellow)", color: "var(--black)" }}
                >
                  {isLast ? "Concluir revisão →" : "Próxima palavra →"}
                </button>
              )}
            </>
          ) : (
            /* All cards reviewed */
            <div className="flex flex-col items-center text-center gap-5 mt-4">
              <div style={{ fontSize: "3rem" }}>🎯</div>
              <div>
                <p className="font-black text-xl text-white">Vocabulário revisado!</p>
                <p className="text-sm mt-2" style={{ color: "var(--gray)" }}>
                  Agora vamos praticar tudo isso em uma conversa. Você já está mais preparado!
                </p>
              </div>
              <button
                onClick={() => generateTrailQuiz(trilhaChat1Messages)}
                className="w-full py-3 rounded-xl font-bold text-sm"
                style={{ background: "var(--yellow)", color: "var(--black)" }}
              >
                🎯 Fazer quiz →
              </button>
            </div>
          )}
        </div>

        <style>{`@keyframes flipIn{from{opacity:0;transform:rotateY(-20deg)}to{opacity:1;transform:rotateY(0)}}`}</style>
      </div>
    );
  }

  // ── Trail Complete Screen ─────────────────────────────────────────────────
  if (screen === "trail-complete" && trilhaStep) {
    return (
      <div className="flex flex-col items-center justify-center px-4 pt-6 pb-8 min-h-screen" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif" }}>
        <div className="w-full max-w-lg flex flex-col items-center text-center gap-5">
          <div style={{ fontSize: "4rem" }}>🏆</div>
          <div>
            <p className="font-black text-2xl text-white">Etapa concluída!</p>
            <p className="text-sm mt-2" style={{ color: "var(--yellow)", fontWeight: 700 }}>{trilhaStep.emoji} {trilhaStep.title}</p>
          </div>
          <p className="text-sm" style={{ color: "var(--gray)" }}>
            Você completou as 3 fases desta etapa: conversa inicial, revisão de vocabulário e prática final. Excelente trabalho!
          </p>
          <div className="w-full flex flex-col gap-3 mt-2">
            <div className="w-full px-4 py-3 rounded-xl text-sm text-center" style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}>
              <span style={{ color: "#4ade80", fontWeight: 600 }}>✓ Fase 1 · Conversa inicial</span>
              {score > 0 && quiz && <span style={{ color: "#4ade80", fontWeight: 700, marginLeft: "0.5rem" }}> · {score}/{quiz.questions.length} no quiz</span>}
            </div>
            <div className="w-full px-4 py-3 rounded-xl text-sm text-center" style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}>
              <span style={{ color: "#4ade80", fontWeight: 600 }}>✓ Fase 2 · Revisão de vocabulário</span>
            </div>
            <div className="w-full px-4 py-3 rounded-xl text-sm text-center" style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}>
              <span style={{ color: "#4ade80", fontWeight: 600 }}>✓ Fase 3 · Prática</span>
            </div>
          </div>
          <button
            onClick={() => router.push("/app/trilha")}
            className="w-full py-3 rounded-xl font-bold text-sm mt-2"
            style={{ background: "#4ade80", color: "#000" }}
          >
            Voltar à trilha →
          </button>
        </div>
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
    const trilhaChat1Passed = false; // quiz is now after flashcards; always proceed to chat2
    const trilhaPassed = !!(trilhaStep && trilhaPhase !== "chat1" && pct >= 70);

    return (
      <div className="flex flex-col items-center justify-center px-4 pt-6 pb-8 min-h-screen" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif" }}>
        <div className="w-full max-w-lg flex flex-col items-center text-center gap-5">
          <div className="text-5xl">{emoji}</div>
          <div>
            <p className="font-black text-5xl" style={{ color: scoreColor }}>{pct}%</p>
            <p className="text-lg font-bold text-white mt-1">{score}/{total} corretas</p>
          </div>
          <p className="text-sm" style={{ color: "var(--gray)" }}>{msg}</p>

          {/* Phase indicator for trail */}
          {trilhaStep && (
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--gray)" }}>
              <span style={{ color: "#4ade80", fontWeight: 700 }}>✓ Fase 1</span>
              <span style={{ color: "var(--gray2)" }}>›</span>
              <span style={{ color: "#4ade80", fontWeight: 700 }}>✓ Fase 2 · Vocabulário</span>
              <span style={{ color: "var(--gray2)" }}>›</span>
              <span style={{ color: "var(--yellow)", fontWeight: 700 }}>● Fase 3 · Prática</span>
            </div>
          )}

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

          {trilhaStep && (
            <div className="w-full px-4 py-3 rounded-xl text-center text-sm font-bold" style={{ background: "rgba(245,200,0,0.08)", border: "1px solid rgba(245,200,0,0.3)", color: "var(--yellow)" }}>
              ✅ Quiz concluído! Agora é hora de praticar tudo em conversa.
            </div>
          )}

          <div className="flex gap-3 w-full mt-2">
            {trilhaStep ? (
              <button
                onClick={startChat2}
                className="flex-1 py-3 rounded-xl font-bold text-sm"
                style={{ background: "#4ade80", color: "#000" }}
              >
                🗣️ Ir para prática →
              </button>
            ) : (
              <>
                <button
                  onClick={() => router.push("/app/progresso")}
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
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Topic Selection Screen ───────────────────────────────────────────────
  if (!topic && !isLoading && messages.length === 0) {
    return (
      <div className="flex flex-col items-center px-3 pt-3 pb-4 sm:px-4 sm:pt-4 sm:pb-6" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", minHeight: "100dvh" }}>
        <header className="w-full max-w-2xl mb-4 flex items-center justify-between gap-2" style={{ position: "relative" }}>
          <div className="flex items-center gap-2 shrink-0">
            <Image src="/favicon.png" alt="Fale Inglês JV" width={32} height={32} className="rounded-xl shrink-0" />
            <span style={{ fontSize: "0.55rem", fontWeight: 800, color: "#000", background: "var(--yellow)", borderRadius: "50px", padding: "1px 6px", letterSpacing: "0.3px", lineHeight: 1.6 }}>4.0</span>
            <a href="/app" title="Início" style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "36px", width: 36, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
                <path d="M9 21V12h6v9"/>
              </svg>
            </a>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isPro && (
              <button onClick={openPortal} disabled={portalLoading} title="Portal do Aluno" className="icon-expand-btn hidden sm:flex" style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "36px", alignItems: "center", cursor: "pointer", opacity: portalLoading ? .5 : 1 }}>
                <span style={{ fontSize: "1rem", flexShrink: 0, width: 36, textAlign: "center" }}>{portalLoading ? "…" : "👤"}</span>
                <span className="icon-expand-label">Portal do Aluno</span>
              </button>
            )}
            <button onClick={() => router.push("/app/progresso")} title="Progresso" className="icon-expand-btn hidden sm:flex" style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "36px", alignItems: "center", cursor: "pointer" }}>
              <span style={{ fontSize: "1rem", flexShrink: 0, width: 36, textAlign: "center" }}>🏆</span>
              <span className="icon-expand-label">Progresso</span>
            </button>
            {isPro && (
              <button onClick={() => router.push("/app/resumo")} title="Revisão de Aula" className="icon-expand-btn hidden sm:flex" style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "36px", alignItems: "center", cursor: "pointer" }}>
                <span style={{ fontSize: "1rem", flexShrink: 0, width: 36, textAlign: "center" }}>📄</span>
                <span className="icon-expand-label">Revisão de Aula</span>
              </button>
            )}
            <a href="/planos" style={{ fontSize: ".78rem", fontWeight: 700, color: "var(--yellow)", border: "1px solid rgba(245,200,0,.35)", borderRadius: "50px", padding: ".3rem .8rem", textDecoration: "none", whiteSpace: "nowrap" }}>Planos</a>
            <button onClick={() => setMobileMenuOpen((v) => !v)} className="flex sm:hidden" style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "36px", width: 36, alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              {mobileMenuOpen
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray)" strokeWidth="2.5" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
              }
            </button>
            <div style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
              <UserButton />
              {isPro && <span style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)", fontSize: "0.52rem", fontWeight: 800, letterSpacing: "0.4px", background: "linear-gradient(135deg, #f5c800, #e0a800)", color: "#000", padding: "1px 5px", borderRadius: "50px", boxShadow: "0 0 6px rgba(245,200,0,0.5)", whiteSpace: "nowrap", lineHeight: 1.4, pointerEvents: "none" }}>PRO</span>}
            </div>
          </div>
          {mobileMenuOpen && (
            <div className="flex sm:hidden" style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "var(--dark1)", border: "1px solid #2a2a2a", borderRadius: "14px", padding: ".5rem", display: "flex", flexDirection: "column", gap: ".35rem", zIndex: 50, minWidth: 200, boxShadow: "0 8px 32px rgba(0,0,0,.5)" }}>
              {isPro && (
                <button onClick={() => { openPortal(); setMobileMenuOpen(false); }} disabled={portalLoading} style={{ background: "transparent", border: "none", borderRadius: "10px", height: "42px", display: "flex", alignItems: "center", gap: "10px", padding: "0 12px", cursor: "pointer", width: "100%" }}>
                  <span style={{ fontSize: "1rem", width: 24, textAlign: "center" }}>{portalLoading ? "…" : "👤"}</span>
                  <span style={{ fontSize: ".85rem", fontWeight: 600, color: "var(--gray)" }}>Portal do Aluno</span>
                </button>
              )}
              <button onClick={() => { router.push("/app/progresso"); setMobileMenuOpen(false); }} style={{ background: "transparent", border: "none", borderRadius: "10px", height: "42px", display: "flex", alignItems: "center", gap: "10px", padding: "0 12px", cursor: "pointer", width: "100%" }}>
                <span style={{ fontSize: "1rem", width: 24, textAlign: "center" }}>🏆</span>
                <span style={{ fontSize: ".85rem", fontWeight: 600, color: "var(--gray)" }}>Progresso</span>
              </button>
              {isPro && (
                <button onClick={() => { router.push("/app/resumo"); setMobileMenuOpen(false); }} style={{ background: "transparent", border: "none", borderRadius: "10px", height: "42px", display: "flex", alignItems: "center", gap: "10px", padding: "0 12px", cursor: "pointer", width: "100%" }}>
                  <span style={{ fontSize: "1rem", width: 24, textAlign: "center" }}>📄</span>
                  <span style={{ fontSize: ".85rem", fontWeight: 600, color: "var(--gray)" }}>Revisão de Aula</span>
                </button>
              )}
            </div>
          )}
        </header>

        <div className="w-full max-w-2xl flex-1 flex flex-col justify-center">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.6rem" }}>
            {TOPICS.map((t) => (
              <button
                key={t.id}
                onClick={() => startTopic(t)}
                className="text-left transition-all active:scale-95"
                style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "14px", padding: "12px", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = t.color + "66")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
              >
                <div style={{ fontSize: "1.4rem", marginBottom: 6 }}>{t.emoji}</div>
                <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fff", lineHeight: 1.3, marginBottom: 3 }}>{t.label}</p>
                <p style={{ fontSize: "0.68rem", color: "var(--gray)", lineHeight: 1.3 }}>{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <nav className="-mx-3 sm:mx-auto w-full sm:max-w-2xl mt-4" style={{ background: "#0d0d0d", borderTop: "1px solid #1e1e1e", display: "grid", gridTemplateColumns: "repeat(4,1fr)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {[
            { href: "/app", icon: "🏠", label: "Início", active: false },
            { href: "/app/trilha", icon: "🗺️", label: "Trilha", active: false },
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

  // ── Chat Screen ──────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col items-center px-3 pt-3 pb-4 sm:px-4 sm:pt-4 sm:pb-6"
      style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", height: "100dvh", overflow: "hidden" }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="w-full max-w-2xl mb-3 flex items-center justify-between gap-2" style={{ position: "relative" }}>
        {/* Esquerda: voltar ao tópico (ou logo) + casinha */}
        <div className="flex items-center gap-2 shrink-0">
          {topic ? (
            <button
              onClick={restartChat}
              style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "36px", padding: "0 10px", display: "flex", alignItems: "center", gap: "5px", fontSize: "0.75rem", fontWeight: 600, color: "var(--gray)", cursor: "pointer" }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span className="hidden sm:inline">Tópicos</span>
            </button>
          ) : (
            <Image src="/favicon.png" alt="Fale Inglês JV" width={32} height={32} className="rounded-xl shrink-0" />
          )}

          {/* Casinha — sempre visível, ao lado do elemento esquerdo */}
          <a
            href="/app"
            title="Início"
            style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "36px", width: 36, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", flexShrink: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
              <path d="M9 21V12h6v9"/>
            </svg>
          </a>
        </div>

        {/* Direita */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Portal, Progresso, Revisão — só no desktop */}
          {isPro && (
            <button
              onClick={openPortal}
              disabled={portalLoading}
              title="Portal do Aluno"
              className="icon-expand-btn hidden sm:flex"
              style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "36px", alignItems: "center", cursor: "pointer", opacity: portalLoading ? .5 : 1 }}
            >
              <span style={{ fontSize: "1rem", flexShrink: 0, width: 36, textAlign: "center" }}>{portalLoading ? "…" : "👤"}</span>
              <span className="icon-expand-label">Portal do Aluno</span>
            </button>
          )}
          <button
            onClick={() => router.push("/app/progresso")}
            title="Progresso"
            className="icon-expand-btn hidden sm:flex"
            style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "36px", alignItems: "center", cursor: "pointer" }}
          >
            <span style={{ fontSize: "1rem", flexShrink: 0, width: 36, textAlign: "center" }}>🏆</span>
            <span className="icon-expand-label">Progresso</span>
          </button>
          {isPro && (
            <button
              onClick={() => router.push("/app/resumo")}
              title="Revisão de Aula"
              className="icon-expand-btn hidden sm:flex"
              style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "36px", alignItems: "center", cursor: "pointer" }}
            >
              <span style={{ fontSize: "1rem", flexShrink: 0, width: 36, textAlign: "center" }}>📄</span>
              <span className="icon-expand-label">Revisão de Aula</span>
            </button>
          )}

          {/* Planos — sempre visível */}
          <a
            href="/planos"
            style={{ fontSize: ".78rem", fontWeight: 700, color: "var(--yellow)", border: "1px solid rgba(245,200,0,.35)", borderRadius: "50px", padding: ".3rem .8rem", textDecoration: "none", whiteSpace: "nowrap" }}
          >
            Planos
          </a>

          {/* Hambúrguer — só no mobile */}
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex sm:hidden"
            style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "36px", width: 36, alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
          >
            {mobileMenuOpen
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray)" strokeWidth="2.5" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            }
          </button>

          {/* Foto de perfil com selo PRO overlay */}
          <div style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
            <UserButton />
            {isPro && (
              <span style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)", fontSize: "0.52rem", fontWeight: 800, letterSpacing: "0.4px", background: "linear-gradient(135deg, #f5c800, #e0a800)", color: "#000", padding: "1px 5px", borderRadius: "50px", boxShadow: "0 0 6px rgba(245,200,0,0.5)", whiteSpace: "nowrap", lineHeight: 1.4, pointerEvents: "none" }}>
                PRO
              </span>
            )}
          </div>
        </div>

        {/* Dropdown mobile menu */}
        {mobileMenuOpen && (
          <div className="flex sm:hidden" style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "var(--dark1)", border: "1px solid #2a2a2a", borderRadius: "14px", padding: ".5rem", display: "flex", flexDirection: "column", gap: ".35rem", zIndex: 50, minWidth: 200, boxShadow: "0 8px 32px rgba(0,0,0,.5)" }}>
            {isPro && (
              <button
                onClick={() => { openPortal(); setMobileMenuOpen(false); }}
                disabled={portalLoading}
                style={{ background: "transparent", border: "none", borderRadius: "10px", height: "42px", display: "flex", alignItems: "center", gap: "10px", padding: "0 12px", cursor: "pointer", width: "100%" }}
              >
                <span style={{ fontSize: "1rem", width: 24, textAlign: "center" }}>{portalLoading ? "…" : "👤"}</span>
                <span style={{ fontSize: ".85rem", fontWeight: 600, color: "var(--gray)" }}>Portal do Aluno</span>
              </button>
            )}
            <button
              onClick={() => { router.push("/app/progresso"); setMobileMenuOpen(false); }}
              style={{ background: "transparent", border: "none", borderRadius: "10px", height: "42px", display: "flex", alignItems: "center", gap: "10px", padding: "0 12px", cursor: "pointer", width: "100%" }}
            >
              <span style={{ fontSize: "1rem", width: 24, textAlign: "center" }}>🏆</span>
              <span style={{ fontSize: ".85rem", fontWeight: 600, color: "var(--gray)" }}>Progresso</span>
            </button>
            {isPro && (
              <button
                onClick={() => { router.push("/app/resumo"); setMobileMenuOpen(false); }}
                style={{ background: "transparent", border: "none", borderRadius: "10px", height: "42px", display: "flex", alignItems: "center", gap: "10px", padding: "0 12px", cursor: "pointer", width: "100%" }}
              >
                <span style={{ fontSize: "1rem", width: 24, textAlign: "center" }}>📄</span>
                <span style={{ fontSize: ".85rem", fontWeight: 600, color: "var(--gray)" }}>Revisão de Aula</span>
              </button>
            )}
          </div>
        )}
      </header>

      {/* ── Trilha phase banner ────────────────────────────── */}
      {trilhaStep && trilhaPhase && (
        <div className="w-full max-w-2xl mb-2 px-3 py-2 flex items-center justify-between gap-2" style={{ background: "rgba(245,200,0,0.06)", border: "1px solid rgba(245,200,0,0.2)", borderRadius: "10px" }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: "1rem" }}>{trilhaStep.emoji}</span>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--yellow)" }}>{trilhaStep.title}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--gray)" }}>
            <span style={{ color: "#4ade80", fontWeight: 700 }}>✓1</span>
            <span style={{ color: "var(--gray2)" }}>›</span>
            {trilhaPhase === "chat1" ? (
              <>
                <span style={{ color: "var(--yellow)", fontWeight: 700 }}>●1</span>
                <span style={{ color: "var(--gray2)" }}>›</span>
                <span>2</span>
                <span style={{ color: "var(--gray2)" }}>›</span>
                <span>3</span>
              </>
            ) : (
              <>
                <span style={{ color: "#4ade80", fontWeight: 700 }}>✓2</span>
                <span style={{ color: "var(--gray2)" }}>›</span>
                <span style={{ color: "var(--yellow)", fontWeight: 700 }}>●3</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Chat area ──────────────────────────────────────── */}
      <div
        className="w-full max-w-2xl flex-1 min-h-0 p-3 sm:p-4 mb-3 overflow-y-auto"
        style={{ background: "var(--dark1)", border: "1px solid #1f1f1f", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" }}
      >
        {/* ── Topic loading (AI opening message) ──────────── */}
        {messages.length === 0 && topic && isLoading && (
          <div className="flex flex-col items-center justify-center gap-3" style={{ minHeight: "60%", paddingBottom: "20%" }}>
            <div className="text-3xl">{topic.emoji}</div>
            <div className="flex gap-1.5">
              {[0, 150, 300].map((d) => (
                <span key={d} className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--yellow)", animationDelay: `${d}ms` }} />
              ))}
            </div>
            <p className="text-xs" style={{ color: "var(--gray)" }}>Preparando sua aula de {topic.label.toLowerCase()}...</p>
          </div>
        )}

        {/* ── Free chat ready state ────────────────────────── */}
        {messages.length === 0 && topic?.id === "free" && !isLoading && !trilhaStep && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="text-3xl">💬</div>
            <div>
              <p className="font-semibold text-white text-sm">Conversa Livre</p>
              <p className="text-xs mt-1 max-w-xs" style={{ color: "var(--gray)" }}>
                Use o microfone ou escreva em inglês. Fala sobre qualquer coisa!
              </p>
            </div>
            <button
              onClick={() => setTopic(null)}
              style={{ fontSize: "0.72rem", color: "var(--gray2)", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}
            >
              Trocar tópico
            </button>
          </div>
        )}

        {/* ── Active topic pill ───────────────────────────── */}
        {topic && messages.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", paddingBottom: "10px", borderBottom: "1px solid #1f1f1f" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "1rem" }}>{topic.emoji}</span>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: topic.color }}>{topic.label}</span>
              {level && (
                <span style={{ fontSize: "0.62rem", color: "var(--gray2)", background: "var(--dark2)", padding: "1px 7px", borderRadius: "50px", border: "1px solid #2a2a2a" }}>
                  {level === "beginner" ? "Básico" : level === "intermediate" ? "Intermediário" : "Avançado"}
                </span>
              )}
            </div>
            <button
              onClick={restartChat}
              style={{ fontSize: "0.68rem", color: "var(--gray2)", background: "transparent", border: "none", cursor: "pointer", opacity: 0.7 }}
            >
              Trocar tópico
            </button>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`mb-3 flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-2`}>
            {msg.role === "assistant" && (() => {
              const isLastAssistant = i === messages.reduce<number>((last, m, idx) => m.role === "assistant" ? idx : last, -1);
              const speaking = isSpeaking && isLastAssistant;
              return (
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mb-0.5 overflow-hidden" style={{
                  borderRadius: "8px",
                  boxShadow: speaking ? "0 0 0 2px #f5c800, 0 0 12px 4px rgba(245,200,0,0.5)" : "none",
                  animation: speaking ? "avatar-pulse 1s ease-in-out infinite" : "none",
                  flexShrink: 0,
                }}>
                  <Image src="/favicon.png" alt="JV" width={28} height={28} style={{ borderRadius: "6px", display: "block" }} />
                </div>
              );
            })()}
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
                  <button
                    onClick={() => { unlockAudio(); speak(msg.content); }}
                    disabled={isSpeaking || isLoading}
                    title="Ouvir novamente"
                    style={{ background: "transparent", border: "1px solid #3a3a3a", borderRadius: "50px", padding: "2px 10px", fontSize: "0.72rem", color: "var(--gray)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", opacity: isSpeaking || isLoading ? 0.4 : 1 }}
                  >
                    🔊 Ouvir
                  </button>
                  <button
                    onClick={() => { unlockAudio(); speak(msg.content, true); }}
                    disabled={isSpeaking || isLoading}
                    title="Repetir devagar"
                    style={{ background: "transparent", border: "1px solid #3a3a3a", borderRadius: "50px", padding: "2px 10px", fontSize: "0.72rem", color: "var(--gray)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", opacity: isSpeaking || isLoading ? 0.4 : 1 }}
                  >
                    🐢 Devagar
                  </button>
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
                      const rw = rightWords[i] ?? "";
                      const ww = wrongWords[i] ?? "";
                      const changed = rw.toLowerCase().replace(/[^a-z]/g, "") !== ww.toLowerCase().replace(/[^a-z]/g, "");
                      return changed ? <span key={i} style={{ color: "#4ade80", fontWeight: 700 }}>{rw} </span> : <span key={i}>{rw} </span>;
                    });
                    const correctedSentence = c.rightSentence ?? c.right;
                    return (
                      <div key={ci} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        {msg.corrections!.length > 1 && (
                          <div style={{ fontSize: "0.68rem", color: "var(--gray)", opacity: 0.6 }}>Erro {ci + 1}: <span style={{ color: "#f87171" }}>{c.wrong}</span> → <span style={{ color: "#4ade80" }}>{c.right}</span></div>
                        )}
                        <div style={{ fontSize: "0.8rem", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "8px", padding: "5px 10px", lineHeight: 1.5 }}>
                          ❌ {wrongHighlighted}
                        </div>
                        <div style={{ fontSize: "0.8rem", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: "8px", padding: "5px 10px", lineHeight: 1.5 }}>
                          ✅ {rightHighlighted}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--gray)", fontStyle: "italic", paddingLeft: "4px" }}>
                          🗣️ {c.phonetic}
                        </div>
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

        {isLoading && (
          <div className="flex items-end gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
              <Image src="/favicon.png" alt="JV" width={28} height={28} style={{ borderRadius: "6px" }} />
            </div>
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

      {/* ── Banner de desconto pendente ────────────────────── */}
      {pendingCoupon && !isPro && (
        <div className="w-full max-w-2xl mb-2 px-4 py-3 flex items-center justify-between gap-3" style={{ background: "rgba(245,200,0,.08)", border: "1px solid rgba(245,200,0,.35)", borderRadius: "var(--radius)" }}>
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--yellow)" }}>🎁 Você tem um desconto esperando!</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--gray)" }}>Clique para ativar e assinar o JV IA com desconto exclusivo.</p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
            <button
              onClick={activateCoupon}
              disabled={couponLoading}
              className="text-xs font-bold px-4 py-2 rounded-full"
              style={{ background: "var(--yellow)", color: "var(--black)", border: "none", cursor: "pointer", opacity: couponLoading ? .6 : 1 }}
            >
              {couponLoading ? "..." : "Ativar"}
            </button>
            <button
              onClick={() => { localStorage.removeItem("jv_coupon"); setPendingCoupon(null); }}
              className="text-xs"
              style={{ background: "transparent", border: "none", color: "var(--gray2)", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Áudio travado — escape manual ─────────────────── */}
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

      {/* ── Botões de ação ─────────────────────────────────── */}
      {trilhaPhase === "chat1" && !limitReached && (
        <div className="w-full max-w-2xl mb-2 flex flex-col gap-2">
          <p className="text-center text-xs font-semibold" style={{ color: "var(--gray)" }}>
            {trilhaMsgCount}/10 mensagens enviadas
            {trilhaMsgCount < 10 ? " — continue conversando!" : " — pronto para avançar!"}
          </p>
          <button
            onClick={proceedToFlashcards}
            disabled={isLoading || trilhaMsgCount < 10}
            className="w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
            style={{ background: trilhaMsgCount >= 10 ? "var(--yellow)" : "rgba(245,200,0,0.08)", border: "1px solid rgba(245,200,0,0.35)", color: trilhaMsgCount >= 10 ? "var(--black)" : "var(--yellow)" }}
          >
            {trilhaMsgCount >= 10 ? "🃏 Ir para vocabulário →" : "🔒 Ir para vocabulário (faltam " + (10 - trilhaMsgCount) + ")"}
          </button>
        </div>
      )}
      {trilhaPhase === "chat2" && !limitReached && (
        <div className="w-full max-w-2xl mb-2 flex flex-col gap-2">
          <p className="text-center text-xs font-semibold" style={{ color: "var(--gray)" }}>
            {trilhaMsgCount}/5 mensagens enviadas
            {trilhaMsgCount < 5 ? " — pratique mais um pouco!" : " — pronto para concluir!"}
          </p>
          <button
            onClick={finalizePractice}
            disabled={isLoading || trilhaMsgCount < 5}
            className="w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
            style={{ background: trilhaMsgCount >= 5 ? "rgba(74,222,128,0.15)" : "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.4)", color: "#4ade80" }}
          >
            {trilhaMsgCount >= 5 ? "✅ Finalizar prática e concluir etapa" : "🔒 Finalizar prática (faltam " + (5 - trilhaMsgCount) + ")"}
          </button>
        </div>
      )}
      {/* ── Encerrar conversa (modo livre/temático) ────────── */}
      {!trilhaStep && messages.length >= 2 && !limitReached && (
        <div className="w-full max-w-2xl mb-2 flex gap-2">
          <button
            onClick={() => endConversation("quiz")}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
            style={{ background: "transparent", border: "1px solid rgba(245,200,0,0.3)", color: "var(--yellow)" }}
          >
            🎯 Fazer quiz
          </button>
          <button
            onClick={() => isPro ? endConversation("flashcards") : router.push("/planos")}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
            style={{ background: "transparent", border: `1px solid ${isPro ? "rgba(255,255,255,0.15)" : "rgba(245,200,0,0.2)"}`, color: isPro ? "var(--white)" : "var(--yellow)" }}
          >
            {isPro ? "🃏 Criar flashcards" : "🔒 Criar flashcards"}
          </button>
        </div>
      )}

      {/* ── Banner instalar PWA ───────────────────────────── */}
      {/* ── Limite diário ─────────────────────────────────── */}
      {limitReached && (
        <div className="w-full max-w-2xl mb-3 px-4 py-5 flex flex-col items-center gap-3 text-center" style={{ background: "var(--dark2)", border: "1px solid rgba(245,200,0,.3)", borderRadius: "var(--radius)" }}>
          <div className="text-2xl">🎯</div>
          <div>
            <p className="font-bold text-white text-sm">Você usou suas 10 mensagens de hoje</p>
            <p className="text-xs mt-1" style={{ color: "var(--gray)" }}>Assine o JV IA por R$ 47/mês e pratique sem limites todos os dias.</p>
          </div>
          <a href="/planos" className="px-5 py-2 rounded-full text-sm font-bold transition-all" style={{ background: "var(--yellow)", color: "var(--black)" }}>
            Assinar JV IA — R$ 47/mês
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
          placeholder={!topic ? "☝️ Escolha um tópico..." : "Digite aqui..."}
          disabled={!topic || limitReached}
          rows={1}
          className="flex-1 resize-none outline-none transition"
          style={{ background: "var(--dark1)", color: "var(--white)", border: "1px solid #2a2a2a", borderRadius: "var(--radius)", padding: "12px 16px", fontFamily: "'Inter', sans-serif", fontSize: "16px", opacity: !topic ? 0.4 : 1 }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--yellow)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
        />

        <button
          onClick={isListening ? stopListening : startListening}
          disabled={isLoading || isSpeaking || isTranscribing || limitReached || !topic}
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
                <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-7 9h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.93V21h2v2H9v-2h2v-3.27A7 7 0 0 1 5 12z" />
              )}
            </svg>
          )}
        </button>

        <button
          onClick={() => sendMessage(input)}
          disabled={isLoading || !input.trim() || limitReached || !topic}
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

      {/* ── Bottom Nav ─────────────────────────────────────── */}
      <nav className="-mx-3 sm:mx-auto w-full sm:max-w-2xl mt-1" style={{ background: "#0d0d0d", borderTop: "1px solid #1e1e1e", display: "grid", gridTemplateColumns: "repeat(4,1fr)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {[
          { href: "/app", icon: "🏠", label: "Início", active: false },
          { href: "/app/trilha", icon: "🗺️", label: "Trilha", active: false },
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

