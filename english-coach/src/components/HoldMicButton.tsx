"use client";
import { useRef, useState } from "react";

function getSupportedMime() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return types.find(t => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}

function fmt(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

interface Props {
  onSend: (blob: Blob) => void;
  disabled?: boolean;
  size?: number;
}

export function HoldMicButton({ onSend, disabled, size = 44 }: Props) {
  const [phase, setPhase] = useState<"idle" | "recording" | "locked">("idle");
  const [seconds, setSeconds] = useState(0);
  const [dragX, setDragX] = useState(0); // negative = dragging left
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isRecRef = useRef(false);
  const isLockedRef = useRef(false);
  const cancelRef = useRef(false);

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = getSupportedMime();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        const wasCancelled = cancelRef.current;
        isRecRef.current = false;
        cancelRef.current = false;
        setPhase("idle");
        setSeconds(0);
        setDragX(0);
        if (!wasCancelled && chunksRef.current.length > 0) {
          onSend(new Blob(chunksRef.current, { type: mr.mimeType }));
        }
      };
      mr.start();
      mrRef.current = mr;
      isRecRef.current = true;
      isLockedRef.current = false;
      cancelRef.current = false;
      setPhase("recording");
      setSeconds(0);
      setDragX(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch (e) {
      console.error("Mic error:", e);
    }
  }

  function stopRec() {
    if (mrRef.current && mrRef.current.state !== "inactive") mrRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function cancelRec() {
    cancelRef.current = true;
    stopRec();
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (disabled || phase !== "idle") return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    startRec();
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!isRecRef.current || isLockedRef.current) return;
    const dx = e.clientX - startXRef.current; // negative = left
    const dy = startYRef.current - e.clientY;  // positive = up

    // Slide up → lock
    if (dy > 60) {
      isLockedRef.current = true;
      setDragX(0);
      setPhase("locked");
      return;
    }

    // Slide left → show drag feedback
    if (dx < 0) {
      setDragX(Math.max(dx, -140));
      // Cancel threshold: 120px left
      if (dx < -120) {
        cancelRec();
      }
    }
  }

  function onPointerUp() {
    if (!isRecRef.current) return;
    if (isLockedRef.current) return;
    setDragX(0);
    stopRec();
  }

  const isCancelZone = dragX < -60;

  if (phase === "idle") {
    return (
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        disabled={disabled}
        style={{
          width: size, height: size, borderRadius: "50%", border: "none",
          background: "var(--yellow)", display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer", flexShrink: 0,
          touchAction: "none", userSelect: "none",
          WebkitUserSelect: "none",
        } as React.CSSProperties}
      >
        <svg width={size * 0.45} height={size * 0.45} viewBox="0 0 24 24" fill="#000">
          <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-7 9h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.93V21h2v2H9v-2h2v-3.07A7 7 0 0 1 5 12z"/>
        </svg>
      </button>
    );
  }

  if (phase === "recording") {
    return (
      <div style={{ display: "flex", alignItems: "center", flex: 1, position: "relative", overflow: "hidden" }}>
        <style>{`@keyframes pulse-rec{0%,100%{box-shadow:0 0 8px rgba(239,68,68,0.4)}50%{box-shadow:0 0 20px rgba(239,68,68,0.8)}}`}</style>

        {/* Hints + timer — fade out when dragging left */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, opacity: isCancelZone ? 0.3 : 1, transition: "opacity 0.15s" }}>
          <span style={{ fontSize: "0.78rem", color: "#ef4444", fontWeight: 700 }}>● {fmt(seconds)}</span>
          <span style={{ fontSize: "0.68rem", color: isCancelZone ? "#ef4444" : "#666", whiteSpace: "nowrap", transition: "color 0.15s" }}>
            {isCancelZone ? "← Solte para cancelar" : "← cancelar  |  ↑ travar"}
          </span>
        </div>

        {/* Mic button — moves left with drag */}
        <button
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{
            width: size, height: size, borderRadius: "50%", border: "none",
            background: isCancelZone ? "#888" : "#ef4444",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
            boxShadow: isCancelZone ? "none" : "0 0 16px rgba(239,68,68,0.5)",
            animation: isCancelZone ? "none" : "pulse-rec 1s ease-in-out infinite",
            transform: `translateX(${dragX}px)`,
            transition: dragX === 0 ? "transform 0.2s, background 0.15s" : "background 0.15s",
            touchAction: "none",
          } as React.CSSProperties}
        >
          <svg width={size * 0.35} height={size * 0.35} viewBox="0 0 24 24" fill="white">
            <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-7 9h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.93V21h2v2H9v-2h2v-3.07A7 7 0 0 1 5 12z"/>
          </svg>
        </button>
      </div>
    );
  }

  // locked
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
      <style>{`@keyframes pulse-rec{0%,100%{box-shadow:0 0 8px rgba(239,68,68,0.4)}50%{box-shadow:0 0 20px rgba(239,68,68,0.8)}}`}</style>
      <button
        onClick={cancelRec}
        style={{ background: "none", border: "1px solid #444", borderRadius: 8, padding: "4px 10px", color: "#888", fontSize: "0.75rem", cursor: "pointer", whiteSpace: "nowrap" }}
      >✕ Cancelar</button>
      <span style={{ fontSize: "0.78rem", color: "#ef4444", fontWeight: 700, flex: 1, textAlign: "center" }}>● {fmt(seconds)}</span>
      <button
        onClick={stopRec}
        style={{
          width: size, height: size, borderRadius: "50%", border: "none",
          background: "#ef4444", display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer", flexShrink: 0,
          boxShadow: "0 0 16px rgba(239,68,68,0.5)",
          animation: "pulse-rec 1s ease-in-out infinite",
        } as React.CSSProperties}
      >
        <svg width={size * 0.32} height={size * 0.32} viewBox="0 0 24 24" fill="white">
          <rect x="6" y="6" width="12" height="12" rx="2"/>
        </svg>
      </button>
    </div>
  );
}
