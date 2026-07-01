"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { TrailStep } from "@/lib/trilha-steps";
import { shuffleQuizOptions } from "@/lib/quiz";
import ChatTranslator from "@/components/ChatTranslator";

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

// Re-injects [FIX|...] tags into assistant messages so the AI sees its own
// past corrections in history and doesn't repeat them.
function withFixTags(msgs: Message[]): { role: string; content: string }[] {
  return msgs.map((m) => {
    if (m.role !== "assistant" || !m.corrections?.length) return { role: m.role, content: m.content };
    const tags = m.corrections
      .map((c) => `[FIX|${c.wrong}|${c.right}|${c.phonetic}|${c.wrongSentence ?? ""}|${c.rightSentence ?? ""}]`)
      .join("\n");
    return { role: m.role, content: `${m.content}\n${tags}` };
  });
}

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
  const [messagesUsed, setMessagesUsed] = useState(0);
  const [isPro, setIsPro] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("userPlan") === "pro";
  });
  const [pendingCoupon, setPendingCoupon] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [topic, setTopic] = useState<TopicDef | null>(null);
  const [trilhaStep, setTrilhaStep] = useState<TrailStep | null>(null);
  const [trilhaPhase, setTrilhaPhase] = useState<"chat1" | "flashcards" | "quiz" | "chat2" | "review" | null>(null);
  const [trilhaMsgCount, setTrilhaMsgCount] = useState(0);
  const [trilhaChat1Messages, setTrilhaChat1Messages] = useState<Message[]>([]);
  const [trilhaFlashcards, setTrilhaFlashcards] = useState<TrilhaFlashcard[]>([]);
  const [trilhaQuizScore, setTrilhaQuizScore] = useState<{ score: number; total: number } | null>(null);
  // Review mode navigation
  const [reviewPhase, setReviewPhase] = useState<"chat" | "flashcards" | "quiz" | "chat2">("chat");
  const [reviewFlashcards, setReviewFlashcards] = useState<TrilhaFlashcard[]>([]);
  const [reviewQuiz, setReviewQuiz] = useState<{ quiz: Quiz; answers: (number | null)[]; score: number } | null>(null);
  const [reviewChat2Messages, setReviewChat2Messages] = useState<Message[]>([]);
  const [reviewFcIndex, setReviewFcIndex] = useState(0);
  const [reviewFcFlipped, setReviewFcFlipped] = useState(false);
  const [fcIndex, setFcIndex] = useState(0);
  const [fcFlipped, setFcFlipped] = useState(false);
  const [fcShowTranslation, setFcShowTranslation] = useState(false);
  const [shownCorrections, setShownCorrections] = useState<Set<string>>(new Set());
  // True if this page load started from a trilha step (skip topic selection screen)
  const [hasPendingTrilha] = useState(() => typeof window !== "undefined" && !!localStorage.getItem("pendingTrilhaStep"));

  // Quiz state
  const [screen, setScreen] = useState<AppScreen>("chat");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizSessionId, setQuizSessionId] = useState<string | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputBarRef = useRef<HTMLDivElement>(null);
  const [inputBarHeight, setInputBarHeight] = useState(70);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const recognitionRef = useRef<AnySpeechRecognition>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = inputBarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setInputBarHeight(el.offsetHeight));
    ro.observe(el);
    setInputBarHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  // Warn before closing tab mid-trilha
  const trilhaSaveRef = useRef({ trilhaStep, messages });
  useEffect(() => { trilhaSaveRef.current = { trilhaStep, messages }; });
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const s = trilhaSaveRef.current;
      if (s.trilhaStep && s.messages.length > 1) { e.preventDefault(); }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save trilha progress whenever state changes (localStorage + Supabase for cross-device)
  useEffect(() => {
    if (!trilhaStep) return;

    // Chat1 and Chat2: save messages and msgCount
    if ((trilhaPhase === "chat1" || trilhaPhase === "chat2") && messages.length > 0) {
      try {
        localStorage.setItem(`trilhaContinue_${trilhaStep.id}`, JSON.stringify({ messages, msgCount: trilhaMsgCount, phase: trilhaPhase }));
      } catch {}
      fetch("/api/trilha-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId: trilhaStep.id, messages, msgCount: trilhaMsgCount, phase: trilhaPhase }),
      }).catch(() => {});
    }

    // Flashcards: save index and flipped state
    if (trilhaPhase === "flashcards" && trilhaFlashcards.length > 0) {
      try {
        localStorage.setItem(`trilhaContinue_${trilhaStep.id}`, JSON.stringify({ phase: "flashcards", fcIndex, fcFlipped }));
      } catch {}
      fetch("/api/trilha-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId: trilhaStep.id, phase: "flashcards", flashcardIndex: fcIndex, flashcardFlipped: fcFlipped }),
      }).catch(() => {});
    }

    // Quiz: save quiz state (current question, answers)
    if (trilhaPhase === "quiz" && quiz) {
      try {
        localStorage.setItem(`trilhaContinue_${trilhaStep.id}`, JSON.stringify({ phase: "quiz", quizState: { currentQ, answers, total: quiz.questions.length } }));
      } catch {}
      fetch("/api/trilha-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId: trilhaStep.id, phase: "quiz", quizData: { currentQ, answers, total: quiz.questions.length } }),
      }).catch(() => {});
    }
  }, [messages, trilhaStep, trilhaPhase, trilhaMsgCount, fcIndex, fcFlipped, trilhaFlashcards.length, currentQ, answers, quiz]);

  // Also save on page unload (e.g., navigating via browser back or home button)
  useEffect(() => {
    function handleUnload() {
      if (!trilhaStep || trilhaPhase !== "chat1" || messages.length === 0) return;
      try {
        localStorage.setItem(
          `trilhaContinue_${trilhaStep.id}`,
          JSON.stringify({ messages, msgCount: trilhaMsgCount })
        );
      } catch {}
    }
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [trilhaStep, trilhaPhase, messages, trilhaMsgCount]);

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then(async (d) => {
      const pro = d.plan === "pro";
      setIsPro(pro);
      localStorage.setItem("userPlan", d.plan ?? "free");
      if (!pro && typeof d.messagesUsed === "number") setMessagesUsed(d.messagesUsed);
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
          const phase: "chat1" | "flashcards" | "quiz" | "chat2" | "review" = parsed.phase ?? "chat1";
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { phase: _p, isTrilha: _isTrilha, ...step } = parsed;
          setTrilhaStep(step as TrailStep);
          setTrilhaPhase(phase);

          // Create a topic based on the trilha step
          const trailStep = step as TrailStep;
          const trilhaTopic: TopicDef = {
            id: `trilha_${trailStep.id}`,
            emoji: trailStep.emoji,
            label: trailStep.title,
            desc: trailStep.desc,
            color: "#f59e0b", // amber color for trail topics
          };
          setTopic(trilhaTopic);

          // Review mode: load saved conversation read-only, no new AI call
          if (phase === "review") {
            setIsLoading(true);
            const stepId = (step as TrailStep).id;
            // 1. Load chat: try localStorage first, then Supabase as fallback
            let chatLoaded = false;
            try {
              const chatRaw = localStorage.getItem(`trilhaReview_chat_${stepId}`);
              if (chatRaw) {
                const parsed = JSON.parse(chatRaw);
                if (parsed?.length > 0) { setMessages(parsed); chatLoaded = true; }
              }
            } catch {}
            if (!chatLoaded) {
              try {
                const sessionRes = await fetch(`/api/trilha-session?stepId=${stepId}`);
                const sessionData = await sessionRes.json();
                if (sessionData.session?.messages?.length > 0) {
                  setMessages(sessionData.session.messages as Message[]);
                  chatLoaded = true;
                }
              } catch {}
            }
            // 2. Load flashcards, quiz and chat2 from localStorage
            let hasFc = false;
            let hasQuiz = false;
            let hasChat2 = false;
            try {
              const fcRaw = localStorage.getItem(`trilhaReview_fc_${stepId}`);
              if (fcRaw) { setReviewFlashcards(JSON.parse(fcRaw)); hasFc = true; }
            } catch {}
            try {
              const qRaw = localStorage.getItem(`trilhaReview_quiz_${stepId}`);
              if (qRaw) { setReviewQuiz(JSON.parse(qRaw)); hasQuiz = true; }
            } catch {}
            try {
              const c2Raw = localStorage.getItem(`trilhaReview_chat2_${stepId}`);
              if (c2Raw) { const parsed = JSON.parse(c2Raw); if (parsed?.length > 0) { setReviewChat2Messages(parsed); hasChat2 = true; } }
            } catch {}
            // 3. Fallback: fetch flashcards and quiz from Supabase if localStorage is missing
            if (!hasFc || !hasQuiz) {
              try {
                const supaRes = await fetch(`/api/trilha-review?stepId=${stepId}`);
                const supaData = await supaRes.json();
                if (!hasFc && supaData.flashcards?.length > 0) {
                  setReviewFlashcards(supaData.flashcards);
                  hasFc = true;
                  try { localStorage.setItem(`trilhaReview_fc_${stepId}`, JSON.stringify(supaData.flashcards)); } catch {}
                }
                if (!hasQuiz && supaData.quiz) {
                  setReviewQuiz(supaData.quiz);
                  hasQuiz = true;
                  try { localStorage.setItem(`trilhaReview_quiz_${stepId}`, JSON.stringify(supaData.quiz)); } catch {}
                }
              } catch {}
            }
            // 4. Auto-navigate to first section with data
            if (!chatLoaded && hasFc) setReviewPhase("flashcards");
            else if (!chatLoaded && hasQuiz) setReviewPhase("quiz");
            else if (!chatLoaded && hasChat2) setReviewPhase("chat2");
            setIsLoading(false);
            return;
          }

          // Restore saved session — check Supabase first (cross-device), then localStorage
          if (phase === "chat1" || phase === "chat2") {
            setIsLoading(true);
            let savedMessages: unknown[] | null = null;
            let savedMsgCount = 0;
            // 1. Supabase (works across devices)
            try {
              const sessionRes = await fetch(`/api/trilha-session?stepId=${(step as TrailStep).id}`);
              const sessionData = await sessionRes.json();
              if (sessionData.session?.messages?.length > 0) {
                savedMessages = sessionData.session.messages;
                savedMsgCount = sessionData.session.msg_count ?? 0;
              }
            } catch {}
            // 2. Fallback: localStorage (same-device cache)
            if (!savedMessages?.length) {
              try {
                const local = localStorage.getItem(`trilhaContinue_${(step as TrailStep).id}`);
                if (local) {
                  const parsed = JSON.parse(local);
                  if (parsed?.messages?.length > 0) {
                    savedMessages = parsed.messages;
                    savedMsgCount = parsed.msgCount ?? 0;
                  }
                }
              } catch {}
            }
            if (savedMessages && savedMessages.length > 0) {
              setMessages(savedMessages as Message[]);
              setTrilhaMsgCount(savedMsgCount);
              setIsLoading(false);
              return;
            }
          }

          // Restore flashcards state
          if (phase === "flashcards") {
            setIsLoading(true);
            try {
              // First try to restore flashcards from localStorage/Supabase
              let flashcards: TrilhaFlashcard[] = [];
              let savedFcIndex = 0;
              let savedFcFlipped = false;

              // Get flashcards from localStorage (review mode)
              try {
                const fcRaw = localStorage.getItem(`trilhaReview_fc_${(step as TrailStep).id}`);
                if (fcRaw) flashcards = JSON.parse(fcRaw);
              } catch {}

              // Get current position from Supabase
              try {
                const sessionRes = await fetch(`/api/trilha-session?stepId=${(step as TrailStep).id}`);
                const sessionData = await sessionRes.json();
                if (sessionData.session?.flashcard_index !== null && sessionData.session?.flashcard_index !== undefined) {
                  savedFcIndex = sessionData.session.flashcard_index;
                  savedFcFlipped = sessionData.session.flashcard_flipped ?? false;
                }
              } catch {}

              if (flashcards.length > 0) {
                setTrilhaFlashcards(flashcards);
                setFcIndex(savedFcIndex);
                setFcFlipped(savedFcFlipped);
                setScreen("trail-fc");
              } else {
                // No flashcards found, try to regenerate them from saved chat1 messages
                const savedChat1Messages = (await (async () => {
                  try {
                    const sessionRes = await fetch(`/api/trilha-session?stepId=${(step as TrailStep).id}`);
                    const sessionData = await sessionRes.json();
                    return sessionData.session?.messages ?? null;
                  } catch { return null; }
                })());
                if (savedChat1Messages && savedChat1Messages.length > 0) {
                  // Regenerate flashcards from saved messages
                  setTrilhaChat1Messages(savedChat1Messages);
                  setMessages(savedChat1Messages);
                  setScreen("loading-flashcards");
                  try {
                    const res = await fetch("/api/flashcards/generate", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ messages: savedChat1Messages, topic: "free", packName: (step as TrailStep).title }),
                    });
                    const data = await res.json();
                    if (data.cards && data.cards.length > 0) {
                      setTrilhaFlashcards(data.cards);
                      setFcIndex(0);
                      setFcFlipped(false);
                      setScreen("trail-fc");
                      try { localStorage.setItem(`trilhaReview_fc_${(step as TrailStep).id}`, JSON.stringify(data.cards)); } catch {}
                      try { localStorage.setItem(`trilhaContinue_${(step as TrailStep).id}`, JSON.stringify({ phase: "flashcards", fcIndex: 0, fcFlipped: false })); } catch {}
                      fetch("/api/trilha-session", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ stepId: (step as TrailStep).id, phase: "flashcards", flashcardIndex: 0, flashcardFlipped: false }),
                      }).catch(() => {});
                    } else {
                      // Flashcard regeneration failed — go straight to quiz
                      await generateTrailQuiz(savedChat1Messages);
                    }
                  } catch {
                    await generateTrailQuiz(savedChat1Messages);
                  }
                } else {
                  setIsLoading(false);
                  router.push("/app/trilha");
                }
                return;
              }
            } catch {}
            setIsLoading(false);
          }

          // Restore quiz state
          if (phase === "quiz") {
            setIsLoading(true);
            try {
              let quiz_data = null;
              let quiz_obj = null;
              let sessionId = null;

              // Get quiz data from localStorage first (which includes full quiz object and sessionId)
              try {
                const qRaw = localStorage.getItem(`trilhaReview_quiz_${(step as TrailStep).id}`);
                if (qRaw) {
                  const parsed = JSON.parse(qRaw);
                  quiz_obj = parsed.quiz ?? null;
                  sessionId = parsed.sessionId ?? null;
                }
              } catch {}

              // Get current progress from Supabase
              try {
                const sessionRes = await fetch(`/api/trilha-session?stepId=${(step as TrailStep).id}`);
                const sessionData = await sessionRes.json();
                const supabaseQuizData = sessionData.session?.quiz_data;
                if (supabaseQuizData) {
                  quiz_data = supabaseQuizData;
                  if (supabaseQuizData.sessionId) sessionId = supabaseQuizData.sessionId;
                }
              } catch {}

              if (quiz_data && quiz_obj) {
                setQuiz(quiz_obj);
                setQuizSessionId(sessionId);
                setCurrentQ(quiz_data.currentQ ?? 0);
                setAnswers(quiz_data.answers ?? []);
                setShowExplanation(false);
                setScore(0);
                setScreen("quiz");
              } else {
                // Quiz not found, go back to trilha
                router.push("/app/trilha");
              }
            } catch {}
            setIsLoading(false);
          }

          // Fresh start: AI opens the conversation
          const ctx = phase === "chat2"
            ? `${(step as TrailStep).context}\n\nPRACTICE SESSION — The student has already had an initial conversation on this topic and just reviewed the key vocabulary with flashcards. Now guide a warm follow-up practice where they naturally use the vocabulary they studied. Be encouraging.`
            : (step as TrailStep).context;
          if (phase !== "chat1") setIsLoading(true); // chat1 already set isLoading above
          const stepId = (step as TrailStep).id;
          fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: [], level: d.level ?? localStorage.getItem("userLevel") ?? null, topic: "free", topicStart: true, stepContext: ctx, stepLevel: (step as TrailStep).level }),
          }).then((r) => r.json()).then((chatData) => {
            if (chatData.reply) {
              const initialMsgs = [{ role: "assistant" as const, content: chatData.reply, translation: chatData.translation ?? undefined }];
              setMessages(initialMsgs);
              // Save even the initial AI message so the user can return and continue
              if (phase === "chat1") {
                try {
                  localStorage.setItem(`trilhaContinue_${stepId}`, JSON.stringify({ messages: initialMsgs, msgCount: 0 }));
                } catch {}
              }
            }
          }).finally(() => setIsLoading(false));
        } catch {}
      }
    });
  }, [router]);

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
        body: JSON.stringify({ messages: withFixTags(updatedMessages), level, topic: trilhaStep ? "free" : topic?.id ?? "free", stepContext: activeStepContext, stepLevel: trilhaStep?.level }),
      });
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Ops, tive um problema. Tente enviar de novo!" }]);
        return;
      }
      const data = await res.json();
      if (data.limitReached) { setLimitReached(true); setMessages((prev) => prev.slice(0, -1)); return; }
      if (!isPro) setMessagesUsed((n) => Math.min(n + 1, 5));
      if (!data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Ops, não consegui responder. Tente de novo!" }]);
        return;
      }
      const newCorrections = (data.corrections ?? []).filter(
        (c: { wrongSentence?: string; wrong: string }) => {
          const key = (c.wrongSentence ?? c.wrong).toLowerCase().trim();
          return !shownCorrections.has(key);
        }
      );
      if (newCorrections.length > 0) {
        setShownCorrections((prev) => {
          const next = new Set(prev);
          newCorrections.forEach((c: { wrongSentence?: string; wrong: string }) => next.add((c.wrongSentence ?? c.wrong).toLowerCase().trim()));
          return next;
        });
      }
      setPendingSpeak(null); // clear stale pending audio from previous message
      const newAssistantMsg = { role: "assistant" as const, content: data.reply, translation: data.translation ?? undefined, corrections: newCorrections.length ? newCorrections : undefined };
      setMessages((prev) => [...prev, newAssistantMsg]);
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
          const shuffled = shuffleQuizOptions(data.quiz);
          setQuiz(shuffled);
          setQuizSessionId(data.sessionId ?? null);
          setAnswers(new Array(shuffled.questions.length).fill(null));
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
      // Save to Supabase — always send quiz data so server can insert if sessionId is missing
      await fetch("/api/quiz", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: quizSessionId,
          score: finalScore,
          answers,
          quiz: quiz ? { title: quiz.title, questions: quiz.questions } : null,
          level,
        }),
      });
      // Trilha: save quiz score for use in finalizePractice (startChat2 resets score/quiz state)
      if (trilhaStep && trilhaPhase === "chat1") {
        setTrilhaQuizScore({ score: finalScore, total: quiz?.questions.length ?? 0 });
        // Save for review mode (localStorage + link quiz session to step in Supabase)
        const reviewQuizData = { quiz, answers: [...answers], score: finalScore };
        try { localStorage.setItem(`trilhaReview_quiz_${trilhaStep.id}`, JSON.stringify(reviewQuizData)); } catch {}
      }
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
    if (trilhaStep && trilhaPhase === "chat1") {
      try { localStorage.removeItem(`trilhaContinue_${trilhaStep.id}`); } catch {}
      fetch("/api/trilha-session", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stepId: trilhaStep.id }) }).catch(() => {});
    }
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
    setTrilhaQuizScore(null);
    setFcIndex(0);
    setFcFlipped(false);
    setFcShowTranslation(false);
    setLimitReached(false);
    setShownCorrections(new Set());
  }

  async function proceedToFlashcards() {
    if (!trilhaStep) return;
    setTrilhaPhase("flashcards");
    // Save conversation for review mode
    try { localStorage.setItem(`trilhaReview_chat_${trilhaStep.id}`, JSON.stringify(messages)); } catch {}
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
        // Save for review mode
        try { localStorage.setItem(`trilhaReview_fc_${trilhaStep.id}`, JSON.stringify(data.cards)); } catch {}
        // Save state to localStorage (so if user leaves, we can restore to flashcards)
        try { localStorage.setItem(`trilhaContinue_${trilhaStep.id}`, JSON.stringify({ phase: "flashcards", fcIndex: 0, fcFlipped: false })); } catch {}
        // Save state to Supabase
        fetch("/api/trilha-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepId: trilhaStep.id, phase: "flashcards", flashcardIndex: 0, flashcardFlipped: false }),
        }).catch(() => {});
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
    if (trilhaStep) setTrilhaPhase("quiz");
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs, level }),
      });
      const data = await res.json();
      if (data.quiz) {
        setQuiz(data.quiz);
        const sessionId = data.sessionId ?? null;
        setQuizSessionId(sessionId);
        const newAnswers = new Array(data.quiz.questions.length).fill(null);
        setAnswers(newAnswers);
        setCurrentQ(0);
        setShowExplanation(false);
        setScore(0);
        setScreen("quiz");
        // Save for review mode
        try {
          localStorage.setItem(`trilhaReview_quiz_${trilhaStep!.id}`, JSON.stringify({ quiz: data.quiz, answers: newAnswers, score: 0, sessionId }));
        } catch {}
        // Save state to localStorage (so if user leaves, we can restore to quiz)
        try {
          localStorage.setItem(`trilhaContinue_${trilhaStep!.id}`, JSON.stringify({ phase: "quiz", currentQ: 0, answers: newAnswers, total: data.quiz.questions.length }));
        } catch {}
        // Save initial quiz state to Supabase
        if (trilhaStep) {
          fetch("/api/trilha-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stepId: trilhaStep.id, phase: "quiz", quizData: { currentQ: 0, answers: newAnswers, total: data.quiz.questions.length, sessionId } }),
          }).catch(() => {});
        }
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
        body: JSON.stringify({ messages: [], level, topic: "free", topicStart: true, stepContext: ctx, stepLevel: trilhaStep.level }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.reply) {
        const initialMsgs = [{ role: "assistant" as const, content: data.reply, translation: data.translation ?? undefined }];
        setMessages(initialMsgs);
        // Save state to localStorage (so if user leaves, we can restore to chat2)
        try { localStorage.setItem(`trilhaContinue_${trilhaStep.id}`, JSON.stringify({ messages: initialMsgs, msgCount: 0, phase: "chat2" })); } catch {}
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function finalizePractice() {
    if (!trilhaStep) return;
    let savedScore: number = trilhaQuizScore?.score ?? 0;
    let savedTotal: number = trilhaQuizScore?.total ?? 0;
    // Fallback: if state was lost (navigation/refresh), recover from localStorage
    if (!trilhaQuizScore) {
      try {
        const stored = localStorage.getItem(`trilhaReview_quiz_${trilhaStep.id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (typeof parsed.score === "number") savedScore = parsed.score;
          if (Array.isArray(parsed.quiz?.questions)) savedTotal = parsed.quiz.questions.length;
        }
      } catch {}
    }
    // Save chat2 messages for review mode
    try { localStorage.setItem(`trilhaReview_chat2_${trilhaStep.id}`, JSON.stringify(messages)); } catch {}
    await fetch("/api/trilha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId: trilhaStep.id, score: savedScore, total: savedTotal }),
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

    async function shareQuizResult() {
      if (sharing || shared) return;
      setSharing(true);
      const resultEmoji = pct >= 80 ? "🏆" : pct >= 60 ? "💪" : "📚";
      const content = `${resultEmoji} Just scored ${score}/${total} (${pct}%) on a quiz!\n\n"${quiz!.title}"`;
      try {
        await fetch("/api/community/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, isShare: true }),
        });
        setShared(true);
      } finally {
        setSharing(false);
      }
    }
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

          <button
            onClick={shareQuizResult}
            disabled={sharing || shared}
            className="w-full py-3 rounded-xl font-bold text-sm"
            style={{ background: shared ? "rgba(74,222,128,.15)" : "rgba(255,255,255,.06)", color: shared ? "#4ade80" : "var(--gray)", border: `1px solid ${shared ? "rgba(74,222,128,.3)" : "#2a2a2a"}`, cursor: sharing || shared ? "default" : "pointer" }}
          >
            {shared ? "✓ Compartilhado na comunidade!" : sharing ? "Compartilhando..." : "🌐 Compartilhar resultado na comunidade"}
          </button>

          <div className="flex gap-3 w-full">
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
  if (!topic && !isLoading && messages.length === 0 && !hasPendingTrilha) {
    return (
      <div className="flex flex-col items-center px-3 sm:px-4" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", height: "100dvh", paddingTop: "calc(65px + env(safe-area-inset-top))", paddingBottom: 70 }}>
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
      </div>
    );
  }

  // ── Chat Screen ──────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col items-center px-3 sm:px-4"
      style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", height: "100dvh", overflow: "hidden", paddingTop: "calc(65px + env(safe-area-inset-top))", paddingBottom: 0 }}
    >

      {/* ── Trilha phase banner ────────────────────────────── */}
      {trilhaStep && trilhaPhase && (
        <div className="w-full max-w-2xl mb-2 px-3 py-2 flex items-center justify-between gap-2" style={{ background: "rgba(245,200,0,0.06)", border: "1px solid rgba(245,200,0,0.2)", borderRadius: "10px" }}>
          <div className="flex items-center gap-2">
            <a href="/app/trilha" title="Voltar à Trilha" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, background: "rgba(245,200,0,0.1)", border: "1px solid rgba(245,200,0,0.25)", borderRadius: 8, flexShrink: 0, textDecoration: "none" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
            </a>
            <span style={{ fontSize: "1rem" }}>{trilhaStep.emoji}</span>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--yellow)" }}>{trilhaStep.title}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--gray)" }}>
            {trilhaPhase === "review" ? (
              <>
                {(["chat", "flashcards", "quiz", "chat2"] as const).map((p, i) => {
                  const label = ["1", "2", "3", "4"][i];
                  const hasData = p === "chat" ? messages.length > 0 : p === "flashcards" ? reviewFlashcards.length > 0 : p === "quiz" ? !!reviewQuiz : reviewChat2Messages.length > 0;
                  const isActive = reviewPhase === p;
                  return (
                    <span key={p} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {i > 0 && <span style={{ color: "var(--gray2)" }}>›</span>}
                      <button
                        onClick={() => hasData && setReviewPhase(p)}
                        style={{ fontWeight: 700, color: isActive ? "var(--yellow)" : hasData ? "#4ade80" : "var(--gray2)", background: "none", border: "none", cursor: hasData ? "pointer" : "default", padding: "2px 4px", borderRadius: 4, fontSize: "0.75rem", textDecoration: isActive ? "underline" : "none" }}
                      >
                        {hasData ? "✓" : ""}{label}
                      </button>
                    </span>
                  );
                })}
              </>
            ) : (
              <>
                <span style={{ color: "#4ade80", fontWeight: 700 }}>✓1</span>
                <span style={{ color: "var(--gray2)" }}>›</span>
                {screen === "chat" && trilhaPhase === "chat1" ? (
                  <>
                    <span style={{ color: "var(--yellow)", fontWeight: 700 }}>●1</span>
                    <span style={{ color: "var(--gray2)" }}>›</span>
                    <span>2</span>
                    <span style={{ color: "var(--gray2)" }}>›</span>
                    <span>3</span>
                    <span style={{ color: "var(--gray2)" }}>›</span>
                    <span>4</span>
                  </>
                ) : screen === "trail-fc" ? (
                  <>
                    <span style={{ color: "#4ade80", fontWeight: 700 }}>✓1</span>
                    <span style={{ color: "var(--gray2)" }}>›</span>
                    <span style={{ color: "var(--yellow)", fontWeight: 700 }}>●2</span>
                    <span style={{ color: "var(--gray2)" }}>›</span>
                    <span>3</span>
                    <span style={{ color: "var(--gray2)" }}>›</span>
                    <span>4</span>
                  </>
                ) : screen === "quiz" ? (
                  <>
                    <span style={{ color: "#4ade80", fontWeight: 700 }}>✓1</span>
                    <span style={{ color: "var(--gray2)" }}>›</span>
                    <span style={{ color: "#4ade80", fontWeight: 700 }}>✓2</span>
                    <span style={{ color: "var(--gray2)" }}>›</span>
                    <span style={{ color: "var(--yellow)", fontWeight: 700 }}>●3</span>
                    <span style={{ color: "var(--gray2)" }}>›</span>
                    <span>4</span>
                  </>
                ) : screen === "chat" && trilhaPhase === "chat2" ? (
                  <>
                    <span style={{ color: "#4ade80", fontWeight: 700 }}>✓1</span>
                    <span style={{ color: "var(--gray2)" }}>›</span>
                    <span style={{ color: "#4ade80", fontWeight: 700 }}>✓2</span>
                    <span style={{ color: "var(--gray2)" }}>›</span>
                    <span style={{ color: "#4ade80", fontWeight: 700 }}>✓3</span>
                    <span style={{ color: "var(--gray2)" }}>›</span>
                    <span style={{ color: "var(--yellow)", fontWeight: 700 }}>●4</span>
                  </>
                ) : (
                  <>
                    <span>2</span>
                    <span style={{ color: "var(--gray2)" }}>›</span>
                    <span>3</span>
                    <span style={{ color: "var(--gray2)" }}>›</span>
                    <span>4</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Review: Flashcards ─────────────────────────────── */}
      {trilhaPhase === "review" && reviewPhase === "flashcards" && (
        <div className="w-full max-w-2xl flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 p-1" style={{ marginBottom: inputBarHeight }}>
          {reviewFlashcards.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--gray)", paddingTop: 40 }}>Flashcards não disponíveis neste dispositivo.</div>
          ) : (
            <>
              <p style={{ fontSize: "0.7rem", color: "var(--gray)", textAlign: "center" }}>{reviewFcIndex + 1}/{reviewFlashcards.length}</p>
              <div
                onClick={() => setReviewFcFlipped(f => !f)}
                style={{ background: "var(--dark1)", border: "1px solid #2a2a2a", borderRadius: 16, padding: "28px 20px", cursor: "pointer", textAlign: "center", minHeight: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                {!reviewFcFlipped ? (
                  <>
                    <p style={{ fontSize: "1.4rem", fontWeight: 800, color: "#fff" }}>{reviewFlashcards[reviewFcIndex].word}</p>
                    {reviewFlashcards[reviewFcIndex].phonetic && <p style={{ fontSize: "0.8rem", color: "var(--gray)" }}>{reviewFlashcards[reviewFcIndex].phonetic}</p>}
                    <p style={{ fontSize: "0.7rem", color: "var(--gray2)", marginTop: 8 }}>Toque para ver a tradução</p>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: "1rem", fontWeight: 700, color: "var(--yellow)" }}>{reviewFlashcards[reviewFcIndex].translation}</p>
                    {reviewFlashcards[reviewFcIndex].example && <p style={{ fontSize: "0.8rem", color: "var(--gray)", fontStyle: "italic", marginTop: 6 }}>{reviewFlashcards[reviewFcIndex].example}</p>}
                  </>
                )}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setReviewFcIndex(i => Math.max(0, i - 1)); setReviewFcFlipped(false); }} disabled={reviewFcIndex === 0}
                  style={{ flex: 1, padding: "10px", background: "var(--dark2)", border: "none", borderRadius: 12, color: "var(--gray)", fontWeight: 700, cursor: "pointer", opacity: reviewFcIndex === 0 ? 0.4 : 1 }}>← Anterior</button>
                <button onClick={() => { setReviewFcIndex(i => Math.min(reviewFlashcards.length - 1, i + 1)); setReviewFcFlipped(false); }} disabled={reviewFcIndex === reviewFlashcards.length - 1}
                  style={{ flex: 1, padding: "10px", background: "var(--dark2)", border: "none", borderRadius: 12, color: "var(--gray)", fontWeight: 700, cursor: "pointer", opacity: reviewFcIndex === reviewFlashcards.length - 1 ? 0.4 : 1 }}>Próximo →</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Review: Quiz ───────────────────────────────────── */}
      {trilhaPhase === "review" && reviewPhase === "quiz" && (
        <div className="w-full max-w-2xl flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 p-1" style={{ marginBottom: inputBarHeight }}>
          {!reviewQuiz ? (
            <div style={{ textAlign: "center", color: "var(--gray)", paddingTop: 40 }}>Quiz não disponível neste dispositivo.</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#fff" }}>{reviewQuiz.quiz.title}</p>
                <span style={{ fontSize: "0.8rem", fontWeight: 800, color: reviewQuiz.score / reviewQuiz.quiz.questions.length >= 0.8 ? "#4ade80" : "var(--yellow)" }}>
                  {reviewQuiz.score}/{reviewQuiz.quiz.questions.length} ✓
                </span>
              </div>
              {reviewQuiz.quiz.questions.map((q, i) => {
                const chosen = reviewQuiz.answers[i];
                const correct = q.correct;
                return (
                  <div key={i} style={{ background: "var(--dark1)", border: `1px solid ${chosen === correct ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`, borderRadius: 12, padding: "12px 14px" }}>
                    <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fff", marginBottom: 8 }}>{i + 1}. {q.question}</p>
                    {q.options.map((opt, oi) => (
                      <div key={oi} style={{ fontSize: "0.78rem", padding: "5px 8px", borderRadius: 8, marginBottom: 4,
                        background: oi === correct ? "rgba(74,222,128,0.1)" : oi === chosen && chosen !== correct ? "rgba(248,113,113,0.1)" : "transparent",
                        color: oi === correct ? "#4ade80" : oi === chosen && chosen !== correct ? "#f87171" : "var(--gray)" }}>
                        {oi === correct ? "✓ " : oi === chosen && chosen !== correct ? "✗ " : "  "}{opt}
                      </div>
                    ))}
                    {q.explanation && <p style={{ fontSize: "0.7rem", color: "var(--gray2)", marginTop: 6, fontStyle: "italic" }}>{q.explanation}</p>}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ── Review: Chat2 (prática de vocabulário) ──────────── */}
      {trilhaPhase === "review" && reviewPhase === "chat2" && (
        <div className="w-full max-w-2xl flex-1 min-h-0 overflow-y-auto p-3 sm:p-4"
          style={{ background: "var(--dark1)", border: "1px solid #1f1f1f", borderRadius: "var(--radius)", marginBottom: inputBarHeight }}>
          {reviewChat2Messages.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--gray)", paddingTop: 40 }}>Prática não disponível neste dispositivo.</div>
          ) : (
            reviewChat2Messages.map((msg, i) => (
              <div key={i} className={`mb-3 flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-2`}>
                {msg.role === "assistant" && <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--yellow)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", flexShrink: 0 }}>🎓</div>}
                <div style={{ maxWidth: "80%", padding: "10px 13px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: msg.role === "user" ? "var(--yellow)" : "var(--dark2)", color: msg.role === "user" ? "#000" : "#fff", fontSize: "0.85rem", lineHeight: 1.5 }}>
                  {msg.content}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Chat area ──────────────────────────────────────── */}
      {(trilhaPhase !== "review" || reviewPhase === "chat") && <div
        className="w-full max-w-2xl flex-1 min-h-0 p-3 sm:p-4 overflow-y-auto flex flex-col"
        style={{ background: "var(--dark1)", border: "1px solid #1f1f1f", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", marginBottom: inputBarHeight }}
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

        {/* ── Review mode: no chat saved ──────────────────── */}
        {messages.length === 0 && trilhaPhase === "review" && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="text-3xl">💬</div>
            <p className="text-sm font-semibold text-white">Conversa não disponível</p>
            <p className="text-xs max-w-xs" style={{ color: "var(--gray)" }}>
              A conversa deste dispositivo não foi salva. Use os botões acima para ver os flashcards ou quiz.
            </p>
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

        {/* Spacer — empurra as mensagens para baixo quando poucas */}
        <div style={{ flex: 1 }} />

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
              {msg.role === "assistant" && msg.corrections && msg.corrections.length > 0 && (() => {
                const corrections = msg.corrections;
                const mainCorrection = corrections[0];
                const wrongSentence = mainCorrection.wrongSentence ?? mainCorrection.wrong;
                const rightSentence = mainCorrection.rightSentence ?? mainCorrection.right;

                // Mark all wrong words from all corrections
                const wrongWords = wrongSentence.split(" ");
                const rightWords = rightSentence.split(" ");
                const errorIndices = new Set<number>();

                corrections.forEach((c) => {
                  const cWrongWords = (c.wrongSentence ?? c.wrong).split(" ");
                  const cRightWords = (c.rightSentence ?? c.right).split(" ");
                  cWrongWords.forEach((w, i) => {
                    const rw = cRightWords[i] ?? "";
                    if (w.toLowerCase().replace(/[^a-z]/g, "") !== rw.toLowerCase().replace(/[^a-z]/g, "")) {
                      errorIndices.add(i);
                    }
                  });
                });

                const wrongHighlighted = wrongWords.map((w, i) =>
                  errorIndices.has(i)
                    ? <span key={i} style={{ color: "#f87171", fontWeight: 700 }}>{w} </span>
                    : <span key={i}>{w} </span>
                );

                const rightHighlighted = rightWords.map((w, i) =>
                  errorIndices.has(i)
                    ? <span key={i} style={{ color: "#4ade80", fontWeight: 700 }}>{w} </span>
                    : <span key={i}>{w} </span>
                );

                const phonetics = corrections.map(c => c.phonetic).filter(Boolean).join(" · ");

                return (
                  <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--gray)" }}>
                      {corrections.length === 1 ? "Correção" : `${corrections.length} Correções`}
                    </div>
                    <div style={{ fontSize: "0.8rem", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "8px", padding: "5px 10px", lineHeight: 1.5 }}>
                      ❌ {wrongHighlighted}
                    </div>
                    <div style={{ fontSize: "0.8rem", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: "8px", padding: "5px 10px", lineHeight: 1.5 }}>
                      ✅ {rightHighlighted}
                    </div>
                    {phonetics && (
                      <div style={{ fontSize: "0.72rem", color: "var(--gray)", fontStyle: "italic", paddingLeft: "4px" }}>
                        🗣️ {phonetics}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "6px", marginTop: "2px" }}>
                      <button
                        onClick={() => { unlockAudio(); speak(rightSentence); }}
                        disabled={isSpeaking || isLoading}
                        title="Ouvir a frase corrigida"
                        style={{ background: "transparent", border: "1px solid rgba(74,222,128,0.3)", borderRadius: "50px", padding: "2px 10px", fontSize: "0.68rem", color: "#4ade80", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", opacity: isSpeaking || isLoading ? 0.4 : 1 }}
                      >
                        🔊 Ouvir
                      </button>
                      <button
                        onClick={() => { unlockAudio(); speak(rightSentence, true); }}
                        disabled={isSpeaking || isLoading}
                        title="Ouvir a frase corrigida devagar"
                        style={{ background: "transparent", border: "1px solid rgba(74,222,128,0.3)", borderRadius: "50px", padding: "2px 10px", fontSize: "0.68rem", color: "#4ade80", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", opacity: isSpeaking || isLoading ? 0.4 : 1 }}
                      >
                        🐢 Devagar
                      </button>
                    </div>
                  </div>
                );
              })()}
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
      </div>}

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

      {/* ── Input bar fixo — estilo WhatsApp ───────────────── */}
      {trilhaPhase !== "review" && (
        <div ref={inputBarRef} style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#111", borderTop: "1px solid #1e1e1e", padding: "8px 12px", paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))", zIndex: 100 }}>

          {/* Áudio bloqueado */}
          {pendingSpeak && !isSpeaking && (
            <button onClick={() => { const t = pendingSpeak; setPendingSpeak(null); speak(t); }} style={{ width: "100%", marginBottom: 8, padding: "8px 0", borderRadius: 12, background: "rgba(245,200,0,0.1)", border: "1px solid rgba(245,200,0,0.35)", color: "var(--yellow)", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
              🔊 Toque para ouvir a resposta
            </button>
          )}

          {/* Botões de ação da trilha */}
          {trilhaPhase === "chat1" && !limitReached && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
              <p style={{ textAlign: "center", fontSize: "0.72rem", fontWeight: 600, color: "var(--gray)", margin: 0 }}>
                {trilhaMsgCount}/8 mensagens enviadas{trilhaMsgCount < 8 ? " — continue conversando!" : " — pronto para avançar!"}
              </p>
              <button onClick={proceedToFlashcards} disabled={isLoading || trilhaMsgCount < 8} style={{ width: "100%", padding: "8px 0", borderRadius: 12, background: trilhaMsgCount >= 8 ? "var(--yellow)" : "rgba(245,200,0,0.08)", border: "1px solid rgba(245,200,0,0.35)", color: trilhaMsgCount >= 8 ? "var(--black)" : "var(--yellow)", fontSize: "0.82rem", fontWeight: 700, cursor: trilhaMsgCount >= 8 ? "pointer" : "default", opacity: (isLoading || trilhaMsgCount < 8) ? 0.5 : 1 }}>
                {trilhaMsgCount >= 8 ? "🃏 Ir para vocabulário →" : "🔒 Ir para vocabulário (faltam " + (8 - trilhaMsgCount) + ")"}
              </button>
            </div>
          )}
          {trilhaPhase === "chat2" && !limitReached && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
              <p style={{ textAlign: "center", fontSize: "0.72rem", fontWeight: 600, color: "var(--gray)", margin: 0 }}>
                {trilhaMsgCount}/4 mensagens enviadas{trilhaMsgCount < 4 ? " — pratique mais um pouco!" : " — pronto para concluir!"}
              </p>
              <button onClick={finalizePractice} disabled={isLoading || trilhaMsgCount < 4} style={{ width: "100%", padding: "8px 0", borderRadius: 12, background: trilhaMsgCount >= 4 ? "rgba(74,222,128,0.15)" : "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.4)", color: "#4ade80", fontSize: "0.82rem", fontWeight: 700, cursor: trilhaMsgCount >= 4 ? "pointer" : "default", opacity: (isLoading || trilhaMsgCount < 4) ? 0.5 : 1 }}>
                {trilhaMsgCount >= 4 ? "✅ Finalizar prática e concluir etapa" : "🔒 Finalizar prática (faltam " + (4 - trilhaMsgCount) + ")"}
              </button>
            </div>
          )}

          {/* Encerrar conversa livre */}
          {!trilhaStep && messages.length >= 2 && !limitReached && (
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button onClick={() => endConversation("quiz")} disabled={isLoading} style={{ flex: 1, padding: "8px 0", borderRadius: 12, background: "transparent", border: "1px solid rgba(245,200,0,0.3)", color: "var(--yellow)", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", opacity: isLoading ? 0.4 : 1 }}>🎯 Fazer quiz</button>
              <button onClick={() => isPro ? endConversation("flashcards") : router.push("/planos")} disabled={isLoading} style={{ flex: 1, padding: "8px 0", borderRadius: 12, background: "transparent", border: `1px solid ${isPro ? "rgba(255,255,255,0.15)" : "rgba(245,200,0,0.2)"}`, color: isPro ? "var(--white)" : "var(--yellow)", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", opacity: isLoading ? 0.4 : 1 }}>
                {isPro ? "🃏 Criar flashcards" : "🔒 Criar flashcards"}
              </button>
            </div>
          )}

          {/* Contador free tier */}
          {!isPro && !limitReached && messagesUsed > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginBottom: 6 }}>
              {[1,2,3,4,5].map((i) => (<div key={i} style={{ width: 28, height: 5, borderRadius: 3, background: i <= messagesUsed ? (messagesUsed >= 4 ? "#f87171" : messagesUsed >= 3 ? "var(--yellow)" : "#4ade80") : "rgba(255,255,255,0.1)", transition: "background 0.3s" }} />))}
              <span style={{ fontSize: "0.68rem", fontWeight: 700, color: messagesUsed >= 4 ? "#f87171" : "var(--gray2)", marginLeft: 4 }}>{5 - messagesUsed} msg{5 - messagesUsed !== 1 ? "s" : ""} restante{5 - messagesUsed !== 1 ? "s" : ""}</span>
            </div>
          )}

          {/* Mic error */}
          {micError && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "7px 10px", marginBottom: 8, fontSize: "0.82rem" }}>
              <span>🎙️</span><span style={{ color: "#fca5a5", flex: 1 }}>{micError}</span>
              <button onClick={() => setMicError("")} style={{ background: "none", border: "none", color: "var(--gray2)", cursor: "pointer", fontSize: "0.85rem" }}>✕</button>
            </div>
          )}

          {/* Status de voz */}
          {(isListening || isTranscribing || isSpeaking) && (
            <div style={{ textAlign: "center", fontSize: "11px", marginBottom: 6 }}>
              {isListening ? <span style={{ color: "#ef4444" }}>● Gravando — toque em ⏹ para enviar</span>
                : isTranscribing ? <span style={{ color: "var(--yellow)" }}>● Reconhecendo sua voz...</span>
                : <span style={{ color: "var(--yellow)" }}>● Coach falando...</span>}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div style={{ display: "flex", alignItems: "center", paddingBottom: 6, flexShrink: 0 }}>
              <ChatTranslator onUse={(text) => { setInput(prev => prev ? prev + " " + text : text); }} />
            </div>
            <div style={{ flex: 1, background: "#1e1e1e", borderRadius: 24, minHeight: 44, display: "flex", alignItems: "flex-end" }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder={!topic ? "☝️ Escolha um tópico..." : "Digite uma mensagem..."}
                disabled={!topic || limitReached}
                rows={1}
                className="w-full resize-none outline-none"
                style={{ background: "transparent", color: "var(--white)", border: "none", borderRadius: 24, padding: "11px 16px", fontFamily: "'Inter', sans-serif", fontSize: "15px", lineHeight: "1.4", maxHeight: 120, overflowY: "auto", opacity: !topic ? 0.4 : 1 }}
              />
            </div>
            <button
              onClick={input.trim() ? () => sendMessage(input) : (isListening ? stopListening : startListening)}
              disabled={isLoading || isSpeaking || isTranscribing || limitReached || (!topic && !input.trim())}
              style={{ width: 44, height: 44, borderRadius: "50%", border: "none", background: isListening ? "#ef4444" : "var(--yellow)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, boxShadow: isListening ? "0 0 16px rgba(239,68,68,0.5)" : "none", transition: "background 0.15s", opacity: (isLoading || isSpeaking || isTranscribing || limitReached || (!topic && !input.trim())) ? 0.4 : 1 }}
            >
              {isTranscribing ? (
                <svg width="18" height="18" className="animate-spin" fill="none" viewBox="0 0 24 24" style={{ color: "var(--yellow)" }}>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : isListening ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
              ) : input.trim() ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 19V5M5 12l7-7 7 7" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#000"><path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-7 9h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.93V21h2v2H9v-2h2v-3.27A7 7 0 0 1 5 12z"/></svg>
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

