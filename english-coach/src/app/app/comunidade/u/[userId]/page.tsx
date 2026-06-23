"use client";

import { useState, useEffect, use } from "react";
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
  created_at: string;
  community_reactions: Reaction[];
};

const HEART_EMOJI = "❤️";

function HeartIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const { user: me } = useUser();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [profile, setProfile] = useState<{ display_name: string; avatar_url: string | null } | null>(null);
  const [totalPosts, setTotalPosts] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/community/user/${userId}`)
      .then(r => r.json())
      .then(d => {
        setPosts(d.posts ?? []);
        setProfile(d.profile ?? null);
        setTotalPosts(d.totalPosts ?? 0);
        setLoading(false);
      });
  }, [userId]);

  async function toggleReaction(postId: string, emoji: string) {
    await fetch("/api/community/react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, emoji }),
    });
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const myId = me?.id ?? "";
      const hasIt = p.community_reactions.some(r => r.emoji === emoji && r.user_id === myId);
      const reactions = hasIt
        ? p.community_reactions.filter(r => !(r.emoji === emoji && r.user_id === myId))
        : [...p.community_reactions, { emoji, user_id: myId }];
      return { ...p, community_reactions: reactions };
    }));
  }

  return (
    <div style={{ background: "var(--black)", minHeight: "100dvh", fontFamily: "'Inter', sans-serif", paddingTop: 65, paddingBottom: 80, overflowX: "hidden" }}>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, padding: "10px 16px", borderBottom: "1px solid #1e1e1e", display: "flex", alignItems: "center", gap: 10, background: "var(--black)", zIndex: 50 }}>
        <button onClick={() => router.back()} style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: 10, height: 32, width: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff" }}>Profile</span>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 16px" }}>
        {/* Profile header */}
        <div style={{ padding: "24px 0 16px", borderBottom: "1px solid #1e1e1e", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", overflow: "hidden", background: "#1e1e1e", flexShrink: 0 }}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt={profile.display_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "1.6rem" }}>👤</span>}
            </div>
            <div>
              <p style={{ fontWeight: 800, fontSize: "1.1rem", color: "#fff", margin: 0 }}>{profile?.display_name ?? "Student"}</p>
              <p style={{ fontSize: "0.75rem", color: "var(--gray)", margin: "4px 0 0" }}>{totalPosts} post{totalPosts !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>

        {/* Posts */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {[0, 150, 300].map(d => <span key={d} style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--yellow)", display: "inline-block", animation: "bounce .8s infinite", animationDelay: `${d}ms` }} />)}
            </div>
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <p style={{ fontSize: "0.9rem", color: "var(--gray)" }}>No posts yet.</p>
          </div>
        )}

        {posts.map(post => {
          const myId = me?.id ?? "";
          return (
            <div key={post.id} style={{ background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "14px 16px", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", background: "#1e1e1e", flexShrink: 0 }}>
                  {post.avatar_url ? <img src={post.avatar_url} alt={post.display_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "1rem" }}>👤</span>}
                </div>
                <div>
                  <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff", margin: 0 }}>{post.display_name}</p>
                  <p style={{ fontSize: "0.65rem", color: "var(--gray)", margin: 0 }}>{timeAgo(post.created_at)}</p>
                </div>
              </div>
              {post.image_url && <img src={post.image_url} alt="post" style={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 10, marginBottom: 10 }} />}
              {post.audio_url && <div style={{ background: "#0d0d0d", borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}><audio src={post.audio_url} controls style={{ width: "100%", height: 32 }} /></div>}
              {post.content && <p style={{ fontSize: "0.9rem", color: "#fff", lineHeight: 1.6, marginBottom: 12, whiteSpace: "pre-wrap" }}>{post.content}</p>}
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {(() => {
                  const count = post.community_reactions.filter(r => r.emoji === HEART_EMOJI).length;
                  const reacted = post.community_reactions.some(r => r.emoji === HEART_EMOJI && r.user_id === myId);
                  return (
                    <button onClick={() => toggleReaction(post.id, HEART_EMOJI)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 50, border: `1px solid ${reacted ? "rgba(245,200,0,.5)" : "#2a2a2a"}`, background: reacted ? "rgba(245,200,0,.08)" : "transparent", cursor: "pointer", fontSize: "0.78rem", color: reacted ? "var(--yellow)" : "var(--gray)", fontWeight: 600 }}>
                      <HeartIcon />{count > 0 && <span>{count}</span>}
                    </button>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>
    </div>
  );
}
