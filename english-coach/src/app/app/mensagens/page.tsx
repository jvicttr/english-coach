"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  updated_at: string;
}

interface UserPresence {
  user_id: string;
  is_online: boolean;
  last_seen: string;
}

export default function MensagensPage() {
  const router = useRouter();
  const { user } = useUser();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [presences, setPresences] = useState<Record<string, UserPresence>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!user) return;
    loadConversations();
    const interval = setInterval(updatePresence, 30000); // Atualizar a cada 30s
    return () => clearInterval(interval);
  }, [user]);

  async function loadConversations() {
    try {
      const res = await fetch("/api/messages");
      const data = await res.json();
      setConversations(data.conversations || []);

      // Buscar presença dos outros usuários
      if (data.conversations.length > 0 && user) {
        const otherUserIds = data.conversations.map(c =>
          c.user1_id === user.id ? c.user2_id : c.user1_id
        );
        const presRes = await fetch(`/api/messages/presence?userIds=${otherUserIds.join(",")}`);
        const presData = await presRes.json();
        const presenceMap: Record<string, UserPresence> = {};
        presData.presences?.forEach((p: UserPresence) => {
          presenceMap[p.user_id] = p;
        });
        setPresences(presenceMap);
      }

      setLoading(false);
    } catch (error) {
      console.error("Erro ao carregar conversas:", error);
      setLoading(false);
    }
  }

  async function updatePresence() {
    try {
      await fetch("/api/messages/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnline: true }),
      });
    } catch (error) {
      console.error("Erro ao atualizar presença:", error);
    }
  }

  function getOtherUser(conv: Conversation): string {
    return conv.user1_id === user?.id ? conv.user2_id : conv.user1_id;
  }

  function isOnline(userId: string): boolean {
    const presence = presences[userId];
    if (!presence) return false;
    const lastSeen = new Date(presence.last_seen);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
    return presence.is_online && diffMinutes < 5;
  }

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "#999" }}>
        Carregando...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--black)", fontFamily: "'Inter', sans-serif" }}>
      {/* Sidebar - Conversas */}
      <div style={{ width: "100%", maxWidth: "400px", borderRight: "1px solid #1e1e1e", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px", borderBottom: "1px solid #1e1e1e" }}>
          <h1 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#fff", margin: 0 }}>💬 Mensagens</h1>
        </div>

        <input
          type="text"
          placeholder="Buscar conversa..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            margin: "10px 16px",
            padding: "8px 12px",
            background: "#0d0d0d",
            border: "1px solid #2a2a2a",
            borderRadius: 8,
            color: "#fff",
            fontSize: "0.9rem",
            outline: "none",
          }}
        />

        <div style={{ flex: 1, overflowY: "auto" }}>
          {conversations.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
              Nenhuma conversa ainda
            </div>
          ) : (
            conversations.map(conv => {
              const otherUserId = getOtherUser(conv);
              const online = isOnline(otherUserId);
              return (
                <div
                  key={conv.id}
                  onClick={() => router.push(`/app/mensagens/${otherUserId}`)}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #1e1e1e",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.05)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      background: online ? "var(--yellow)" : "#2a2a2a",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.2rem",
                      position: "relative",
                      flexShrink: 0,
                    }}
                  >
                    👤
                    {online && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: 0,
                          right: 0,
                          width: 12,
                          height: 12,
                          background: "#22c55e",
                          borderRadius: "50%",
                          border: "2px solid var(--black)",
                        }}
                      />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#fff" }}>
                      {otherUserId}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#666" }}>
                      {online ? "Online agora" : "Offline"}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Area - Vazio por enquanto */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#666",
          fontSize: "1rem",
        }}
      >
        Selecione uma conversa
      </div>
    </div>
  );
}
