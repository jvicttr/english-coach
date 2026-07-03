"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import ChatTranslator from "@/components/ChatTranslator";

const EMOJIS = ["😀","😂","😍","🥰","😎","🤔","😅","🙌","👏","🔥","💯","❤️","🎉","✨","💪","🙏","👍","😊","🤩","😏","🥳","💬","🌍","📚","🎯","🚀","⭐","💡","🎶","✅"];
const QUICK_EMOJIS = ["❤️","😂","😮","😢","🙏","👍","🔥","😍"];

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
    <div style={{ width: size, height: size, borderRadius: "50%", background: (!src || err) ? avatarColor(name) : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
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

function ChatAudioPlayer({ src, isOwn }: { src: string; isOwn: boolean }) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [current, setCurrent] = React.useState(0);
  const [duration, setDuration] = React.useState(0);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); } else { a.play(); }
    setPlaying(!playing);
  }

  function fmt(s: number) {
    if (!isFinite(s) || s === 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  const pct = duration > 0 ? (current / duration) * 100 : 0;
  const btnBg = isOwn ? "rgba(0,0,0,0.25)" : "var(--yellow)";
  const btnColor = isOwn ? "#000" : "#000";
  const trackBg = isOwn ? "rgba(0,0,0,0.2)" : "#2a2a2a";
  const fillBg = isOwn ? "rgba(0,0,0,0.55)" : "var(--yellow)";
  const timeColor = isOwn ? "rgba(0,0,0,0.55)" : "var(--gray)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 180, maxWidth: 260, marginBottom: 4 }}>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={e => setCurrent((e.target as HTMLAudioElement).currentTime)}
        onLoadedMetadata={e => setDuration((e.target as HTMLAudioElement).duration)}
        onEnded={() => { setPlaying(false); setCurrent(0); }}
        style={{ display: "none" }}
      />
      <button
        onClick={toggle}
        style={{ width: 30, height: 30, borderRadius: "50%", background: btnBg, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
      >
        {playing
          ? <svg width="11" height="11" viewBox="0 0 24 24" fill={btnColor}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          : <svg width="11" height="11" viewBox="0 0 24 24" fill={btnColor}><polygon points="5,3 19,12 5,21"/></svg>
        }
      </button>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
        <div
          style={{ position: "relative", height: 3, background: trackBg, borderRadius: 2, cursor: "pointer" }}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            if (audioRef.current && duration > 0) { audioRef.current.currentTime = ratio * duration; setCurrent(ratio * duration); }
          }}
        >
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: fillBg, borderRadius: 2, transition: "width 0.1s linear" }} />
        </div>
        <span style={{ fontSize: "0.62rem", color: timeColor }}>
          {playing || current > 0 ? fmt(current) : fmt(duration)}
        </span>
      </div>
    </div>
  );
}

function parseDate(dateStr: string): Date {
  let s = dateStr.replace(" ", "T");
  if (!s.endsWith("Z") && !/[+-]\d{2}:?\d{2}$/.test(s)) s += "Z";
  s = s.replace(/\+00:00$/, "Z").replace(/\+00$/, "Z").replace(/\+0000$/, "Z");
  return new Date(s);
}

function fmtBrasiliaTime(dateStr: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parseDate(dateStr));
}

function getBrasiliaDay(dateStr: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parseDate(dateStr));
}

function getDayLabel(dateStr: string): string {
  const now = new Date();
  const fmt = (d: Date) => new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
  const today = fmt(now);
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  const yesterday = fmt(yest);
  const day = getBrasiliaDay(dateStr);
  if (day === today) return "Hoje";
  if (day === yesterday) return "Ontem";
  return day;
}

