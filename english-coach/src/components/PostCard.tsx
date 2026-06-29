"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export type Reaction = { emoji: string; user_id: string };
export type Post = {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  content: string;
  audio_url: string | null;
  image_url: string | null;
  transcript: string | null;
  created_at: string;
  reply_count?: number;
  community_reactions: Reaction[];
};

export const EMOJIS_REACT = ["❤️"];

export const EMOJI_LIST = [
  "😀", "😂", "😍", "🥰", "😎", "🤔", "😅", "🙌",
  "👏", "🔥", "💯", "❤️", "🎉", "✨", "💪", "🙏",
  "👍", "😊", "🤩", "😏", "💬", "🌍", "📚", "🎯",
  "🚀", "⭐", "💡", "🎶", "✅", "😘", "😜", "🥳",
];

export function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function MentionLink({ name }: { name: string }) {
  const [href, setHref] = React.useState<string | null>(null);
  React.useEffect(() => {
    fetch(`/api/community/user-by-name?name=${encodeURIComponent(name.slice(1))}`)
      .then(r => r.json())
      .then(d => { if (d.userId) setHref(`/app/comunidade/u/${d.userId}`); })
      .catch(() => {});
  }, [name]);
  return href
    ? <a href={href} style={{ color: "var(--yellow)", fontWeight: 700, textDecoration: "none" }}>{name}</a>
    : <span style={{ color: "var(--yellow)", fontWeight: 700 }}>{name}</span>;
}

export function renderWithMentions(text: string): React.ReactNode[] {
  return text.split(/(@[\wÀ-ɏḀ-ỿ]+)/g).map((part, i) =>
    /^@/.test(part) && part.length > 1
      ? <MentionLink key={i} name={part} />
      : part
  );
}

