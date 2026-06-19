"use client";

import { useState, useEffect } from "react";
import { TIERS, getTier as getTierFromXp } from "@/lib/tiers";

type TierInfo = { id: string; label: string; emoji: string; color: string; min: number; max: number };

type BadgeData = {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  xpReward: number;
  earned: boolean;
  earned_at: string | null;
};

type RankingEntry = {
  position: number;
  userId: string;
  displayName: string;
  totalXp: number;
  tier: TierInfo;
  isMe: boolean;
};

type ConquistasData = {
  totalXp: number;
  tier: TierInfo;
  nextTier: TierInfo | null;
  badges: BadgeData[];
  messageCount: number;
  flashcardReviews: number;
};

type RankingData = {
  ranking: RankingEntry[];
  myPosition: number | null;
  myXp: number;
};

export default function ConquistasPage() {
  const [data, setData] = useState<ConquistasData | null>(null);
  const [ranking, setRanking] = useState<RankingData | null>(null);
  const [tab, setTab] = useState<"badges" | "ranking">("badges");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/conquistas").then((r) => r.json()),
      fetch("/api/ranking").then((r) => r.json()),
    ]).then(([c, r]) => {
      setData(c);
      setRanking(r);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div style={{ background: "var(--black)", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", paddingTop: 65 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 150, 300].map((d) => (
            <span key={d} style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--yellow)", display: "inline-block", animation: "bounce .8s infinite", animationDelay: `${d}ms` }} />
          ))}
        </div>
        <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>
      </div>
    );
  }

  if (!data) return null;

  const { totalXp, tier, nextTier, badges } = data;
  const tierProgress = nextTier ? ((totalXp - tier.min) / (nextTier.min - tier.min)) * 100 : 100;
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div className="app-scroll" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", paddingTop: 65, paddingBottom: 80 }}>
      <style>{`
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes popIn { from{opacity:0;transform:scale(.85)} to{opacity:1;transform:scale(1)} }
      `}</style>

      <div style={{ padding: "10px 16px", borderBottom: "1px solid #1e1e1e" }}>
        <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff" }}>🏅 Conquistas</span>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 0" }}>

        {/* Tier Card */}
        <div style={{ marginBottom: 20, padding: "20px", borderRadius: 20, border: `1px solid ${tier.color}40`, background: `${tier.color}0d`, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at top right, ${tier.color}18 0%, transparent 60%)`, pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: "3.2rem", lineHeight: 1 }}>{tier.emoji}</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "0.7rem", fontWeight: 700, color: tier.color, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Tier atual</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 900, color: "#fff", lineHeight: 1 }}>{tier.label}</p>
              <p style={{ fontSize: "0.8rem", fontWeight: 700, color: tier.color, marginTop: 4 }}>{totalXp.toLocaleString("pt-BR")} XP</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "0.65rem", color: "var(--gray)", marginBottom: 4 }}>{earnedCount}/{badges.length} badges</p>
            </div>
          </div>

          {/* Progress to next tier */}
          {nextTier && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: "0.65rem", color: "var(--gray)" }}>{tier.label}</span>
                <span style={{ fontSize: "0.65rem", color: "var(--gray)" }}>{nextTier.emoji} {nextTier.label} — {nextTier.min.toLocaleString("pt-BR")} XP</span>
              </div>
              <div style={{ height: 6, background: "#1f1f1f", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: 6, background: tier.color, borderRadius: 99, width: `${Math.min(100, tierProgress)}%`, transition: "width .8s ease" }} />
              </div>
              <p style={{ fontSize: "0.65rem", color: "var(--gray)", marginTop: 4, textAlign: "right" }}>
                faltam {(nextTier.min - totalXp).toLocaleString("pt-BR")} XP para {nextTier.label}
              </p>
            </div>
          )}
          {!nextTier && (
            <div style={{ marginTop: 12, padding: "6px 12px", background: `${tier.color}20`, border: `1px solid ${tier.color}40`, borderRadius: 50, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: "0.75rem" }}>✨</span>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: tier.color }}>Tier máximo atingido!</span>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 20 }}>
          {[
            { label: "Mensagens", value: data.messageCount.toLocaleString("pt-BR"), emoji: "💬" },
            { label: "Flashcards", value: data.flashcardReviews.toLocaleString("pt-BR"), emoji: "🃏" },
            { label: "Total XP", value: totalXp.toLocaleString("pt-BR"), emoji: "⚡" },
          ].map((s) => (
            <div key={s.label} style={{ background: "var(--dark1)", border: "1px solid #1f1f1f", borderRadius: 14, padding: "12px 10px", textAlign: "center" }}>
              <p style={{ fontSize: "1.1rem", marginBottom: 4 }}>{s.emoji}</p>
              <p style={{ fontSize: "1rem", fontWeight: 800, color: "#fff" }}>{s.value}</p>
              <p style={{ fontSize: "0.6rem", color: "var(--gray)", marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {(["badges", "ranking"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{ flex: 1, padding: "8px", borderRadius: 10, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", border: "none", fontFamily: "'Inter', sans-serif", background: tab === t ? "var(--yellow)" : "var(--dark1)", color: tab === t ? "var(--black)" : "var(--gray)", transition: "all .15s" }}
            >
              {t === "badges" ? `🏅 Badges (${earnedCount}/${badges.length})` : "🏆 Ranking"}
            </button>
          ))}
        </div>

        {/* Badges Tab */}
        {tab === "badges" && (
          <div>
            {/* Earned */}
            {badges.filter((b) => b.earned).length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--yellow)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Conquistados</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                  {badges.filter((b) => b.earned).map((badge) => (
                    <div key={badge.id} style={{ background: "var(--dark1)", border: "1px solid rgba(245,200,0,0.25)", borderRadius: 14, padding: "14px 10px", textAlign: "center", animation: "popIn .3s ease" }}>
                      <p style={{ fontSize: "1.8rem", marginBottom: 6 }}>{badge.emoji}</p>
                      <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>{badge.title}</p>
                      <p style={{ fontSize: "0.58rem", color: "var(--gray)", marginTop: 3, lineHeight: 1.3 }}>{badge.desc}</p>
                      <p style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--yellow)", marginTop: 5 }}>+{badge.xpReward} XP</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Locked */}
            {badges.filter((b) => !b.earned).length > 0 && (
              <div>
                <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--gray2)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Bloqueados</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                  {badges.filter((b) => !b.earned).map((badge) => (
                    <div key={badge.id} style={{ background: "var(--dark1)", border: "1px solid #1f1f1f", borderRadius: 14, padding: "14px 10px", textAlign: "center", opacity: 0.45 }}>
                      <p style={{ fontSize: "1.8rem", marginBottom: 6, filter: "grayscale(1)" }}>{badge.emoji}</p>
                      <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--gray)", lineHeight: 1.3 }}>{badge.title}</p>
                      <p style={{ fontSize: "0.58rem", color: "var(--gray2)", marginTop: 3, lineHeight: 1.3 }}>{badge.desc}</p>
                      <p style={{ fontSize: "0.6rem", fontWeight: 700, color: "#333", marginTop: 5 }}>+{badge.xpReward} XP</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ranking Tab */}
        {tab === "ranking" && ranking && (
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ranking.ranking.map((entry) => (
                <div
                  key={entry.userId}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14,
                    background: entry.isMe ? "rgba(245,200,0,0.08)" : "var(--dark1)",
                    border: `1px solid ${entry.isMe ? "rgba(245,200,0,0.35)" : "#1f1f1f"}`,
                    transition: "all .15s",
                  }}
                >
                  {/* Position */}
                  <div style={{ width: 28, textAlign: "center", flexShrink: 0 }}>
                    {entry.position <= 3 ? (
                      <span style={{ fontSize: "1.2rem" }}>{["🥇","🥈","🥉"][entry.position - 1]}</span>
                    ) : (
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--gray)" }}>#{entry.position}</span>
                    )}
                  </div>

                  {/* Tier emoji */}
                  <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{entry.tier.emoji}</span>

                  {/* Name */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "0.82rem", fontWeight: 700, color: entry.isMe ? "var(--yellow)" : "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.displayName}{entry.isMe && " (você)"}
                    </p>
                    <p style={{ fontSize: "0.65rem", color: entry.tier.color, fontWeight: 600 }}>{entry.tier.label}</p>
                  </div>

                  {/* XP */}
                  <p style={{ fontSize: "0.82rem", fontWeight: 800, color: entry.isMe ? "var(--yellow)" : "var(--gray)", flexShrink: 0 }}>
                    {entry.totalXp.toLocaleString("pt-BR")} XP
                  </p>
                </div>
              ))}

              {/* User outside top 10 */}
              {ranking.myPosition && (
                <>
                  <div style={{ textAlign: "center", padding: "6px 0" }}>
                    <span style={{ fontSize: "0.65rem", color: "var(--gray2)" }}>· · ·</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, background: "rgba(245,200,0,0.08)", border: "1px solid rgba(245,200,0,0.35)" }}>
                    <div style={{ width: 28, textAlign: "center" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--gray)" }}>#{ranking.myPosition}</span>
                    </div>
                    <span style={{ fontSize: "1.1rem" }}>{getTierFromXp(ranking.myXp).emoji}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--yellow)" }}>Você</p>
                      <p style={{ fontSize: "0.65rem", color: getTierFromXp(ranking.myXp).color, fontWeight: 600 }}>{getTierFromXp(ranking.myXp).label}</p>
                    </div>
                    <p style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--yellow)" }}>{ranking.myXp.toLocaleString("pt-BR")} XP</p>
                  </div>
                </>
              )}
            </div>

            <p style={{ textAlign: "center", marginTop: 16, fontSize: "0.65rem", color: "var(--gray2)" }}>
              Ranking atualizado em tempo real · {ranking.ranking.length} jogadores no top 10
            </p>
          </div>
        )}

        <div style={{ height: 32 }} />
      </div>

    </div>
  );
}

