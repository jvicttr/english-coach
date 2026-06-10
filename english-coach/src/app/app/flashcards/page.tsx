"use client";

import { useState, useEffect } from "react";
import { UserButton } from "@clerk/nextjs";

type Flashcard = {
  id: string;
  word: string;
  translation: string;
  phonetic: string | null;
  example: string | null;
  topic: string | null;
  next_review: string;
};

export default function Flashcards() {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionResults, setSessionResults] = useState({ easy: 0, hard: 0, miss: 0 });
  const [rating, setRating] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/flashcards")
      .then((r) => r.json())
      .then((d) => {
        setCards(d.cards ?? []);
        setPending(d.pending ?? 0);
        setLoading(false);
      });
  }, []);

  async function rate(r: "easy" | "hard" | "miss") {
    const card = cards[currentIndex];
    setRating(r);
    setSessionResults((prev) => ({ ...prev, [r]: prev[r] + 1 }));

    await fetch("/api/flashcards", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: card.id, rating: r }),
    });

    setTimeout(() => {
      setRating(null);
      setFlipped(false);
      if (currentIndex + 1 >= cards.length) {
        setDone(true);
      } else {
        setCurrentIndex((i) => i + 1);
      }
    }, 400);
  }

  const BottomNav = () => (
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0d0d0d", borderTop: "1px solid #1e1e1e", display: "grid", gridTemplateColumns: "repeat(4,1fr)", paddingBottom: "env(safe-area-inset-bottom, 0px)", zIndex: 50 }}>
      {[
        { href: "/app", icon: "🏠", label: "Início", active: false },
        { href: "/app/conversar", icon: "💬", label: "Conversar", active: false },
        { href: "/app/flashcards", icon: "🃏", label: "Flashcards", active: true },
        { href: "/app/progresso", icon: "📊", label: "Progresso", active: false },
      ].map((item) => (
        <a key={item.href} href={item.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 0 10px", textDecoration: "none" }}>
          <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
          <span style={{ fontSize: "0.6rem", fontWeight: 700, color: item.active ? "var(--yellow)" : "#444" }}>{item.label}</span>
        </a>
      ))}
    </nav>
  );

  if (loading) {
    return (
      <div style={{ background: "var(--black)", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 150, 300].map((d) => <span key={d} style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--yellow)", display: "inline-block", animation: `bounce .8s infinite`, animationDelay: `${d}ms` }} />)}
        </div>
        <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }`}</style>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (cards.length === 0) {
    return (
      <div style={{ background: "var(--black)", minHeight: "100dvh", fontFamily: "'Inter', sans-serif", paddingBottom: 70 }}>
        <header style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1e1e1e" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href="/app" style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "36px", width: 36, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </a>
            <span style={{ fontWeight: 800, color: "#fff", fontSize: "0.95rem" }}>🃏 Flashcards</span>
          </div>
          <UserButton />
        </header>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", textAlign: "center", padding: "0 24px", gap: 16 }}>
          <div style={{ fontSize: "3rem" }}>🃏</div>
          <h2 style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Nenhum flashcard ainda</h2>
          <p style={{ color: "var(--gray)", fontSize: "0.875rem", lineHeight: 1.6, margin: 0 }}>
            Seus flashcards ficam salvos aqui. Para criar, encerre uma conversa e escolha <strong style={{ color: "var(--white)" }}>Criar flashcards</strong>.
          </p>
          <a href="/app/conversar" style={{ background: "var(--yellow)", color: "#000", padding: "0.75rem 2rem", borderRadius: "50px", textDecoration: "none", fontWeight: 800, fontSize: "0.9rem" }}>
            Começar uma conversa
          </a>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── Session done ─────────────────────────────────────────────────────────
  if (done) {
    const total = sessionResults.easy + sessionResults.hard + sessionResults.miss;
    return (
      <div style={{ background: "var(--black)", minHeight: "100dvh", fontFamily: "'Inter', sans-serif", paddingBottom: 70 }}>
        <header style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1e1e1e" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href="/app" style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "36px", width: 36, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </a>
            <span style={{ fontWeight: 800, color: "#fff", fontSize: "0.95rem" }}>🃏 Flashcards</span>
          </div>
          <UserButton />
        </header>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", textAlign: "center", padding: "0 24px", gap: 20 }}>
          <div style={{ fontSize: "3rem" }}>🎉</div>
          <h2 style={{ color: "#fff", fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>Revisão concluída!</h2>
          <p style={{ color: "var(--gray)", fontSize: "0.875rem", margin: 0 }}>Você revisou {total} palavra{total !== 1 ? "s" : ""} hoje.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, width: "100%", maxWidth: 320 }}>
            {[
              { label: "Sabia bem", count: sessionResults.easy, color: "#4ade80", bg: "rgba(74,222,128,.1)" },
              { label: "Foi difícil", count: sessionResults.hard, color: "var(--yellow)", bg: "rgba(245,200,0,.1)" },
              { label: "Errei", count: sessionResults.miss, color: "#f87171", bg: "rgba(248,113,113,.1)" },
            ].map((item) => (
              <div key={item.label} style={{ background: item.bg, border: `1px solid ${item.color}33`, borderRadius: 14, padding: "12px 8px", textAlign: "center" }}>
                <p style={{ fontSize: "1.5rem", fontWeight: 900, color: item.color, margin: 0 }}>{item.count}</p>
                <p style={{ fontSize: "0.65rem", color: item.color, fontWeight: 600, marginTop: 2 }}>{item.label}</p>
              </div>
            ))}
          </div>
          {pending > total && (
            <p style={{ color: "var(--gray)", fontSize: "0.8rem" }}>
              Ainda há {pending - total} palavra{pending - total !== 1 ? "s" : ""} para revisar hoje.
            </p>
          )}
          <a href="/app" style={{ background: "var(--yellow)", color: "#000", padding: "0.75rem 2rem", borderRadius: "50px", textDecoration: "none", fontWeight: 800, fontSize: "0.9rem" }}>
            Voltar ao início
          </a>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── Card review ──────────────────────────────────────────────────────────
  const card = cards[currentIndex];
  const progress = ((currentIndex) / cards.length) * 100;

  return (
    <div style={{ background: "var(--black)", minHeight: "100dvh", fontFamily: "'Inter', sans-serif", paddingBottom: 70, display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1e1e1e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/app" style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "36px", width: 36, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
          <span style={{ fontWeight: 800, color: "#fff", fontSize: "0.95rem" }}>🃏 Flashcards</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "0.78rem", color: "var(--gray)", fontWeight: 600 }}>{currentIndex + 1} / {cards.length}</span>
          <UserButton />
        </div>
      </header>

      {/* Progress bar */}
      <div style={{ height: 3, background: "var(--dark2)" }}>
        <div style={{ height: 3, background: "var(--yellow)", width: `${progress}%`, transition: "width .3s ease" }} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", gap: 20 }}>

        {/* Card */}
        <div
          onClick={() => !rating && setFlipped((v) => !v)}
          style={{
            width: "100%", maxWidth: 400, minHeight: 240,
            background: flipped ? "#111" : "var(--dark1)",
            border: `1px solid ${flipped ? "rgba(245,200,0,.25)" : "#2a2a2a"}`,
            borderRadius: 20,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "28px 24px", textAlign: "center", cursor: rating ? "default" : "pointer",
            transition: "all .25s ease",
            opacity: rating ? 0.5 : 1,
            gap: 12,
          }}
        >
          {!flipped ? (
            <>
              <p style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--gray)", marginBottom: 8 }}>
                {card.topic ? `#${card.topic}` : "vocabulário"}
              </p>
              <p style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff", margin: 0 }}>{card.word}</p>
              <p style={{ fontSize: "0.75rem", color: "var(--gray)", marginTop: 4 }}>Toque para ver a tradução</p>
            </>
          ) : (
            <>
              <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--yellow)", letterSpacing: ".05em", marginBottom: 4 }}>{card.word}</p>
              <p style={{ fontSize: "1.4rem", fontWeight: 800, color: "#fff", margin: 0 }}>{card.translation}</p>
              {card.phonetic && (
                <p style={{ fontSize: "0.8rem", color: "#60a5fa", fontStyle: "italic", marginTop: 4 }}>🗣️ {card.phonetic}</p>
              )}
              {card.example && (
                <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(255,255,255,.04)", borderRadius: 10, border: "1px solid #2a2a2a" }}>
                  <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,.65)", lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>"{card.example}"</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Rating buttons — only show after flip */}
        {flipped && !rating && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, width: "100%", maxWidth: 400 }}>
            {[
              { r: "miss" as const, label: "Errei", emoji: "😅", color: "#f87171", bg: "rgba(248,113,113,.1)", border: "rgba(248,113,113,.3)" },
              { r: "hard" as const, label: "Difícil", emoji: "🤔", color: "var(--yellow)", bg: "rgba(245,200,0,.1)", border: "rgba(245,200,0,.3)" },
              { r: "easy" as const, label: "Sabia!", emoji: "💪", color: "#4ade80", bg: "rgba(74,222,128,.1)", border: "rgba(74,222,128,.3)" },
            ].map((item) => (
              <button
                key={item.r}
                onClick={() => rate(item.r)}
                style={{ background: item.bg, border: `1px solid ${item.border}`, borderRadius: 14, padding: "14px 8px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, transition: "transform .1s" }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                <span style={{ fontSize: "1.3rem" }}>{item.emoji}</span>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: item.color }}>{item.label}</span>
              </button>
            ))}
          </div>
        )}

        {!flipped && (
          <p style={{ fontSize: "0.75rem", color: "var(--gray2)", marginTop: -8 }}>Tente lembrar a tradução antes de virar</p>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
