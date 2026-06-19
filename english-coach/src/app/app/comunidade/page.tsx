"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";

type Reaction = { emoji: string; user_id: string };
type Post = {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  content: string;
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
  const [showModal, setShowModal] = useState(false);
  const [postText, setPostText] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function loadPosts() {
    const res = await fetch("/api/community/posts");
    const data = await res.json();
    setPosts(data.posts ?? []);
    setLoading(false);
  }

  useEffect(() => { loadPosts(); }, []);

  useEffect(() => {
    if (showModal) setTimeout(() => textareaRef.current?.focus(), 100);
  }, [showModal]);

  async function submitPost() {
    if (!postText.trim() || posting) return;
    setPosting(true);
    setPostError("");
    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: postText.trim() }),
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
      setPostText("");
      setShowModal(false);
      await loadPosts();
    } finally {
      setPosting(false);
    }
  }

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

  return (
    <div style={{ background: "var(--black)", minHeight: "100dvh", fontFamily: "'Inter', sans-serif", paddingTop: 65, paddingBottom: 80 }}>
      {/* Subheader */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #1e1e1e" }}>
        <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff" }}>🌎 Comunidade</span>
      </div>

      {/* Feed */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 16px 0" }}>
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
          <div style={{ textAlign: "center", paddingTop: 80 }}>
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

              {/* Content */}
              <p style={{ fontSize: "0.9rem", color: "#fff", lineHeight: 1.6, marginBottom: 12, whiteSpace: "pre-wrap" }}>{post.content}</p>

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

      {/* Modal */}
      {showModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) { setShowModal(false); setPostError(""); setPostText(""); } }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div style={{ background: "#111", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px", width: "100%", maxWidth: 600 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff" }}>✍️ New post</span>
              <button onClick={() => { setShowModal(false); setPostError(""); setPostText(""); }} style={{ background: "none", border: "none", color: "var(--gray)", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
            </div>

            <textarea
              ref={textareaRef}
              value={postText}
              onChange={e => { setPostText(e.target.value); setPostError(""); }}
              placeholder="Share something in English... 🇺🇸"
              maxLength={280}
              rows={4}
              style={{ width: "100%", background: "var(--dark1)", border: "1px solid #2a2a2a", borderRadius: 12, padding: "12px 14px", fontSize: "0.9rem", color: "#fff", resize: "none", outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box" }}
            />

            {postError && (
              <p style={{ fontSize: "0.75rem", color: "#f87171", marginTop: 8 }}>{postError}</p>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
              <span style={{ fontSize: "0.7rem", color: postText.length > 250 ? "#f87171" : "var(--gray)" }}>{postText.length}/280</span>
              <button
                onClick={submitPost}
                disabled={!postText.trim() || posting}
                style={{ background: postText.trim() ? "var(--yellow)" : "#2a2a2a", color: postText.trim() ? "#000" : "var(--gray)", border: "none", borderRadius: 50, padding: "8px 20px", fontWeight: 800, fontSize: "0.85rem", cursor: postText.trim() ? "pointer" : "default", transition: "all .15s" }}
              >
                {posting ? "Checking..." : "Post"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>

      {/* FAB trigger (usado pelo BottomNav via evento customizado) */}
      <button
        id="community-fab"
        onClick={() => setShowModal(true)}
        style={{ display: "none" }}
      />
    </div>
  );
}
