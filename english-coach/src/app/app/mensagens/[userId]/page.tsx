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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user?.id || !otherUserId) return;
    init();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
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
        intervalRef.current = setInterval(() => loadMessages(startData.conversationId), 3000);
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
    setMessages(prev => [...prev, { id: `temp-${Date.now()}`, sender_id: user?.id, content: text, created_at: new Date().toISOString() }]);
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
    <div
      className="flex flex-col items-center px-3 sm:px-4"
      style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", height: "100dvh", overflow: "hidden", paddingTop: 65, paddingBottom: 65 }}
    >
      {/* Subheader com info do usuário */}
      <div className="w-full max-w-2xl mb-3 flex items-center gap-3 shrink-0">
        <button
          onClick={() => router.back()}
          style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "36px", padding: "0 10px", display: "flex", alignItems: "center", gap: "5px", fontSize: "0.75rem", fontWeight: 600, color: "var(--gray)", cursor: "pointer" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        {otherUserImage
          ? <img src={otherUserImage} alt={otherUserName} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          : <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--dark2)", border: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", flexShrink: 0 }}>👤</div>
        }
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--white)" }}>{otherUserName || "..."}</div>
          <div style={{ fontSize: "0.68rem", color: "var(--gray)" }}>Mensagem direta</div>
        </div>
      </div>

      {/* Chat area - mesmo estilo do conversar */}
      <div
        className="w-full max-w-2xl flex-1 min-h-0 p-3 sm:p-4 mb-3 overflow-y-auto"
        style={{ background: "var(--dark1)", border: "1px solid #1f1f1f", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div style={{ fontSize: "2rem" }}>💬</div>
            <div>
              <p className="font-semibold text-white text-sm">{otherUserName || "..."}</p>
              <p className="text-xs mt-1 max-w-xs" style={{ color: "var(--gray)" }}>
                Comece a conversa! Mande sua primeira mensagem.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg: any) => (
            <div key={msg.id} className={`mb-3 flex ${msg.sender_id === user?.id ? "justify-end" : "justify-start"} items-end gap-2`}>
              {msg.sender_id !== user?.id && (
                otherUserImage
                  ? <img src={otherUserImage} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0, marginBottom: 2 }} />
                  : <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--dark2)", flexShrink: 0 }} />
              )}
              <div
                className="max-w-[82%] sm:max-w-[78%] px-3 sm:px-4 py-2.5 text-sm leading-relaxed"
                style={
                  msg.sender_id === user?.id
                    ? { background: "var(--yellow)", color: "var(--black)", borderRadius: "18px 18px 4px 18px", fontWeight: 500 }
                    : { background: "var(--dark2)", color: "var(--white)", borderRadius: "18px 18px 18px 4px", border: "1px solid #2a2a2a" }
                }
              >
                {msg.content}
                <div style={{ fontSize: "0.62rem", opacity: 0.6, marginTop: 4 }}>
                  {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input - mesmo estilo do conversar */}
      <div className="-mx-3 sm:mx-auto w-full sm:max-w-2xl flex gap-2 items-end px-3 sm:px-0 pb-1 sm:pb-0" style={{ background: "var(--black)" }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Digite aqui..."
          rows={1}
          style={{ flex: 1, background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "var(--radius)", color: "var(--white)", fontSize: "0.92rem", padding: "12px 14px", resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5 }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="w-12 h-12 flex items-center justify-center transition-all shrink-0 disabled:opacity-40"
          style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "var(--radius)", cursor: input.trim() ? "pointer" : "default" }}
        >
          {sending ? (
            <div style={{ width: 18, height: 18, border: "2px solid #555", borderTopColor: "var(--yellow)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: input.trim() ? "var(--yellow)" : "var(--gray)" }}>
              <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