function getSupportedMime() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return types.find(t => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}
function mimeToExt(mime: string) {
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

export function ReplyComposer({ postId, user, onDone }: { postId: string; user: ReturnType<typeof useUser>["user"]; onDone: () => void }) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => taRef.current?.focus(), 80); }, []);

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = getSupportedMime();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        setAudioBlob(blob); setAudioUrl(URL.createObjectURL(blob)); setRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
      };
      mr.start(); mrRef.current = mr; setRecording(true); setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes("Permission") || msg.includes("denied") || msg.includes("NotAllowed")
        ? "Permita o acesso ao microfone nas configurações do seu navegador."
        : "Não foi possível acessar o microfone.");
    }
  }

  function insertEmoji(e: string) {
    const ta = taRef.current;
    if (!ta) { setText(t => t + e); return; }
    const s = ta.selectionStart ?? text.length, end = ta.selectionEnd ?? text.length;
    const next = text.slice(0, s) + e + text.slice(end);
    setText(next);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + e.length, s + e.length); }, 0);
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Image must be smaller than 5MB."); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError("");
  }

  async function submit() {
    if (posting || (!text.trim() && !audioBlob && !imageFile)) return;
    setPosting(true); setError("");
    try {
      let uploadedAudio: string | null = null;
      let audioTranscript: string | null = null;
      let uploadedImage: string | null = null;
      if (audioBlob) {
        const ext = mimeToExt(audioBlob.type);
        const tf = new FormData();
        tf.append("audio", new File([audioBlob], `audio.${ext}`, { type: audioBlob.type }));
        const tr = await fetch("/api/transcribe", { method: "POST", body: tf });
        const td = await tr.json();
        if (!td.transcript?.trim()) { setError("Couldn't understand audio. Try again."); return; }
        const vr = await fetch("/api/community/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: td.transcript, validateOnly: true }) });
        const vd = await vr.json();
        if (vd.error === "not_english") { setError("Please record in English! 🇺🇸"); return; }
        const uf = new FormData();
        uf.append("file", new File([audioBlob], `audio.${ext}`, { type: audioBlob.type })); uf.append("type", "audio");
        const ur = await fetch("/api/community/upload", { method: "POST", body: uf });
        uploadedAudio = (await ur.json()).url;
        audioTranscript = td.transcript;
      }
      if (imageFile) {
        const uf = new FormData();
        uf.append("file", imageFile); uf.append("type", "image");
        const ur = await fetch("/api/community/upload", { method: "POST", body: uf });
        uploadedImage = (await ur.json()).url;
      }
      const res = await fetch("/api/community/posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text.trim(), audioUrl: uploadedAudio, transcript: audioTranscript, imageUrl: uploadedImage, parentId: postId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error === "not_english" ? "Please write in English! 🇺🇸" : "Something went wrong."); return; }
      onDone();
    } finally { setPosting(false); }
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #1e1e1e" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", background: "#1e1e1e", flexShrink: 0 }}>
          {user?.imageUrl ? <img src={user.imageUrl} alt="you" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "0.8rem" }}>👤</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          {recording ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f87171", display: "inline-block", animation: "pulse 1s infinite" }} />
              <span style={{ fontSize: "0.8rem", color: "#f87171", fontWeight: 700 }}>{Math.floor(seconds / 60).toString().padStart(2, "0")}:{(seconds % 60).toString().padStart(2, "0")}</span>
              <button onClick={() => mrRef.current?.stop()} style={{ marginLeft: "auto", background: "#f87171", border: "none", borderRadius: 50, padding: "3px 10px", fontWeight: 700, fontSize: "0.72rem", color: "#fff", cursor: "pointer" }}>Stop</button>
            </div>
          ) : audioBlob ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0d0d0d", borderRadius: 8, padding: "6px 10px", marginBottom: 6 }}>
              <audio src={audioUrl!} controls style={{ flex: 1, height: 28, minWidth: 0 }} />
              <button onClick={() => { setAudioBlob(null); setAudioUrl(null); }} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "0.8rem" }}>✕</button>
            </div>
          ) : imagePreview ? (
            <div style={{ marginBottom: 6, borderRadius: 8, position: "relative", display: "flex", justifyContent: "center", alignItems: "center" }}>
              <img src={imagePreview} alt="preview" style={{ maxWidth: "100%", height: "auto", objectFit: "contain", borderRadius: 8 }} />
              <button onClick={() => { setImageFile(null); setImagePreview(null); }} style={{ position: "absolute", top: 4, right: 4, background: "#f87171", border: "none", color: "#fff", cursor: "pointer", fontSize: "0.8rem", width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>✕</button>
            </div>
          ) : (
            <textarea
              ref={taRef}
              value={text}
              onChange={e => { setText(e.target.value); setError(""); }}
              placeholder="Reply in English… 🇺🇸"
              maxLength={280}
              rows={2}
              style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: "0.85rem", color: "#fff", resize: "none", fontFamily: "'Inter', sans-serif", lineHeight: 1.5, boxSizing: "border-box", padding: 0 }}
            />
          )}
          {showEmoji && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, background: "#0d0d0d", borderRadius: 8, padding: "6px 8px", marginBottom: 6 }}>
              {EMOJI_LIST.map(e => <button key={e} onClick={() => insertEmoji(e)} style={{ background: "none", border: "none", fontSize: "1rem", cursor: "pointer", padding: "1px 3px", borderRadius: 4 }}>{e}</button>)}
            </div>
          )}
          {error && <p style={{ fontSize: "0.7rem", color: "#f87171", margin: "4px 0" }}>{error}</p>}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <button onClick={() => { if (!recording && !audioBlob) startRec(); }} disabled={recording || !!audioBlob} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 50, border: `1px solid ${audioBlob ? "rgba(245,200,0,.5)" : "#2a2a2a"}`, background: audioBlob ? "rgba(245,200,0,.08)" : "transparent", cursor: "pointer", color: audioBlob ? "var(--yellow)" : "var(--gray)", opacity: 1 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            </button>
            <button onClick={() => fileInputRef.current?.click()} disabled={!!imageFile} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 50, border: `1px solid ${imageFile ? "rgba(245,200,0,.5)" : "#2a2a2a"}`, background: imageFile ? "rgba(245,200,0,.08)" : "transparent", cursor: "pointer", color: imageFile ? "var(--yellow)" : "var(--gray)", opacity: 1 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: "none" }} />
            <button onClick={() => setShowEmoji(v => !v)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 50, border: `1px solid ${showEmoji ? "rgba(245,200,0,.5)" : "#2a2a2a"}`, background: showEmoji ? "rgba(245,200,0,.08)" : "transparent", cursor: "pointer", color: showEmoji ? "var(--yellow)" : "var(--gray)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="9" r="1"/></svg>
            </button>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={submit} disabled={!text.trim() && !audioBlob && !imageFile || posting} style={{ background: (text.trim() || audioBlob || imageFile) ? "var(--yellow)" : "#1e1e1e", color: (text.trim() || audioBlob || imageFile) ? "#000" : "#333", border: "none", borderRadius: 50, padding: "5px 14px", fontWeight: 800, fontSize: "0.78rem", cursor: (text.trim() || audioBlob || imageFile) ? "pointer" : "default" }}>
                {posting ? "…" : "Reply"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Creator badge ─────────────────────────────────────────────────────────

const CREATOR_ID = "user_3EzV0DXiskFt0wNSwNSXVHapiBC";

function CreatorBadge({ size = 18 }: { size?: number }) {
  return (
    <span
      title="Criador do app"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #f5c800 0%, #ff9500 100%)",
        boxShadow: "0 1px 6px rgba(245,180,0,0.55)",
        flexShrink: 0,
      }}
    >
      {/* crown */}
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="#000">
        <path d="M2 19h20v2H2zM2 6l5 7 5-7 5 7 5-7v11H2z"/>
      </svg>
    </span>
  );
}

