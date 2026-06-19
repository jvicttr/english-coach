"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();

  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [sending, setSending] = useState(false);

  const otherUserId = params?.userId as string;

  useEffect(() => {
    if (!user?.id || !otherUserId) return;

    async function loadChat() {
      try {
        const res = await fetch("/api/messages/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ otherUserId }),
        });
        const data = await res.json();
        setConversationId(data.conversationId);

        const msgRes = await fetch(`/api/messages?conversationId=${data.conversationId}`);
        const msgData = await msgRes.json();
        setMessages(msgData.messages || []);
      } catch (e) {
        console.error(e);
      }
    }

    loadChat();
  }, [user?.id, otherUserId]);

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
    <div style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column", background: "#000", color: "#fff" }}>
      <div style={{ minHeight: "60px", padding: "16px", borderBottom: "1px solid #222", display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#fff", fontSize: "24px", cursor: "pointer", padding: 0 }}>
          ←
        </button>
        <div style={{ fontSize: "18px", fontWeight: 600 }}>{otherUserId || "Chat"}</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "8px", minHeight: 0 }}>
        {!messages || messages.length === 0 ? (
          <div style={{ textAlign: "center", color: "#666", marginTop: "20px" }}>Nenhuma mensagem ainda</div>
        ) : (
          messages.map((msg: any) => (
            <div key={msg.id} style={{ display: "flex", justifyContent: msg.sender_id === user?.id ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "80%", background: msg.sender_id === user?.id ? "#ffd700" : "#222", color: msg.sender_id === user?.id ? "#000" : "#fff", padding: "8px 12px", borderRadius: "8px" }}>
                <p style={{ margin: "0 0 4px 0" }}>{msg.content}</p>
                <small style={{ opacity: 0.7 }}>{new Date(msg.created_at).toLocaleTimeString()}</small>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ minHeight: "70px", padding: "16px", borderTop: "1px solid #222", display: "flex", gap: "8px", alignItems: "flex-end", flexShrink: 0 }}>
        <input type="text" placeholder="Mensagem..." value={messageText} onChange={(e) => setMessageText(e.target.value)} onKeyPress={(e) => e.key === "Enter" && handleSend()} style={{ flex: 1, padding: "8px 12px", background: "#111", border: "1px solid #333", borderRadius: "4px", color: "#fff", fontSize: "14px", outline: "none" }} />
        <button onClick={handleSend} disabled={sending || !messageText.trim()} style={{ padding: "8px 16px", background: messageText.trim() ? "#ffd700" : "#333", color: messageText.trim() ? "#000" : "#666", border: "none", borderRadius: "4px", fontWeight: 600, cursor: messageText.trim() ? "pointer" : "default" }}>
          {sending ? "..." : "✓"}
        </button>
      </div>
    </div>
  );
}
