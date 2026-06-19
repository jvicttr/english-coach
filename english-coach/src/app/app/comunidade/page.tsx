"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

type Reaction = { emoji: string; user_id: string };
type Post = {
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

const EMOJIS_REACT = ["❤️"];

function getSupportedMime() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return types.find(t => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}
function mimeToExt(mime: string) {
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}
const EMOJI_LIST = ["😀","😂","😍","🥰","😎","🤔","😅","🙌","👏","🔥","💯","❤️","🎉","✨","💪","🙏","👍","😊","🤩","😏","🥳","😤","💬","🌍","📚","🎯","🚀","⭐","💡","🎶"];

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// ── Mini reply composer ──────────────────────────────────────────────────────
function ReplyComposer({ postId, user, onDone }: { postId: string; user: ReturnType<typeof useUser>["user"]; onDone: () => void }) {
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="9" cy="9" r="1" fill="white"/><circle cx="15" cy="9" r="1" fill="white"/></svg>
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

// ── PostCard ─────────────────────────────────────────────────────────────────
function PostCard({ post, myId, user, router, isReply = false, onReaction, onDeleted, onImageClick }: {
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

  async function fetchTranslation(text: string) {
    if (translationPt) { setShowTranslation(true); return; }
    setTranslating(true);
    const res = await fetch("/api/community/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    const data = await res.json();
    setTranslationPt(data.translation ?? null);
    setShowTranslation(true);
    setTranslating(false);
  }

  async function deletePost() {
    if (!confirm("Delete this post?")) return;
    setDeleting(true);
    await fetch(`/api/community/posts/${post.id}`, { method: "DELETE" });
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

  return (
    <div style={{ background: isReply ? "#0d0d0d" : "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "14px 16px", marginBottom: isReply ? 8 : 10 }}>
      {/* Author */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <button onClick={() => router.push(`/app/comunidade/u/${post.user_id}`)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}>
          <div style={{ width: isReply ? 28 : 36, height: isReply ? 28 : 36, borderRadius: "50%", overflow: "hidden", background: "#1e1e1e" }}>
            {post.avatar_url ? <img src={post.avatar_url} alt={post.display_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "0.9rem" }}>👤</span>}
          </div>
        </button>
        <div style={{ flex: 1 }}>
          <button onClick={() => router.push(`/app/comunidade/u/${post.user_id}`)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
            <p style={{ fontSize: isReply ? "0.78rem" : "0.82rem", fontWeight: 700, color: "#fff", margin: 0 }}>{post.display_name}</p>
          </button>
          <p style={{ fontSize: "0.65rem", color: "var(--gray)", margin: 0 }}>{timeAgo(post.created_at)}</p>
        </div>
        {post.user_id === myId && (
          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            {!editing && (
              <button onClick={() => { setEditing(true); setEditText(currentContent); }} title="Edit" style={{ background: "none", border: "none", cursor: "pointer", color: "#555", fontSize: "0.75rem", padding: "2px 6px", borderRadius: 6, lineHeight: 1 }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--yellow)")}
                onMouseLeave={e => (e.currentTarget.style.color = "#555")}>✏️</button>
            )}
            <button onClick={deletePost} disabled={deleting} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", color: "#555", fontSize: "0.75rem", padding: "2px 6px", borderRadius: 6, lineHeight: 1 }}
              onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
              onMouseLeave={e => (e.currentTarget.style.color = "#555")}>
              {deleting ? "…" : "🗑"}
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
          {currentContent && <p style={{ fontSize: isReply ? "0.85rem" : "0.9rem", color: "#fff", lineHeight: 1.6, marginBottom: 12, whiteSpace: "pre-wrap" }}>{currentContent}</p>}
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
            <button key={emoji} onClick={() => onReaction(post.id, emoji)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 50, border: `1px solid ${reacted ? "rgba(245,200,0,.5)" : "#2a2a2a"}`, background: reacted ? "rgba(245,200,0,.08)" : "transparent", cursor: "pointer", fontSize: "0.78rem", color: reacted ? "var(--yellow)" : "var(--gray)", fontWeight: 600 }}>
              {getIcon()}{count > 0 && <span>{count}</span>}
            </button>
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
            <PostCard key={r.id} post={r} myId={user?.id ?? ""} user={user} router={router} isReply onReaction={onReaction} onImageClick={(url) => { setSelectedImage(url); setImageZoom(1); }} onDeleted={id => { setReplies(prev => prev.filter(x => x.id !== id)); setReplyCount(c => Math.max(0, c - 1)); }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ComunidadePage() {
  const { user } = useUser();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [pullProgress, setPullProgress] = useState(0);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [composerOpen, setComposerOpen] = useState(false);
  const [postText, setPostText] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef(0);

  async function loadPosts(checkNew = false) {
    const res = await fetch("/api/community/posts");
    const data = await res.json();
    const newPosts = data.posts ?? [];

    if (checkNew && posts.length > 0) {
      const count = newPosts.length - posts.length;
      if (count > 0) setNewPostsCount(count);
      return;
    }

    setPosts(newPosts);
    setLoading(false);
    setRefreshing(false);
    setNewPostsCount(0);
  }

  async function loadNewPosts() {
    setRefreshing(true);
    await loadPosts();
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedImage(null);
        setImageZoom(1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    loadPosts();
    const interval = setInterval(() => loadPosts(true), 10000);

    const container = scrollContainerRef.current;
    if (!container) return () => clearInterval(interval);

    const handleTouchStart = (e: TouchEvent) => {
      if (container.scrollTop === 0) {
        touchStartRef.current = e.touches[0].clientY;
        setPullProgress(0);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (container.scrollTop !== 0 || refreshing) return;
      const touch = e.touches[0];
      const diff = touch.clientY - touchStartRef.current;
      setPullProgress(Math.min(diff, 100));
      if (diff > 80) {
        loadNewPosts();
        touchStartRef.current = 0;
      }
    };

    const handleTouchEnd = () => {
      setPullProgress(0);
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      clearInterval(interval);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [refreshing]);
  useEffect(() => { if (composerOpen && !recording && !audioBlob) setTimeout(() => textareaRef.current?.focus(), 80); }, [composerOpen, recording, audioBlob]);

  function resetComposer() {
    setComposerOpen(false); setPostText(""); setPostError("");
    setImageFile(null); setImagePreview(null);
    setAudioBlob(null); setAudioUrl(null); setRecordingSeconds(0);
    setShowEmojiPicker(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function insertEmoji(e: string) {
    const ta = textareaRef.current;
    if (!ta) { setPostText(t => t + e); return; }
    const s = ta.selectionStart ?? postText.length, end = ta.selectionEnd ?? postText.length;
    setPostText(postText.slice(0, s) + e + postText.slice(end));
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + e.length, s + e.length); }, 0);
  }

  async function startRecording() {
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
      mr.start(); mrRef.current = mr; setRecording(true); setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPostError(msg.includes("Permission") || msg.includes("denied") || msg.includes("NotAllowed")
        ? "Permita o acesso ao microfone nas configurações do seu navegador."
        : "Não foi possível acessar o microfone.");
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file); setImagePreview(URL.createObjectURL(file));
  }

  const submitPost = useCallback(async () => {
    if (posting) return;
    if (!postText.trim() && !audioBlob && !imageFile) return;
    setPosting(true); setPostError("");
    try {
      let uploadedAudioUrl: string | null = null;
      let uploadedImageUrl: string | null = null;
      let audioTranscript: string | null = null;

      if (audioBlob) {
        const ext = mimeToExt(audioBlob.type);
        const tf = new FormData();
        tf.append("audio", new File([audioBlob], `audio.${ext}`, { type: audioBlob.type }));
        const tr = await fetch("/api/transcribe", { method: "POST", body: tf });
        const td = await tr.json();
        if (!td.transcript?.trim()) { setPostError("Couldn't understand audio."); return; }
        const vr = await fetch("/api/community/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: td.transcript, validateOnly: true }) });
        if ((await vr.json()).error === "not_english") { setPostError("Please record in English! 🇺🇸"); return; }
        const uf = new FormData();
        uf.append("file", new File([audioBlob], `audio.${ext}`, { type: audioBlob.type })); uf.append("type", "audio");
        const uploadRes = await fetch("/api/community/upload", { method: "POST", body: uf });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.url) { setPostError("Failed to upload audio. Try again."); return; }
        uploadedAudioUrl = uploadData.url;
        audioTranscript = td.transcript;
      }

      if (imageFile) {
        const uf = new FormData();
        uf.append("file", imageFile); uf.append("type", "image");
        const ur = await fetch("/api/community/upload", { method: "POST", body: uf });
        if (!ur.ok) { setPostError("Failed to upload image."); return; }
        uploadedImageUrl = (await ur.json()).url;
      }

      const res = await fetch("/api/community/posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: postText.trim(), audioUrl: uploadedAudioUrl, imageUrl: uploadedImageUrl, transcript: audioTranscript }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPostError(data.error === "free_limit" ? "Upgrade to PRO to keep posting! 🚀" : data.error === "not_english" ? "Please write in English! 🇺🇸" : "Something went wrong. Try again.");
        return;
      }
      resetComposer(); await loadPosts();
    } finally { setPosting(false); }
  }, [posting, postText, audioBlob, imageFile]);

  function toggleReaction(postId: string, emoji: string) {
    const myId = user?.id ?? "";
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const hasIt = p.community_reactions.some(r => r.emoji === emoji && r.user_id === myId);
      return { ...p, community_reactions: hasIt ? p.community_reactions.filter(r => !(r.emoji === emoji && r.user_id === myId)) : [...p.community_reactions, { emoji, user_id: myId }] };
    }));
    fetch("/api/community/react", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, emoji }) }).catch(() => {
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        const hasIt = p.community_reactions.some(r => r.emoji === emoji && r.user_id === myId);
        return { ...p, community_reactions: hasIt ? p.community_reactions.filter(r => !(r.emoji === emoji && r.user_id === myId)) : [...p.community_reactions, { emoji, user_id: myId }] };
      }));
    });
  }

  const canPost = !posting && (postText.trim().length > 0 || !!audioBlob || !!imageFile);

  return (
    <div ref={scrollContainerRef} className="app-scroll" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", paddingTop: 65, paddingBottom: 80 }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff" }}>🌎 Comunidade</span>
        {refreshing && <span style={{ fontSize: "0.75rem", color: "var(--yellow)" }}>Carregando…</span>}
      </div>

      {(pullProgress > 0 || refreshing) && (
        <div style={{ padding: "8px 16px", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <div style={{
            fontSize: "1.2rem",
            transition: "transform 0.2s",
            transform: pullProgress > 80 ? "rotate(180deg)" : "rotate(0deg)"
          }}>
            ↓
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--gray)" }}>
            {refreshing ? "Carregando…" : pullProgress > 80 ? "Solte para carregar" : "Puxe para carregar"}
          </span>
        </div>
      )}

      {newPostsCount > 0 && (
        <div style={{ padding: "12px 16px", background: "rgba(245,200,0,.1)", borderBottom: "1px solid rgba(245,200,0,.2)", textAlign: "center", cursor: "pointer" }} onClick={() => loadNewPosts()}>
          <span style={{ fontSize: "0.78rem", color: "var(--yellow)", fontWeight: 600 }}>📬 {newPostsCount} novo{newPostsCount > 1 ? "s post" : " post"}. Toque para carregar</span>
        </div>
      )}

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 16px 0" }}>
        {/* Composer */}
        <div style={{ background: "var(--dark1)", border: `1px solid ${composerOpen ? "#2a2a2a" : "#1e1e1e"}`, borderRadius: 16, padding: "14px 16px", marginBottom: 16, transition: "border-color .15s" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", background: "#1e1e1e", flexShrink: 0, marginTop: 2 }}>
              {user?.imageUrl ? <img src={user.imageUrl} alt="you" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "1rem" }}>👤</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {!composerOpen ? (
                <div onClick={() => setComposerOpen(true)} style={{ fontSize: "0.88rem", color: "#444", padding: "8px 0", cursor: "text" }}>What's on your mind?</div>
              ) : (
                <>
                  {recording && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", marginBottom: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f87171", display: "inline-block", animation: "pulse 1s infinite" }} />
                      <span style={{ fontSize: "0.85rem", color: "#f87171", fontWeight: 700 }}>Recording… {Math.floor(recordingSeconds / 60).toString().padStart(2, "0")}:{(recordingSeconds % 60).toString().padStart(2, "0")}</span>
                      <button onClick={() => mrRef.current?.stop()} style={{ marginLeft: "auto", background: "#f87171", border: "none", borderRadius: 50, padding: "5px 14px", fontWeight: 700, fontSize: "0.78rem", color: "#fff", cursor: "pointer" }}>Stop</button>
                    </div>
                  )}
                  {audioUrl && !recording && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#0d0d0d", borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>
                      <audio src={audioUrl} controls style={{ flex: 1, height: 32, minWidth: 0 }} />
                      <button onClick={() => { setAudioBlob(null); setAudioUrl(null); }} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "0.85rem" }}>✕</button>
                    </div>
                  )}
                  {!recording && (
                    <textarea ref={textareaRef} value={postText} onChange={e => { setPostText(e.target.value); setPostError(""); }}
                      placeholder={audioBlob ? "Add a caption in English... (optional)" : "Write in English… 🇺🇸"}
                      maxLength={280} rows={3}
                      style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: "0.9rem", color: "#fff", resize: "none", fontFamily: "'Inter', sans-serif", lineHeight: 1.6, boxSizing: "border-box", padding: 0 }}
                    />
                  )}
                  {showEmojiPicker && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, background: "#0d0d0d", borderRadius: 10, padding: "8px 10px", marginBottom: 8 }}>
                      {EMOJI_LIST.map(e => <button key={e} onClick={() => insertEmoji(e)} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", padding: "2px 4px", borderRadius: 6, lineHeight: 1 }}>{e}</button>)}
                    </div>
                  )}
                  {imagePreview && (
                    <div style={{ position: "relative", marginTop: 8, marginBottom: 4, background: "#0d0d0d", borderRadius: 10, overflow: "hidden" }}>
                      <img src={imagePreview} alt="preview" style={{ width: "100%", maxHeight: 240, objectFit: "contain", borderRadius: 10, display: "block" }} />
                      <button onClick={() => { setImageFile(null); setImagePreview(null); }} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 24, height: 24, color: "#fff", fontSize: "0.75rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          {postError && <p style={{ fontSize: "0.75rem", color: "#f87171", marginTop: 8, marginLeft: 46 }}>{postError}</p>}
          <div style={{ borderTop: "1px solid #1e1e1e", marginTop: 10, paddingTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => { if (!composerOpen) setComposerOpen(true); if (!recording && !audioBlob) startRecording(); }} disabled={recording || !!audioBlob}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 50, border: `1px solid ${audioBlob ? "rgba(245,200,0,.5)" : "#2a2a2a"}`, background: audioBlob ? "rgba(245,200,0,.08)" : "transparent", cursor: "pointer", fontSize: "0.75rem", color: audioBlob ? "var(--yellow)" : "var(--gray)", fontWeight: 600 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              <span>{recording ? "Recording…" : audioBlob ? "Audio ✓" : "Audio"}</span>
            </button>
            <button onClick={() => { if (!composerOpen) setComposerOpen(true); imageInputRef.current?.click(); }}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 50, border: `1px solid ${imageFile ? "rgba(245,200,0,.5)" : "#2a2a2a"}`, background: imageFile ? "rgba(245,200,0,.08)" : "transparent", cursor: "pointer", fontSize: "0.75rem", color: imageFile ? "var(--yellow)" : "var(--gray)", fontWeight: 600 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <span>{imageFile ? "Photo ✓" : "Photo"}</span>
            </button>
            <input ref={imageInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageSelect} />
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {composerOpen ? (
                <>
                  <button onClick={() => setShowEmojiPicker(v => !v)} style={{ background: showEmojiPicker ? "rgba(245,200,0,.1)" : "none", border: "none", fontSize: "1.1rem", cursor: "pointer", padding: "2px 6px", borderRadius: 8 }} title="Add emoji">😊</button>
                  {postText.length > 0 && <span style={{ fontSize: "0.65rem", color: postText.length > 250 ? "#f87171" : "var(--gray)" }}>{postText.length}/280</span>}
                  <button onClick={resetComposer} style={{ background: "none", border: "none", color: "var(--gray)", fontSize: "0.78rem", cursor: "pointer", padding: "0 4px" }}>Cancel</button>
                  <button onClick={submitPost} disabled={!canPost} style={{ background: canPost ? "var(--yellow)" : "#1e1e1e", color: canPost ? "#000" : "#333", border: "none", borderRadius: 50, padding: "6px 18px", fontWeight: 800, fontSize: "0.82rem", cursor: canPost ? "pointer" : "default", transition: "all .15s" }}>
                    {posting ? "…" : "Post"}
                  </button>
                </>
              ) : (
                <span onClick={() => setComposerOpen(true)} style={{ fontSize: "0.75rem", color: "var(--yellow)", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  <span>✍️</span> Write in English
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Feed */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {[0, 150, 300].map(d => <span key={d} style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--yellow)", display: "inline-block", animation: "bounce .8s infinite", animationDelay: `${d}ms` }} />)}
            </div>
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <p style={{ fontSize: "2rem", marginBottom: 12 }}>🌎</p>
            <p style={{ fontWeight: 800, color: "#fff", marginBottom: 6 }}>No posts yet!</p>
            <p style={{ fontSize: "0.8rem", color: "var(--gray)" }}>Be the first to share something in English.</p>
          </div>
        )}

        {posts.map(post => (
          <PostCard key={post.id} post={post} myId={user?.id ?? ""} user={user} router={router} onReaction={toggleReaction} onImageClick={(url) => { setSelectedImage(url); setImageZoom(1); }} onDeleted={id => setPosts(prev => prev.filter(p => p.id !== id))} />
        ))}
      </div>

      <button id="community-fab" onClick={() => setComposerOpen(true)} style={{ display: "none" }} />

      {selectedImage && (
        <div onClick={() => { setSelectedImage(null); setImageZoom(1); }} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "90%", height: "90%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img
              src={selectedImage}
              alt="fullscreen"
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                transform: `scale(${imageZoom})`,
                transition: "transform 0.2s",
                cursor: imageZoom > 1 ? "grab" : "zoom-in"
              }}
              onWheel={(e) => {
                e.preventDefault();
                setImageZoom(prev => Math.min(Math.max(prev + (e.deltaY > 0 ? -0.1 : 0.1), 1), 3));
              }}
            />
            <button
              onClick={() => { setSelectedImage(null); setImageZoom(1); }}
              style={{
                position: "absolute",
                top: 20,
                right: 20,
                background: "rgba(255,255,255,0.2)",
                border: "none",
                color: "#fff",
                fontSize: "1.5rem",
                cursor: "pointer",
                width: 40,
                height: 40,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              ✕
            </button>
            <div style={{ position: "absolute", bottom: 20, display: "flex", gap: 10, background: "rgba(0,0,0,0.5)", padding: "10px 15px", borderRadius: 50 }}>
              <button onClick={() => setImageZoom(prev => Math.max(prev - 0.2, 1))} style={{ background: "none", border: "none", color: "#fff", fontSize: "1rem", cursor: "pointer" }}>−</button>
              <span style={{ color: "#fff", fontSize: "0.9rem", minWidth: 40, textAlign: "center" }}>{Math.round(imageZoom * 100)}%</span>
              <button onClick={() => setImageZoom(prev => Math.min(prev + 0.2, 3))} style={{ background: "none", border: "none", color: "#fff", fontSize: "1rem", cursor: "pointer" }}>+</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
      `}</style>
    </div>
  );
}
