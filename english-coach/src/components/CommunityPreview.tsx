"use client";

import { useEffect, useState } from "react";
import { timeAgo, stripMentionIds } from "@/components/PostCard";

type PreviewPost = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  content: string;
  image_url: string | null;
  audio_url: string | null;
  created_at: string;
  community_reactions?: { emoji: string }[];
};

function postSnippet(post: PreviewPost): string {
  const text = stripMentionIds(post.content ?? "").trim();
  if (text) return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  if (post.image_url) return "📷 Compartilhou uma imagem";
  if (post.audio_url) return "🎙️ Compartilhou um áudio";
  return "Compartilhou uma atualização";
}

export default function CommunityPreview() {
  const [posts, setPosts] = useState<PreviewPost[] | null>(null);

  useEffect(() => {
    fetch("/api/community/posts")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPosts((d?.posts ?? []).slice(0, 3)))
      .catch(() => setPosts([]));
  }, []);

  if (posts !== null && posts.length === 0) return null;

  return (
    <a
      href="/app/comunidade"
      style={{ background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 16, padding: "14px 16px", textDecoration: "none", display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--gray)", margin: 0 }}>
          🌐 Comunidade
        </p>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--yellow)" }}>Ver tudo →</span>
      </div>

      {posts === null ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div className="sk" style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="sk" style={{ height: 10, width: "40%", marginBottom: 6 }} />
                <div className="sk" style={{ height: 10, width: "80%" }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {posts.map((post) => {
            const likeCount = post.community_reactions?.length ?? 0;
            return (
              <div key={post.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", background: "#1e1e1e", flexShrink: 0 }}>
                  {post.avatar_url ? (
                    <img src={post.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "0.75rem" }}>👤</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fff" }}>{post.display_name}</span>
                    <span style={{ fontSize: "0.65rem", color: "var(--gray)" }}>{timeAgo(post.created_at)}</span>
                  </div>
                  <p style={{ fontSize: "0.78rem", color: "var(--gray)", margin: "1px 0 0", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {postSnippet(post)}
                  </p>
                </div>
                {likeCount > 0 && (
                  <span style={{ fontSize: "0.68rem", color: "var(--gray)", flexShrink: 0, whiteSpace: "nowrap" }}>❤️ {likeCount}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </a>
  );
}
