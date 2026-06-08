"use client";

import { useState, useRef, useEffect } from "react";
import { UserButton } from "@clerk/nextjs";

type Message = { role: "user" | "assistant"; content: string; translation?: string };
type Level = "beginner" | "intermediate" | "advanced" | null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;

const LEVEL_LABEL: Record<NonNullable<Level>, string> = {
  beginner: "Básico",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [level, setLevel] = useState<Level>(null);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [micError, setMicError] = useState("");
  const [limitReached, setLimitReached] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<AnySpeechRecognition>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  // iOS Safari requires the Audio element to be created AND played inside a user gesture.
  // We create it once, play a silent clip to activate it, then reuse it for all TTS.
  function unlockAudio() {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    const audio = new Audio();
    audioRef.current = audio;
    audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    audio.play().then(() => { audio.pause(); audio.currentTime = 0; }).catch(() => {});
  }

  async function speak(text: string) {
    const audio = audioRef.current;
    if (audio && !audio.paused) audio.pause();

    const clean = stripEmojis(text);
    if (!clean) return;

    const speed = level === "beginner" ? 0.85 : level === "advanced" ? 1.05 : 1.0;
    setIsSpeaking(true);

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, speed }),
      });

      if (!res.ok) { setIsSpeaking(false); return; }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const player = audioRef.current ?? new Audio();
      audioRef.current = player;
      player.src = url;
      player.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
      player.onerror = () => { setIsSpeaking(false); };
      player.play().catch(() => setIsSpeaking(false));
    } catch {
      setIsSpeaking(false);
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim()) return;
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
      const data = await res.json();
      if (data.limitReached) { setLimitReached(true); setMessages((prev) => prev.slice(0, -1)); return; }
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply, translation: data.translation ?? undefined }]);
      if (data.detectedLevel) setLevel(data.detectedLevel as Level);
      speak(data.reply);
    } finally {
      setIsLoading(false);
    }
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
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      setMicError("Permissão de microfone negada. Clique no cadeado na barra de endereço e permita o microfone.");
      return;
    }

    audioChunksRef.current = [];

    // Opus/WebM is best for Whisper — fall back gracefully
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
        // Always name the file with the real mime type so Whisper parses it correctly
        const ext = finalMime.includes("mp4") ? "mp4"
          : finalMime.includes("ogg") ? "ogg"
          : "webm";
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
    if (rec && rec.state === "recording") {
      rec.stop(); // triggers final ondataavailable automatically
    }
    setIsListening(false);
  }


  return (
    <div
      className="flex flex-col items-center px-3 pt-3 pb-4 sm:px-4 sm:pt-4 sm:pb-6"
      style={{
        background: "var(--black)",
        fontFamily: "'Inter', sans-serif",
        height: "100dvh",
        overflow: "hidden",
      }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="w-full max-w-2xl mb-3 flex items-center justify-between gap-2">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
            style={{ background: "var(--yellow)", color: "var(--black)" }}
          >
            JV
          </div>
          <span className="font-bold text-white text-sm leading-none">
            Fale Inglês <span style={{ color: "var(--yellow)" }}>JV</span>
          </span>
        </div>

        {/* Planos link */}
        <a href="/planos" style={{ fontSize: ".78rem", fontWeight: 700, color: "var(--yellow)", border: "1px solid rgba(245,200,0,.35)", borderRadius: "50px", padding: ".3rem .8rem", textDecoration: "none", whiteSpace: "nowrap" }}>
          Planos
        </a>

        {/* User button */}
        <UserButton />

        {/* Level pills — desktop: all three; mobile: only active */}
        <div className="hidden sm:flex gap-1.5">
          {(["beginner", "intermediate", "advanced"] as NonNullable<Level>[]).map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
              style={
                level === l
                  ? { background: "var(--yellow)", color: "var(--black)" }
                  : { background: "var(--dark2)", color: "var(--gray)", border: "1px solid #2a2a2a" }
              }
            >
              {LEVEL_LABEL[l]}
            </button>
          ))}
        </div>
        <div className="sm:hidden">
          <span
            className="px-2.5 py-1 rounded-full text-xs font-semibold"
            style={
              level
                ? { background: "var(--yellow)", color: "var(--black)" }
                : { background: "var(--dark2)", color: "var(--gray)", border: "1px solid #2a2a2a" }
            }
          >
            {level ? LEVEL_LABEL[level] : "Detectando..."}
          </span>
        </div>
      </header>

      {/* ── Chat area ──────────────────────────────────────── */}
      <div
        className="w-full max-w-2xl flex-1 min-h-0 p-3 sm:p-4 mb-3 overflow-y-auto"
        style={{
          background: "var(--dark1)",
          border: "1px solid #1f1f1f",
          borderRadius: "var(--radius)",
          boxShadow: "var(--shadow)",
        }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-6 gap-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl"
              style={{ background: "var(--yellow)", color: "var(--black)" }}
            >
              JV
            </div>
            <div>
              <p className="font-semibold text-white">Pronto para praticar!</p>
              <p className="text-sm mt-1 max-w-xs" style={{ color: "var(--gray)" }}>
                Use o microfone para falar em inglês ou escreva uma mensagem. Escolha o nível acima.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`mb-3 flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-2`}>
            {msg.role === "assistant" && (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 mb-0.5"
                style={{ background: "var(--yellow)", color: "var(--black)" }}
              >
                JV
              </div>
            )}
            <div
              className="max-w-[82%] sm:max-w-[78%] px-3 sm:px-4 py-2.5 text-sm leading-relaxed"
              style={
                msg.role === "user"
                  ? {
                      background: "var(--yellow)",
                      color: "var(--black)",
                      borderRadius: "18px 18px 4px 18px",
                      fontWeight: 500,
                    }
                  : {
                      background: "var(--dark2)",
                      color: "var(--white)",
                      borderRadius: "18px 18px 18px 4px",
                      border: "1px solid #2a2a2a",
                    }
              }
            >
              {msg.content}
              {msg.role === "assistant" && msg.translation && (
                <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.08)", color: "var(--gray)", fontSize: "0.78rem", fontStyle: "italic" }}>
                  🇧🇷 {msg.translation}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-end gap-2 mb-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
              style={{ background: "var(--yellow)", color: "var(--black)" }}
            >
              JV
            </div>
            <div
              className="px-4 py-3 text-sm"
              style={{ background: "var(--dark2)", borderRadius: "18px 18px 18px 4px", border: "1px solid #2a2a2a" }}
            >
              <span className="flex gap-1 items-center">
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ background: "var(--yellow)", animationDelay: `${d}ms` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Limite diário ─────────────────────────────────── */}
      {limitReached && (
        <div
          className="w-full max-w-2xl mb-3 px-4 py-5 flex flex-col items-center gap-3 text-center"
          style={{ background: "var(--dark2)", border: "1px solid rgba(245,200,0,.3)", borderRadius: "var(--radius)" }}
        >
          <div className="text-2xl">🎯</div>
          <div>
            <p className="font-bold text-white text-sm">Você usou suas 10 mensagens de hoje</p>
            <p className="text-xs mt-1" style={{ color: "var(--gray)" }}>Assine o Coach IA por R$ 47/mês e pratique sem limites todos os dias.</p>
          </div>
          <a
            href="/planos"
            className="px-5 py-2 rounded-full text-sm font-bold transition-all"
            style={{ background: "var(--yellow)", color: "var(--black)" }}
          >
            Assinar Coach IA — R$ 47/mês
          </a>
        </div>
      )}

      {/* ── Mic error ──────────────────────────────────────── */}
      {micError && (
        <div
          className="w-full max-w-2xl mb-3 px-3 sm:px-4 py-2.5 flex gap-2 items-start text-sm"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius)" }}
        >
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
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
          }}
          placeholder="Digite aqui..."
          rows={1}
          className="flex-1 resize-none outline-none transition"
          style={{
            background: "var(--dark1)",
            color: "var(--white)",
            border: "1px solid #2a2a2a",
            borderRadius: "var(--radius)",
            padding: "12px 16px",
            fontFamily: "'Inter', sans-serif",
            fontSize: "16px", // prevents iOS zoom on focus
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--yellow)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
        />

        {/* Mic */}
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={isLoading || isSpeaking || isTranscribing || limitReached}
          title={isListening ? "Clique para parar e enviar" : "Clique para falar"}
          className="w-12 h-12 flex items-center justify-center transition-all shrink-0 disabled:opacity-40"
          style={{
            background: isListening ? "#ef4444" : isTranscribing ? "var(--dark2)" : "var(--yellow)",
            borderRadius: "var(--radius)",
            boxShadow: isListening ? "0 0 20px rgba(239,68,68,0.5)" : "none",
            transform: isListening ? "scale(1.08)" : "scale(1)",
          }}
        >
          {isTranscribing ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" style={{ color: "var(--yellow)" }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"
              style={{ color: isListening ? "white" : "var(--black)" }}>
              {isListening ? (
                <rect x="6" y="6" width="12" height="12" rx="2" />
              ) : (
                <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-7 9h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.93V21h2v2H9v-2h2v-2.07A7 7 0 0 1 5 12z" />
              )}
            </svg>
          )}
        </button>

        {/* Send */}
        <button
          onClick={() => sendMessage(input)}
          disabled={isLoading || !input.trim() || limitReached}
          className="w-12 h-12 flex items-center justify-center transition-all shrink-0 disabled:opacity-40"
          style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "var(--radius)" }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
            style={{ color: "var(--yellow)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m-7 7 7-7 7 7" />
          </svg>
        </button>
      </div>

      {/* ── Status ─────────────────────────────────────────── */}
      <div className="mt-1.5 h-3.5 text-[11px] text-center">
        {isListening && <span style={{ color: "#ef4444" }}>● Gravando — toque no mic para enviar</span>}
        {isTranscribing && <span style={{ color: "var(--yellow)" }}>● Reconhecendo...</span>}
        {isSpeaking && !isListening && !isTranscribing && <span style={{ color: "var(--yellow)" }}>● Coach falando...</span>}
      </div>
    </div>
  );
}
