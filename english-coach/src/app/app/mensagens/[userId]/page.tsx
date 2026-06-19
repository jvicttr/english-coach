"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

const EMOJIS = ["😀","😂","😍","🥰","😎","🤔","😅","🙌","👏","🔥","💯","❤️","🎉","✨","💪","🙏","👍","😊","🤩","😏","🥳","💬","🌍","📚","🎯","🚀","⭐","💡","🎶","✅"];

const AVATAR_COLORS = ["#e85d4a","#f5a623","#4caf7d","#4a90d9","#9b59b6","#e91e8c","#00bcd4","#ff7043"];
function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function renderWithMentions(text: string): React.ReactNode[] {
  return text.split(/(@\w+)/g).map((part, i) =>
    /^@\w/.test(part)
      ? <span key={i} style={{ color: "var(--yellow)", fontWeight: 700 }}>{part}</span>
      : part
  );
}

function UserAvatar({ src, name, size = 32 }: { src: string; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const initial = (name || "?")[0].toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: (!src || err) ? avatarColor(name) : "#2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
      {src && !err
        ? <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setErr(true)} />
        : <span style={{ fontSize: size * 0.42, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{initial}</span>
      }
    </div>
  );
}

function getSupportedMime() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return types.find(t => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}

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
  const [showEmoji, setShowEmoji] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [allUsers, setAllUsers] = useState<Array<{ id: string; name: string; image_url: string | null }>>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recSeconds, setRecSeconds] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        fetch("/api/messages/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ otherUserId }) }),
        fetch("/api/users"),
      ]);
      const startData = await startRes.json();
      const usersData = await usersRes.json();
      const foundUser = usersData.users?.find((u: any) => u.id === otherUserId);
      if (foundUser) { setOtherUserName(foundUser.name); setOtherUserImage(foundUser.image_url || ""); }
      setAllUsers(usersData.users || []);
      if (startData.conversationId) {
        setConversationId(startData.conversationId);
        loadMessages(startData.conversationId);
        // Marcar conversa como lida
        fetch("/api/messages/unread", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: startData.conversationId }) }).catch(() => {});
        intervalRef.current = setInterval(() => loadMessages(startData.conversationId), 3000);
      }
    } catch (e) { console.error(e); }
  }

  async function loadMessages(convId: string) {
    try {
      const res = await fetch(`/api/messages?conversationId=${convId}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (e) { console.error(e); }
  }

  async function send(content?: string, imageUrl?: string, audioUrl?: string) {
    if (!conversationId || sending) return;
    if (!content?.trim() && !imageUrl && !audioUrl) return;
    setSending(true);
    if (content) { setInput(""); setMessages(prev => [...prev, { id: `tmp-${Date.now()}`, sender_id: user?.id, content, created_at: new Date().toISOString() }]); }
    try {
      await fetch("/api/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, content: content || null, imageUrl: imageUrl || null, audioUrl: audioUrl || null, videoUrl: null, replyToId: null }),
      });
      loadMessages(conversationId);
    } catch (e) { console.error(e); } finally { setSending(false); }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = getSupportedMime();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
      };
      mr.start(); mrRef.current = mr; setRecording(true); setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch (e) { console.error("Mic error:", e); }
  }

  function stopRecording() { mrRef.current?.stop(); if (timerRef.current) clearInterval(timerRef.current); }

  async function sendAudio() {
    if (!audioBlob) return;
    setSending(true);
    try {
      const ext = audioBlob.type.includes("mp4") ? "mp4" : audioBlob.type.includes("ogg") ? "ogg" : "webm";
      const fd = new FormData();
      fd.append("file", new File([audioBlob], `audio.${ext}`, { type: audioBlob.type }));
      fd.append("type", "audio");
      const res = await fetch("/api/community/upload", { method: "POST", body: fd });
      const { url } = await res.json();
      setAudioBlob(null); setAudioUrl(null);
      await send(undefined, undefined, url);
    } catch (e) { console.error(e); setSending(false); }
  }

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("type", "image");
      const res = await fetch("/api/community/upload", { method: "POST", body: fd });
      const { url } = await res.json();
      await send(undefined, url, undefined);
    } catch (e) { console.error(e); setSending(false); }
    e.target.value = "";
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInput(val);
    const cursor = e.target.selectionStart ?? val.length;
    const match = val.slice(0, cursor).match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1].toLowerCase());
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
    }
  }

  function insertMention(u: { name: string }) {
    const ta = textareaRef.current;
    const cursor = ta?.selectionStart ?? input.length;
    const before = input.slice(0, cursor);
    const atIdx = before.lastIndexOf("@");
    const firstName = u.name.split(" ")[0];
    const newText = before.slice(0, atIdx) + `@${firstName} ` + input.slice(cursor);
    setInput(newText);
    setMentionOpen(false);
    setTimeout(() => ta?.focus(), 0);
  }

  const filteredMentions = allUsers
    .filter(u => u.name.toLowerCase().includes(mentionQuery))
    .slice(0, 5);

  function insertEmoji(e: string) {
    setInput(prev => prev + e);
    setShowEmoji(false);
    textareaRef.current?.focus();
  }

  return (
    <div className="flex flex-col items-center px-3 sm:px-4" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", height: "100dvh", overflow: "hidden", paddingTop: 65, paddingBottom: 65 }}>

      {/* Subheader */}
      <div className="w-full max-w-2xl mb-3 flex items-center gap-3 shrink-0">
        <button onClick={() => router.back()} style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "36px", padding: "0 10px", display: "flex", alignItems: "center", gap: "5px", color: "var(--gray)", cursor: "pointer" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <UserAvatar src={otherUserImage} name={otherUserName} size={32} />
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--white)" }}>{otherUserName || "..."}</div>
          <div style={{ fontSize: "0.68rem", color: "var(--gray)" }}>Mensagem direta</div>
        </div>
      </div>

      {/* Chat area */}
      <div className="w-full max-w-2xl flex-1 min-h-0 p-3 sm:p-4 mb-3 overflow-y-auto" style={{ background: "var(--dark1)", border: "1px solid #1f1f1f", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div style={{ fontSize: "2rem" }}>💬</div>
            <div>
              <p className="font-semibold text-white text-sm">{otherUserName || "..."}</p>
              <p className="text-xs mt-1" style={{ color: "var(--gray)" }}>Comece a conversa!</p>
            </div>
          </div>
        ) : messages.map((msg: any) => (
          <div key={msg.id} className={`mb-3 flex ${msg.sender_id === user?.id ? "justify-end" : "justify-start"} items-end gap-2`}>
            {msg.sender_id !== user?.id && (
              <UserAvatar src={otherUserImage} name={otherUserName} size={28} />
            )}
            <div className="max-w-[82%] sm:max-w-[78%] px-3 sm:px-4 py-2.5 text-sm leading-relaxed"
              style={msg.sender_id === user?.id
                ? { background: "var(--yellow)", color: "var(--black)", borderRadius: "18px 18px 4px 18px", fontWeight: 500 }
                : { background: "var(--dark2)", color: "var(--white)", borderRadius: "18px 18px 18px 4px", border: "1px solid #2a2a2a" }
              }
            >
              {msg.content && <p style={{ margin: "0 0 4px 0" }}>{renderWithMentions(msg.content)}</p>}
              {msg.image_url && <img src={msg.image_url} alt="" style={{ maxWidth: "100%", borderRadius: 8, marginBottom: 4 }} />}
              {msg.audio_url && <audio src={msg.audio_url} controls style={{ width: "100%", marginBottom: 4 }} />}
              <div style={{ fontSize: "0.62rem", opacity: 0.6 }}>
                {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Emoji picker */}
      {showEmoji && (
        <div className="hidden sm:flex w-full max-w-2xl mb-2 p-2 shrink-0" style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "var(--radius)", flexWrap: "wrap", gap: 4 }}>
          {EMOJIS.map(e => (
            <button key={e} onClick={() => insertEmoji(e)} style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", padding: "2px 4px", borderRadius: 6 }}>{e}</button>
          ))}
        </div>
      )}

      {/* Audio preview */}
      {audioUrl && (
        <div className="w-full max-w-2xl mb-2 flex items-center gap-2 shrink-0" style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "var(--radius)", padding: "8px 12px" }}>
          <audio src={audioUrl} controls style={{ flex: 1, height: 36 }} />
          <button onClick={sendAudio} disabled={sending} style={{ background: "var(--yellow)", color: "#000", border: "none", borderRadius: 8, padding: "6px 14px", fontWeight: 700, cursor: "pointer", fontSize: "0.85rem" }}>Enviar</button>
          <button onClick={() => { setAudioBlob(null); setAudioUrl(null); }} style={{ background: "none", border: "none", color: "var(--gray)", cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
        </div>
      )}

      {/* Input */}
      <div className="-mx-3 sm:mx-auto w-full sm:max-w-2xl flex gap-2 items-end px-3 sm:px-0 pb-1 sm:pb-0 shrink-0" style={{ background: "var(--black)" }}>
        {/* Emoji btn - apenas desktop */}
        <button onClick={() => setShowEmoji(s => !s)} className="hidden sm:flex" style={{ width: 44, height: 44, background: showEmoji ? "var(--yellow)" : "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "var(--radius)", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, fontSize: "1.2rem" }}>
          😊
        </button>

        {/* Foto btn */}
        <button onClick={() => fileInputRef.current?.click()} style={{ width: 44, height: 44, background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "var(--radius)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
          </svg>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImage} />

        {/* Textarea */}
        <div className="flex-1" style={{ position: "relative" }}>
          {mentionOpen && filteredMentions.length > 0 && (
            <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, right: 0, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, overflow: "hidden", zIndex: 50, boxShadow: "0 -8px 24px rgba(0,0,0,0.5)" }}>
              {filteredMentions.map(u => (
                <button key={u.id} onMouseDown={e => { e.preventDefault(); insertMention(u); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "transparent", border: "none", borderBottom: "1px solid #1e1e1e", cursor: "pointer", width: "100%", textAlign: "left" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#2a2a2a")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", background: "#2a2a2a", flexShrink: 0 }}>
                    {u.image_url ? <img src={u.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "0.8rem" }}>👤</span>}
                  </div>
                  <span style={{ fontSize: "0.85rem", color: "var(--yellow)", fontWeight: 700 }}>@{u.name.split(" ")[0]}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--gray)" }}>{u.name}</span>
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Digite aqui..."
            rows={1}
            className="w-full resize-none outline-none"
            style={{ background: "var(--dark1)", color: "var(--white)", border: "1px solid #2a2a2a", borderRadius: "var(--radius)", padding: "12px 16px", fontFamily: "'Inter', sans-serif", fontSize: "16px" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--yellow)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
          />
        </div>

        {/* Mic btn */}
        <button
          onClick={recording ? stopRecording : startRecording}
          style={{ width: 44, height: 44, background: recording ? "#ef4444" : "var(--yellow)", borderRadius: "var(--radius)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, boxShadow: recording ? "0 0 16px rgba(239,68,68,0.5)" : "none" }}
        >
          {recording ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--black)"><path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-7 9h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.93V21h2v2H9v-2h2v-3.07A7 7 0 0 1 5 12z"/></svg>
          )}
        </button>

        {/* Send btn */}
        <button onClick={() => send(input)} disabled={!input.trim() || sending}
          className="w-12 h-12 flex items-center justify-center shrink-0 disabled:opacity-40"
          style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "var(--radius)", cursor: input.trim() ? "pointer" : "default" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: "var(--yellow)" }}>
            <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Status gravação */}
      <div className="mt-1.5 h-3.5 text-center" style={{ fontSize: "11px" }}>
        {recording
          ? <span style={{ color: "#ef4444" }}>● Gravando {recSeconds}s — toque em ⏹ para parar</span>
          : <span style={{ color: "var(--gray2)", opacity: 0.6 }}>● Toque em 🎙️ para gravar áudio</span>
        }
      </div>
    </div>
  );
}
