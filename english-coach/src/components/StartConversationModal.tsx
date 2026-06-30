"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Conversation = {
  id: string;
  user1_id: string;
  user2_id: string;
  updated_at: string;
};

type UserInfo = {
  id: string;
  name: string;
  email: string;
  image_url: string | null;
};

type ConvEntry = {
  conversation: Conversation;
  otherUser: UserInfo;
};

export function StartConversationModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const [entries, setEntries] = useState<ConvEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    loadConversations().finally(() => setLoading(false));
  }, [isOpen]);

  async function loadConversations() {
    // Fetch existing conversations
    const convRes = await fetch("/api/messages");
    const convData = await convRes.json();
    const conversations: Conversation[] = convData.conversations || [];
    if (conversations.length === 0) { setEntries([]); return; }

    // Fetch user details for the other party in each conversation
    const usersRes = await fetch("/api/users");
    const usersData = await usersRes.json();
    const allUsers: UserInfo[] = usersData.users || [];
    const userMap = Object.fromEntries(allUsers.map(u => [u.id, u]));

    // Determine current userId from first conversation participant check
    // The current user is whichever ID appears in all conversations as user1 or user2
    // We need to know our own ID — use the fact that /api/users excludes the current user
    const knownOtherIds = new Set(allUsers.map(u => u.id));

    const built: ConvEntry[] = conversations
      .map(conv => {
        const otherId = knownOtherIds.has(conv.user1_id) ? conv.user1_id : conv.user2_id;
        const other = userMap[otherId];
        if (!other) return null;
        return { conversation: conv, otherUser: other };
      })
      .filter(Boolean) as ConvEntry[];

    setEntries(built);
  }

  function openChat(userId: string) {
    onClose();
    router.push(`/app/mensagens/${userId}`);
  }

  if (!isOpen) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 90 }} />
      <div style={{
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
      }}>
        <div style={{ padding: "16px", borderBottom: "1px solid #1e1e1e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, color: "#fff", fontSize: "1rem", fontWeight: 700 }}>💬 Conversas</h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#999", fontSize: "1.5rem", cursor: "pointer", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: "#666", paddingTop: 40 }}>Carregando conversas...</div>
          ) : entries.length === 0 ? (
            <div style={{ textAlign: "center", color: "#666", paddingTop: 40, fontSize: "0.88rem" }}>
              Você ainda não iniciou nenhuma conversa.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {entries.map(({ conversation, otherUser }) => (
                <button
                  key={conversation.id}
                  onClick={() => openChat(otherUser.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 12,
                    background: "transparent",
                    border: "1px solid transparent",
                    borderRadius: 12,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    textAlign: "left",
                    width: "100%",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(245,200,0,.08)";
                    e.currentTarget.style.borderColor = "rgba(245,200,0,.2)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.borderColor = "transparent";
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: otherUser.image_url ? "transparent" : "#2a2a2a",
                    flexShrink: 0, overflow: "hidden",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {otherUser.image_url
                      ? <img src={otherUser.image_url} alt={otherUser.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {otherUser.name}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#555", marginTop: 2 }}>Toque para abrir</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </>
  );
}
