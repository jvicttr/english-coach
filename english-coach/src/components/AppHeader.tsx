"use client";

import { useState, useEffect, useRef } from "react";
import { UserButton } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";

type Notif = {
  id: string;
  type: string;
  post_id: string | null;
  from_user_id: string;
  from_display_name: string;
  from_avatar_url: string | null;
  read: boolean;
  created_at: string;
};

type MsgNotif = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_image: string | null;
  content: string;
  created_at: string;
};

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [isPro, setIsPro] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("isPro") === "true";
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [msgNotifs, setMsgNotifs] = useState<MsgNotif[]>([]);
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((me) => {
      const pro = me.plan === "pro" || me.plan === "combo";
      setIsPro(pro);
      localStorage.setItem("isPro", String(pro));
    }).catch(() => {});

    loadNotifs();
    loadMsgNotifs();
    const id = setInterval(() => { loadNotifs(); loadMsgNotifs(); }, 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function loadNotifs() {
    try {
      const res = await fetch("/api/community/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifs(data.notifications ?? []);
      setUnread(data.unread ?? 0);
    } catch {}
  }

  async function loadMsgNotifs() {
    try {
      const res = await fetch("/api/messages/unread");
      if (!res.ok) return;
      const data = await res.json();
      setMsgNotifs(data.messages ?? []);
      setUnreadMsgs(data.unread ?? 0);
    } catch {}
  }

  async function openNotifs() {
    setNotifOpen((v) => !v);
    setMenuOpen(false);
    if (!notifOpen && unread > 0) {
      setUnread(0);
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
      await fetch("/api/community/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    }
  }

  async function openChat(msg: MsgNotif) {
    setNotifOpen(false);
    // Marcar como lida
    await fetch("/api/messages/unread", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: msg.conversation_id }) });
    setUnreadMsgs(0);
    setMsgNotifs([]);
    router.push(`/app/mensagens/${msg.sender_id}`);
  }

  async function goToPost(n: Notif) {
    setNotifOpen(false);
    if (n.type === "direct_message") {
      router.push(`/app/mensagens/${n.from_user_id}`);
    } else {
      router.push(`/app/comunidade`);
    }
  }

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/portal", { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error ?? `Erro ${res.status}`);
        return;
      }
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error ?? "Sem URL retornada");
    } catch (e) {
      alert("Erro ao abrir portal: " + String(e));
    } finally {
      setPortalLoading(false);
    }
  }

  const isHome = pathname === "/app";
  const hideHeader = /^\/app\/comunidade\/u\//.test(pathname) || /^\/app\/mensagens\/[^/]+/.test(pathname);

  if (hideHeader) return null;

  return (
    <>
      <header
        style={{
          paddingTop: "calc(14px + env(safe-area-inset-top))",
          paddingBottom: 12,
          paddingLeft: 16,
          paddingRight: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #1e1e1e",
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          background: "#0d0d0d",
          zIndex: 100,
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a
            href={isHome ? "https://www.faleinglesjv.com" : "/app"}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, background: "var(--dark2)", border: "1px solid #2a2a2a", textDecoration: "none", flexShrink: 0 }}
            title={isHome ? "Voltar ao site" : "Início"}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7L9 12" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <Image src="/favicon.png" alt="JV IA" width={28} height={28} style={{ borderRadius: 8 }} />
          <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff" }}>
            JV <span style={{ color: "var(--yellow)" }}>IA</span>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a
            href="/planos"
            className="planos-btn"
            style={{ fontSize: ".75rem", fontWeight: 700, color: "var(--yellow)", border: "1px solid rgba(245,200,0,.35)", borderRadius: "50px", padding: ".25rem .75rem", textDecoration: "none" }}
          >
            Planos
          </a>

          {/* Bell */}
          <div ref={notifRef} style={{ position: "relative" }}>
            <button
              onClick={openNotifs}
              style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative", flexShrink: 0 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {(unread + unreadMsgs) > 0 && (
                <span style={{ position: "absolute", top: -4, right: -4, background: "#f87171", borderRadius: "50%", width: 16, height: 16, fontSize: "0.6rem", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                  {(unread + unreadMsgs) > 9 ? "9+" : (unread + unreadMsgs)}
                </span>
              )}
            </button>

            {notifOpen && (
              <div style={{ position: "fixed", top: 62, right: 16, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 14, zIndex: 200, width: 300, maxHeight: 380, overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,.7)" }}>
                <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid #2a2a2a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "#fff" }}>Notificações</span>
                  <a href="/app/comunidade" onClick={() => setNotifOpen(false)} style={{ fontSize: "0.7rem", color: "var(--yellow)", fontWeight: 700, textDecoration: "none" }}>Ver tudo</a>
                </div>

                {/* Mensagens não lidas */}
                {msgNotifs.length > 0 && (
                  <>
                    <div style={{ padding: "8px 14px 4px", fontSize: "0.68rem", fontWeight: 700, color: "var(--yellow)", letterSpacing: "0.5px" }}>💬 MENSAGENS</div>
                    {msgNotifs.map((msg) => (
                      <button key={msg.id} onClick={() => openChat(msg)} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", background: "rgba(245,200,0,.04)", border: "none", borderBottom: "1px solid #1e1e1e", cursor: "pointer", width: "100%", textAlign: "left" }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", background: "#2a2a2a", flexShrink: 0 }}>
                          {msg.sender_image ? <img src={msg.sender_image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "0.9rem" }}>👤</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: "0.78rem", color: "#fff", margin: 0, lineHeight: 1.4 }}>
                            <span style={{ fontWeight: 700 }}>{msg.sender_name}</span>{" "}
                            <span style={{ color: "var(--gray)" }}>enviou uma mensagem</span>
                          </p>
                          <p style={{ fontSize: "0.72rem", color: "var(--gray2)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{msg.content}</p>
                          <p style={{ fontSize: "0.65rem", color: "var(--gray)", margin: "2px 0 0" }}>{timeAgo(msg.created_at)}</p>
                        </div>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--yellow)", flexShrink: 0, marginTop: 4 }} />
                      </button>
                    ))}
                  </>
                )}

                {/* Notificações da comunidade */}
                {notifs.length > 0 && (
                  <>
                    <div style={{ padding: "8px 14px 4px", fontSize: "0.68rem", fontWeight: 700, color: "var(--gray)", letterSpacing: "0.5px" }}>🌍 COMUNIDADE</div>
                    {notifs.map((n) => (
                      <button key={n.id} onClick={() => goToPost(n)} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", background: n.read ? "transparent" : "rgba(245,200,0,.04)", border: "none", borderBottom: "1px solid #1e1e1e", cursor: "pointer", width: "100%", textAlign: "left" }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", background: "#2a2a2a", flexShrink: 0 }}>
                          {n.from_avatar_url ? <img src={n.from_avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "0.9rem" }}>👤</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: "0.78rem", color: "#fff", margin: 0, lineHeight: 1.4 }}>
                            <span style={{ fontWeight: 700 }}>{n.from_display_name}</span>{" "}
                            <span style={{ color: "var(--gray)" }}>{n.type === "mention" ? "te mencionou em um post" : n.type === "direct_message" ? "te enviou uma mensagem" : "respondeu seu post"}</span>
                          </p>
                          <p style={{ fontSize: "0.65rem", color: "var(--gray)", margin: "3px 0 0" }}>{timeAgo(n.created_at)}</p>
                        </div>
                        {!n.read && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--yellow)", flexShrink: 0, marginTop: 4 }} />}
                      </button>
                    ))}
                  </>
                )}

                {notifs.length === 0 && msgNotifs.length === 0 && (
                  <div style={{ padding: "24px 16px", textAlign: "center", fontSize: "0.8rem", color: "var(--gray)" }}>Nenhuma notificação</div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setMenuOpen((v) => !v)}
            style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: 8, width: 32, height: 32, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer", flexShrink: 0 }}
          >
            {menuOpen ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2L12 12M12 2L2 12" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <>
                <span style={{ width: 14, height: 2, background: "var(--gray)", borderRadius: 2 }} />
                <span style={{ width: 14, height: 2, background: "var(--gray)", borderRadius: 2 }} />
                <span style={{ width: 14, height: 2, background: "var(--gray)", borderRadius: 2 }} />
              </>
            )}
          </button>

          <div style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
            <UserButton appearance={{ elements: { avatarBox: { width: 38, height: 38 } } }} />
            {isPro && (
              <span style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)", fontSize: "0.52rem", fontWeight: 800, letterSpacing: "0.4px", background: "linear-gradient(135deg, #f5c800, #e0a800)", color: "#000", padding: "1px 5px", borderRadius: "50px", whiteSpace: "nowrap", lineHeight: 1.4, pointerEvents: "none" }}>
                PRO
              </span>
            )}
          </div>
        </div>
      </header>

      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
          <div style={{ position: "fixed", top: 62, right: 16, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 14, padding: "6px 0", zIndex: 95, minWidth: 200, boxShadow: "0 8px 32px rgba(0,0,0,.6)" }}>
            {isPro && (
              <button
                onClick={() => { setMenuOpen(false); openPortal(); }}
                disabled={portalLoading}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", color: "#fff", fontSize: "0.9rem", fontWeight: 600, background: "transparent", border: "none", cursor: "pointer", width: "100%" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: "1.1rem" }}>👤</span>
                {portalLoading ? "Abrindo..." : "Portal do Aluno"}
              </button>
            )}
            {[
              { href: "/planos", icon: "⭐", label: "Planos", mobileOnly: true },
              { href: "/app/progresso", icon: "🏆", label: "Progresso" },
              { href: "/app/resumo", icon: "📄", label: "Revisão de Aula" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={item.mobileOnly ? "menu-mobile-only" : undefined}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", textDecoration: "none", color: "#fff", fontSize: "0.9rem", fontWeight: 600 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
                {item.label}
              </a>
            ))}
          </div>
        </>
      )}
    </>
  );
}
