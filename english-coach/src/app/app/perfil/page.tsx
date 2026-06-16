"use client";

import { useState, useEffect } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { BottomNavFixed } from "@/components/BottomNav";

type ProfileData = {
  isPro: boolean;
  streak: number;
  totalXp: number;
  tier: { label: string; min: number };
  nextTier: { label: string; min: number } | null;
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

  useEffect(() => {
    Promise.all([
      fetch("/api/me").then((r) => r.json()),
      fetch("/api/home").then((r) => r.json()),
    ]).then(([me, home]) => {
      setPlan(me.plan ?? "free");
      setLevel(me.level ?? localStorage.getItem("userLevel") ?? "intermediate");
      setData(home);
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

  const levelInfo = level ? LEVEL_INFO[level] : null;
  const xpToNext = data?.nextTier ? data.nextTier.min - (data.totalXp ?? 0) : null;
  const xpPct = data?.nextTier
    ? Math.min(100, Math.round(((data.totalXp - data.tier.min) / (data.nextTier.min - data.tier.min)) * 100))
    : 100;

  return (
    <div style={{ background: "var(--black)", minHeight: "100dvh", fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ width: "100%", maxWidth: 672, padding: "18px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "1rem", fontWeight: 800, color: "var(--white)" }}>Perfil</span>
        <UserButton />
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
            <p style={{ fontSize: "0.72rem", color: "var(--gray2)", margin: "2px 0 0" }}>
              {user?.primaryEmailAddress?.emailAddress ?? ""}
            </p>
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

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <StatCard emoji="🔥" label="Sequência" value={data ? `${data.streak} dia${data.streak !== 1 ? "s" : ""}` : "—"} />
          <StatCard emoji="⚡" label="XP total" value={data ? `${data.totalXp} XP` : "—"} />
          <StatCard emoji="🏅" label="Ranking" value={data?.tier?.label ?? "—"} />
          <StatCard emoji="🗺️" label="Etapas na trilha" value={data ? `${data.trilhaCompleted.length}` : "—"} />
        </div>

        {/* XP progress */}
        {data && (
          <div style={{ background: "var(--dark2)", borderRadius: 16, padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--white)" }}>🏅 {data.tier.label}</span>
              {data.nextTier && (
                <span style={{ fontSize: "0.65rem", color: "var(--gray2)" }}>{xpToNext} XP para {data.nextTier.label}</span>
              )}
            </div>
            <div style={{ height: 7, background: "#1e1e1e", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${xpPct}%`, background: "linear-gradient(90deg, #F5C800, #e0a800)", borderRadius: 99, transition: "width 0.6s" }} />
            </div>
            <p style={{ fontSize: "0.65rem", color: "var(--gray2)", margin: "6px 0 0", textAlign: "right" }}>{data.totalXp} XP</p>
          </div>
        )}

        {/* Upgrade (free only) */}
        {plan === "free" && (
          <a href="/planos" style={{ background: "rgba(245,200,0,.06)", border: "1px solid rgba(245,200,0,.3)", borderRadius: 16, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, textDecoration: "none" }}>
            <span style={{ fontSize: "1.6rem" }}>⭐</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--yellow)", margin: 0 }}>Assine o JV IA PRO</p>
              <p style={{ fontSize: "0.7rem", color: "rgba(245,200,0,.65)", margin: "2px 0 0" }}>Trilha, roleplay, flashcards e sem limites — R$ 47/mês</p>
            </div>
            <span style={{ fontSize: "0.85rem", color: "var(--yellow)" }}>→</span>
          </a>
        )}

      </div>

      <BottomNavFixed />
    </div>
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
