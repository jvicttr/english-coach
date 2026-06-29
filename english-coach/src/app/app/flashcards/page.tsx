"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Flashcard = {
  id: string;
  word: string;
  translation: string;
  phonetic: string | null;
  example: string | null;
  example_translation: string | null;
  topic: string | null;
  pack_id: string | null;
  pack_name: string | null;
  next_review: string;
  created_at: string;
  ease_factor: number | null;
  interval: number | null;
};

type Pack = {
  pack_id: string;
  pack_name: string;
  created_at: string;
  cards: Flashcard[];
};

export default function Flashcards() {
  const router = useRouter();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);

  // Review state
  const [activePack, setActivePack] = useState<Pack | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionResults, setSessionResults] = useState({ easy: 0, hard: 0, miss: 0 });
  const [rating, setRating] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showExampleTranslation, setShowExampleTranslation] = useState(false);
  const [exampleTranslationText, setExampleTranslationText] = useState<string | null>(null);
  const [loadingTranslation, setLoadingTranslation] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function getAudio() {
    if (!audioRef.current) audioRef.current = new Audio();
    return audioRef.current;
  }

  async function speak(text: string, lang: "en" | "pt" = "en") {
    if (isSpeaking) return;
    setIsSpeaking(true);
    let url: string | null = null;
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, speed: 0.9, lang }),
      });
      if (!res.ok) { setIsSpeaking(false); return; }
      const blob = await res.blob();
      url = URL.createObjectURL(blob);
      // Always create a fresh Audio element to avoid reuse conflicts
      const player = new Audio(url);
      player.onended = () => { setIsSpeaking(false); if (url) URL.revokeObjectURL(url); };
      player.onerror = () => { setIsSpeaking(false); if (url) URL.revokeObjectURL(url); };
      audioRef.current = player;
      await player.play();
    } catch {
      setIsSpeaking(false);
      if (url) URL.revokeObjectURL(url);
    }
  }

  useEffect(() => {
    fetch("/api/flashcards")
      .then((r) => {
        if (r.status === 403) { router.replace("/planos"); return null; }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setPacks(d.packs ?? []);
        setLoading(false);
      });
  }, [router]);

  function startPack(pack: Pack) {
    // Sort: hardest cards first (lowest ease_factor = most missed), then by next_review ascending
    const sorted = [...pack.cards].sort((a, b) => {
      const aHard = (a.ease_factor ?? 2.5) < 1.6 ? 0 : 1;
      const bHard = (b.ease_factor ?? 2.5) < 1.6 ? 0 : 1;
      if (aHard !== bHard) return aHard - bHard;
      return (a.ease_factor ?? 2.5) - (b.ease_factor ?? 2.5);
    });
    setActivePack({ ...pack, cards: sorted });
    setCurrentIndex(0);
    setFlipped(false);
    setDone(false);
    setSessionResults({ easy: 0, hard: 0, miss: 0 });
    setRating(null);
  }

  function backToList() {
    setActivePack(null);
    setDone(false);
  }

  async function fetchExampleTranslation(cardId: string, example: string, savedTranslation: string | null) {
    if (savedTranslation) {
      setExampleTranslationText(savedTranslation);
      setShowExampleTranslation(true);
      return;
    }
    setLoadingTranslation(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `Translate this English sentence to Brazilian Portuguese. Reply with ONLY the translation, nothing else: "${example}"` }],
          level: "intermediate",
          topic: "free",
        }),
      });
      const data = await res.json();
      const raw: string = data.reply ?? "";
      const match = raw.match(/\[PT:\s*([\s\S]+?)\]/);
      const translation = match ? match[1].trim() : raw.split("\n")[0].trim();
      setExampleTranslationText(translation);
      setShowExampleTranslation(true);
      // Persist to DB and update local state
      fetch("/api/flashcards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cardId, example_translation: translation }),
      });
      setActivePack((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: prev.cards.map((c) => c.id === cardId ? { ...c, example_translation: translation } : c),
        };
      });
    } catch {
      setExampleTranslationText("(erro ao traduzir)");
      setShowExampleTranslation(true);
    } finally {
      setLoadingTranslation(false);
    }
  }

  async function deletePack(pack: Pack, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Apagar o pack "${pack.pack_name}" e todas as suas palavras?`)) return;
    await fetch("/api/flashcards", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack_id: pack.pack_id }),
    });
    setPacks((prev) => prev.filter((p) => p.pack_id !== pack.pack_id));
  }

  async function rate(r: "easy" | "hard" | "miss") {
    if (!activePack) return;
    const card = activePack.cards[currentIndex];
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
      setShowExampleTranslation(false);
      setExampleTranslationText(null);
      if (currentIndex + 1 >= activePack.cards.length) {
        setDone(true);
      } else {
        setCurrentIndex((i) => i + 1);
      }
    }, 400);
  }


  const Header = ({ onBack, title, right }: { onBack?: () => void; title: string; right?: React.ReactNode }) => (
    <div style={{ padding: "10px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1e1e1e" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onBack && (
          <button onClick={onBack} style={{ background: "var(--dark2)", border: "1px solid #2a2a2a", borderRadius: "10px", height: "32px", width: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7L9 12" stroke="var(--gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
        <span style={{ fontWeight: 800, color: "#fff", fontSize: "0.9rem" }}>{title}</span>
      </div>
      {right}
    </div>
  );

  if (loading) {
    return (
      <div className="app-scroll" style={{ background: "var(--black)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 150, 300].map((d) => <span key={d} style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--yellow)", display: "inline-block", animation: "bounce .8s infinite", animationDelay: `${d}ms` }} />)}
        </div>
        <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }`}</style>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (packs.length === 0) {
    return (
      <div className="app-scroll" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", paddingTop: "calc(65px + env(safe-area-inset-top))", paddingBottom: 70 }}>
        <Header title="🃏 Flashcards" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", textAlign: "center", padding: "0 24px", gap: 16 }}>
          <div style={{ fontSize: "3rem" }}>🃏</div>
          <h2 style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Nenhum flashcard ainda</h2>
          <p style={{ color: "var(--gray)", fontSize: "0.875rem", lineHeight: 1.6, margin: 0 }}>
            Seus packs ficam salvos aqui. Para criar, encerre uma conversa e escolha <strong style={{ color: "var(--white)" }}>Criar flashcards</strong>.
          </p>
          <a href="/app/conversar" style={{ background: "var(--yellow)", color: "#000", padding: "0.75rem 2rem", borderRadius: "50px", textDecoration: "none", fontWeight: 800, fontSize: "0.9rem" }}>
            Começar uma conversa
          </a>
        </div>
      </div>
    );
  }

  // ── Session done ─────────────────────────────────────────────────────────
  if (done && activePack) {
    const total = sessionResults.easy + sessionResults.hard + sessionResults.miss;
    return (
      <div className="app-scroll" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", paddingTop: "calc(65px + env(safe-area-inset-top))", paddingBottom: 70 }}>
        <Header onBack={backToList} title="🃏 Flashcards" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", textAlign: "center", padding: "0 24px", gap: 20 }}>
          <div style={{ fontSize: "3rem" }}>🎉</div>
          <h2 style={{ color: "#fff", fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>Pack revisado!</h2>
          <p style={{ color: "var(--gray)", fontSize: "0.875rem", margin: 0 }}>
            Você revisou {total} palavra{total !== 1 ? "s" : ""} de <strong style={{ color: "#fff" }}>{activePack.pack_name}</strong>.
          </p>
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
          <button onClick={backToList} style={{ background: "var(--yellow)", color: "#000", padding: "0.75rem 2rem", borderRadius: "50px", border: "none", fontWeight: 800, fontSize: "0.9rem", cursor: "pointer" }}>
            Ver todos os packs
          </button>
        </div>
      </div>
    );
  }

  // ── Card review ──────────────────────────────────────────────────────────
  if (activePack) {
    const card = activePack.cards[currentIndex];
    const progress = (currentIndex / activePack.cards.length) * 100;
    return (
      <div className="app-scroll" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", paddingTop: "calc(65px + env(safe-area-inset-top))", paddingBottom: 70, display: "flex", flexDirection: "column" }}>
        <Header
          onBack={backToList}
          title={`🃏 ${activePack.pack_name}`}
          right={<span style={{ fontSize: "0.78rem", color: "var(--gray)", fontWeight: 600 }}>{currentIndex + 1} / {activePack.cards.length}</span>}
        />
        <div style={{ height: 3, background: "var(--dark2)" }}>
          <div style={{ height: 3, background: "var(--yellow)", width: `${progress}%`, transition: "width .3s ease" }} />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", gap: 20 }}>
          <div
            onClick={() => !rating && setFlipped((v) => !v)}
            style={{ width: "100%", maxWidth: 400, minHeight: 240, background: flipped ? "#111" : "var(--dark1)", border: `1px solid ${flipped ? "rgba(245,200,0,.25)" : "#2a2a2a"}`, borderRadius: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px 24px", textAlign: "center", cursor: rating ? "default" : "pointer", transition: "all .25s ease", opacity: rating ? 0.5 : 1, gap: 12 }}
          >
            {!flipped ? (
              <>
                <p style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--gray)", marginBottom: 8 }}>
                  {card.topic ? `#${card.topic}` : "vocabulário"}
                </p>
                <p style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff", margin: 0 }}>{card.word}</p>
                <button
                  onClick={(e) => { e.stopPropagation(); speak(card.word); }}
                  disabled={isSpeaking}
                  style={{ marginTop: 10, background: "transparent", border: "1px solid #3a3a3a", borderRadius: "50px", padding: "4px 14px", fontSize: "0.72rem", color: isSpeaking ? "var(--gray2)" : "var(--gray)", cursor: isSpeaking ? "default" : "pointer", display: "flex", alignItems: "center", gap: 5, opacity: isSpeaking ? 0.5 : 1 }}
                >
                  🔊 Ouvir pronúncia
                </button>
                <p style={{ fontSize: "0.72rem", color: "var(--gray2)", marginTop: 8, opacity: 0.6 }}>Toque no card para ver a tradução</p>
              </>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--yellow)", letterSpacing: ".05em", margin: 0 }}>{card.word}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); speak(card.word); }}
                    disabled={isSpeaking}
                    title="Ouvir palavra"
                    style={{ background: "transparent", border: "1px solid rgba(245,200,0,.3)", borderRadius: "50px", padding: "2px 10px", fontSize: "0.68rem", color: "var(--yellow)", cursor: isSpeaking ? "default" : "pointer", opacity: isSpeaking ? 0.4 : 1 }}
                  >
                    🔊
                  </button>
                </div>
                <p style={{ fontSize: "1.4rem", fontWeight: 800, color: "#fff", margin: 0 }}>{card.translation}</p>
                {card.phonetic && <p style={{ fontSize: "0.8rem", color: "#60a5fa", fontStyle: "italic", marginTop: 4 }}>🗣️ {card.phonetic}</p>}
                {card.example && (
                  <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(255,255,255,.04)", borderRadius: 10, border: "1px solid #2a2a2a", width: "100%" }}>
                    <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,.65)", lineHeight: 1.6, margin: "0 0 8px", fontStyle: "italic" }}>"{card.example}"</p>
                    {showExampleTranslation && exampleTranslationText && (
                      <p style={{ fontSize: "0.72rem", color: "var(--gray)", lineHeight: 1.5, margin: "0 0 8px", fontStyle: "italic" }}>🇧🇷 {exampleTranslationText}</p>
                    )}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); speak(card.example!); }}
                        disabled={isSpeaking}
                        style={{ background: "transparent", border: "1px solid #3a3a3a", borderRadius: "50px", padding: "3px 12px", fontSize: "0.68rem", color: "var(--gray)", cursor: isSpeaking ? "default" : "pointer", opacity: isSpeaking ? 0.4 : 1 }}
                      >
                        🔊 Ouvir exemplo
                      </button>
                      {!showExampleTranslation && (
                        <button
                          onClick={(e) => { e.stopPropagation(); fetchExampleTranslation(card.id, card.example!, card.example_translation); }}
                          disabled={loadingTranslation}
                          style={{ background: "transparent", border: "1px solid #3a3a3a", borderRadius: "50px", padding: "3px 12px", fontSize: "0.68rem", color: "var(--gray)", cursor: loadingTranslation ? "default" : "pointer", opacity: loadingTranslation ? 0.5 : 1 }}
                        >
                          {loadingTranslation ? "..." : "🇧🇷 Ver tradução"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          {flipped && !rating && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, width: "100%", maxWidth: 400 }}>
              {[
                { r: "miss" as const, label: "Errei", emoji: "😅", color: "#f87171", bg: "rgba(248,113,113,.1)", border: "rgba(248,113,113,.3)" },
                { r: "hard" as const, label: "Difícil", emoji: "🤔", color: "var(--yellow)", bg: "rgba(245,200,0,.1)", border: "rgba(245,200,0,.3)" },
                { r: "easy" as const, label: "Sabia!", emoji: "💪", color: "#4ade80", bg: "rgba(74,222,128,.1)", border: "rgba(74,222,128,.3)" },
              ].map((item) => (
                <button key={item.r} onClick={() => rate(item.r)}
                  style={{ background: item.bg, border: `1px solid ${item.border}`, borderRadius: 14, padding: "14px 8px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  <span style={{ fontSize: "1.3rem" }}>{item.emoji}</span>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: item.color }}>{item.label}</span>
                </button>
              ))}
            </div>
          )}
          {!flipped && <p style={{ fontSize: "0.75rem", color: "var(--gray2)", marginTop: -8 }}>Tente lembrar a tradução antes de virar</p>}
        </div>
      </div>
    );
  }

  // ── Pack list ────────────────────────────────────────────────────────────
  const totalWords = packs.reduce((acc, p) => acc + p.cards.length, 0);
  const today = new Date().toISOString().split("T")[0];
  const totalPending = packs.reduce((acc, p) => acc + p.cards.filter((c) => c.next_review <= today).length, 0);

  return (
    <div className="app-scroll" style={{ background: "var(--black)", fontFamily: "'Inter', sans-serif", paddingTop: "calc(65px + env(safe-area-inset-top))", paddingBottom: 80 }}>
      <Header title="🃏 Flashcards" />
      <div style={{ padding: "16px", maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Summary bar */}
        <div style={{ display: "flex", gap: 10, marginBottom: 4 }}>
          <div style={{ flex: 1, background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 12, padding: "10px 14px" }}>
            <p style={{ fontSize: "0.62rem", color: "var(--gray)", margin: "0 0 2px", fontWeight: 600 }}>TOTAL</p>
            <p style={{ fontSize: "1.1rem", fontWeight: 800, color: "#fff", margin: 0 }}>{totalWords} palavras</p>
          </div>
          <div style={{ flex: 1, background: "var(--dark1)", border: "1px solid #1e1e1e", borderRadius: 12, padding: "10px 14px" }}>
            <p style={{ fontSize: "0.62rem", color: "var(--gray)", margin: "0 0 2px", fontWeight: 600 }}>P/ REVISAR</p>
            <p style={{ fontSize: "1.1rem", fontWeight: 800, color: totalPending > 0 ? "#f97316" : "var(--gray)", margin: 0 }}>{totalPending} hoje</p>
          </div>
        </div>

        {packs.map((pack) => {
          const pendingInPack = pack.cards.filter((c) => c.next_review <= today).length;
          const hardInPack = pack.cards.filter((c) => (c.ease_factor ?? 2.5) < 1.6).length;
          const dateLabel = new Date(pack.created_at).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
          return (
            <div key={pack.pack_id} style={{ position: "relative" }}>
            <button
              onClick={() => startPack(pack)}
              style={{ background: "var(--dark1)", border: "1px solid #2a2a2a", borderRadius: 16, padding: "16px", textAlign: "left", cursor: "pointer", width: "100%", transition: "border-color .15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(245,200,0,.35)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", margin: "0 0 4px" }}>{pack.pack_name}</p>
                  <p style={{ fontSize: "0.7rem", color: "var(--gray)", margin: 0 }}>{dateLabel}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--gray)", background: "var(--dark2)", borderRadius: 8, padding: "3px 8px" }}>
                    {pack.cards.length} palavra{pack.cards.length !== 1 ? "s" : ""}
                  </span>
                  {pendingInPack > 0 && (
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#f97316", background: "rgba(249,115,22,.12)", border: "1px solid rgba(249,115,22,.25)", borderRadius: 8, padding: "2px 7px" }}>
                      {pendingInPack} p/ revisar
                    </span>
                  )}
                  {hardInPack > 0 && (
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#f87171", background: "rgba(248,113,113,.1)", border: "1px solid rgba(248,113,113,.2)", borderRadius: 8, padding: "2px 7px" }}>
                      {hardInPack} difícil{hardInPack !== 1 ? "is" : ""}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {pack.cards.slice(0, 4).map((c) => (
                    <span key={c.id} style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.5)", background: "rgba(255,255,255,.05)", borderRadius: 6, padding: "2px 8px" }}>{c.word}</span>
                  ))}
                  {pack.cards.length > 4 && (
                    <span style={{ fontSize: "0.7rem", color: "var(--gray2)", padding: "2px 4px" }}>+{pack.cards.length - 4} mais</span>
                  )}
                </div>
              </div>
            </button>
            <button
              onClick={(e) => deletePack(pack, e)}
              title="Apagar pack"
              style={{ position: "absolute", bottom: 12, right: 12, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 8, cursor: "pointer", padding: "5px 8px", display: "flex", alignItems: "center", gap: 4, transition: "background .15s, border-color .15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(248,113,113,0.22)"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.5)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(248,113,113,0.1)"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.25)"; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
              <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#f87171" }}>Apagar</span>
            </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
