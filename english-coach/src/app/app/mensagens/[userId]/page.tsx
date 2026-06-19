"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const otherUserId = params?.userId as string;

  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user?.id || !otherUserId) return;
    init();
  }, [user?.id, otherUserId]);

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
        const msgRes = await fetch(`/api/messages?conversationId=${data.conversationId}`);
        const msgData = await msgRes.json();
        setMessages(msgData.messages || []);
      }
    } catch (e) {
      console.error("Init error:", e);
    }
  }

  async function handleSend() {
    if (!messageText.trim() || !conversationId) return;
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
      const res = await fetch(`/api/messages?conversationId=${conversationId}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div style={{ padding: "16px", borderBottom: "1px solid #222" }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#fff", fontSize: "20px", cursor: "pointer" }}>
          ← {otherUserId}
        </button>
      </div>

      <div style={{ flex: 1, padding: "16px", overflowY: "auto" }}>
        {messages.length === 0 ? (
          <p style={{ color: "#666" }}>Nenhuma mensagem</p>
        ) : (
          messages.map((msg: any) => (
            <div key={msg.id} style={{ marginBottom: "8px", textAlign: msg.sender_id === user?.id ? "right" : "left" }}>
              <div style={{ display: "inline-block", maxWidth: "70%", background: msg.sender_id === user?.id ? "#ffd700" : "#222", color: msg.sender_id === user?.id ? "#000" : "#fff", padding: "8px 12px", borderRadius: "8px" }}>
                <p style={{ margin: "0 0 4px 0" }}>{msg.content}</p>
                <small style={{ opacity: 0.7 }}>{new Date(msg.created_at).toLocaleTimeString()}</small>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ padding: "16px", borderTop: "1px solid #222", display: "flex", gap: "8px" }}>
        <input type="text" placeholder="Mensagem..." value={messageText} onChange={(e) => setMessageText(e.target.value)} onKeyPress={(e) => e.key === "Enter" && handleSend()} style={{ flex: 1, padding: "8px 12px", background: "#111", border: "1px solid #333", borderRadius: "4px", color: "#fff" }} />
        <button onClick={handleSend} disabled={sending} style={{ padding: "8px 16px", background: "#ffd700", color: "#000", border: "none", borderRadius: "4px", cursor: "pointer" }}>
          {sending ? "..." : "✓"}
        </button>
      </div>
    </>
  );
}
