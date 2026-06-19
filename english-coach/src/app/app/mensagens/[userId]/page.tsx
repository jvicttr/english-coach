"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const otherUserId = (params.userId as string) || "";

  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !otherUserId) return;
    init();
  }, [user, otherUserId]);

  async function init() {
    try {
      const res = await fetch("/api/messages/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId }),
      });
      const data = await res.json();
      if (data.conversationId) {
        setConversationId(data.conversationId);
        loadMessages(data.conversationId);
      }
      setLoading(false);
    } catch (e) {
      console.error("Init error:", e);
      setLoading(false);
    }
  }

  async function loadMessages(convId: string) {
    try {
      const res = await fetch(`/api/messages?conversationId=${convId}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (e) {
      console.error("Load messages error:", e);
    }
  }

  async function sendMessage() {
    if (!conversationId || !messageText.trim()) return;
    setSending(true);
    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          content: messageText,
          imageUrl: null,
          audioUrl: null,
          videoUrl: null,
          replyToId: null,
        }),
      });
      setMessageText("");
      loadMessages(conversationId);
    } catch (e) {
      console.error("Send error:", e);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0a0a0a" }}>
      <div style={{ padding: "16px", borderBottom: "1px solid #1e1e1e", display: "flex", gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#fff", fontSize: "1.5rem", cursor: "pointer" }}>
          ←
        </button>
        <div style={{ color: "#fff", fontWeight: 600 }}>{otherUserId}</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {loading ? (
          <div style={{ color: "#666" }}>Carregando...</div>
        ) : messages.length === 0 ? (
          <div style={{ color: "#666", textAlign: "center", marginTop: "20px" }}>Nenhuma mensagem ainda</div>
        ) : (
          messages.map((msg: any) => (
            <div key={msg.id} style={{ display: "flex", justifyContent: msg.sender_id === user?.id ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "70%", background: msg.sender_id === user?.id ? "var(--yellow)" : "#1e1e1e", color: msg.sender_id === user?.id ? "#000" : "#fff", padding: "10px 12px", borderRadius: "12px" }}>
                <p style={{ margin: 0 }}>{msg.content}</p>
                <div style={{ fontSize: "0.7rem", opacity: 0.7, marginTop: "4px" }}>{new Date(msg.created_at).toLocaleTimeString()}</div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: "16px", borderTop: "1px solid #1e1e1e", display: "flex", gap: 8 }}>
        <input type="text" placeholder="Mensagem..." value={messageText} onChange={(e) => setMessageText(e.target.value)} onKeyPress={(e) => e.key === "Enter" && sendMessage()} style={{ flex: 1, padding: "10px 12px", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 8, color: "#fff", fontSize: "0.9rem" }} />
        <button onClick={sendMessage} disabled={sending} style={{ background: "var(--yellow)", color: "#000", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600, cursor: "pointer" }}>
          {sending ? "..." : "Enviar"}
        </button>
      </div>
    </div>
  );
}
