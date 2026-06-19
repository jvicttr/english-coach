"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

const AVATAR_COLORS = ["#e85d4a","#f5a623","#4caf7d","#4a90d9","#9b59b6","#e91e8c","#00bcd4","#ff7043"];
function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function UserAvatar({ src, name, size = 40, online }: { src: string | null; name: string; size?: number; online?: boolean }) {
  const [err, setErr] = useState(false);
  const initial = (name || "?")[0].toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: (!src || err) ? avatarColor(name) : "transparent", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", flexShrink: 0, overflow: "hidden" }}>
      {src && !err
        ? <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setErr(true)} />
        : <span style={{ fontSize: size * 0.42, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{initial}</span>
      }
      {online && <div style={{ position: "absolute", bottom: 0, right: 0, width: size * 0.3, height: size * 0.3, background: "#22c55e", borderRadius: "50%", border: "2px solid var(--black)" }} />}
    </div>
  );
}

interface User {
  id: string;
  name: string;
  email: string;
  image_url: string | null;
}

interface UserPresence {
  user_id: string;
  is_online: boolean;
  last_seen: string;
}

export default function MensagensPage() {
  const router = useRouter();
  const { user } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [presences, setPresences] = useState<Record<string, UserPresence>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!user) return;
    loadUsers();
    const interval = setInterval(updatePresence, 30000);
    return () => clearInterval(interval);
  }, [user]);

  async function loadUsers() {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      const allUsers = data.users || [];
      setUsers(allUsers);

      // Buscar presença de todos os usuários
      if (allUsers.length > 0) {
        const userIds = allUsers.map((u: User) => u.id);
        const presRes = await fetch(`/api/messages/presence?userIds=${userIds.join(",")}`);
        const presData = await presRes.json();
        const presenceMap: Record<string, UserPresence> = {};
        presData.presences?.forEach((p: UserPresence) => {
          presenceMap[p.user_id] = p;
        });
        setPresences(presenceMap);
      }

      setLoading(false);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
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

  function isOnline(userId: string): boolean {
    const presence = presences[userId];
    if (!presence) return false;
    const lastSeen = new Date(presence.last_seen);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
    return presence.is_online && diffMinutes < 5;
  }

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "#999" }}>
        Carregando...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--black)", fontFamily: "'Inter', sans-serif" }}>
      {/* Sidebar - Usuários */}
      <div style={{ width: "100%", maxWidth: "400px", borderRight: "1px solid #1e1e1e", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px", borderBottom: "1px solid #1e1e1e" }}>
          <h1 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#fff", margin: 0 }}>💬 Mensagens</h1>
        </div>

        <input
          type="text"
          placeholder="Buscar usuário..."
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
          {filteredUsers.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
              Nenhum usuário encontrado
            </div>
          ) : (
            filteredUsers.map(u => {
              const online = isOnline(u.id);
              return (
                <div
                  key={u.id}
                  onClick={() => router.push(`/app/mensagens/${u.id}`)}
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
                  <UserAvatar src={u.image_url} name={u.name} size={40} online={online} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#fff" }}>
                      {u.name}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#666" }}>
                      {online ? "🟢 Online" : "⚫ Offline"}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Area - Vazio */}
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
        Selecione um usuário para começar
      </div>
    </div>
  );
}
