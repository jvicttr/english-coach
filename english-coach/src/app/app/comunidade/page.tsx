"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";

type Reaction = { emoji: string; user_id: string };
type Post = {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  content: string;
  audio_url: string | null;
  image_url: string | null;
  created_at: string;
  community_reactions: Reaction[];
};

const EMOJIS = ["👍", "🔥", "💯"];

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function ComunidadePage() {
  const { user } = useUser();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  // Composer state
  const [composerOpen, setComposerOpen] = useState(false);
  const [postText, setPostText] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Audio state
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
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

  useEffect(() => {
    if (composerOpen && !recording && !audioBlob) {
      setTimeout(() => textareaRef.current?.focus(), 80);
    }
  }, [composerOpen, recording, audioBlob]);

  function openComposer() {
    setComposerOpen(true);
  }

  function resetComposer() {
    setComposerOpen(false);
    setPostText("");
    setPostError("");
    setImageFile(null);
    setImagePreview(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingSeconds(0);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  // ── Audio recording ─────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch {
      setPostError("Microphone access denied.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  function discardAudio() {
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingSeconds(0);
  }

  // ── Image selection ──────────────────────────────────────────────────────
  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  const submitPost = useCallback(async () => {
    if (posting) return;
    if (!postText.trim() && !audioBlob && !imageFile) return;

    setPosting(true);
    setPostError("");

    try {
      let uploadedAudioUrl: string | null = null;
      let uploadedImageUrl: string | null = null;

      // Upload audio if present — validate English via transcription
      if (audioBlob) {
        const formData = new FormData();
        formData.append("file", new File([audioBlob], "audio.webm", { type: "audio/webm" }));
        formData.append("type", "audio");

        // Transcribe first to validate English
        const transcribeForm = new FormData();
        transcribeForm.append("audio", new File([audioBlob], "audio.webm", { type: "audio/webm" }));
        const transcribeRes = await fetch("/api/transcribe", { method: "POST", body: transcribeForm });
        const transcribeData = await transcribeRes.json();
        const transcript: string = transcribeData.text ?? "";

        if (!transcript.trim()) {
          setPostError("Couldn't understand the audio. Please try again.");
          return;
        }

        // Validate English
        const checkRes = await fetch("/api/community/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: transcript, validateOnly: true }),
        });
        const checkData = await checkRes.json();
        if (checkData.error === "not_english") {
          setPostError("Please record in English! 🇺🇸");
          return;
        }

        // Upload audio file
        const uploadRes = await fetch("/api/community/upload", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) { setPostError("Failed to upload audio."); return; }
        uploadedAudioUrl = uploadData.url;
      }

      // Upload image if present
      if (imageFile) {
        const formData = new FormData();
        formData.append("file", imageFile);
        formData.append("type", "image");
        const uploadRes = await fetch("/api/community/upload", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) { setPostError("Failed to upload image."); return; }
        uploadedImageUrl = uploadData.url;
      }

      // Submit post
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: postText.trim(),
          audioUrl: uploadedAudioUrl,
          imageUrl: uploadedImageUrl,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "free_limit") {
          setPostError("You've used your free post! Upgrade to PRO to keep posting. 🚀");
        } else if (data.error === "not_english") {
          setPostError(data.message);
        } else {
          setPostError("Something went wrong. Try again.");
        }
        return;
      }

      resetComposer();
      await loadPosts();
    } finally {
      setPosting(false);
    }
  }, [posting, postText, audioBlob, imageFile]);

  // ── Reactions ────────────────────────────────────────────────────────────
  async function toggleReaction(postId: string, emoji: string) {
    await fetch("/api/community/react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, emoji }),
    });
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const myId = user?.id ?? "";
      const hasIt = p.community_reactions.some(r => r.emoji === emoji && r.user_id === myId);
      const reactions = hasIt
        ? p.community_reactions.filter(r => !(r.emoji === emoji && r.user_id === myId))
        : [...p.community_reactions, { emoji, user_id: myId }];
      return { ...p, community_reactions: reactions };
    }));
  }

  const canPost = !posting && (postText.trim().length > 0 || !!audioBlob || !!imageFile);

  return (
    <div style={{ background: "var(--black)", minHeight: "100dvh", fontFamily: "'Inter', sans-serif", paddingTop: 65, paddingBottom: 80 }}>
      {/* Subheader */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #1e1e1e" }}>
        <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff" }}>🌎 Comunidade</span>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 16px 0" }}>

        {/* ── Composer ── */}
        <div style={{ background: "var(--dark1)", border: `1px solid ${composerOpen ? "#2a2a2a" : "#1e1e1e"}`, borderRadius: 16, padding: "14px 16px", marginBottom: 16, transition: "border-color .15s" }}>
          <div style={{ display: "flex", gap: 10 }}>
            {/* Avatar */}
            <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", background: "#1e1e1e", flexShrink: 0, marginTop: 2 }}>
              {user?.imageUrl
                ? <img src={user.imageUrl} alt="you" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "1rem" }}>👤</span>}
            </div>

            {/* Input area */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {!composerOpen ? (
                <div
                  onClick={openComposer}
                  style={{ fontSize: "0.88rem", color: "#444", padding: "8px 0", cursor: "text" }}
                >
                  What's on your mind?
                </div>
              ) : (
                <>
                  {/* Audio recording UI */}
                  {recording && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", marginBottom: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f87171", display: "inline-block", animation: "pulse 1s infinite" }} />
                      <span style={{ fontSize: "0.85rem", color: "#f87171", fontWeight: 700 }}>
                        Recording… {Math.floor(recordingSeconds / 60).toString().padStart(2, "0")}:{(recordingSeconds % 60).toString().padStart(2, "0")}
                      </span>
                      <button onClick={stopRecording} style={{ marginLeft: "auto", background: "#f87171", border: "none", borderRadius: 50, padding: "5px 14px", fontWeight: 700, fontSize: "0.78rem", color: "#fff", cursor: "pointer" }}>
                        Stop
                      </button>
                    </div>
                  )}

                  {/* Audio preview */}
                  {audioUrl && !recording && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#0d0d0d", borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>
                      <audio src={audioUrl} controls style={{ flex: 1, height: 32, minWidth: 0 }} />
                      <button onClick={discardAudio} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "0.85rem", flexShrink: 0 }}>✕</button>
                    </div>
                  )}

                  {/* Text area (hidden when recording) */}
                  {!recording && (
                    <textarea
                      ref={textareaRef}
                      value={postText}
                      onChange={e => { setPostText(e.target.value); setPostError(""); }}
                      placeholder={audioBlob ? "Add a caption in English... (optional)" : "Write in English… 🇺🇸"}
                      maxLength={280}
                      rows={3}
                      style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: "0.9rem", color: "#fff", resize: "none", fontFamily: "'Inter', sans-serif", lineHeight: 1.6, boxSizing: "border-box", padding: 0 }}
                    />
                  )}

                  {/* Image preview */}
                  {imagePreview && (
                    <div style={{ position: "relative", marginTop: 8, marginBottom: 4 }}>
                      <img src={imagePreview} alt="preview" style={{ width: "100%", maxHeight: 240, objectFit: "cover", borderRadius: 10 }} />
                      <button
                        onClick={() => { setImageFile(null); setImagePreview(null); }}
                        style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 24, height: 24, color: "#fff", fontSize: "0.75rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >✕</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Error */}
          {postError && (
            <p style={{ fontSize: "0.75rem", color: "#f87171", marginTop: 8, marginLeft: 46 }}>{postError}</p>
          )}

          {/* Bottom bar */}
          <div style={{ borderTop: `1px solid #1e1e1e`, marginTop: composerOpen ? 10 : 0, paddingTop: composerOpen ? 10 : 0, display: "flex", alignItems: "center", gap: 12, ...(composerOpen ? {} : { marginTop: 10, paddingTop: 10 }) }}>
            {/* Audio button */}
            <button
              onClick={() => { if (!composerOpen) openComposer(); if (!recording && !audioBlob) startRecording(); }}
              disabled={recording || !!audioBlob}
              style={{ background: "none", border: "none", cursor: recording || audioBlob ? "default" : "pointer", display: "flex", alignItems: "center", gap: 5, color: recording ? "#f87171" : audioBlob ? "#4ade80" : "#333", fontSize: "0.75rem", padding: 0 }}
            >
              <span style={{ fontSize: "1rem" }}>🎙️</span>
              <span style={{ fontWeight: 600 }}>{recording ? "Recording…" : audioBlob ? "Audio ✓" : "Audio"}</span>
            </button>

            {/* Image button */}
            <button
              onClick={() => { if (!composerOpen) openComposer(); imageInputRef.current?.click(); }}
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: imageFile ? "#4ade80" : "#333", fontSize: "0.75rem", padding: 0 }}
            >
              <span style={{ fontSize: "1rem" }}>🖼️</span>
              <span style={{ fontWeight: 600 }}>{imageFile ? "Photo ✓" : "Photo"}</span>
            </button>
            <input ref={imageInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageSelect} />

            {/* Right side */}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
              {composerOpen && (
                <>
                  {postText.length > 0 && (
                    <span style={{ fontSize: "0.65rem", color: postText.length > 250 ? "#f87171" : "var(--gray)" }}>{postText.length}/280</span>
                  )}
                  <button onClick={resetComposer} style={{ background: "none", border: "none", color: "var(--gray)", fontSize: "0.78rem", cursor: "pointer", padding: "0 4px" }}>Cancel</button>
                  <button
                    onClick={submitPost}
                    disabled={!canPost}
                    style={{ background: canPost ? "var(--yellow)" : "#1e1e1e", color: canPost ? "#000" : "#333", border: "none", borderRadius: 50, padding: "6px 18px", fontWeight: 800, fontSize: "0.82rem", cursor: canPost ? "pointer" : "default", transition: "all .15s" }}
                  >
                    {posting ? "…" : "Post"}
                  </button>
                </>
              )}
              {!composerOpen && (
                <span onClick={openComposer} style={{ fontSize: "0.75rem", color: "var(--yellow)", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  <span>✍️</span> Write in English
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Feed ── */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {[0, 150, 300].map(d => (
                <span key={d} style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--yellow)", display: "inline-block", animation: "bounce .8s infinite", animationDelay: `${d}ms` }} />
              ))}
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

        {posts.map(post => {
          const myId = user?.id ?? "";
          return (
            <div key={post.id} style={{ background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "14px 16px", marginBottom: 10 }}>
              {/* Author */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", background: "#1e1e1e", flexShrink: 0 }}>
                  {post.avatar_url
                    ? <img src={post.avatar_url} alt={post.display_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "1rem" }}>👤</span>}
                </div>
                <div>
                  <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff", margin: 0 }}>{post.display_name}</p>
                  <p style={{ fontSize: "0.65rem", color: "var(--gray)", margin: 0 }}>{timeAgo(post.created_at)}</p>
                </div>
              </div>

              {/* Image */}
              {post.image_url && (
                <img src={post.image_url} alt="post" style={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 10, marginBottom: 10 }} />
              )}

              {/* Audio */}
              {post.audio_url && (
                <div style={{ background: "#0d0d0d", borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>
                  <audio src={post.audio_url} controls style={{ width: "100%", height: 32 }} />
                </div>
              )}

              {/* Text */}
              {post.content && (
                <p style={{ fontSize: "0.9rem", color: "#fff", lineHeight: 1.6, marginBottom: 12, whiteSpace: "pre-wrap" }}>{post.content}</p>
              )}

              {/* Reactions */}
              <div style={{ display: "flex", gap: 6 }}>
                {EMOJIS.map(emoji => {
                  const count = post.community_reactions.filter(r => r.emoji === emoji).length;
                  const reacted = post.community_reactions.some(r => r.emoji === emoji && r.user_id === myId);
                  return (
                    <button
                      key={emoji}
                      onClick={() => toggleReaction(post.id, emoji)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 50, border: `1px solid ${reacted ? "rgba(245,200,0,.5)" : "#2a2a2a"}`, background: reacted ? "rgba(245,200,0,.08)" : "transparent", cursor: "pointer", fontSize: "0.78rem", color: reacted ? "var(--yellow)" : "var(--gray)", fontWeight: 600 }}
                    >
                      <span>{emoji}</span>
                      {count > 0 && <span>{count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hidden FAB trigger for BottomNav */}
      <button id="community-fab" onClick={openComposer} style={{ display: "none" }} />

      <style>{`
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  );
}
