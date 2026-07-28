"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";

function Bounce() {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {[0, 150, 300].map((d) => (
        <span key={d} style={{ width: 10, height: 10, borderRadius: "50%", background: "#F5C800", display: "inline-block", animation: `bounce 1s ${d}ms infinite` }} />
      ))}
    </div>
  );
}

function CheckoutSucessoInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn } = useSignIn();
  const [erro, setErro] = useState("");
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [msg, setMsg] = useState("Confirmando seu pagamento...");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const sessionId = params.get("session_id");
        if (!sessionId) {
          setErro("Não encontramos os dados do seu pagamento.");
          return;
        }

        const res = await fetch("/api/checkout-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json();
        if (!res.ok || !data.ticket) {
          throw new Error(data.error || "Não foi possível confirmar o pagamento.");
        }

        setPaymentConfirmed(true);
        setMsg("Entrando na sua conta...");

        const { error: ticketError } = await signIn.ticket({ ticket: data.ticket });
        if (ticketError) throw new Error(ticketError.message || "Não foi possível entrar automaticamente na sua conta.");

        if (signIn.status !== "complete") {
          throw new Error("Não foi possível entrar automaticamente na sua conta.");
        }

        const { error: finalizeError } = await signIn.finalize();
        if (finalizeError) throw new Error(finalizeError.message || "Não foi possível ativar sua sessão.");

        router.replace("/app?sucesso=1");
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro desconhecido. Tente entrar manualmente.");
      }
    })();
  }, [params, router, signIn]);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.2rem", fontFamily: "'Inter', sans-serif", textAlign: "center" }}>
      <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }`}</style>
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ width: 155, height: 44, overflow: "hidden", position: "relative", margin: "0 auto" }}>
          <img src="/logo-amarelo.png" alt="Fale Inglês JV" style={{ position: "absolute", width: 158, top: "50%", left: 2, transform: "translateY(-50%)" }} />
        </div>
      </div>

      {!erro ? (
        <>
          <Bounce />
          <p style={{ color: "#ccc", marginTop: "1.5rem", fontSize: ".95rem" }}>{msg}</p>
        </>
      ) : (
        <div style={{ background: "#111", border: `1px solid ${paymentConfirmed ? "rgba(245,200,0,.3)" : "rgba(248,113,113,.3)"}`, borderRadius: 16, padding: "2rem", maxWidth: 420 }}>
          <p style={{ color: paymentConfirmed ? "#F5C800" : "#f87171", fontWeight: 700, marginBottom: ".5rem" }}>
            {paymentConfirmed ? "🎉 Pagamento confirmado" : "Algo deu errado"}
          </p>
          <p style={{ color: "#ccc", fontSize: ".9rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
            {erro} {paymentConfirmed && "Sua assinatura já está ativa — basta entrar com o e-mail usado no pagamento."}
          </p>
          <button
            onClick={() => router.push("/entrar")}
            style={{ width: "100%", padding: ".9rem", borderRadius: 50, background: "#F5C800", border: "none", color: "#000", fontWeight: 800, fontSize: ".95rem", cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
          >
            Entrar na minha conta
          </button>
        </div>
      )}
    </div>
  );
}

export default function CheckoutSucessoPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Bounce />
      </div>
    }>
      <CheckoutSucessoInner />
    </Suspense>
  );
}