// ── Structured content renderers ──────────────────────────────────────────

type QuizResultData = {
  type: "quiz_result";
  title: string;
  score: number;
  total: number;
  questions: { question: string; options: string[]; correct: number; userAnswer: number | null; explanation: string }[];
};

type FlashcardResultData = {
  type: "flashcard_result";
  pack_name: string;
  cards: { word: string; translation: string; phonetic: string | null; example: string | null; rating: "easy" | "hard" | "miss" | null }[];
};

function QuizResultEmbed({ data }: { data: QuizResultData }) {
  const [open, setOpen] = React.useState(false);
  const pct = data.total > 0 ? Math.round((data.score / data.total) * 100) : 0;
  return (
    <div style={{ background: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
      <button onClick={() => setOpen(v => !v)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.75rem" }}>📝</span>
          <span style={{ fontSize: "0.75rem", color: "#ccc", fontWeight: 600 }}>Quiz · {data.title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: pct >= 80 ? "#4ade80" : pct >= 60 ? "var(--yellow)" : "#f87171" }}>{pct}%</span>
          <span style={{ color: "var(--gray)", fontSize: "0.7rem", transform: open ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.2s" }}>▼</span>
        </div>
      </button>
      {open && (
        <div style={{ borderTop: "1px solid #1e1e1e", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
          {data.questions.map((q, i) => {
            const isCorrect = q.userAnswer === q.correct;
            const notAnswered = q.userAnswer === null || q.userAnswer === undefined;
            return (
              <div key={i} style={{ background: "#111", borderRadius: 10, padding: "10px 12px", border: `1px solid ${notAnswered ? "#2a2a2a" : isCorrect ? "rgba(74,222,128,.2)" : "rgba(248,113,113,.2)"}` }}>
                <p style={{ fontSize: "0.78rem", color: "#fff", fontWeight: 600, margin: "0 0 8px 0", lineHeight: 1.4 }}>{i + 1}. {q.question}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {q.options.map((opt, j) => {
                    const isUser = q.userAnswer === j;
                    const isRight = q.correct === j;
                    let bg = "transparent";
                    let border = "#2a2a2a";
                    let color = "var(--gray)";
                    if (isRight) { bg = "rgba(74,222,128,.08)"; border = "rgba(74,222,128,.3)"; color = "#4ade80"; }
                    if (isUser && !isRight) { bg = "rgba(248,113,113,.08)"; border = "rgba(248,113,113,.3)"; color = "#f87171"; }
                    return (
                      <div key={j} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 8, background: bg, border: `1px solid ${border}` }}>
                        <span style={{ fontSize: "0.65rem", width: 14, flexShrink: 0, color }}>
                          {isRight ? "✓" : isUser ? "✗" : ""}
                        </span>
                        <span style={{ fontSize: "0.74rem", color, lineHeight: 1.3 }}>{opt}</span>
                        {isUser && <span style={{ marginLeft: "auto", fontSize: "0.65rem", color, flexShrink: 0 }}>{isRight ? "✅" : "❌"}</span>}
                      </div>
                    );
                  })}
                </div>
                {q.explanation && (
                  <p style={{ fontSize: "0.68rem", color: "var(--gray)", margin: "8px 0 0 0", lineHeight: 1.4, fontStyle: "italic" }}>💡 {q.explanation}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FlashcardResultEmbed({ data }: { data: FlashcardResultData }) {
  const [open, setOpen] = React.useState(false);
  const total = data.cards.length;
  const easy = data.cards.filter(c => c.rating === "easy").length;
  return (
    <div style={{ background: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
      <button onClick={() => setOpen(v => !v)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.75rem" }}>🃏</span>
          <span style={{ fontSize: "0.75rem", color: "#ccc", fontWeight: 600 }}>Flashcards · {data.pack_name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.72rem", color: "var(--gray)" }}>{easy}/{total} ✅</span>
          <span style={{ color: "var(--gray)", fontSize: "0.7rem", transform: open ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.2s" }}>▼</span>
        </div>
      </button>
      {open && (
        <div style={{ borderTop: "1px solid #1e1e1e", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {data.cards.map((c, i) => {
            const ratingColor = c.rating === "easy" ? "#4ade80" : c.rating === "hard" ? "var(--yellow)" : c.rating === "miss" ? "#f87171" : "var(--gray)";
            const ratingIcon = c.rating === "easy" ? "✅" : c.rating === "hard" ? "😅" : c.rating === "miss" ? "❌" : "·";
            return (
              <div key={i} style={{ background: "#111", borderRadius: 10, padding: "9px 12px", border: `1px solid #1e1e1e`, display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: "0.75rem", flexShrink: 0, marginTop: 1 }}>{ratingIcon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff" }}>{c.word}</span>
                    {c.phonetic && <span style={{ fontSize: "0.68rem", color: "var(--gray)", fontStyle: "italic" }}>{c.phonetic}</span>}
                  </div>
                  <p style={{ fontSize: "0.74rem", color: ratingColor, margin: "2px 0 0 0" }}>{c.translation}</p>
                  {c.example && <p style={{ fontSize: "0.68rem", color: "var(--gray)", margin: "4px 0 0 0", fontStyle: "italic", lineHeight: 1.4 }}>"{c.example}"</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RepostEmbed({ data }: { data: { original_user_id: string; original_display_name: string; original_avatar_url: string | null; original_content: string; original_image_url?: string | null; original_created_at: string } }) {
  return (
    <div style={{ background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <a href={`/app/comunidade/u/${data.original_user_id}`} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", background: "#1e1e1e", flexShrink: 0 }}>
            {data.original_avatar_url ? <img src={data.original_avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "0.7rem" }}>👤</span>}
          </div>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#ccc" }}>{data.original_display_name}</span>
          {data.original_user_id === CREATOR_ID && <CreatorBadge size={14} />}
          <span style={{ fontSize: "0.65rem", color: "var(--gray)" }}>{timeAgo(data.original_created_at)}</span>
        </a>
      </div>
      {data.original_content?.trim() && <p style={{ fontSize: "0.82rem", color: "#ddd", margin: "0 0 6px 0", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{data.original_content}</p>}
      {data.original_image_url && <img src={data.original_image_url} alt="" style={{ width: "100%", maxHeight: 200, objectFit: "contain", borderRadius: 8, background: "#0d0d0d" }} />}
    </div>
  );
}

function StructuredContent({ transcript }: { transcript: string | null }) {
  if (!transcript?.startsWith("{")) return null;
  try {
    const data = JSON.parse(transcript);
    if (data.type === "repost") return <RepostEmbed data={data} />;
    if (data.type === "quiz_result") return <QuizResultEmbed data={data as QuizResultData} />;
    if (data.type === "flashcard_result") return <FlashcardResultEmbed data={data as FlashcardResultData} />;
  } catch { /* not JSON */ }
  return null;
}

export function PostCard({ post, myId, user, router, isReply = false, onReaction, onDeleted, onImageClick }: {
  post: Post; myId: string; user: ReturnType<typeof useUser>["user"];
  router: ReturnType<typeof useRouter>; isReply?: boolean;
  onReaction: (postId: string, emoji: string) => void;
  onDeleted?: (postId: string) => void;
  onImageClick?: (imageUrl: string) => void;
}) {
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [replies, setReplies] = useState<Post[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyCount, setReplyCount] = useState(post.reply_count ?? 0);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.content);
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentContent, setCurrentContent] = useState(post.content);
  const [showEditEmoji, setShowEditEmoji] = useState(false);
  const editTaRef = useRef<HTMLTextAreaElement>(null);
  const [translationPt, setTranslationPt] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState<boolean>(false);
  const [likersPopover, setLikersPopover] = useState<{ emoji: string; users: { user_id: string; name: string; avatar: string | null }[] } | null>(null);
  const [loadingLikers, setLoadingLikers] = useState(false);
  const likersRef = useRef<HTMLDivElement>(null);
  const likersCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [repostComment, setRepostComment] = useState("");
  const [reposting, setReposting] = useState(false);
  const [reposted, setReposted] = useState(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (likersRef.current && !likersRef.current.contains(e.target as Node)) {
        setLikersPopover(null);
      }
    }
    if (likersPopover) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [likersPopover]);

  async function showLikers(emoji: string) {
    const count = post.community_reactions.filter(r => r.emoji === emoji).length;
    if (count === 0) return;
    if (likersPopover?.emoji === emoji) { setLikersPopover(null); return; }
    setLoadingLikers(true);
    setLikersPopover({ emoji, users: [] });
    const res = await fetch(`/api/community/reactions/${post.id}`);
    const all = await res.json();
    const filtered = all.filter((r: { emoji: string }) => r.emoji === emoji);
    setLikersPopover({ emoji, users: filtered });
    setLoadingLikers(false);
  }

  async function fetchTranslation(text: string) {
    if (translationPt) { setShowTranslation(true); return; }
    setTranslating(true);
    const res = await fetch("/api/community/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    const data = await res.json();
    setTranslationPt(data.translation ?? null);
    setShowTranslation(true);
    setTranslating(false);
  }

  async function doRepost() {
    if (reposting || reposted) return;
    setReposting(true);
    const repostData = JSON.stringify({
      type: "repost",
      original_post_id: post.id,
      original_user_id: post.user_id,
      original_display_name: post.display_name,
      original_avatar_url: post.avatar_url,
      original_content: post.content,
      original_image_url: post.image_url,
      original_audio_url: post.audio_url,
      original_created_at: post.created_at,
    });
    await fetch("/api/community/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: repostComment.trim() || " ", transcript: repostData, isShare: true }),
    });
    setReposting(false);
    setReposted(true);
    setShowRepostModal(false);
    setRepostComment("");
  }

  async function confirmDeletePost() {
    setDeleting(true);
    await fetch(`/api/community/posts/${post.id}`, { method: "DELETE" });
    setConfirmDelete(false);
    onDeleted?.(post.id);
  }

  async function saveEdit() {
    if (!editText.trim() || saving) return;
    setSaving(true); setEditError("");
    const res = await fetch(`/api/community/posts/${post.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editText.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setEditError(data.error === "not_english" ? "Please write in English! 🇺🇸" : "Something went wrong.");
      setSaving(false); return;
    }
    setCurrentContent(editText.trim());
    setEditing(false); setSaving(false);
  }

  async function loadReplies() {
    if (loadingReplies) return;
    setLoadingReplies(true);
    const res = await fetch(`/api/community/replies/${post.id}`);
    const data = await res.json();
    setReplies(data.replies ?? []);
    setReplyCount(data.replies?.length ?? 0);
    setLoadingReplies(false);
  }

  async function toggleExpand() {
    if (!expanded && replies.length === 0) await loadReplies();
    setExpanded(v => !v);
  }

  async function handleReplied() {
    setShowReplyComposer(false);
    await loadReplies();
    setExpanded(true);
    setReplyCount(c => c + 1);
  }

  const repostMeta = (() => {
    try { if (post.transcript) { const p = JSON.parse(post.transcript); if (p.type === "repost") return p; } } catch {}
    return null;
  })();

  return (
    <div style={{ background: isReply ? "#0d0d0d" : "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "14px 16px", marginBottom: isReply ? 8 : 10 }}>
      {repostMeta && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8, fontSize: "0.68rem", color: "var(--gray)" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
          <span>{post.display_name} repostou</span>
        </div>
      )}
      {/* Author */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <button onClick={() => router.push(`/app/comunidade/u/${post.user_id}`)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}>
          <div style={{ width: isReply ? 28 : 36, height: isReply ? 28 : 36, borderRadius: "50%", overflow: "hidden", background: "#1e1e1e" }}>
            {post.avatar_url ? <img src={post.avatar_url} alt={post.display_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "0.9rem" }}>👤</span>}
          </div>
        </button>
        <div style={{ flex: 1 }}>
          <button onClick={() => router.push(`/app/comunidade/u/${post.user_id}`)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: isReply ? "0.78rem" : "0.82rem", fontWeight: 700, color: "#fff" }}>{post.display_name}</span>
              {post.user_id === CREATOR_ID && <CreatorBadge size={isReply ? 15 : 18} />}
            </span>
          </button>
          <p style={{ fontSize: "0.65rem", color: "var(--gray)", margin: 0 }}>{timeAgo(post.created_at)}</p>
        </div>
        {post.user_id === myId && (
          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            {!editing && (
              <button onClick={() => { setEditing(true); setEditText(currentContent); }} title="Edit" style={{ background: "none", border: "none", cursor: "pointer", color: "#555", padding: "2px 6px", borderRadius: 6, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--yellow)")}
                onMouseLeave={e => (e.currentTarget.style.color = "#555")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            )}
            <button onClick={() => setConfirmDelete(true)} disabled={deleting} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", color: "#555", padding: "2px 6px", borderRadius: 6, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
              onMouseLeave={e => (e.currentTarget.style.color = "#555")}>
              {deleting ? "…" : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>}
            </button>
          </div>
        )}
      </div>

      {post.image_url && (
        <img
          src={post.image_url}
          alt="post"
          onClick={() => post.image_url && onImageClick?.(post.image_url)}
          style={{ width: "100%", maxHeight: 280, objectFit: "contain", borderRadius: 10, marginBottom: 10, background: "#0d0d0d", display: "block", cursor: "pointer" }}
        />
      )}
      {post.audio_url && (
        <div style={{ background: "#0d0d0d", borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>
          <audio src={post.audio_url} controls style={{ width: "100%", height: 32 }} />
          {post.transcript && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: "0.78rem", color: "#ccc", lineHeight: 1.5, margin: 0, fontStyle: "italic" }}>"{post.transcript}"</p>
              <div style={{ marginTop: 6 }}>
                {showTranslation ? (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <p style={{ fontSize: "0.75rem", color: "var(--gray)", lineHeight: 1.5, margin: 0 }}>
                      🇧🇷 {translationPt}
                    </p>
                    <button onClick={() => setShowTranslation(false)} style={{ background: "none", border: "none", color: "#555", fontSize: "0.65rem", cursor: "pointer", flexShrink: 0, padding: 0 }}>ocultar</button>
                  </div>
                ) : (
                  <button onClick={() => fetchTranslation(post.transcript!)} disabled={translating} style={{ background: "transparent", border: "1px solid #3a3a3a", borderRadius: 50, padding: "2px 10px", fontSize: "0.7rem", color: "var(--gray)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {translating ? "…" : "🇧🇷 Ver tradução"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {!post.audio_url && <StructuredContent transcript={post.transcript} />}
      {editing ? (
        <div style={{ marginBottom: 12 }}>
          <textarea
            ref={editTaRef}
            value={editText}
            onChange={e => { setEditText(e.target.value); setEditError(""); }}
            maxLength={280}
            rows={3}
            autoFocus
            style={{ width: "100%", background: "#0d0d0d", border: "1px solid #3a3a3a", borderRadius: 10, outline: "none", fontSize: "0.9rem", color: "#fff", resize: "none", fontFamily: "'Inter', sans-serif", lineHeight: 1.6, padding: "8px 10px", boxSizing: "border-box" }}
          />
          {showEditEmoji && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, background: "#0d0d0d", borderRadius: 8, padding: "6px 8px", marginTop: 4 }}>
              {EMOJI_LIST.map(e => (
                <button key={e} onClick={() => {
                  const ta = editTaRef.current;
                  const s = ta?.selectionStart ?? editText.length;
                  const end = ta?.selectionEnd ?? editText.length;
                  const next = editText.slice(0, s) + e + editText.slice(end);
                  setEditText(next);
                  setTimeout(() => { ta?.focus(); ta?.setSelectionRange(s + e.length, s + e.length); }, 0);
                }} style={{ background: "none", border: "none", fontSize: "1rem", cursor: "pointer", padding: "1px 3px", borderRadius: 4 }}>{e}</button>
              ))}
            </div>
          )}
          {editError && <p style={{ fontSize: "0.72rem", color: "#f87171", margin: "4px 0" }}>{editError}</p>}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <button onClick={() => setShowEditEmoji(v => !v)} style={{ background: showEditEmoji ? "rgba(245,200,0,.1)" : "none", border: "none", fontSize: "1rem", cursor: "pointer", padding: "2px 6px", borderRadius: 8 }}>😊</button>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button onClick={() => { setEditing(false); setEditText(currentContent); setEditError(""); setShowEditEmoji(false); }} style={{ background: "none", border: "1px solid #2a2a2a", borderRadius: 50, padding: "4px 14px", fontSize: "0.75rem", color: "var(--gray)", cursor: "pointer" }}>Cancel</button>
              <button onClick={saveEdit} disabled={!editText.trim() || saving} style={{ background: "var(--yellow)", border: "none", borderRadius: 50, padding: "4px 14px", fontSize: "0.75rem", fontWeight: 800, color: "#000", cursor: "pointer" }}>{saving ? "…" : "Save"}</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {currentContent && <p style={{ fontSize: isReply ? "0.85rem" : "0.9rem", color: "#fff", lineHeight: 1.6, marginBottom: 12, whiteSpace: "pre-wrap" }}>{renderWithMentions(currentContent)}</p>}
          {currentContent && (
            <div style={{ marginBottom: 12 }}>
              {showTranslation ? (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                  <p style={{ fontSize: "0.75rem", color: "var(--gray)", lineHeight: 1.5, margin: 0 }}>
                    🇧🇷 {translationPt}
                  </p>
                  <button onClick={() => setShowTranslation(false)} style={{ background: "none", border: "none", color: "#555", fontSize: "0.65rem", cursor: "pointer", flexShrink: 0, padding: 0 }}>ocultar</button>
                </div>
              ) : (
                <button onClick={() => fetchTranslation(currentContent)} disabled={translating} style={{ background: "transparent", border: "1px solid #3a3a3a", borderRadius: 50, padding: "2px 10px", fontSize: "0.7rem", color: "var(--gray)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {translating ? "…" : "🇧🇷 Ver tradução"}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {EMOJIS_REACT.map(emoji => {
          const count = post.community_reactions.filter(r => r.emoji === emoji).length;
          const reacted = post.community_reactions.some(r => r.emoji === emoji && r.user_id === myId);
          const getIcon = () => (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          );
          return (
            <div key={emoji} style={{ position: "relative" }} ref={likersPopover?.emoji === emoji ? likersRef : undefined} onMouseLeave={() => { likersCloseTimer.current = setTimeout(() => setLikersPopover(null), 150); }} onMouseEnter={() => { if (likersCloseTimer.current) { clearTimeout(likersCloseTimer.current); likersCloseTimer.current = null; } }}>
              <div style={{ display: "flex", alignItems: "center", gap: 0, borderRadius: 50, border: `1px solid ${reacted ? "rgba(245,200,0,.5)" : "#2a2a2a"}`, background: reacted ? "rgba(245,200,0,.08)" : "transparent", overflow: "hidden" }}>
                <button onClick={() => onReaction(post.id, emoji)} style={{ display: "flex", alignItems: "center", gap: 4, padding: count > 0 ? "4px 8px 4px 10px" : "4px 10px", background: "transparent", border: "none", cursor: "pointer", fontSize: "0.78rem", color: reacted ? "var(--yellow)" : "var(--gray)", fontWeight: 600 }}>
                  {getIcon()}
                </button>
                {count > 0 && (
                  <button
                    onClick={() => showLikers(emoji)}
                    onMouseEnter={() => { if (likersCloseTimer.current) { clearTimeout(likersCloseTimer.current); likersCloseTimer.current = null; } showLikers(emoji); }}
                    style={{ background: "transparent", border: "none", borderLeft: `1px solid ${reacted ? "rgba(245,200,0,.3)" : "#2a2a2a"}`, padding: "4px 10px 4px 8px", cursor: "pointer", fontSize: "0.78rem", color: reacted ? "var(--yellow)" : "var(--gray)", fontWeight: 600 }}
                  >
                    {count}
                  </button>
                )}
              </div>

              {/* Likers popover */}
              {likersPopover?.emoji === emoji && (
                <div style={{ position: "absolute", bottom: "calc(100% + 8px)", left: 0, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, padding: "10px 12px", minWidth: 180, maxWidth: 260, zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,.5)" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--gray)", marginBottom: 8, fontWeight: 600 }}>Liked by</div>
                  {loadingLikers ? (
                    <div style={{ fontSize: "0.78rem", color: "var(--gray)" }}>Loading…</div>
                  ) : likersPopover.users.length === 0 ? (
                    <div style={{ fontSize: "0.78rem", color: "var(--gray)" }}>No one yet</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {likersPopover.users.map(u => (
                        <a key={u.user_id} href={`/app/comunidade/u/${u.user_id}`} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", borderRadius: 8, padding: "2px 4px", margin: "-2px -4px", transition: "background 0.15s" }} onMouseEnter={e => (e.currentTarget.style.background = "#2a2a2a")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          {u.avatar ? (
                            <img src={u.avatar} alt={u.name} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", color: "var(--gray)", flexShrink: 0 }}>
                              {u.name[0]?.toUpperCase()}
                            </div>
                          )}
                          <span style={{ fontSize: "0.82rem", color: "#e0e0e0", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Reply button */}
        <button
          onClick={() => setShowReplyComposer(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 50, border: "1px solid #2a2a2a", background: showReplyComposer ? "rgba(255,255,255,.05)" : "transparent", cursor: "pointer", fontSize: "0.78rem", color: "var(--gray)", fontWeight: 600, marginLeft: 2 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Reply
        </button>

        {/* Repost button — only on original posts (not reposts themselves) */}
        {!isReply && (() => {
          let isRepostPost = false;
          try { if (post.transcript) { const p = JSON.parse(post.transcript); if (p.type === "repost") isRepostPost = true; } } catch {}
          return !isRepostPost && (
            <button
              onClick={() => !reposted && setShowRepostModal(true)}
              disabled={reposted}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 50, border: `1px solid ${reposted ? "rgba(74,222,128,.3)" : "#2a2a2a"}`, background: reposted ? "rgba(74,222,128,.08)" : "transparent", cursor: reposted ? "default" : "pointer", fontSize: "0.78rem", color: reposted ? "#4ade80" : "var(--gray)", fontWeight: 600, marginLeft: 2 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
              {reposted ? "Repostado!" : "Repost"}
            </button>
          );
        })()}

        {/* Show replies */}
        {replyCount > 0 && (
          <button onClick={toggleExpand} style={{ background: "none", border: "none", fontSize: "0.72rem", color: "var(--yellow)", fontWeight: 700, cursor: "pointer", marginLeft: 4 }}>
            {loadingReplies ? "…" : expanded ? `Hide` : `${replyCount} repl${replyCount === 1 ? "y" : "ies"}`}
          </button>
        )}
      </div>

      {/* Reply composer */}
      {showReplyComposer && (
        <ReplyComposer postId={post.id} user={user} onDone={handleReplied} />
      )}

      {/* Replies */}
      {expanded && replies.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #1e1e1e", borderLeft: "2px solid #2a2a2a", paddingLeft: 12, display: "flex", flexDirection: "column", gap: 0 }}>
          {replies.map(r => (
            <PostCard key={r.id} post={r} myId={user?.id ?? ""} user={user} router={router} isReply onReaction={onReaction} onDeleted={id => { setReplies(prev => prev.filter(x => x.id !== id)); setReplyCount(c => Math.max(0, c - 1)); }} />
          ))}
        </div>
      )}

      {confirmDelete && (
        <div onClick={() => !deleting && setConfirmDelete(false)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--dark2)", borderRadius: 14, padding: "20px 18px", maxWidth: "90%", minWidth: 280, border: "1px solid #2a2a2a" }}>
            <p style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", margin: 0, marginBottom: 8 }}>Quer mesmo deletar este post?</p>
            <p style={{ fontSize: "0.85rem", color: "var(--gray)", margin: 0, marginBottom: 16 }}>Esta ação não pode ser desfeita.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDelete(false)} disabled={deleting} style={{ flex: 1, padding: "10px 14px", border: "1px solid #2a2a2a", background: "#1a1a1a", color: "var(--gray)", borderRadius: 8, fontSize: "0.9rem", fontWeight: 700, cursor: deleting ? "default" : "pointer", opacity: deleting ? 0.5 : 1 }}>Cancelar</button>
              <button onClick={confirmDeletePost} disabled={deleting} style={{ flex: 1, padding: "10px 14px", border: "none", background: "#ff4444", color: "#fff", borderRadius: 8, fontSize: "0.9rem", fontWeight: 700, cursor: deleting ? "default" : "pointer", opacity: deleting ? 0.5 : 1 }}>Deletar</button>
            </div>
          </div>
        </div>
      )}

      {showRepostModal && (
        <div onClick={() => !reposting && setShowRepostModal(false)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1001, paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--dark2)", borderRadius: "18px 18px 0 0", padding: "20px 18px 28px", width: "100%", maxWidth: 520, border: "1px solid #2a2a2a", borderBottom: "none" }}>
            <p style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", margin: "0 0 14px 0" }}>Repostar</p>
            <div style={{ background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 12, padding: "10px 12px", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", background: "#1e1e1e", flexShrink: 0 }}>
                  {post.avatar_url ? <img src={post.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "0.7rem" }}>👤</span>}
                </div>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#ccc" }}>{post.display_name}</span>
              </div>
              {post.content?.trim() && <p style={{ fontSize: "0.8rem", color: "#aaa", margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{post.content.slice(0, 120)}{post.content.length > 120 ? "…" : ""}</p>}
              {post.image_url && <img src={post.image_url} alt="" style={{ width: "100%", maxHeight: 120, objectFit: "cover", borderRadius: 8, marginTop: 8 }} />}
            </div>
            <textarea
              value={repostComment}
              onChange={e => setRepostComment(e.target.value)}
              placeholder="Adicione um comentário... (opcional)"
              maxLength={280}
              rows={3}
              style={{ width: "100%", background: "#111", border: "1px solid #2a2a2a", borderRadius: 10, color: "#fff", fontSize: "0.9rem", padding: "10px 12px", resize: "none", fontFamily: "'Inter', sans-serif", lineHeight: 1.5, outline: "none", boxSizing: "border-box", marginBottom: 14 }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowRepostModal(false)} disabled={reposting} style={{ flex: 1, padding: "11px", border: "1px solid #2a2a2a", background: "#1a1a1a", color: "var(--gray)", borderRadius: 10, fontSize: "0.9rem", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
              <button onClick={doRepost} disabled={reposting} style={{ flex: 1, padding: "11px", border: "none", background: "var(--yellow)", color: "#000", borderRadius: 10, fontSize: "0.9rem", fontWeight: 800, cursor: reposting ? "default" : "pointer", opacity: reposting ? 0.6 : 1 }}>
                {reposting ? "Repostando…" : "Repostar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
