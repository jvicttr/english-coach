"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type User = { id: string; name: string; email: string; image_url: string | null };

export function StartConversationModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && users.length === 0) {
      setLoading(true);
      fetch("/api/users")
        .then((r) => r.json())
        .then((data) => setUsers(data.users || []))
        .catch((e) => console.error("Erro ao carregar usuários:", e))
        .finally(() => setLoading(false));
    }
  }, [isOpen, users.length]);

  async function startChat(otherUserId: string) {
    try {
      await fetch("/api/messages/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId }),
      });
      onClose();
      router.push(`/app/mensagens/${otherUserId}`);
    } catch (error) {
      console.error("Erro ao iniciar chat:", error);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 90,
        }}
      />
      <div
        style={{
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
        }}
      >
        <div style={{ padding: "16px", borderBottom: "1px solid #1e1e1e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, color: "#fff", fontSize: "1rem", fontWeight: 700 }}>Iniciar conversa</h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#999",
              fontSize: "1.5rem",
              cursor: "pointer",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: "#666", paddingTop: "40px" }}>Carregando usuários...</div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: "center", color: "#666", paddingTop: "40px" }}>Nenhum usuário disponível</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => startChat(u.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px",
                    background: "transparent",
                    border: "1px solid transparent",
                    borderRadius: "12px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(245,200,0,.08)";
                    e.currentTarget.style.borderColor = "rgba(245,200,0,.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.borderColor = "transparent";
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      background: u.image_url ? "transparent" : "var(--yellow)",
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.2rem",
                      flexShrink: 0,
                      overflow: "hidden",
                    }}
                  >
                    {u.image_url ? <img src={u.image_url} alt={u.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#fff" }}>{u.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "#666" }}>{u.email}</div>
                  </div>
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
