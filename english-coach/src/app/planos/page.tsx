"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PlanosPage() {
  const [loading, setLoading] = useState(false);
  const [isPro, setIsPro] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("userPlan") === "pro";
  });
  const router = useRouter();

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((d) => {
      const pro = d.plan === "pro";
      setIsPro(pro);
      localStorage.setItem("userPlan", d.plan ?? "free");
    });
  }, []);

  async function handleAssinar() {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--black)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.2rem", fontFamily: "'Inter', sans-serif" }}>

      {/* Voltar */}
      <button onClick={() => router.back()} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--gray)", cursor: "pointer", fontSize: ".9rem", marginBottom: "2rem", display: "flex", alignItems: "center", gap: ".4rem" }}>
        ← Voltar
      </button>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "3rem" }}>
        <div style={{ display: "inline-block", background: "rgba(245,200,0,.12)", color: "var(--yellow)", border: "1px solid rgba(245,200,0,.25)", padding: ".4rem 1rem", borderRadius: "50px", fontSize: ".75rem", fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", marginBottom: "1rem" }}>
          Planos
        </div>
        <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.5rem)", fontWeight: 900, color: "var(--white)", letterSpacing: "-1px", marginBottom: ".75rem" }}>
          Escolha seu plano
        </h1>
        <p style={{ color: "var(--gray)", fontSize: "1rem", maxWidth: 480, margin: "0 auto" }}>
          Comece de graça e faça upgrade quando quiser praticar sem limites.
        </p>
      </div>

      {/* Cards */}
      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", justifyContent: "center", width: "100%", maxWidth: 760 }}>

        {/* Grátis */}
        <div style={{ background: "var(--dark1)", border: "1px solid #2a2a2a", borderRadius: "var(--radius)", padding: "2rem", flex: "1 1 300px", maxWidth: 340 }}>
          <div style={{ fontSize: ".8rem", fontWeight: 700, color: "var(--gray)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: ".75rem" }}>Grátis</div>
          <div style={{ fontSize: "2.5rem", fontWeight: 900, color: "var(--white)", marginBottom: ".25rem" }}>R$ 0</div>
          <div style={{ fontSize: ".85rem", color: "var(--gray)", marginBottom: "2rem" }}>para sempre</div>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 2rem", display: "flex", flexDirection: "column", gap: ".75rem" }}>
            {["10 mensagens por dia", "Áudio e correção de gramática", "Detecção automática de nível"].map((f) => (
              <li key={f} style={{ display: "flex", alignItems: "center", gap: ".6rem", fontSize: ".9rem", color: "var(--gray)" }}>
                <span style={{ color: "var(--yellow)" }}>✓</span> {f}
              </li>
            ))}
          </ul>
          <button onClick={() => router.push("/app")} style={{ width: "100%", padding: ".85rem", borderRadius: "50px", background: "var(--dark2)", border: "1px solid #2a2a2a", color: "var(--white)", fontWeight: 700, fontSize: ".95rem", cursor: "pointer" }}>
            Usar grátis
          </button>
        </div>

        {/* JV IA */}
        <div style={{ background: "var(--dark1)", border: "2px solid var(--yellow)", borderRadius: "var(--radius)", padding: "2rem", flex: "1 1 300px", maxWidth: 340, position: "relative" }}>
          <div style={{ position: "absolute", top: "-13px", left: "50%", transform: "translateX(-50%)", background: "var(--yellow)", color: "var(--black)", fontSize: ".72rem", fontWeight: 800, padding: ".3rem .9rem", borderRadius: "50px", whiteSpace: "nowrap" }}>
            {isPro ? "✓ SEU PLANO" : "MAIS POPULAR"}
          </div>
          <div style={{ fontSize: ".8rem", fontWeight: 700, color: "var(--yellow)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: ".75rem" }}>JV IA</div>
          <div style={{ fontSize: "2.5rem", fontWeight: 900, color: "var(--white)", marginBottom: ".25rem" }}>R$ 97</div>
          <div style={{ fontSize: ".85rem", color: "var(--gray)", marginBottom: "2rem" }}>por mês</div>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 2rem", display: "flex", flexDirection: "column", gap: ".75rem" }}>
            {["Conversas ilimitadas", "Role-play em cenários reais", "Flashcards + quizzes", "Revisão de aula com PDF", "Suporte por WhatsApp"].map((f) => (
              <li key={f} style={{ display: "flex", alignItems: "center", gap: ".6rem", fontSize: ".9rem", color: "var(--white)" }}>
                <span style={{ color: "var(--yellow)" }}>✓</span> {f}
              </li>
            ))}
          </ul>
          <button
            onClick={handleAssinar}
            disabled={loading}
            style={{ width: "100%", padding: ".85rem", borderRadius: "50px", background: "var(--yellow)", border: "none", color: "var(--black)", fontWeight: 800, fontSize: ".95rem", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? .7 : 1, transition: "opacity .2s" }}
          >
            {loading ? "Redirecionando..." : "Assinar agora"}
          </button>

          <a
            href="https://wa.me/5561995691219?text=Oi%20JV!%20Tenho%20interesse%20no%20plano%20Coach%20IA%20%F0%9F%91%8B"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: ".5rem", marginTop: ".75rem", width: "100%", padding: ".75rem", borderRadius: "50px", background: "transparent", border: "1px solid rgba(245,200,0,.25)", color: "var(--gray)", fontWeight: 600, fontSize: ".85rem", textDecoration: "none", transition: "border-color .2s" }}
          >
            💬 Tirar dúvidas no WhatsApp
          </a>
        </div>

      </div>

      <p style={{ marginTop: "2rem", fontSize: ".8rem", color: "var(--gray2)", textAlign: "center" }}>
        Pagamento seguro via Stripe · Cancele quando quiser
      </p>
    </div>
  );
}

