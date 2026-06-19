"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const otherUserId = params?.userId as string;

  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [sending, setSending] = useState(false);
  const [otherUserName, setOtherUserName] = useState("");
  const [otherUserImage, setOtherUserImage] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.id || !otherUserId) return;
    init();
  }, [user?.id, otherUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function init() {
    try {
      const [startRes, usersRes] = await Promise.all([
        fetch("/api/messages/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ otherUserId }),
        }),
        fetch("/api/users"),
      ]);

      const startData = await startRes.json();
      const usersData = await usersRes.json();

      const foundUser = usersData.users?.find((u: any) => u.id === otherUserId);
      if (foundUser) {
        setOtherUserName(foundUser.name);
        setOtherUserImage(foundUser.image_url || "");
      }

      if (startData.conversationId) {
        setConversationId(startData.conversationId);
        loadMessages(startData.conversationId);
      }
    } catch (e) {
      console.error("Init error:", e);
    }
  }

  async function loadMessages(convId: string) {
    try {
      const res = await fetch(`/api/messages?conversationId=${convId}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSend() {
    if (!input.trim() || !conversationId || sending) return;
    setSending(true);
    const text = input;
    setInput("");
    setMessages(prev => [...prev, { id: Date.now(), sender_id: user?.id, content: text, created_at: new Date().toISOString() }]);
    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, content: text, imageUrl: null, audioUrl: null, videoUrl: null, replyToId: null }),
      });
      loadMessages(conversationId);
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col" style={{ height: "100dvh", background: "var(--black)", paddingTop: 56, paddingBottom: 68 }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid #1f1f1f", background: "var(--black)", position: "fixed", top: 56, left: 0, right: 0, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "var(--white)", fontSize: "1.3rem", cursor: "pointer", padding: 0 }}>←</button>
        {otherUserImage ? (
          <img src={otherUserImage} alt={otherUserName} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--dark2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>👤</div>
        )}
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--white)" }}>{otherUserName || "Carregando..."}</div>
          <div style={{ fontSize: "0.7rem", color: "var(--gray)" }}>Mensagem direta</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4" style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: 60 }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div style={{ fontSize: "2.5rem" }}>💬</div>
            <p style={{ color: "var(--gray)", fontSize: "0.85rem" }}>Nenhuma mensagem ainda.<br />Comece a conversa!</p>
          </div>
        ) : (
          messages.map((msg: any) => (
            <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? "justify-end" : "justify-start"} items-end gap-2`}>
              {msg.sender_id !== user?.id && (
                otherUserImage
                  ? <img src={otherUserImage} alt="" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  : <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--dark2)", flexShrink: 0 }} />
              )}
              <div
                style={{
                  maxWidth: "78%",
                  padding: "8px 12px",
                  fontSize: "0.88rem",
                  lineHeight: 1.5,
                  ...(msg.sender_id === user?.id
                    ? { background: "var(--yellow)", color: "var(--black)", borderRadius: "18px 18px 4px 18px", fontWeight: 500 }
                    : { background: "var(--dark2)", color: "var(--white)", borderRadius: "18px 18px 18px 4px", border: "1px solid #2a2a2a" })
                }}
              >
                <p style={{ margin: 0 }}>{msg.content}</p>
                <div style={{ fontSize: "0.65rem", opacity: 0.6, marginTop: 4 }}>
                  {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 px-3 py-2" style={{ borderTop: "1px solid #1f1f1f", background: "var(--black)", position: "fixed", bottom: 68, left: 0, right: 0 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Digite aqui..."
          rows={1}
          style={{ flex: 1, padding: "10px 14px", background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: 20, color: "var(--white)", fontSize: "0.9rem", resize: "none", outline: "none" }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          style={{ width: 44, height: 44, borderRadius: "50%", background: input.trim() ? "var(--yellow)" : "var(--dark2)", border: "1px solid #2a2a2a", color: input.trim() ? "#000" : "var(--gray)", display: "flex", alignItems: "center", justifyContent: "center", cursor: input.trim() ? "pointer" : "default", flexShrink: 0 }}
        >
          {sending ? "..." : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
