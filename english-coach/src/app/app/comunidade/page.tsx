"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { PostCard, type Post, EMOJI_LIST } from "@/components/PostCard";

function getSupportedMime() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return types.find(t => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}
function mimeToExt(mime: string) {
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
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
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; image_url: string | null }>>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionAllUsers, setMentionAllUsers] = useState<Array<{ id: string; name: string; image_url: string | null; handle: string | null }>>([]);
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

  function highlightHashPost() {
    const hash = window.location.hash;
    if (!hash.startsWith("#post-")) return;
    const el = document.getElementById(hash.slice(1));
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.style.outline = "2px solid var(--yellow)";
    el.style.outlineOffset = "3px";
    el.style.borderRadius = "16px";
    el.style.transition = "outline 0.3s";
    setTimeout(() => {
      el.style.outline = "";
      el.style.outlineOffset = "";
    }, 2500);
  }

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

    // After posts render, scroll to and highlight the post from the notification URL hash
    if (window.location.hash.startsWith("#post-")) {
      setTimeout(highlightHashPost, 400);
    }
  }

  async function loadNewPosts() {
    setRefreshing(true);
    await loadPosts();
  }

  async function openUsersModal() {
    setShowUsersModal(true);
    if (users.length === 0) {
      setUsersLoading(true);
      try {
        const res = await fetch("/api/users");
        const data = await res.json();
        setUsers(data.users || []);
      } catch (error) {
        console.error("Erro ao carregar usuários:", error);
      } finally {
        setUsersLoading(false);
      }
    }
  }

  async function startChat(otherUserId: string) {
    try {
      const res = await fetch("/api/messages/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId }),
      });
      const data = await res.json();
      setShowUsersModal(false);
      router.push(`/app/mensagens/${otherUserId}`);
    } catch (error) {
      console.error("Erro ao iniciar chat:", error);
    }
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

  async function fetchMentionUsers() {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setMentionAllUsers(data.users || []);
    } catch {}
  }

  function handlePostChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setPostText(val);
    setPostError("");
    const cursor = e.target.selectionStart ?? val.length;
    const match = val.slice(0, cursor).match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1].toLowerCase());
      setMentionOpen(true);
      if (mentionAllUsers.length === 0) fetchMentionUsers();
    } else {
      setMentionOpen(false);
    }
  }

  function insertMention(u: { id: string; name: string; handle: string | null }) {
    const ta = textareaRef.current;
    const cursor = ta?.selectionStart ?? postText.length;
    const before = postText.slice(0, cursor);
    const atIdx = before.lastIndexOf("@");
    const tag = u.handle ?? u.name.split(" ")[0];
    const newText = before.slice(0, atIdx) + `@${tag} ` + postText.slice(cursor);
    setPostText(newText);
    setMentionOpen(false);
    setTimeout(() => ta?.focus(), 0);
  }

  const filteredMentions = mentionAllUsers
    .filter(u => u.name.toLowerCase().includes(mentionQuery) || (u.handle ?? "").toLowerCase().includes(mentionQuery))
    .slice(0, 5);

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
    const toggle = (p: typeof posts[0]) => {
      if (p.id !== postId) return p;
      const cr = p.community_reactions ?? [];
      const hasIt = cr.some(r => r.emoji === emoji && r.user_id === myId);
      return { ...p, community_reactions: hasIt ? cr.filter(r => !(r.emoji === emoji && r.user_id === myId)) : [...cr, { emoji, user_id: myId }] };
    };
    setPosts(prev => prev.map(toggle));
    fetch("/api/community/react", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, emoji }) }).catch(() => {
      setPosts(prev => prev.map(toggle));
    });
  }

  const canPost = !posting && (postText.trim().length > 0 || !!audioBlob || !!imageFile);

  return (
    <div ref={scrollContainerRef} className="app-scroll" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", paddingTop: "calc(65px + env(safe-area-inset-top))", paddingBottom: 80 }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: "0.95rem", color: "#fff" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          Comunidade
        </div>
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
                    <div style={{ position: "relative" }}>
                      {mentionOpen && filteredMentions.length > 0 && (
                        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, overflow: "hidden", zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                          {filteredMentions.map(u => (
                            <button key={u.id} onMouseDown={e => { e.preventDefault(); insertMention(u); }}
                              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "transparent", border: "none", borderBottom: "1px solid #1e1e1e", cursor: "pointer", width: "100%", textAlign: "left" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "#2a2a2a")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                            >
                              <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", background: "#2a2a2a", flexShrink: 0 }}>
                                {u.image_url ? <img src={u.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "0.8rem" }}>👤</span>}
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                <span style={{ fontSize: "0.85rem", color: "var(--yellow)", fontWeight: 700 }}>@{u.handle ?? u.name.split(" ")[0]}</span>
                                <span style={{ fontSize: "0.75rem", color: "var(--gray)" }}>{u.name}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      <textarea ref={textareaRef} value={postText} onChange={handlePostChange}
                        placeholder={audioBlob ? "Add a caption in English... (optional)" : "Write in English… 🇺🇸"}
                        maxLength={280} rows={3}
                        style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: "0.9rem", color: "#fff", resize: "none", fontFamily: "'Inter', sans-serif", lineHeight: 1.6, boxSizing: "border-box", padding: 0 }}
                      />
                    </div>
                  )}
                  {showEmojiPicker && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 3, background: "#0d0d0d", borderRadius: 8, padding: "8px", marginBottom: 8, height: "60px", maxHeight: "60px", overflowY: "auto", border: "2px solid #fff", scrollBehavior: "smooth", flexShrink: 0 }}>
                      {EMOJI_LIST.map(e => <button key={e} onClick={() => insertEmoji(e)} style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", padding: "4px", borderRadius: 6, lineHeight: 1, transition: "transform .1s", display: "flex", alignItems: "center", justifyContent: "center" }} onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.2)")} onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}>{e}</button>)}
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
                  <button onClick={() => setShowEmojiPicker(v => !v)} style={{ background: showEmojiPicker ? "rgba(245,200,0,.1)" : "none", border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: showEmojiPicker ? "var(--yellow)" : "var(--gray)" }} title="Add emoji">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="9" r="1"/></svg>
                  </button>
                  {postText.length > 0 && <span style={{ fontSize: "0.65rem", color: postText.length > 250 ? "#f87171" : "var(--gray)" }}>{postText.length}/280</span>}
                  <button onClick={resetComposer} style={{ background: "none", border: "none", color: "var(--gray)", fontSize: "0.78rem", cursor: "pointer", padding: "0 4px" }}>Cancel</button>
                  <button onClick={submitPost} disabled={!canPost} style={{ background: canPost ? "var(--yellow)" : "#1e1e1e", color: canPost ? "#000" : "#333", border: "none", borderRadius: 50, padding: "6px 18px", fontWeight: 800, fontSize: "0.82rem", cursor: canPost ? "pointer" : "default", transition: "all .15s" }}>
                    {posting ? "…" : "Post"}
                  </button>
                </>
              ) : (
                <span onClick={() => setComposerOpen(true)} style={{ fontSize: "0.75rem", color: "var(--yellow)", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Write in English
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
          <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "90%", height: "90%", display: "flex", alignItems: "center", justifyContent: "center" }}
            onTouchStart={(e) => {
              if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                (e.currentTarget as any).initialDistance = Math.sqrt(dx * dx + dy * dy);
              }
            }}
            onTouchMove={(e) => {
              if (e.touches.length === 2 && (e.currentTarget as any).initialDistance) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const currentDistance = Math.sqrt(dx * dx + dy * dy);
                const scale = currentDistance / (e.currentTarget as any).initialDistance;
                setImageZoom(prev => Math.min(Math.max(prev * scale, 1), 3));
                (e.currentTarget as any).initialDistance = currentDistance;
              }
            }}
            onTouchEnd={(e) => {
              (e.currentTarget as any).initialDistance = null;
            }}
          >
            <img
              src={selectedImage}
              alt="fullscreen"
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                transform: `scale(${imageZoom})`,
                transition: "transform 0.2s",
                cursor: imageZoom > 1 ? "grab" : "zoom-in",
                touchAction: "none"
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

      {/* FAB Mensagens */}
      <button
        onClick={openUsersModal}
        style={{
          position: "fixed",
          bottom: "100px",
          right: "max(20px, calc((100vw - 600px) / 6))",
          width: "46px",
          height: "46px",
          borderRadius: "14px",
          background: "rgba(17,17,17,0.6)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.07)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
          zIndex: 40,
          transition: "border-color 0.15s, background 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "rgba(245,200,0,0.3)";
          e.currentTarget.style.background = "rgba(30,30,30,0.75)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
          e.currentTarget.style.background = "rgba(17,17,17,0.6)";
        }}
        title="Mensagens"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>

      {/* Painel lateral de usuários */}
      {showUsersModal && (
        <>
          <div
            onClick={() => setShowUsersModal(false)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 90,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              width: "100%",
              maxWidth: "350px",
              height: "100vh",
              background: "var(--black)",
              borderLeft: "1px solid #1e1e1e",
              zIndex: 100,
              display: "flex",
              flexDirection: "column",
              animation: "slideIn 0.3s ease-out",
            }}
          >
            <div style={{ padding: "16px", borderBottom: "1px solid #1e1e1e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, color: "#fff", fontSize: "1rem", fontWeight: 700 }}>Iniciar conversa</h2>
              <button
                onClick={() => setShowUsersModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#999",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
              {usersLoading ? (
                <div style={{ textAlign: "center", color: "#666", paddingTop: "40px" }}>Carregando usuários...</div>
              ) : users.length === 0 ? (
                <div style={{ textAlign: "center", color: "#666", paddingTop: "40px" }}>Nenhum usuário disponível</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => startChat(u.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px",
                        background: "transparent",
                        border: "1px solid transparent",
                        borderRadius: "12px",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(245,200,0,.08)";
                        e.currentTarget.style.borderColor = "rgba(245,200,0,.2)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.borderColor = "transparent";
                      }}
                    >
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          background: u.image_url ? "transparent" : "var(--yellow)",
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "1.2rem",
                          flexShrink: 0,
                          overflow: "hidden",
                        }}
                      >
                        {u.image_url
                          ? <img src={u.image_url} alt={u.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : "👤"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#fff" }}>{u.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "#666" }}>{u.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
        [style*="border: 2px solid #fff"]::-webkit-scrollbar { width: 6px; }
        [style*="border: 2px solid #fff"]::-webkit-scrollbar-track { background: transparent; }
        [style*="border: 2px solid #fff"]::-webkit-scrollbar-thumb { background: #555; border-radius: 3px; }
        [style*="border: 2px solid #fff"]::-webkit-scrollbar-thumb:hover { background: #777; }
      `}</style>
    </div>
  );
}
