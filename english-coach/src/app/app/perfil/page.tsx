"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";

type ProfileData = {
  isPro: boolean;
  streak: number;
  totalXp: number;
  tier: { label: string; emoji: string; min: number };
  nextTier: { label: string; emoji: string; min: number } | null;
  trilhaCompleted: { step_id: string }[];
  flashcardPending: number;
};

const LEVEL_INFO: Record<string, { emoji: string; label: string; color: string }> = {
  beginner:     { emoji: "🌱", label: "Iniciante",     color: "#60a5fa" },
  intermediate: { emoji: "🔥", label: "Intermediário", color: "#F5C800" },
  advanced:     { emoji: "🚀", label: "Avançado",      color: "#4ade80" },
};

export default function PerfilPage() {
  const { user } = useUser();
  const [data, setData] = useState<ProfileData | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [plan, setPlan] = useState<"free" | "pro">("free");
  const [changingLevel, setChangingLevel] = useState(false);
  const [savingLevel, setSavingLevel] = useState(false);
  const [handle, setHandle] = useState<string | null>(null);
  const [editingHandle, setEditingHandle] = useState(false);
  const [handleInput, setHandleInput] = useState("");
  const [handleError, setHandleError] = useState("");
  const [savingHandle, setSavingHandle] = useState(false);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/community/follow?userId=${user.id}`)
      .then(r => r.json())
      .then(d => { setFollowerCount(d.followerCount ?? 0); setFollowingCount(d.followingCount ?? 0); })
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    Promise.all([
      fetch("/api/me").then((r) => r.json()),
      fetch("/api/home").then((r) => r.json()),
      fetch("/api/community/handle").then((r) => r.json()),
    ]).then(([me, home, h]) => {
      setPlan(me.plan ?? "free");
      setLevel(me.level ?? localStorage.getItem("userLevel") ?? "intermediate");
      setData(home);
      setHandle(h.handle ?? null);
    });
  }, []);

  async function saveLevel(newLevel: string) {
    setSavingLevel(true);
    try {
      await fetch("/api/level", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: newLevel }),
      });
      localStorage.setItem("userLevel", newLevel);
      setLevel(newLevel);
      setChangingLevel(false);
    } finally {
      setSavingLevel(false);
    }
  }

  async function saveHandle() {
    setHandleError("");
    setSavingHandle(true);
    try {
      const res = await fetch("/api/community/handle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: handleInput }),
      });
      const data = await res.json();
      if (!res.ok) { setHandleError(data.error ?? "Erro ao salvar"); return; }
      setHandle(data.handle);
      setEditingHandle(false);
    } finally {
      setSavingHandle(false);
    }
  }

  const levelInfo = level ? LEVEL_INFO[level] : null;
  const xpToNext = data?.nextTier ? data.nextTier.min - (data.totalXp ?? 0) : null;
  const xpPct = data?.nextTier
    ? Math.min(100, Math.round(((data.totalXp - data.tier.min) / (data.nextTier.min - data.tier.min)) * 100))
    : 100;

  const loading = !data || !level;

  if (loading) return (
    <div style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "calc(65px + env(safe-area-inset-top))", paddingBottom: "calc(56px + env(safe-area-inset-bottom, 0px))" }}>
      <div style={{ width: "100%", padding: "10px 16px", borderBottom: "1px solid #1e1e1e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "1rem", fontWeight: 800, color: "var(--white)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Perfil
        </div>
      </div>
      <div style={{ width: "100%", maxWidth: 672, padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        <style>{`@keyframes sk-pulse{0%,100%{opacity:.4}50%{opacity:.15}}`}</style>
        {/* Avatar skeleton */}
        <div style={{ background: "var(--dark2)", borderRadius: 16, padding: "20px 18px", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#2a2a2a", flexShrink: 0, animation: "sk-pulse 1.5s ease-in-out infinite" }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ height: 14, width: "55%", borderRadius: 6, background: "#2a2a2a", animation: "sk-pulse 1.5s ease-in-out infinite" }} />
            <div style={{ height: 11, width: "40%", borderRadius: 6, background: "#2a2a2a", animation: "sk-pulse 1.5s ease-in-out infinite 0.2s" }} />
            <div style={{ height: 10, width: "65%", borderRadius: 6, background: "#2a2a2a", animation: "sk-pulse 1.5s ease-in-out infinite 0.4s" }} />
          </div>
          <div style={{ width: 36, height: 22, borderRadius: 50, background: "#2a2a2a", animation: "sk-pulse 1.5s ease-in-out infinite" }} />
        </div>
        {/* Nível skeleton */}
        <div style={{ background: "var(--dark2)", borderRadius: 16, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#2a2a2a", animation: "sk-pulse 1.5s ease-in-out infinite" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ height: 10, width: 100, borderRadius: 6, background: "#2a2a2a", animation: "sk-pulse 1.5s ease-in-out infinite 0.1s" }} />
              <div style={{ height: 13, width: 80, borderRadius: 6, background: "#2a2a2a", animation: "sk-pulse 1.5s ease-in-out infinite 0.2s" }} />
            </div>
          </div>
          <div style={{ width: 52, height: 28, borderRadius: 8, background: "#2a2a2a", animation: "sk-pulse 1.5s ease-in-out infinite" }} />
        </div>
        {/* Handle skeleton */}
        <div style={{ background: "var(--dark2)", borderRadius: 16, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ height: 10, width: 110, borderRadius: 6, background: "#2a2a2a", animation: "sk-pulse 1.5s ease-in-out infinite 0.1s" }} />
            <div style={{ height: 13, width: 80, borderRadius: 6, background: "#2a2a2a", animation: "sk-pulse 1.5s ease-in-out infinite 0.2s" }} />
          </div>
          <div style={{ width: 52, height: 28, borderRadius: 8, background: "#2a2a2a", animation: "sk-pulse 1.5s ease-in-out infinite" }} />
        </div>
        {/* Plan skeleton */}
        <div style={{ background: "var(--dark2)", borderRadius: 16, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "#2a2a2a", flexShrink: 0, animation: "sk-pulse 1.5s ease-in-out infinite" }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ height: 13, width: "50%", borderRadius: 6, background: "#2a2a2a", animation: "sk-pulse 1.5s ease-in-out infinite 0.1s" }} />
            <div style={{ height: 10, width: "70%", borderRadius: 6, background: "#2a2a2a", animation: "sk-pulse 1.5s ease-in-out infinite 0.2s" }} />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "calc(65px + env(safe-area-inset-top))", paddingBottom: "calc(56px + env(safe-area-inset-bottom, 0px))" }}>
      <div style={{ width: "100%", padding: "10px 16px", borderBottom: "1px solid #1e1e1e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "1rem", fontWeight: 800, color: "var(--white)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Perfil
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 672, padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Avatar + nome + plano */}
        <div style={{ background: "var(--dark2)", borderRadius: 16, padding: "20px 18px", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", background: "#1e1e1e", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {user?.imageUrl
              ? <img src={user.imageUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: "1.6rem" }}>👤</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: "1rem", fontWeight: 800, color: "var(--white)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.firstName ?? user?.fullName ?? "Aluno"}
            </p>
            {handle && (
              <p style={{ fontSize: "0.78rem", color: "var(--yellow)", fontWeight: 600, margin: "2px 0 0", opacity: 0.85 }}>@{handle}</p>
            )}
            <p style={{ fontSize: "0.72rem", color: "var(--gray2)", margin: "2px 0 0" }}>
              {user?.primaryEmailAddress?.emailAddress ?? ""}
            </p>
            {(followerCount !== null || followingCount !== null) && (
              <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                {followerCount !== null && (
                  <span style={{ fontSize: "0.7rem", color: "var(--gray2)" }}>
                    <strong style={{ color: "var(--white)" }}>{followerCount}</strong> seguidor{followerCount !== 1 ? "es" : ""}
                  </span>
                )}
                {followingCount !== null && (
                  <span style={{ fontSize: "0.7rem", color: "var(--gray2)" }}>
                    <strong style={{ color: "var(--white)" }}>{followingCount}</strong> seguindo
                  </span>
                )}
              </div>
            )}
          </div>
          <span style={{ fontSize: "0.65rem", fontWeight: 800, padding: "3px 10px", borderRadius: 50, background: plan === "pro" ? "var(--yellow)" : "#1e1e1e", color: plan === "pro" ? "#000" : "var(--gray2)", border: plan === "pro" ? "none" : "1px solid #333", flexShrink: 0 }}>
            {plan === "pro" ? "PRO" : "FREE"}
          </span>
        </div>

        {/* Nível de inglês */}
        <div style={{ background: "var(--dark2)", borderRadius: 16, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: changingLevel ? 14 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "1.4rem" }}>{levelInfo?.emoji ?? "🌱"}</span>
              <div>
                <p style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--gray2)", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>Seu nível de inglês</p>
                <p style={{ fontSize: "0.95rem", fontWeight: 800, color: levelInfo?.color ?? "var(--white)", margin: "2px 0 0" }}>{levelInfo?.label ?? "—"}</p>
              </div>
            </div>
            <button
              onClick={() => setChangingLevel((v) => !v)}
              style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--yellow)", background: "rgba(245,200,0,.08)", border: "1px solid rgba(245,200,0,.25)", borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}
            >
              {changingLevel ? "Cancelar" : "Trocar"}
            </button>
          </div>

          {changingLevel && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(LEVEL_INFO).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => saveLevel(key)}
                  disabled={savingLevel}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: `1px solid ${level === key ? info.color : "#2a2a2a"}`, background: level === key ? `${info.color}15` : "#1a1a1a", cursor: "pointer", textAlign: "left", opacity: savingLevel ? 0.6 : 1 }}
                >
                  <span style={{ fontSize: "1.3rem" }}>{info.emoji}</span>
                  <div>
                    <p style={{ fontSize: "0.85rem", fontWeight: 800, color: info.color, margin: 0 }}>{info.label}</p>
                    <p style={{ fontSize: "0.68rem", color: "var(--gray2)", margin: "2px 0 0" }}>
                      {key === "beginner" ? "Sei pouco ou nada. Quero começar do zero." : key === "intermediate" ? "Me viro, mas erro bastante e travo às vezes." : "Me comunico bem, quero refinar fluência."}
                    </p>
                  </div>
                  {level === key && <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: info.color }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Handle de menção */}
        <div style={{ background: "var(--dark2)", borderRadius: 16, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--gray2)", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>Seu @ na comunidade</p>
              <p style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--yellow)", margin: "3px 0 0" }}>
                {handle ? `@${handle}` : <span style={{ color: "var(--gray2)", fontWeight: 400, fontSize: "0.85rem" }}>Nenhum definido</span>}
              </p>
            </div>
            <button
              onClick={() => { setEditingHandle(v => !v); setHandleInput(handle ?? ""); setHandleError(""); }}
              style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--yellow)", background: "rgba(245,200,0,.08)", border: "1px solid rgba(245,200,0,.25)", borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}
            >
              {editingHandle ? "Cancelar" : handle ? "Trocar" : "Definir"}
            </button>
          </div>

          {editingHandle && (
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 0, background: "#111", border: `1px solid ${handleError ? "#ef4444" : "#2a2a2a"}`, borderRadius: 10, overflow: "hidden" }}>
                <span style={{ padding: "10px 10px 10px 14px", fontSize: "0.9rem", color: "var(--yellow)", fontWeight: 700, userSelect: "none" }}>@</span>
                <input
                  value={handleInput}
                  onChange={e => setHandleInput(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 30))}
                  placeholder="seunome"
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: "0.9rem", color: "var(--white)", padding: "10px 12px 10px 0" }}
                />
              </div>
              {handleError && <p style={{ fontSize: "0.72rem", color: "#ef4444", margin: 0 }}>{handleError}</p>}
              <p style={{ fontSize: "0.68rem", color: "var(--gray2)", margin: 0 }}>Só letras, números, pontos e underscores. Mínimo 2 caracteres.</p>
              <button
                onClick={saveHandle}
                disabled={savingHandle || handleInput.length < 2}
                style={{ background: "var(--yellow)", color: "#000", fontWeight: 800, fontSize: "0.82rem", border: "none", borderRadius: 10, padding: "10px", cursor: "pointer", opacity: savingHandle || handleInput.length < 2 ? 0.5 : 1 }}
              >
                {savingHandle ? "Salvando…" : "Salvar @"}
              </button>
            </div>
          )}
        </div>

        {/* Upgrade (free only) */}
        {plan === "free" && (
          <a href="/planos" style={{ background: "rgba(245,200,0,.06)", border: "1px solid rgba(245,200,0,.3)", borderRadius: 16, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, textDecoration: "none" }}>
            <span style={{ fontSize: "1.6rem" }}>⭐</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--yellow)", margin: 0 }}>Assine o JV IA PRO</p>
              <p style={{ fontSize: "0.7rem", color: "rgba(245,200,0,.65)", margin: "2px 0 0" }}>Trilha, roleplay, flashcards e sem limites — R$ 97/mês</p>
            </div>
            <span style={{ fontSize: "0.85rem", color: "var(--yellow)" }}>→</span>
          </a>
        )}

        {/* Gerenciar assinatura (pro only) */}
        {plan === "pro" && <ManageSubscriptionButton />}

        {/* Instalar app (mobile only) */}
        <InstallAppButton />

        {/* Notificações */}
        <NotificationButton />

      </div>

    </div>
  );
}

function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: 16, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, width: "100%", cursor: "pointer", opacity: loading ? 0.6 : 1 }}
    >
      <span style={{ fontSize: "1.4rem" }}>💳</span>
      <div style={{ flex: 1, textAlign: "left" }}>
        <p style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--white)", margin: 0 }}>Gerenciar assinatura</p>
        <p style={{ fontSize: "0.7rem", color: "var(--gray2)", margin: "2px 0 0" }}>Cancelar, trocar método de pagamento e mais</p>
      </div>
      <span style={{ fontSize: "0.85rem", color: "var(--gray2)" }}>{loading ? "..." : "→"}</span>
    </button>
  );
}

function NotificationButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "denied" | "unsupported" | "ios-safari">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detecta iOS Safari fora do PWA
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|OPiOS/.test(navigator.userAgent);
    const isStandalone = (window.navigator as any).standalone === true;

    if (isIOS && isSafari && !isStandalone) {
      setStatus("ios-safari");
      return;
    }

    if (!("Notification" in window)) { setStatus("unsupported"); return; }
    if (Notification.permission === "denied") { setStatus("denied"); return; }
    // Se já tem permissão, tenta registrar o token automaticamente
    if (Notification.permission === "granted") setStatus("idle");
  }, []);

  async function enable() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    setStatus("loading");
    setErrorMsg(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setStatus("denied"); return; }

      // Web Push nativo para todos (iOS e Android) — evita dependência do Firebase no browser
      const sw = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      await navigator.serviceWorker.ready;

      const vapidPublicKey = process.env.NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY!;
      const keyBytes = Uint8Array.from(atob(vapidPublicKey.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

      const existingSub = await sw.pushManager.getSubscription();
      if (existingSub) await existingSub.unsubscribe();

      const subscription = await sw.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes,
      });
      await fetch("/api/webpush/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      setStatus("done");
    } catch (err: any) {
      setErrorMsg(err?.message ?? String(err));
      setStatus("idle");
    }
  }

  if (status === "unsupported") return null;

  // iOS Safari fora do PWA — instrução para instalar
  if (status === "ios-safari") {
    return (
      <div style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: 16, padding: "16px 18px", display: "flex", alignItems: "flex-start", gap: 14 }}>
        <span style={{ fontSize: "1.4rem" }}>🔔</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--white)", margin: 0 }}>Ativar notificações no iPhone</p>
          <p style={{ fontSize: "0.7rem", color: "var(--gray2)", margin: "6px 0 0", lineHeight: 1.5 }}>
            Para receber notificações, instale o app na tela inicial:{" "}
            <strong style={{ color: "var(--white)" }}>Safari → botão compartilhar</strong>{" "}
            <span style={{ fontSize: "0.85rem" }}>⎙</span>{" "}
            → <strong style={{ color: "var(--white)" }}>Adicionar à Tela de Início</strong>.
            Depois abra o app pela tela inicial e volte aqui.
          </p>
        </div>
      </div>
    );
  }

  const label = status === "done" ? "Notificações ativadas ✓"
    : status === "denied" ? "Notificações bloqueadas no browser"
    : status === "loading" ? "Ativando…"
    : "Ativar notificações";

  const subtitle = status === "done" ? "Você receberá alertas de streak e mensagens"
    : status === "denied" ? "Permita nas configurações do browser para ativar"
    : "Receba lembretes de streak e mensagens diretas";

  return (
    <>
      <button
        onClick={status === "idle" ? enable : undefined}
        disabled={status === "loading" || status === "done" || status === "denied"}
        style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: 16, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, width: "100%", cursor: status === "idle" ? "pointer" : "default", opacity: status === "denied" ? 0.5 : 1 }}
      >
        <span style={{ fontSize: "1.4rem" }}>🔔</span>
        <div style={{ flex: 1, textAlign: "left" }}>
          <p style={{ fontSize: "0.85rem", fontWeight: 800, color: status === "done" ? "var(--yellow)" : "var(--white)", margin: 0 }}>{label}</p>
          <p style={{ fontSize: "0.7rem", color: "var(--gray2)", margin: "2px 0 0" }}>{subtitle}</p>
        </div>
        {status === "idle" && <span style={{ fontSize: "0.85rem", color: "var(--gray2)" }}>→</span>}
      </button>
      {errorMsg && (
        <p style={{ fontSize: "0.68rem", color: "#ef4444", margin: "6px 4px 0", wordBreak: "break-all" }}>{errorMsg}</p>
      )}
    </>
  );
}

function InstallAppButton() {
  const [state, setState] = useState<"hidden" | "ios" | "android" | "installed">("hidden");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua);
    const isAndroid = /Android/.test(ua);
    const isStandalone = (navigator as any).standalone === true || window.matchMedia("(display-mode: standalone)").matches;

    if (isStandalone) { setState("installed"); return; }
    if (isIOS) setState("ios");
    else if (isAndroid) setState("android");
  }, []);

  async function installAndroid() {
    if (!(window as any)._deferredPrompt) return;
    (window as any)._deferredPrompt.prompt();
    await (window as any)._deferredPrompt.userChoice;
    (window as any)._deferredPrompt = null;
  }

  if (state === "hidden" || state === "installed") return null;

  if (state === "ios") {
    return (
      <div style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: 16, padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
          <span style={{ fontSize: "1.4rem" }}>📲</span>
          <div>
            <p style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--white)", margin: 0 }}>Adicionar à tela inicial</p>
            <p style={{ fontSize: "0.7rem", color: "var(--gray2)", margin: "2px 0 0" }}>Acesse mais rápido e receba notificações</p>
          </div>
        </div>
        <p style={{ fontSize: "0.72rem", color: "var(--gray2)", margin: 0, lineHeight: 1.6 }}>
          Toque em <strong style={{ color: "var(--white)" }}>Compartilhar ⎙</strong> na barra inferior do Safari e depois em <strong style={{ color: "var(--yellow)" }}>Adicionar à Tela de Início</strong>.
        </p>
      </div>
    );
  }

  return (
    <button
      onClick={installAndroid}
      style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: 16, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, width: "100%", cursor: "pointer" }}
    >
      <span style={{ fontSize: "1.4rem" }}>📲</span>
      <div style={{ flex: 1, textAlign: "left" }}>
        <p style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--white)", margin: 0 }}>Instalar app</p>
        <p style={{ fontSize: "0.7rem", color: "var(--gray2)", margin: "2px 0 0" }}>Adicionar à tela inicial do celular</p>
      </div>
      <span style={{ fontSize: "0.85rem", color: "var(--gray2)" }}>→</span>
    </button>
  );
}

function StatCard({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div style={{ background: "var(--dark2)", borderRadius: 14, padding: "14px 16px" }}>
      <p style={{ fontSize: "1.1rem", margin: 0 }}>{emoji}</p>
      <p style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--gray2)", margin: "6px 0 2px", textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</p>
      <p style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--white)", margin: 0 }}>{value}</p>
    </div>
  );
}