// SVG checkmarks — WhatsApp-style
function CheckSingle({ color = "#999" }: { color?: string }) {
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}>
      <path d="M1.5 5L5 8.5L12.5 1" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CheckDouble({ color = "#999" }: { color?: string }) {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}>
      <path d="M1.5 5L5 8.5L12.5 1" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 5L10.5 8.5L18 1" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function MsgStatus({ msg }: { msg: any }) {
  if (msg.id?.startsWith("tmp-")) return <CheckSingle color="#888" />;
  if (msg.read_at) return <CheckDouble color="#4fc3f7" />;
  return <CheckDouble color="#888" />;
}

function groupReactions(reactions: any[]): { emoji: string; count: number; userIds: string[] }[] {
  const order: string[] = [];
  const map = new Map<string, string[]>();
  for (const r of reactions || []) {
    if (!map.has(r.emoji)) { order.push(r.emoji); map.set(r.emoji, []); }
    map.get(r.emoji)!.push(r.user_id);
  }
  return order.map(emoji => ({ emoji, count: map.get(emoji)!.length, userIds: map.get(emoji)! }));
}

// Reply icon button
function ActionBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      title={title}
      style={{
        width: 28, height: 28, background: "var(--dark2)", border: "1px solid #2a2a2a",
        borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", flexShrink: 0, color: "var(--gray)",
      }}
    >
      {children}
    </button>
  );
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

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  // Reaction picker (desktop) — posição fixed na tela
  const [reactionPicker, setReactionPicker] = useState<{ msgId: string; x: number; y: number } | null>(null);

  // Reply state
  const [replyTo, setReplyTo] = useState<any>(null);
  // Hover state for desktop action buttons
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  // Swipe state for mobile reply
  const [swipeState, setSwipeState] = useState<{ msgId: string; offset: number } | null>(null);
  const swipingActiveRef = useRef(false);
  const touchStartRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const replyTriggeredRef = useRef(false);
  const swipeVibratedRef = useRef(false);
  // Long press menu for mobile delete
  const [longPressMenu, setLongPressMenu] = useState<{ msgId: string; x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputBarRef = useRef<HTMLDivElement>(null);
  const [inputBarHeight, setInputBarHeight] = useState(70);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const msgRefsMap = useRef<Map<string, HTMLElement>>(new Map());
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = inputBarRef.current;
    if (!el) return;
    const syncBar = () => {
      const h = el.offsetHeight;
      setInputBarHeight(h);
      document.documentElement.style.setProperty("--chat-pb", `${h}px`);
      requestAnimationFrame(() => {
        if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      });
    };
    const ro = new ResizeObserver(syncBar);
    ro.observe(el);
    syncBar();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!user?.id || !otherUserId) return;
    init();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [user?.id, otherUserId]);

  const initialScrollDone = useRef(false);

  useEffect(() => {
    if (messages.length === 0) return;
    const container = chatScrollRef.current;
    if (!container) return;

    if (!initialScrollDone.current) {
      // First load: jump to bottom after layout is painted
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        });
      });
      initialScrollDone.current = true;
      return;
    }

    // Subsequent updates: only scroll if user is near the bottom
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom <= 120) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  // Close long press menu on outside click
  useEffect(() => {
    if (!longPressMenu) return;
    const handler = () => setLongPressMenu(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [longPressMenu]);

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
      if (!foundUser?.image_url) {
        // Fallback: imagem no Supabase pode estar desatualizada — busca direto do Clerk
        fetch(`/api/community/user/${otherUserId}`).then(r => r.json()).then(d => {
          if (d.profile?.avatar_url) setOtherUserImage(d.profile.avatar_url);
        }).catch(() => {});
      }
      if (startData.conversationId) {
        setConversationId(startData.conversationId);
        loadMessages(startData.conversationId);
        fetch("/api/messages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: startData.conversationId }) }).catch(() => {});
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

  async function send(content?: string, imageUrl?: string, audioUrlParam?: string) {
    if (!conversationId || sending) return;
    if (!content?.trim() && !imageUrl && !audioUrlParam) return;
    setSending(true);
    const currentReplyTo = replyTo;
    setReplyTo(null);
    if (content) {
      setInput("");
      setMessages(prev => [...prev, {
        id: `tmp-${Date.now()}`,
        sender_id: user?.id,
        content,
        created_at: new Date().toISOString(),
        reply_to_id: currentReplyTo?.id || null,
      }]);
    }
    try {
      await fetch("/api/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          content: content || null,
          imageUrl: imageUrl || null,
          audioUrl: audioUrlParam || null,
          videoUrl: null,
          replyToId: currentReplyTo?.id || null,
        }),
      });
      loadMessages(conversationId);
    } catch (e) { console.error(e); } finally { setSending(false); }
  }

  async function deleteMsg(messageId: string) {
    if (messageId.startsWith("tmp-")) return;
    setMessages(prev => prev.filter(m => m.id !== messageId));
    await fetch(`/api/messages?messageId=${encodeURIComponent(messageId)}`, { method: "DELETE" }).catch(() => {});
  }

  function addReaction(messageId: string, emoji: string) {
    if (!user?.id || messageId.startsWith("tmp-")) return;
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      return { ...m, message_reactions: [...(m.message_reactions || []), { id: `tmp-r-${Date.now()}`, message_id: messageId, user_id: user.id, emoji }] };
    }));
    fetch("/api/messages/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, emoji }),
    }).catch(() => {});
  }

  function removeReaction(messageId: string, emoji: string) {
    if (!user?.id) return;
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const reactions: any[] = m.message_reactions || [];
      // Remove a última ocorrência da reação deste usuário
      const idx = reactions.map((r: any, i: number) => r.user_id === user.id && r.emoji === emoji ? i : -1).filter(i => i !== -1).pop();
      if (idx === undefined) return m;
      return { ...m, message_reactions: [...reactions.slice(0, idx), ...reactions.slice(idx + 1)] };
    }));
    fetch("/api/messages/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, emoji, remove: true }),
    }).catch(() => {});
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

  const filteredMentions = allUsers.filter(u => u.name.toLowerCase().includes(mentionQuery)).slice(0, 5);

  function insertEmoji(e: string) {
    setInput(prev => prev + e);
    setShowEmoji(false);
    textareaRef.current?.focus();
  }

  // Mobile touch handlers
  function handleTouchStart(e: React.TouchEvent, msgId: string) {
    const t = e.touches[0];
    touchStartRef.current = { id: msgId, x: t.clientX, y: t.clientY };
    replyTriggeredRef.current = false;
    swipeVibratedRef.current = false;
    swipingActiveRef.current = true;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      setLongPressMenu({ msgId, x: t.clientX, y: t.clientY });
    }, 600);
  }

  function handleTouchMove(e: React.TouchEvent, msgId: string) {
    if (!touchStartRef.current || touchStartRef.current.id !== msgId) return;
    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    const deltaY = e.touches[0].clientY - touchStartRef.current.y;
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    }
    if (Math.abs(deltaY) > 20 && Math.abs(deltaY) > Math.abs(deltaX)) {
      // vertical scroll dominates — cancel swipe
      setSwipeState(null);
      swipingActiveRef.current = false;
      touchStartRef.current = null;
      return;
    }
    if (deltaX > 0) {
      const offset = Math.min(deltaX, 72);
      if (offset >= 50 && !swipeVibratedRef.current) {
        swipeVibratedRef.current = true;
        navigator.vibrate?.(40);
      }
      setSwipeState({ msgId, offset });
    }
  }

  function handleTouchEnd(msgId: string) {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    const offset = swipeState?.msgId === msgId ? swipeState.offset : 0;
    if (offset > 50 && !replyTriggeredRef.current) {
      const msg = messages.find(m => m.id === msgId);
      if (msg) {
        replyTriggeredRef.current = true;
        setReplyTo(msg);
        setTimeout(() => textareaRef.current?.focus(), 100);
      }
    }
    setSwipeState(null);
    swipingActiveRef.current = false;
    touchStartRef.current = null;
  }

  function getSwipeOffset(msgId: string) {
    return swipeState?.msgId === msgId ? swipeState.offset : 0;
  }

  function scrollToMessage(msgId: string) {
    const el = msgRefsMap.current.get(msgId);
    if (!el || !chatScrollRef.current) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMsgId(msgId);
    setTimeout(() => setHighlightedMsgId(null), 1200);
  }

  function getReplyContent(msg: any) {
    if (!msg) return "Mensagem apagada";
    if (msg.content) return msg.content.length > 80 ? msg.content.slice(0, 80) + "…" : msg.content;
    if (msg.image_url) return "📷 Imagem";
    if (msg.audio_url) return "🎵 Áudio";
    return "📎 Arquivo";
  }

  return (
    <div
      ref={outerRef}
      className="flex flex-col items-center px-3 sm:px-4"
      style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", position: "fixed", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden", paddingTop: "calc(65px + env(safe-area-inset-top))", paddingBottom: "var(--chat-pb, 70px)" }}
      onClick={() => longPressMenu && setLongPressMenu(null)}
    >

      {/* Subheader */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, paddingTop: "calc(10px + env(safe-area-inset-top))", paddingBottom: 10, background: "var(--black)", borderBottom: "1px solid #1e1e1e", zIndex: 1000 }}>
        <div style={{ maxWidth: "42rem", margin: "0 auto", paddingLeft: 16, paddingRight: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()} style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "36px", padding: "0 10px", display: "flex", alignItems: "center", gap: "5px", color: "var(--gray)", cursor: "pointer", flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <a href={`/app/comunidade/u/${otherUserId}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flex: 1, minWidth: 0 }}>
            <UserAvatar src={otherUserImage} name={otherUserName} size={36} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--white)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{otherUserName || "..."}</div>
              <div style={{ fontSize: "0.68rem", color: "var(--gray)" }}>Mensagem direta</div>
            </div>
          </a>
        </div>
      </div>

      {/* Chat area */}
      <div
        ref={chatScrollRef}
        className="w-full max-w-2xl flex-1 min-h-0 p-3 sm:p-4 overflow-y-auto flex flex-col"
        style={{ background: "var(--dark1)", border: "1px solid #1f1f1f", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflowX: "hidden" }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div style={{ fontSize: "2rem" }}>💬</div>
            <div>
              <p className="font-semibold text-white text-sm">{otherUserName || "..."}</p>
              <p className="text-xs mt-1" style={{ color: "var(--gray)" }}>Comece a conversa!</p>
            </div>
          </div>
        ) : (<><div style={{ flex: 1 }} />{messages.flatMap((msg: any, idx: number) => {
          const isOwn = msg.sender_id === user?.id;
          const showSep = idx === 0 || getBrasiliaDay(msg.created_at) !== getBrasiliaDay(messages[idx - 1].created_at);
          const swipeOffset = getSwipeOffset(msg.id);
          const isHovered = hoveredMsgId === msg.id;
          const isTmp = msg.id?.startsWith("tmp-");

          const originalMsg = msg.reply_to_id ? messages.find((m: any) => m.id === msg.reply_to_id) : null;
          const replyBorderColor = isOwn ? "rgba(0,0,0,0.25)" : "var(--yellow)";
          const replyBg = isOwn ? "rgba(0,0,0,0.15)" : "rgba(255,213,0,0.08)";
          const replyNameColor = isOwn ? "rgba(0,0,0,0.6)" : "var(--yellow)";

          const els: React.ReactNode[] = [];

          if (showSep) els.push(
            <div key={`sep-${msg.id}`} style={{ textAlign: "center", margin: "16px 0 8px" }}>
              <span style={{ padding: "3px 14px", fontSize: "0.68rem", color: "var(--gray)", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 50 }}>
                {getDayLabel(msg.created_at)}
              </span>
            </div>
          );

          const isHighlighted = highlightedMsgId === msg.id;
          const grouped = groupReactions(msg.message_reactions);
          const showActions = (isHovered && !isTmp) || reactionPicker?.msgId === msg.id;

          els.push(
            <div
              key={msg.id}
              ref={(el) => { if (el) msgRefsMap.current.set(msg.id, el); else msgRefsMap.current.delete(msg.id); }}
              style={{
                position: "relative",
                marginBottom: 10,
                borderRadius: 12,
                transition: "background 0.3s ease",
                background: isHighlighted ? "rgba(245,200,0,0.12)" : "transparent",
              }}
            >
              {/* Mobile swipe reply arrow — sempre à esquerda */}
              <div
                style={{
                  position: "absolute",
                  left: 4,
                  top: "50%",
                  transform: "translateY(-50%)",
                  opacity: Math.min(swipeOffset / 50, 1),
                  pointerEvents: "none",
                  color: "var(--gray)",
                  fontSize: "1.1rem",
                  transition: swipeOffset === 0 ? "opacity 0.2s" : "none",
                }}
              >
                ↩
              </div>

              {/* Message row */}
              <div
                className={`flex ${isOwn ? "justify-end" : "justify-start"} items-end gap-2`}
                style={{
                  transform: `translateX(${swipeOffset}px)`,
                  transition: swipeOffset === 0 ? "transform 0.2s ease" : "none",
                }}
                onMouseEnter={() => !isTmp && setHoveredMsgId(msg.id)}
                onMouseLeave={() => setHoveredMsgId(null)}
                onDoubleClick={(e) => { e.preventDefault(); setReplyTo(msg); setTimeout(() => textareaRef.current?.focus(), 50); }}
                onTouchStart={(e) => handleTouchStart(e, msg.id)}
                onTouchMove={(e) => handleTouchMove(e, msg.id)}
                onTouchEnd={() => handleTouchEnd(msg.id)}
              >
                {/* Other user avatar */}
                {!isOwn && <UserAvatar src={otherUserImage} name={otherUserName} size={28} />}

                {/* Emoji reaction button — mobile, sempre visível (esquerda do bubble para msgs próprias) */}
                {isOwn && !isTmp && (
                  <button
                    className=""
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      const r = e.currentTarget.getBoundingClientRect();
                      const pw = 292;
                      setReactionPicker(prev => prev?.msgId === msg.id ? null : {
                        msgId: msg.id,
                        x: Math.max(8, Math.min(r.left - pw / 2 + 13, window.innerWidth - pw - 8)),
                        y: Math.max(70, r.top - 58),
                      });
                    }}
                    style={{ width: 26, height: 26, background: reactionPicker?.msgId === msg.id ? "rgba(245,200,0,0.2)" : "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, fontSize: "0.85rem", lineHeight: 1 }}
                  >😊</button>
                )}

                {/* Action buttons for own messages (desktop, left of bubble) */}
                {isOwn && showActions && (
                  <div className="hidden sm:flex items-center gap-1">
                    <ActionBtn onClick={() => { setReplyTo(msg); setTimeout(() => textareaRef.current?.focus(), 50); }} title="Responder">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
                        <path d="M13 21l-4-4 4-4"/>
                        <path d="M9 17h8a2 2 0 0 0 2-2v-5"/>
                      </svg>
                    </ActionBtn>
                    <ActionBtn onClick={() => deleteMsg(msg.id)} title="Apagar mensagem">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </ActionBtn>
                  </div>
                )}

                {/* Message bubble */}
                <div
                  className="max-w-[82%] sm:max-w-[78%] px-3 sm:px-4 py-2.5 text-sm leading-relaxed"
                  style={isOwn
                    ? { background: "var(--yellow)", color: "var(--black)", borderRadius: "18px 18px 4px 18px", fontWeight: 500 }
                    : { background: "var(--dark2)", color: "var(--white)", borderRadius: "18px 18px 18px 4px", border: "1px solid #2a2a2a" }
                  }
                >
                  {/* Reply quote inside bubble — clicável para ir à mensagem original */}
                  {msg.reply_to_id && (
                    <div
                      onClick={(e) => { e.stopPropagation(); if (originalMsg) scrollToMessage(msg.reply_to_id); }}
                      style={{
                        borderLeft: `3px solid ${replyBorderColor}`,
                        background: replyBg,
                        borderRadius: 6,
                        padding: "4px 8px",
                        marginBottom: 6,
                        cursor: originalMsg ? "pointer" : "default",
                      }}
                    >
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: replyNameColor, marginBottom: 2 }}>
                        {originalMsg
                          ? (originalMsg.sender_id === user?.id ? "Você" : otherUserName)
                          : "Mensagem apagada"
                        }
                      </div>
                      <div style={{ fontSize: "0.75rem", opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>
                        {getReplyContent(originalMsg)}
                      </div>
                    </div>
                  )}

                  {msg.content && <p style={{ margin: "0 0 4px 0" }}>{renderWithMentions(msg.content)}</p>}
                  {msg.image_url && (
                    <img
                      src={msg.image_url}
                      alt=""
                      onClick={(e) => { e.stopPropagation(); setLightboxUrl(msg.image_url); }}
                      style={{ maxWidth: "100%", borderRadius: 8, marginBottom: 4, cursor: "zoom-in", display: "block" }}
                    />
                  )}
                  {msg.audio_url && <ChatAudioPlayer src={msg.audio_url} isOwn={isOwn} />}

                  {/* Timestamp + status */}
                  <div style={{ fontSize: "0.62rem", opacity: 0.65, display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", marginTop: 2 }}>
                    {fmtBrasiliaTime(msg.created_at)}
                    {isOwn && <MsgStatus msg={msg} />}
                  </div>
                </div>

                {/* Emoji reaction button — mobile, sempre visível (direita do bubble para msgs recebidas) */}
                {!isOwn && (
                  <button
                    className=""
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      const r = e.currentTarget.getBoundingClientRect();
                      const pw = 292;
                      setReactionPicker(prev => prev?.msgId === msg.id ? null : {
                        msgId: msg.id,
                        x: Math.max(8, Math.min(r.left - pw / 2 + 13, window.innerWidth - pw - 8)),
                        y: Math.max(70, r.top - 58),
                      });
                    }}
                    style={{ width: 26, height: 26, background: reactionPicker?.msgId === msg.id ? "rgba(245,200,0,0.2)" : "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, fontSize: "0.85rem", lineHeight: 1 }}
                  >😊</button>
                )}

                {/* Action buttons for other's messages (desktop, right of bubble) */}
                {!isOwn && showActions && (
                  <div className="hidden sm:flex items-center gap-1">
                    <ActionBtn onClick={() => { setReplyTo(msg); setTimeout(() => textareaRef.current?.focus(), 50); }} title="Responder">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
                        <path d="M13 21l-4-4 4-4"/>
                        <path d="M9 17h8a2 2 0 0 0 2-2v-5"/>
                      </svg>
                    </ActionBtn>
                    <ActionBtn onClick={() => deleteMsg(msg.id)} title="Apagar mensagem">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </ActionBtn>
                  </div>
                )}
              </div>

              {/* Reaction pills abaixo do bubble */}
              {grouped.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3, justifyContent: isOwn ? "flex-end" : "flex-start", paddingLeft: isOwn ? 0 : 36, paddingRight: 4 }}>
                  {grouped.map(({ emoji, count, userIds }) => {
                    const hasOwn = userIds.includes(user?.id ?? "");
                    return (
                      <button
                        key={emoji}
                        onClick={() => { if (hasOwn) removeReaction(msg.id, emoji); else addReaction(msg.id, emoji); }}
                        style={{ background: hasOwn ? "rgba(245,200,0,0.18)" : "rgba(255,255,255,0.07)", border: hasOwn ? "1px solid rgba(245,200,0,0.45)" : "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "3px 9px", fontSize: "0.82rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "var(--white)", fontFamily: "inherit", lineHeight: 1 }}
                      >
                        {emoji}{count > 1 && <span style={{ fontSize: "0.7rem", fontWeight: 700, opacity: 0.85 }}>{count}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );

          return els;
        })}</>)}
        <div ref={bottomRef} />
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 2000,
            background: "rgba(0,0,0,0.95)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          <img
            src={lightboxUrl}
            alt=""
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", userSelect: "none" }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            style={{
              position: "absolute", top: 16, right: 16,
              background: "rgba(255,255,255,0.1)", border: "none",
              borderRadius: "50%", width: 40, height: 40,
              color: "#fff", fontSize: "1.2rem", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Reaction picker flutuante — desktop */}
      {reactionPicker && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 298 }} onClick={() => setReactionPicker(null)} />
          <div
            style={{ position: "fixed", top: reactionPicker.y, left: reactionPicker.x, background: "#1e1e1e", border: "1px solid #2a2a2a", borderRadius: 30, padding: "6px 8px", display: "flex", gap: 2, zIndex: 299, boxShadow: "0 4px 24px rgba(0,0,0,0.7)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onMouseDown={(e) => { e.preventDefault(); addReaction(reactionPicker.msgId, emoji); setReactionPicker(null); }}
                style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", padding: "4px 5px", borderRadius: 8, lineHeight: 1 }}
                onMouseEnter={e => (e.currentTarget.style.background = "#2a2a2a")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >{emoji}</button>
            ))}
          </div>
        </>
      )}

      {/* Long press context menu (mobile) */}
      {longPressMenu && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={(e) => { e.stopPropagation(); setLongPressMenu(null); }} />
          <div
            style={{
              position: "fixed",
              top: Math.min(longPressMenu.y, window.innerHeight - 175),
              left: Math.min(longPressMenu.x, window.innerWidth - 200),
              background: "#1e1e1e",
              border: "1px solid #2a2a2a",
              borderRadius: 14,
              zIndex: 999,
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
              minWidth: 190,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Quick emoji reactions no topo */}
            <div style={{ display: "flex", justifyContent: "space-around", padding: "10px 8px", borderBottom: "1px solid #2a2a2a" }}>
              {QUICK_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => { addReaction(longPressMenu.msgId, emoji); setLongPressMenu(null); }}
                  style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", padding: "2px 3px", borderRadius: 8, lineHeight: 1 }}
                >{emoji}</button>
              ))}
            </div>
            {[
              {
                label: "Responder",
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
                    <path d="M13 21l-4-4 4-4"/><path d="M9 17h8a2 2 0 0 0 2-2v-5"/>
                  </svg>
                ),
                color: "var(--white)",
                action: () => {
                  const msg = messages.find(m => m.id === longPressMenu.msgId);
                  if (msg) { setReplyTo(msg); setTimeout(() => textareaRef.current?.focus(), 100); }
                  setLongPressMenu(null);
                },
              },
              {
                label: "Apagar mensagem",
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                ),
                color: "#ef4444",
                action: () => {
                  deleteMsg(longPressMenu.msgId);
                  setLongPressMenu(null);
                },
              },
            ].map((item, i, arr) => (
              <button
                key={item.label}
                onClick={item.action}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 16px", background: "transparent",
                  border: "none", borderBottom: i < arr.length - 1 ? "1px solid #2a2a2a" : "none",
                  cursor: "pointer", width: "100%", textAlign: "left",
                  color: item.color, fontSize: "0.85rem", fontWeight: 500,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#2a2a2a")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Emoji picker */}
      {showEmoji && (
        <div className="hidden sm:flex w-full max-w-2xl mb-2 p-2 shrink-0" style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "var(--radius)", flexWrap: "wrap", gap: 4 }}>
          {EMOJIS.map(e => (
            <button key={e} onClick={() => insertEmoji(e)} style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", padding: "2px 4px", borderRadius: 6 }}>{e}</button>
          ))}
        </div>
      )}

      {/* Input bar — estilo WhatsApp, fixo no fundo */}
      <div ref={inputBarRef} style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#111", borderTop: "1px solid #1e1e1e", zIndex: 100, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div style={{ maxWidth: "42rem", margin: "0 auto", padding: "8px 12px" }}>
        {/* Audio preview */}
        {audioUrl && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: "7px 10px", marginBottom: 8 }}>
            <div style={{ flex: 1 }}><ChatAudioPlayer src={audioUrl} isOwn={false} /></div>
            <button onClick={sendAudio} disabled={sending} style={{ background: "var(--yellow)", color: "#000", border: "none", borderRadius: 8, padding: "6px 14px", fontWeight: 700, cursor: "pointer", fontSize: "0.85rem", flexShrink: 0 }}>Enviar</button>
            <button onClick={() => { setAudioBlob(null); setAudioUrl(null); }} style={{ background: "none", border: "none", color: "var(--gray)", cursor: "pointer", fontSize: "1.2rem", flexShrink: 0 }}>✕</button>
          </div>
        )}

        {/* Reply preview bar */}
        {replyTo && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#1a1a1a", border: "1px solid #2a2a2a", borderLeft: "3px solid var(--yellow)", borderRadius: 10, padding: "7px 10px", marginBottom: 8 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M9 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
              <path d="M13 21l-4-4 4-4"/><path d="M9 17h8a2 2 0 0 0 2-2v-5"/>
            </svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.68rem", color: "var(--yellow)", fontWeight: 700, marginBottom: 1 }}>
                {replyTo.sender_id === user?.id ? "Respondendo a você mesmo" : `Respondendo a ${otherUserName}`}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--gray)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {getReplyContent(replyTo)}
              </div>
            </div>
            <button onClick={() => setReplyTo(null)} style={{ background: "none", border: "none", color: "var(--gray)", cursor: "pointer", fontSize: "1.1rem", flexShrink: 0, lineHeight: 1 }}>✕</button>
          </div>
        )}
        {recording && (
          <div style={{ textAlign: "center", fontSize: "11px", marginBottom: 6 }}>
            <span style={{ color: "#ef4444" }}>● Gravando {recSeconds}s — toque em ⏹ para parar</span>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>

          {/* Ícones esquerdos: tradutor + foto */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", paddingBottom: 6, flexShrink: 0 }}>
            <ChatTranslator onUse={(text) => { setInput(prev => prev ? prev + " " + text : text); setTimeout(() => textareaRef.current?.focus(), 50); }} />
            <button onClick={() => fileInputRef.current?.click()} style={{ width: 36, height: 36, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
              </svg>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImage} />
          </div>

          {/* Pill input */}
          <div style={{ flex: 1, position: "relative", background: "#1e1e1e", borderRadius: 24, minHeight: 44, display: "flex", alignItems: "flex-end" }}>
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
              placeholder="Digite uma mensagem..."
              rows={1}
              className="w-full resize-none outline-none"
              style={{ background: "transparent", color: "var(--white)", border: "none", borderRadius: 24, padding: "11px 16px", fontFamily: "'Inter', sans-serif", fontSize: "15px", lineHeight: "1.4", maxHeight: 120, overflowY: "auto" }}
            />
          </div>

          {/* Mic ou Send — círculo amarelo */}
          <button
            onClick={input.trim() ? () => send(input) : (recording ? stopRecording : startRecording)}
            disabled={sending}
            style={{ width: 44, height: 44, borderRadius: "50%", border: "none", background: recording ? "#ef4444" : "var(--yellow)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, boxShadow: recording ? "0 0 16px rgba(239,68,68,0.5)" : "none", transition: "background 0.15s" }}
          >
            {recording ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
            ) : input.trim() ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 19V5M5 12l7-7 7 7" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#000"><path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-7 9h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.93V21h2v2H9v-2h2v-3.07A7 7 0 0 1 5 12z"/></svg>
            )}
          </button>

        </div>
      </div>
      </div>
    </div>
  );
}
