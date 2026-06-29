"use client";

import { useState, useEffect, use } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { getTier } from "@/lib/tiers";
import { PostCard, type Post } from "@/components/PostCard";

export default function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const { user: me } = useUser();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [profile, setProfile] = useState<{ display_name: string; avatar_url: string | null; total_xp: number; level: string | null; level_label: string | null } | null>(null);
  const [totalPosts, setTotalPosts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageZoom, setImageZoom] = useState(1);

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
    <div style={{ background: "var(--black)", minHeight: "100dvh", fontFamily: "'Inter', sans-serif", paddingTop: "calc(65px + env(safe-area-inset-top))", paddingBottom: 80, overflowX: "hidden" }}>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, paddingTop: "calc(10px + env(safe-area-inset-top))", paddingBottom: 10, paddingLeft: 16, paddingRight: 16, borderBottom: "1px solid #1e1e1e", display: "flex", alignItems: "center", gap: 10, background: "var(--black)", zIndex: 1000 }}>
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
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile?.display_name ?? "Student"}</span>
                  {userId === "user_3EzV0DXiskFt0wNSwNSXVHapiBC" && (
                    <span title="Criador do app" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", background: "var(--yellow)", flexShrink: 0 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="#000"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                    </span>
                  )}
                </span>
                {me && me.id !== userId && (
                  <a
                    href={`/app/mensagens/${userId}`}
                    title="Enviar mensagem direta"
                    style={{ flexShrink: 0, width: 32, height: 32, borderRadius: "50%", background: "rgba(245,200,0,.12)", border: "1px solid rgba(245,200,0,.3)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="var(--yellow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--gray)" }}>{totalPosts} post{totalPosts !== 1 ? "s" : ""}</span>
                {profile && (() => {
                  const tier = getTier(profile.total_xp);
                  return (
                    <>
                      <span style={{ fontSize: "0.65rem", color: "#333" }}>·</span>
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: tier.color }}>{tier.emoji} {tier.label}</span>
                      <span style={{ fontSize: "0.65rem", color: "#333" }}>·</span>
                      <span style={{ fontSize: "0.7rem", color: "var(--gray)" }}>{profile.total_xp.toLocaleString("pt-BR")} XP</span>
                      {profile.level_label && (
                        <>
                          <span style={{ fontSize: "0.65rem", color: "#333" }}>·</span>
                          <span style={{ fontSize: "0.68rem", background: "rgba(245,200,0,.1)", color: "var(--yellow)", padding: "1px 7px", borderRadius: 50, fontWeight: 600 }}>{profile.level_label}</span>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
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

        {posts.map(post => (
          <PostCard
            key={post.id}
            post={post}
            myId={me?.id ?? ""}
            user={me}
            router={router}
            onReaction={toggleReaction}
            onImageClick={(url) => { setSelectedImage(url); setImageZoom(1); }}
            onDeleted={(id) => setPosts(prev => prev.filter(p => p.id !== id))}
          />
        ))}
      </div>
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>

      {selectedImage && (
        <div onClick={() => { setSelectedImage(null); setImageZoom(1); }} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div onClick={e => e.stopPropagation()} style={{ position: "relative", width: "90%", height: "90%", display: "flex", alignItems: "center", justifyContent: "center" }}
            onTouchStart={e => { if (e.touches.length === 2) { const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; (e.currentTarget as any).initialDistance = Math.sqrt(dx*dx+dy*dy); } }}
            onTouchMove={e => { if (e.touches.length === 2 && (e.currentTarget as any).initialDistance) { const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; const dist = Math.sqrt(dx*dx+dy*dy); setImageZoom(prev => Math.min(Math.max(prev * (dist / (e.currentTarget as any).initialDistance), 1), 3)); (e.currentTarget as any).initialDistance = dist; } }}
            onTouchEnd={e => { (e.currentTarget as any).initialDistance = null; }}
          >
            <img
              src={selectedImage}
              alt="fullscreen"
              style={{ maxWidth: "100%", maxHeight: "100%", transform: `scale(${imageZoom})`, transition: "transform 0.2s", cursor: imageZoom > 1 ? "grab" : "zoom-in", touchAction: "none" }}
              onWheel={e => { e.preventDefault(); setImageZoom(prev => Math.min(Math.max(prev + (e.deltaY > 0 ? -0.1 : 0.1), 1), 3)); }}
            />
            <button onClick={() => { setSelectedImage(null); setImageZoom(1); }} style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", fontSize: "1.5rem", cursor: "pointer", width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            <div style={{ position: "absolute", bottom: 20, display: "flex", gap: 10, background: "rgba(0,0,0,0.5)", padding: "10px 15px", borderRadius: 50 }}>
              <button onClick={() => setImageZoom(prev => Math.max(prev - 0.2, 1))} style={{ background: "none", border: "none", color: "#fff", fontSize: "1rem", cursor: "pointer" }}>−</button>
              <span style={{ color: "#fff", fontSize: "0.9rem", minWidth: 40, textAlign: "center" }}>{Math.round(imageZoom * 100)}%</span>
              <button onClick={() => setImageZoom(prev => Math.min(prev + 0.2, 3))} style={{ background: "none", border: "none", color: "#fff", fontSize: "1rem", cursor: "pointer" }}>+</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
