"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

export default function DescontoPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [percent, setPercent] = useState<number | null>(null);
  const [couponOk, setCouponOk] = useState<boolean | null>(null);

  // Save coupon to localStorage as soon as page loads
  useEffect(() => {
    if (!codigo) return;
    localStorage.setItem("jv_coupon", codigo);

    // Validate coupon via Stripe (optional visual check)
    fetch(`/api/coupon-info?id=${codigo}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) { setPercent(d.percent); setCouponOk(true); }
        else setCouponOk(false);
      })
      .catch(() => setCouponOk(true)); // assume valid if check fails
  }, [codigo]);

  async function handleAssinar() {
    setLoading(true);
    setErro("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coupon: codigo }),
      });
      const data = await res.json();
      if (data.url) {
        localStorage.removeItem("jv_coupon");
        window.location.href = data.url;
      } else {
        setErro("Não foi possível iniciar o pagamento. Tente novamente.");
      }
    } catch {
      setErro("Erro de conexão. Verifique sua internet.");
    } finally {
      setLoading(false);
    }
  }

  const precoOriginal = 97;
  const precoComDesconto = percent ? Math.round(precoOriginal * (1 - percent / 100)) : null;

  if (!isLoaded) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 150, 300].map((d) => (
            <span key={d} style={{ width: 10, height: 10, borderRadius: "50%", background: "#F5C800", display: "inline-block", animation: `bounce 1s ${d}ms infinite` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.2rem", fontFamily: "'Inter', sans-serif" }}>

      {/* Logo */}
      <div style={{ marginBottom: "2.5rem" }}>
        <div style={{ width: 155, height: 44, overflow: "hidden", position: "relative", margin: "0 auto" }}>
          <img src="/logo-amarelo.png" alt="Fale Inglês JV" style={{ position: "absolute", width: 158, top: "50%", left: 2, transform: "translateY(-50%)" }} />
        </div>
      </div>

      {/* Card */}
      <div style={{ background: "#111111", border: "2px solid #F5C800", borderRadius: 20, padding: "2.5rem 2rem", maxWidth: 420, width: "100%", textAlign: "center" }}>

        {/* Badge */}
        <div style={{ display: "inline-block", background: "rgba(245,200,0,.15)", color: "#F5C800", border: "1px solid rgba(245,200,0,.3)", padding: ".4rem 1rem", borderRadius: 50, fontSize: ".75rem", fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase" as const, marginBottom: "1.2rem" }}>
          🎁 Desconto exclusivo para você
        </div>

        <h1 style={{ fontSize: "1.8rem", fontWeight: 900, color: "#fff", letterSpacing: "-1px", marginBottom: ".75rem" }}>
          Coach IA com<br />
          <span style={{ color: "#F5C800" }}>
            {percent ? `${percent}% de desconto` : "desconto especial"}
          </span>
        </h1>

        {/* Preço */}
        <div style={{ margin: "1.5rem 0", display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
          <span style={{ fontSize: "1rem", color: "#666", textDecoration: "line-through" }}>R$ {precoOriginal}/mês</span>
          <span style={{ fontSize: "2.2rem", fontWeight: 900, color: "#F5C800" }}>
            {precoComDesconto ? `R$ ${precoComDesconto}/mês` : "Preço especial"}
          </span>
        </div>

        {/* Benefícios */}
        <div style={{ textAlign: "left", margin: "1.5rem 0", display: "flex", flexDirection: "column", gap: ".6rem" }}>
          {[
            "Mensagens ilimitadas com o Coach IA",
            "Respostas em áudio — ouça o inglês correto",
            "Correções automáticas de gramática",
            "Disponível 24h por dia, 7 dias por semana",
            "Suporte por WhatsApp",
          ].map((item) => (
            <div key={item} style={{ display: "flex", gap: ".6rem", fontSize: ".9rem", color: "#ccc" }}>
              <span style={{ color: "#F5C800", flexShrink: 0 }}>✓</span> {item}
            </div>
          ))}
        </div>

        {couponOk === false && (
          <div style={{ background: "rgba(248,113,113,.1)", border: "1px solid rgba(248,113,113,.3)", borderRadius: 10, padding: ".75rem 1rem", color: "#f87171", fontSize: ".85rem", marginBottom: "1rem" }}>
            Este link de desconto não é mais válido ou já foi utilizado.
          </div>
        )}

        {erro && (
          <div style={{ background: "rgba(248,113,113,.1)", border: "1px solid rgba(248,113,113,.3)", borderRadius: 10, padding: ".75rem 1rem", color: "#f87171", fontSize: ".85rem", marginBottom: "1rem" }}>
            {erro}
          </div>
        )}

        {/* CTA */}
        {isSignedIn ? (
          <button
            onClick={handleAssinar}
            disabled={loading || couponOk === false}
            style={{ width: "100%", padding: "1rem", borderRadius: 50, background: "#F5C800", border: "none", color: "#000", fontWeight: 800, fontSize: "1rem", cursor: loading || couponOk === false ? "not-allowed" : "pointer", opacity: loading || couponOk === false ? .6 : 1, transition: "opacity .2s", fontFamily: "'Inter', sans-serif" }}
          >
            {loading ? "Redirecionando..." : `Assinar por R$ ${precoComDesconto ?? "..."}/mês`}
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: ".75rem" }}>
            <button
              onClick={() => router.push("/cadastro")}
              style={{ width: "100%", padding: "1rem", borderRadius: 50, background: "#F5C800", border: "none", color: "#000", fontWeight: 800, fontSize: "1rem", cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
            >
              Criar conta e assinar com desconto
            </button>
            <button
              onClick={() => router.push("/entrar")}
              style={{ width: "100%", padding: ".85rem", borderRadius: 50, background: "transparent", border: "1px solid rgba(245,200,0,.3)", color: "#F5C800", fontWeight: 600, fontSize: ".9rem", cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
            >
              Já tenho conta — entrar
            </button>
          </div>
        )}

        <p style={{ marginTop: "1.2rem", fontSize: ".75rem", color: "#555" }}>
          Pagamento seguro via Stripe · Cancele quando quiser · 1 uso por link
        </p>
      </div>
    </div>
  );
}
