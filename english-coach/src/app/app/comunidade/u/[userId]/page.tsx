"use client";

import { useState, useEffect, use, useRef } from "react";
import { createPortal } from "react-dom";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { getTier } from "@/lib/tiers";
import { CREATOR_IDS } from "@/lib/creator";
import { PostCard, type Post } from "@/components/PostCard";

type Profile = {
  display_name: string;
  avatar_url: string | null;
  total_xp: number;
  level: string | null;
  level_label: string | null;
  handle: string | null;
  follower_count: number;
  following_count: number;
  is_following: boolean;
};

type FollowUser = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  handle: string | null;
};

export default function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const { user: me } = useUser();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [totalPosts, setTotalPosts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [followLoading, setFollowLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [followModal, setFollowModal] = useState<{ type: "followers" | "following"; users: FollowUser[]; loading: boolean } | null>(null);

  function loadProfile() {
    return fetch(`/api/community/user/${userId}`)
      .then(r => r.json())
      .then(d => {
        setPosts(d.posts ?? []);
        setProfile(d.profile ?? null);
        setTotalPosts(d.totalPosts ?? 0);
        setLoading(false);
      });
  }

  useEffect(() => {
    loadProfile();
    // Poll follower count every 20s for real-time updates from other users
    pollRef.current = setInterval(() => {
      fetch(`/api/community/follow?userId=${userId}`)
        .then(r => r.json())
        .then(d => {
          setProfile(prev => prev ? { ...prev, follower_count: d.followerCount, is_following: d.isFollowing } : prev);
        })
        .catch(() => {});
    }, 20000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [userId]);

  async function toggleFollow() {
    if (!profile || followLoading) return;
    setFollowLoading(true);
    // Optimistic update
    const wasFollowing = profile.is_following;
    setProfile(prev => prev ? {
      ...prev,
      is_following: !wasFollowing,
      follower_count: wasFollowing ? prev.follower_count - 1 : prev.follower_count + 1,
    } : prev);
    try {
      const res = await fetch("/api/community/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      setProfile(prev => prev ? { ...prev, is_following: data.isFollowing, follower_count: data.followerCount } : prev);
    } catch {
      // Revert on error
      setProfile(prev => prev ? {
        ...prev,
        is_following: wasFollowing,
        follower_count: wasFollowing ? prev.follower_count + 1 : prev.follower_count - 1,
      } : prev);
    } finally {
      setFollowLoading(false);
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
      const myId = me?.id ?? "";
      const hasIt = p.community_reactions.some(r => r.emoji === emoji && r.user_id === myId);
      const reactions = hasIt
        ? p.community_reactions.filter(r => !(r.emoji === emoji && r.user_id === myId))
        : [...p.community_reactions, { emoji, user_id: myId }];
      return { ...p, community_reactions: reactions };
    }));
  }

  async function openFollowModal(type: "followers" | "following") {
    setFollowModal({ type, users: [], loading: true });
    try {
      const res = await fetch(`/api/community/followers?userId=${userId}&type=${type}`);
      const data = await res.json();
      setFollowModal({ type, users: data.users ?? [], loading: false });
    } catch {
      setFollowModal(prev => prev ? { ...prev, loading: false } : null);
    }
  }

  const isMe = me?.id === userId;

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
        <div style={{ padding: "24px 0 20px", borderBottom: "1px solid #1e1e1e", marginBottom: 16 }}>
          <style>{`@keyframes sk-pulse{0%,100%{opacity:.4}50%{opacity:.15}}`}</style>
          {loading ? (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#1e1e1e", flexShrink: 0, animation: "sk-pulse 1.5s ease-in-out infinite" }} />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ height: 16, width: "50%", borderRadius: 6, background: "#1e1e1e", animation: "sk-pulse 1.5s ease-in-out infinite" }} />
                <div style={{ height: 11, width: "30%", borderRadius: 6, background: "#1e1e1e", animation: "sk-pulse 1.5s ease-in-out infinite 0.1s" }} />
                <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                  <div style={{ height: 10, width: 50, borderRadius: 6, background: "#1e1e1e", animation: "sk-pulse 1.5s ease-in-out infinite 0.2s" }} />
                  <div style={{ height: 10, width: 60, borderRadius: 6, background: "#1e1e1e", animation: "sk-pulse 1.5s ease-in-out infinite 0.3s" }} />
                  <div style={{ height: 10, width: 55, borderRadius: 6, background: "#1e1e1e", animation: "sk-pulse 1.5s ease-in-out infinite 0.4s" }} />
                </div>
                <div style={{ height: 10, width: "40%", borderRadius: 6, background: "#1e1e1e", animation: "sk-pulse 1.5s ease-in-out infinite 0.5s" }} />
                {!isMe && me && (
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <div style={{ width: 90, height: 34, borderRadius: 50, background: "#1e1e1e", animation: "sk-pulse 1.5s ease-in-out infinite" }} />
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#1e1e1e", animation: "sk-pulse 1.5s ease-in-out infinite 0.1s" }} />
                  </div>
                )}
              </div>
            </div>
          ) : (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", overflow: "hidden", background: "#1e1e1e", flexShrink: 0 }}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt={profile.display_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "1.6rem" }}>👤</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Name row */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {profile?.display_name ?? "Student"}
                </span>
                {CREATOR_IDS.has(userId) && (
                  <span title="Criador do app" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg, #f5c800 0%, #ff9500 100%)", boxShadow: "0 1px 8px rgba(245,180,0,0.6)", flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="#000"><path d="M2 19h20v2H2zM2 6l5 7 5-7 5 7 5-7v11H2z"/></svg>
                  </span>
                )}
              </div>

              {/* Handle */}
              {profile?.handle && (
                <p style={{ fontSize: "0.78rem", color: "var(--yellow)", fontWeight: 600, margin: "2px 0 0", opacity: 0.85 }}>
                  @{profile.handle}
                </p>
              )}

              {/* Stats row */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--gray)" }}>
                  <strong style={{ color: "#fff" }}>{totalPosts}</strong> post{totalPosts !== 1 ? "s" : ""}
                </span>
                <button onClick={() => openFollowModal("followers")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "0.72rem", color: "var(--gray)" }}>
                  <strong style={{ color: "#fff" }}>{profile?.follower_count ?? 0}</strong> seguidor{(profile?.follower_count ?? 0) !== 1 ? "es" : ""}
                </button>
                <button onClick={() => openFollowModal("following")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "0.72rem", color: "var(--gray)" }}>
                  <strong style={{ color: "#fff" }}>{profile?.following_count ?? 0}</strong> seguindo
                </button>
              </div>

              {/* Tier + XP */}
              {profile && (() => {
                const tier = getTier(profile.total_xp);
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: tier.color }}>{tier.emoji} {tier.label}</span>
                    <span style={{ fontSize: "0.65rem", color: "#333" }}>·</span>
                    <span style={{ fontSize: "0.7rem", color: "var(--gray)" }}>{profile.total_xp.toLocaleString("pt-BR")} XP</span>
                    {profile.level_label && (
                      <>
                        <span style={{ fontSize: "0.65rem", color: "#333" }}>·</span>
                        <span style={{ fontSize: "0.68rem", background: "rgba(245,200,0,.1)", color: "var(--yellow)", padding: "1px 7px", borderRadius: 50, fontWeight: 600 }}>{profile.level_label}</span>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* Action buttons */}
              {!isMe && me && (
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button
                    onClick={toggleFollow}
                    disabled={followLoading}
                    style={{
                      padding: "8px 20px",
                      borderRadius: 50,
                      border: profile?.is_following ? "1px solid #3a3a3a" : "none",
                      background: profile?.is_following ? "transparent" : "var(--yellow)",
                      color: profile?.is_following ? "var(--gray)" : "#000",
                      fontWeight: 800,
                      fontSize: "0.82rem",
                      cursor: followLoading ? "default" : "pointer",
                      opacity: followLoading ? 0.7 : 1,
                      transition: "all 0.15s",
                    }}
                  >
                    {followLoading ? "…" : profile?.is_following ? "Seguindo" : "Seguir"}
                  </button>
                  <a
                    href={`/app/mensagens/${userId}`}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: "50%", background: "rgba(245,200,0,.1)", border: "1px solid rgba(245,200,0,.25)", textDecoration: "none", flexShrink: 0 }}
                    title="Enviar mensagem"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="var(--yellow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                </div>
              )}
            </div>
          </div>
          )}
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
            <p style={{ fontSize: "0.9rem", color: "var(--gray)" }}>Nenhum post ainda.</p>
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

      {/* Followers / Following modal */}
      {followModal && typeof document !== "undefined" && createPortal(
        <div onClick={() => setFollowModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 2000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--dark2)", borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 520, maxHeight: "70vh", display: "flex", flexDirection: "column", border: "1px solid #2a2a2a", borderBottom: "none" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid #1e1e1e", flexShrink: 0 }}>
              <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff" }}>
                {followModal.type === "followers" ? "Seguidores" : "Seguindo"}
              </span>
              <button onClick={() => setFollowModal(null)} style={{ background: "none", border: "none", color: "var(--gray)", cursor: "pointer", fontSize: "1.2rem", lineHeight: 1 }}>✕</button>
            </div>
            {/* List */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {followModal.loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[0, 150, 300].map(d => <span key={d} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--yellow)", display: "inline-block", animation: "bounce .8s infinite", animationDelay: `${d}ms` }} />)}
                  </div>
                </div>
              ) : followModal.users.length === 0 ? (
                <p style={{ textAlign: "center", color: "var(--gray)", fontSize: "0.85rem", padding: 32 }}>
                  {followModal.type === "followers" ? "Nenhum seguidor ainda." : "Não está seguindo ninguém ainda."}
                </p>
              ) : (
                followModal.users.map(u => (
                  <a key={u.user_id} href={`/app/comunidade/u/${u.user_id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", textDecoration: "none", borderBottom: "1px solid #1e1e1e" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#1a1a1a")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", background: "#1e1e1e", flexShrink: 0 }}>
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt={u.display_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "1rem" }}>👤</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "0.88rem", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.display_name}</p>
                      {u.handle && <p style={{ margin: "1px 0 0", fontSize: "0.72rem", color: "var(--yellow)", opacity: 0.8 }}>@{u.handle}</p>}
                    </div>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2L10 7L5 12" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </a>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

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
