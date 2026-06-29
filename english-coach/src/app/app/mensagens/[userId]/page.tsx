"use client";

import { useState, useEffect, useRef, use } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function DMPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId: otherUserId } = use(params);
  const { user: me } = useUser();
  const router = useRouter();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<{ name: string; avatar_url: string | null } | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { init(); }, [otherUserId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function init() {
    const profileRes = await fetch(`/api/community/user/${otherUserId}`);
    const profileData = await profileRes.json();
    if (profileData.profile) setOtherUser(profileData.profile);

    const convRes = await fetch("/api/messages/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otherUserId }),
    });
    const convData = await convRes.json();
    if (!convData.conversationId) { setLoading(false); return; }
    setConversationId(convData.conversationId);
    await loadMessages(convData.conversationId);
    setLoading(false);
  }

  async function loadMessages(convId: string) {
    const res = await fetch(`/api/messages?conversationId=${convId}`);
    const data = await res.json();
    setMessages(data.messages ?? []);
  }

  async function send() {
    if (!text.trim() || !conversationId || sending) return;
    setSending(true);
    const content = text.trim();
    setText("");
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, content }),
    });
    const data = await res.json();
    if (data.message) setMessages((prev) => [...prev, data.message]);
    setSending(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  useEffect(() => {
    if (!conversationId) return;
    const interval = setInterval(() => loadMessages(conversationId), 5000);
    return () => clearInterval(interval);
  }, [conversationId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "var(--black)", fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, paddingTop: "calc(10px + env(safe-area-inset-top))", paddingBottom: 10, paddingLeft: 12, paddingRight: 16, borderBottom: "1px solid #1e1e1e", display: "flex", alignItems: "center", gap: 10, background: "var(--black)", zIndex: 100, flexShrink: 0 }}>
        <button onClick={() => router.back()} style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: 10, height: 34, width: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        {otherUser?.avatar_url
          ? <img src={otherUser.avatar_url} alt={otherUser.name} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          : <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>👤</div>
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{otherUser?.name ?? "..."}</p>
          <p style={{ fontSize: "0.65rem", color: "var(--gray)", margin: 0 }}>Mensagem direta</p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 40 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {[0, 150, 300].map((d) => (
                <span key={d} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--yellow)", display: "inline-block", animation: "bounce .8s infinite", animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--gray)", fontSize: "0.85rem", paddingTop: 40 }}>
            <p style={{ fontSize: "1.8rem", margin: "0 0 8px" }}>👋</p>
            <p style={{ margin: 0 }}>Inicio da sua conversa com <strong style={{ color: "#fff" }}>{otherUser?.name}</strong></p>
          </div>
        )}

        {messages.map((msg) => {
          const isMine = msg.sender_id === me?.id;
          return (
            <div key={msg.id} style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "75%",
                padding: "10px 14px",
                borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                background: isMine ? "var(--yellow)" : "var(--dark1)",
                border: isMine ? "none" : "1px solid #2a2a2a",
                color: isMine ? "#000" : "#fff",
              }}>
                <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.content}</p>
                <p style={{ margin: "4px 0 0", fontSize: "0.6rem", opacity: 0.6, textAlign: "right" }}>{timeAgo(msg.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "10px 12px", paddingBottom: "calc(10px + env(safe-area-inset-bottom))", borderTop: "1px solid #1e1e1e", background: "var(--black)", display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Mensagem..."
          rows={1}
          style={{ flex: 1, background: "var(--dark1)", border: "1px solid #2a2a2a", borderRadius: 20, padding: "10px 16px", color: "#fff", fontSize: "0.9rem", resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5, maxHeight: 120, overflowY: "auto" }}
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          style={{ width: 42, height: 42, borderRadius: "50%", background: text.trim() ? "var(--yellow)" : "#2a2a2a", border: "none", cursor: text.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background .2s" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke={text.trim() ? "#000" : "#555"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={text.trim() ? "#000" : "#555"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>
    </div>
  );
}
