"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  image_url: string | null;
  audio_url: string | null;
  video_url: string | null;
  reply_to_id: string | null;
  created_at: string;
  reactions?: Array<{ emoji: string; users: string[] }>;
}

interface UserPresence {
  user_id: string;
  is_online: boolean;
  last_seen: string;
}

interface OtherUser {
  id: string;
  name: string;
  email: string;
  image_url: string | null;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const otherUserId = params.userId as string;

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [presence, setPresence] = useState<UserPresence | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Scroll para a última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Inicializar conversa
  useEffect(() => {
    if (!user) return;
    initializeChat();
  }, [user, otherUserId]);

  async function initializeChat() {
    try {
      // Buscar dados do outro usuário
      const userRes = await fetch(`/api/users?search=${otherUserId}`);
      const userData = await userRes.json();
      if (userData.users?.[0]) {
        setOtherUser(userData.users[0]);
      }

      // Iniciar conversa
      const res = await fetch("/api/messages/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId }),
      });
      const data = await res.json();
      setConversationId(data.conversationId);

      // Carregar mensagens
      loadMessages(data.conversationId);

      // Buscar presença
      const presRes = await fetch(`/api/messages/presence?userIds=${otherUserId}`);
      const presData = await presRes.json();
      if (presData.presences?.[0]) {
        setPresence(presData.presences[0]);
      }

      // Poll para novas mensagens a cada 2s
      const interval = setInterval(() => loadMessages(data.conversationId), 2000);
      return () => clearInterval(interval);
    } catch (error) {
      console.error("Erro ao inicializar chat:", error);
    }
  }

  async function loadMessages(convId: string) {
    try {
      const res = await fetch(`/api/messages?conversationId=${convId}`);
      const data = await res.json();
      setMessages(data.messages || []);
      setLoading(false);
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
    }
  }

  async function sendMessage(content?: string, imageUrl?: string, audioUrl?: string, videoUrl?: string) {
    if (!conversationId || (!content && !imageUrl && !audioUrl && !videoUrl)) return;

    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          content: content || null,
          imageUrl: imageUrl || null,
          audioUrl: audioUrl || null,
          videoUrl: videoUrl || null,
          replyToId: replyTo?.id || null,
        }),
      });

      if (res.ok) {
        setMessageText("");
        setReplyTo(null);
        loadMessages(conversationId);
      }
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
    } finally {
      setSending(false);
    }
  }

  async function toggleReaction(messageId: string, emoji: string) {
    try {
      await fetch("/api/messages/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, emoji }),
      });
      loadMessages(conversationId!);
    } catch (error) {
      console.error("Erro ao adicionar reação:", error);
    }
  }

  function isOnline(): boolean {
    if (!presence) return false;
    const lastSeen = new Date(presence.last_seen);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
    return presence.is_online && diffMinutes < 5;
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#999" }}>
        Carregando...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--black)", fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #1e1e1e",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => router.back()}
            style={{ background: "none", border: "none", color: "#fff", fontSize: "1.2rem", cursor: "pointer" }}
          >
            ←
          </button>
          {otherUser?.image_url && (
            <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", background: "#1e1e1e" }}>
              <img src={otherUser.image_url} alt={otherUser.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          )}
          <div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#fff" }}>{otherUser?.name || otherUserId}</div>
            <div style={{ fontSize: "0.7rem", color: isOnline() ? "#22c55e" : "#666" }}>
              {isOnline() ? "🟢 Online" : "⚫ Offline"}
            </div>
          </div>
        </div>
      </div>

      {/* Mensagens */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", color: "#666", marginTop: "20px" }}>
            Nenhuma mensagem ainda. Comece a conversa!
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: "flex",
                justifyContent: msg.sender_id === user?.id ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "70%",
                  background: msg.sender_id === user?.id ? "var(--yellow)" : "#1e1e1e",
                  color: msg.sender_id === user?.id ? "#000" : "#fff",
                  padding: "10px 12px",
                  borderRadius: "12px",
                }}
              >
                {msg.content && <p style={{ margin: "0 0 8px 0", fontSize: "0.9rem" }}>{msg.content}</p>}
                {msg.image_url && (
                  <img src={msg.image_url} alt="msg" style={{ maxWidth: "100%", borderRadius: 8, marginBottom: "8px" }} />
                )}
                {msg.audio_url && (
                  <audio src={msg.audio_url} controls style={{ width: "100%", marginBottom: "8px" }} />
                )}
                <div style={{ fontSize: "0.65rem", opacity: 0.7, marginBottom: "4px" }}>
                  {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                  {["👍", "❤️", "😂", "😮", "😢"].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => toggleReaction(msg.id, emoji)}
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        border: "none",
                        borderRadius: "4px",
                        padding: "2px 6px",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Preview */}
      {replyTo && (
        <div style={{ padding: "8px 16px", background: "#1e1e1e", borderLeft: "3px solid var(--yellow)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#999" }}>Respondendo para:</div>
            <div style={{ fontSize: "0.85rem", color: "#fff" }}>{replyTo.content?.substring(0, 50)}...</div>
          </div>
          <button onClick={() => setReplyTo(null)} style={{ background: "none", border: "none", color: "#666", cursor: "pointer" }}>
            ✕
          </button>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid #1e1e1e", display: "flex", gap: 8, alignItems: "flex-end" }}>
        <button
          onClick={() => imageInputRef.current?.click()}
          style={{ background: "none", border: "none", color: "#999", fontSize: "1.2rem", cursor: "pointer" }}
        >
          📷
        </button>
        <button
          onClick={() => audioInputRef.current?.click()}
          style={{ background: "none", border: "none", color: "#999", fontSize: "1.2rem", cursor: "pointer" }}
        >
          🎙️
        </button>
        <input
          type="file"
          accept="image/*"
          ref={imageInputRef}
          style={{ display: "none" }}
          onChange={(e) => {
            // Implementar upload de imagem
          }}
        />
        <input
          type="file"
          accept="audio/*"
          ref={audioInputRef}
          style={{ display: "none" }}
          onChange={(e) => {
            // Implementar upload de áudio
          }}
        />
        <input
          type="text"
          placeholder="Mensagem..."
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage(messageText);
            }
          }}
          style={{
            flex: 1,
            padding: "8px 12px",
            background: "#0d0d0d",
            border: "1px solid #2a2a2a",
            borderRadius: 8,
            color: "#fff",
            fontSize: "0.9rem",
            outline: "none",
          }}
        />
        <button
          onClick={() => sendMessage(messageText)}
          disabled={sending || !messageText.trim()}
          style={{
            background: messageText.trim() ? "var(--yellow)" : "#2a2a2a",
            color: messageText.trim() ? "#000" : "#666",
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            fontWeight: 600,
            cursor: messageText.trim() ? "pointer" : "default",
          }}
        >
          {sending ? "..." : "Enviar"}
        </button>
      </div>

      <input ref={audioInputRef} type="file" accept="audio/*" style={{ display: "none" }} />
      <input ref={imageInputRef} type="file" accept="image/*" style={{ display: "none" }} />
    </div>
  );
}
