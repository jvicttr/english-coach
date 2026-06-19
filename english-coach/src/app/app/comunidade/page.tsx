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

const EMOJIS_REACT = ["👍", "🔥", "💯"];

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
        <div style={{ flex: 1, minWidth: 0 }}>
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
            <div style={{ marginBottom: 6, borderRadius: 8, overflow: "hidden", maxWidth: "100%", position: "relative" }}>
              <img src={imagePreview} alt="preview" style={{ width: "100%", height: "auto", maxHeight: 200, objectFit: "contain", borderRadius: 8 }} />
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
            <button onClick={() => { if (!recording && !audioBlob) startRec(); }} disabled={recording || !!audioBlob} style={{ background: "none", border: "none", fontSize: "0.9rem", cursor: "pointer", opacity: audioBlob ? 0.4 : 1 }}>🎙️</button>
            <button onClick={() => fileInputRef.current?.click()} disabled={!!imageFile} style={{ background: "none", border: "none", fontSize: "0.9rem", cursor: "pointer", opacity: imageFile ? 0.4 : 1 }}>📷</button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: "none" }} />
            <button onClick={() => setShowEmoji(v => !v)} style={{ background: "none", border: "none", fontSize: "0.9rem", cursor: "pointer" }}>😊</button>
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
function PostCard({ post, myId, user, router, isReply = false, onReaction, onDeleted }: {
  post: Post; myId: string; user: ReturnType<typeof useUser>["user"];
  router: ReturnType<typeof useRouter>; isReply?: boolean;
  onReaction: (postId: string, emoji: string) => void;
  onDeleted?: (postId: string) => void;
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
  const [translation, setTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  async function fetchTranslation(text: string) {
    if (translation) { setShowTranslation(true); return; }
    setTranslating(true);
    const res = await fetch("/api/community/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    const data = await res.json();
    setTranslation(data.translation ?? null);
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

      {post.image_url && <img src={post.image_url} alt="post" style={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 10, marginBottom: 10 }} />}
      {post.audio_url && (
        <div style={{ background: "#0d0d0d", borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>
          <audio src={post.audio_url} controls style={{ width: "100%", height: 32 }} />
          {post.transcript && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: "0.78rem", color: "#ccc", lineHeight: 1.5, margin: 0, fontStyle: "italic" }}>"{post.transcript}"</p>
              <div style={{ marginTop: 6 }}>
                {showTranslation && translation ? (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <p style={{ fontSize: "0.75rem", color: "var(--gray)", lineHeight: 1.5, margin: 0 }}>🇧🇷 {translation}</p>
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
        currentContent && <p style={{ fontSize: isReply ? "0.85rem" : "0.9rem", color: "#fff", lineHeight: 1.6, marginBottom: 12, whiteSpace: "pre-wrap" }}>{currentContent}</p>
      )}

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {EMOJIS_REACT.map(emoji => {
          const count = post.community_reactions.filter(r => r.emoji === emoji).length;
          const reacted = post.community_reactions.some(r => r.emoji === emoji && r.user_id === myId);
          return (
            <button key={emoji} onClick={() => onReaction(post.id, emoji)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 50, border: `1px solid ${reacted ? "rgba(245,200,0,.5)" : "#2a2a2a"}`, background: reacted ? "rgba(245,200,0,.08)" : "transparent", cursor: "pointer", fontSize: "0.78rem", color: reacted ? "var(--yellow)" : "var(--gray)", fontWeight: 600 }}>
              <span>{emoji}</span>{count > 0 && <span>{count}</span>}
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
            <PostCard key={r.id} post={r} myId={myId} user={user} router={router} isReply onReaction={onReaction} onDeleted={id => { setReplies(prev => prev.filter(x => x.id !== id)); setReplyCount(c => Math.max(0, c - 1)); }} />
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

  async function loadPosts() {
    const res = await fetch("/api/community/posts");
    const data = await res.json();
    setPosts(data.posts ?? []);
    setLoading(false);
  }

  useEffect(() => { loadPosts(); }, []);
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

  async function toggleReaction(postId: string, emoji: string) {
    await fetch("/api/community/react", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, emoji }) });
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const myId = user?.id ?? "";
      const hasIt = p.community_reactions.some(r => r.emoji === emoji && r.user_id === myId);
      return { ...p, community_reactions: hasIt ? p.community_reactions.filter(r => !(r.emoji === emoji && r.user_id === myId)) : [...p.community_reactions, { emoji, user_id: myId }] };
    }));
  }

  const canPost = !posting && (postText.trim().length > 0 || !!audioBlob || !!imageFile);

  return (
    <div className="app-scroll" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", paddingTop: 65, paddingBottom: 80 }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #1e1e1e" }}>
        <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff" }}>🌎 Comunidade</span>
      </div>

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
                    <div style={{ position: "relative", marginTop: 8, marginBottom: 4 }}>
                      <img src={imagePreview} alt="preview" style={{ width: "100%", maxHeight: 240, objectFit: "cover", borderRadius: 10 }} />
                      <button onClick={() => { setImageFile(null); setImagePreview(null); }} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 24, height: 24, color: "#fff", fontSize: "0.75rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          {postError && <p style={{ fontSize: "0.75rem", color: "#f87171", marginTop: 8, marginLeft: 46 }}>{postError}</p>}
          <div style={{ borderTop: "1px solid #1e1e1e", marginTop: 10, paddingTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => { if (!composerOpen) setComposerOpen(true); if (!recording && !audioBlob) startRecording(); }} disabled={recording || !!audioBlob}
              style={{ background: "none", border: "none", cursor: recording || audioBlob ? "default" : "pointer", display: "flex", alignItems: "center", gap: 5, color: recording ? "#f87171" : audioBlob ? "#4ade80" : "#333", fontSize: "0.75rem", padding: 0 }}>
              <span style={{ fontSize: "1rem" }}>🎙️</span>
              <span style={{ fontWeight: 600 }}>{recording ? "Recording…" : audioBlob ? "Audio ✓" : "Audio"}</span>
            </button>
            <button onClick={() => { if (!composerOpen) setComposerOpen(true); imageInputRef.current?.click(); }}
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: imageFile ? "#4ade80" : "#333", fontSize: "0.75rem", padding: 0 }}>
              <span style={{ fontSize: "1rem" }}>🖼️</span>
              <span style={{ fontWeight: 600 }}>{imageFile ? "Photo ✓" : "Photo"}</span>
            </button>
            <input ref={imageInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageSelect} />
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
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
          <PostCard key={post.id} post={post} myId={user?.id ?? ""} user={user} router={router} onReaction={toggleReaction} onDeleted={id => setPosts(prev => prev.filter(p => p.id !== id))} />
        ))}
      </div>

      <button id="community-fab" onClick={() => setComposerOpen(true)} style={{ display: "none" }} />

      <style>{`
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
      `}</style>
    </div>
  );
}
