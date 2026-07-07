"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

const AVATAR_COLORS = ["#e85d4a","#f5a623","#4caf7d","#4a90d9","#9b59b6","#e91e8c","#00bcd4","#ff7043"];
function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function UserAvatar({ src, name, size = 48 }: { src: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const initial = (name || "?")[0].toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: (!src || err) ? avatarColor(name) : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
      {src && !err
        ? <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setErr(true)} />
        : <span style={{ fontSize: size * 0.42, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{initial}</span>
      }
    </div>
  );
}

function formatTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return date.toLocaleDateString("pt-BR", { weekday: "short" });
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

interface Conversation {
  conversation_id: string;
  other_user: { id: string; name: string; image_url: string | null };
  last_message: { content: string | null; audio_url: string | null; image_url: string | null; created_at: string; is_mine: boolean } | null;
  unread_count: number;
  updated_at: string;
}

export default function MensagensPage() {
  const router = useRouter();
  const { user } = useUser();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    fetch("/api/messages/conversations")
      .then(r => r.json())
      .then(d => setConversations(d.conversations || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  function handleTouchStart(conversationId: string) {
    longPressFiredRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      if (navigator.vibrate) navigator.vibrate(10);
      setDeleteConfirmId(conversationId);
    }, 550);
  }

  function cancelLongPress() {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  }

  async function deleteConversation(conversationId: string) {
    setDeleting(true);
    try {
      await fetch(`/api/messages/conversations?conversationId=${encodeURIComponent(conversationId)}`, { method: "DELETE" });
      setConversations(prev => prev.filter(c => c.conversation_id !== conversationId));
    } catch {} finally {
      setDeleting(false);
      setDeleteConfirmId(null);
    }
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#0d0d0d", fontFamily: "'Inter', sans-serif", paddingTop: "calc(65px + env(safe-area-inset-top))", paddingBottom: "calc(56px + env(safe-area-inset-bottom, 0px))" }}>

      {/* Header */}
      <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, color: "#fff", fontSize: "1rem" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Mensagens
        </div>
        <button
          onClick={() => router.push("/app/pesquisa")}
          style={{ background: "rgba(245,200,0,0.08)", border: "1px solid rgba(245,200,0,0.25)", borderRadius: 8, padding: "6px 12px", color: "var(--yellow)", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}
        >
          + Nova conversa
        </button>
      </div>

      {/* Lista de conversas */}
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#1e1e1e" }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ height: 12, width: "40%", borderRadius: 6, background: "#1e1e1e" }} />
                  <div style={{ height: 10, width: "65%", borderRadius: 6, background: "#161616" }} />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 16, color: "#555" }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p style={{ margin: 0, fontSize: "0.95rem", color: "#555" }}>Nenhuma conversa ainda</p>
            <button
              onClick={() => router.push("/app/pesquisa")}
              style={{ background: "var(--yellow)", color: "#000", fontWeight: 800, fontSize: "0.85rem", border: "none", borderRadius: 10, padding: "10px 20px", cursor: "pointer" }}
            >
              Encontrar usuários
            </button>
          </div>
        ) : (
          conversations.map(conv => (
            <div
              key={conv.conversation_id}
              onClick={() => {
                if (longPressFiredRef.current) { longPressFiredRef.current = false; return; }
                router.push(`/app/mensagens/${conv.other_user.id}`);
              }}
              onTouchStart={() => handleTouchStart(conv.conversation_id)}
              onTouchMove={cancelLongPress}
              onTouchEnd={cancelLongPress}
              onContextMenu={(e) => { e.preventDefault(); setDeleteConfirmId(conv.conversation_id); }}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderBottom: "1px solid #111", cursor: "pointer", transition: "background 0.1s", WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#111"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <UserAvatar src={conv.other_user.image_url} name={conv.other_user.name} size={48} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: "0.95rem", fontWeight: conv.unread_count > 0 ? 800 : 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "65%" }}>
                    {conv.other_user.name}
                  </span>
                  {conv.last_message && (
                    <span style={{ fontSize: "0.72rem", color: conv.unread_count > 0 ? "var(--yellow)" : "#555", flexShrink: 0 }}>
                      {formatTime(conv.last_message.created_at)}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: "0.82rem", color: conv.unread_count > 0 ? "#aaa" : "#555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                    {conv.last_message
                      ? `${conv.last_message.is_mine ? "Você: " : ""}${conv.last_message.content || (conv.last_message.audio_url ? "🎵 Áudio" : conv.last_message.image_url ? "📸 Imagem" : "Mensagem")}`
                      : "Conversa iniciada"}
                  </span>
                  {conv.unread_count > 0 && (
                    <span style={{ background: "var(--yellow)", color: "#000", fontSize: "0.65rem", fontWeight: 800, borderRadius: "50%", minWidth: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: "0 4px" }}>
                      {conv.unread_count > 99 ? "99+" : conv.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Confirmação de apagar conversa (aperta-segura ou botão direito) */}
      {deleteConfirmId && (
        <>
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 2000 }}
            onClick={() => !deleting && setDeleteConfirmId(null)}
          />
          <div style={{ position: "fixed", left: "50%", top: "50%", transform: "translate(-50%, -50%)", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 16, padding: 24, zIndex: 2001, width: "min(320px, calc(100vw - 48px))" }}>
            <p style={{ color: "var(--white)", fontSize: "0.9rem", textAlign: "center", marginBottom: 20, lineHeight: 1.5 }}>
              Apagar esta conversa da sua lista? Ela some só para você — a outra pessoa continua vendo normalmente.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                style={{ flex: 1, padding: "10px", background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: 10, color: "var(--gray)", cursor: "pointer", fontSize: "0.85rem" }}
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteConversation(deleteConfirmId)}
                disabled={deleting}
                style={{ flex: 1, padding: "10px", background: "#ef4444", border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", opacity: deleting ? 0.7 : 1 }}
              >
                {deleting ? "Apagando…" : "Apagar"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
