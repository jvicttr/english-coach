"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Image from "next/image";

type ShareableLinkState = {
  percent: string;
  label: string;
  loading: boolean;
  url: string | null;
  copied: boolean;
};

type User = {
  id: string;
  name: string;
  email: string;
  imageUrl: string;
  plan: "free" | "pro";
  createdAt: number;
};

const ADMIN_USER_ID = "user_3EzV0DXiskFt0wNSwNSXVHapiBC";

export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [shareable, setShareable] = useState<ShareableLinkState>({ percent: "50", label: "", loading: false, url: null, copied: false });

  useEffect(() => {
    if (!isLoaded) return;
    if (!user || user.id !== ADMIN_USER_ID) {
      router.replace("/app");
    }
  }, [isLoaded, user, router]);

  async function generateShareableLink() {
    setShareable((s) => ({ ...s, loading: true, url: null, copied: false }));
    const res = await fetch("/api/admin/coupon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discountPercent: Number(shareable.percent), label: shareable.label || undefined }),
    });
    const data = await res.json();
    setShareable((s) => ({ ...s, loading: false, url: data.url ?? null }));
  }

  function copyShareableLink() {
    if (!shareable.url) return;
    navigator.clipboard.writeText(shareable.url);
    setShareable((s) => ({ ...s, copied: true }));
    setTimeout(() => setShareable((s) => ({ ...s, copied: false })), 2000);
  }
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  // Discount link state
  const [discountOpen, setDiscountOpen] = useState<string | null>(null);
  const [discountPercent, setDiscountPercent] = useState("50");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/admin/users", { cache: "no-store" })
      .then((r) => {
        if (r.status === 403) throw new Error("Acesso negado.");
        return r.json();
      })
      .then((d) => { setUsers(d.users ?? []); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  async function generateDiscountLink(targetUserId: string) {
    setGeneratingLink(true);
    setGeneratedLink(null);
    setCopied(false);
    const res = await fetch("/api/admin/checkout-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId, discountPercent: Number(discountPercent) }),
    });
    const data = await res.json();
    setGeneratingLink(false);
    if (data.url) setGeneratedLink(data.url);
  }

  function copyLink() {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function togglePlan(userId: string, currentPlan: string) {
    const newPlan = currentPlan === "pro" ? "free" : "pro";
    setUpdating(userId);
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, plan: newPlan }),
    });
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, plan: newPlan as "free" | "pro" } : u));
    setUpdating(null);
  }

  const filtered = users.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const proCount = users.filter((u) => u.plan === "pro").length;

  if (!isLoaded || !user || user.id !== ADMIN_USER_ID) {
    return <div style={{ minHeight: "100vh", background: "var(--black)" }} />;
  }

  return (
    <div style={{ minHeight: "100vh", height: "100dvh", overflowY: "auto", background: "var(--black)", fontFamily: "'Inter', sans-serif", padding: "2rem 1.2rem" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <div style={{ background: "var(--yellow)", color: "var(--black)", fontWeight: 900, fontSize: "0.85rem", padding: "6px 12px", borderRadius: "8px" }}>
              ADMIN
            </div>
            <h1 style={{ color: "var(--white)", fontWeight: 800, fontSize: "1.4rem", margin: 0 }}>Gerenciar Usuários</h1>
          </div>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            <span style={{ color: "var(--gray)", fontSize: "0.85rem" }}>Total: <strong style={{ color: "var(--white)" }}>{users.length}</strong></span>
            <span style={{ color: "var(--gray)", fontSize: "0.85rem" }}>Pro: <strong style={{ color: "var(--yellow)" }}>{proCount}</strong></span>
            <span style={{ color: "var(--gray)", fontSize: "0.85rem" }}>Free: <strong style={{ color: "var(--white)" }}>{users.length - proCount}</strong></span>
          </div>
        </div>

        {/* ── Link compartilhável (sem precisar de usuário cadastrado) ── */}
        <div style={{ background: "var(--dark1)", border: "1px solid rgba(99,179,237,.25)", borderRadius: 14, padding: "1.25rem 1.5rem", marginBottom: "1.5rem" }}>
          <p style={{ color: "#63b3ed", fontWeight: 700, fontSize: ".9rem", marginBottom: ".25rem" }}>🔗 Gerar link de desconto compartilhável</p>
          <p style={{ color: "var(--gray)", fontSize: ".78rem", marginBottom: "1rem" }}>
            Funciona para quem ainda <strong style={{ color: "var(--white)" }}>não tem cadastro</strong>. O aluno clica, cria a conta e o desconto é aplicado automaticamente.
          </p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <input
              placeholder="Nome / aluno (opcional)"
              value={shareable.label}
              onChange={(e) => setShareable((s) => ({ ...s, label: e.target.value, url: null }))}
              style={{ flex: "1 1 140px", padding: "7px 12px", borderRadius: 8, background: "var(--dark2)", border: "1px solid #3a3a3a", color: "var(--white)", fontSize: ".85rem", outline: "none" }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="number" min={1} max={99}
                value={shareable.percent}
                onChange={(e) => setShareable((s) => ({ ...s, percent: e.target.value, url: null }))}
                style={{ width: 56, padding: "7px 10px", borderRadius: 8, background: "var(--dark2)", border: "1px solid #3a3a3a", color: "var(--white)", fontSize: ".85rem", textAlign: "center", outline: "none" }}
              />
              <span style={{ color: "var(--gray)", fontSize: ".85rem" }}>% off</span>
              <span style={{ color: "var(--gray)", fontSize: ".78rem" }}>
                → <strong style={{ color: "var(--yellow)" }}>R$ {Math.round(97 * (1 - Number(shareable.percent) / 100))}/mês</strong>
              </span>
            </div>
            <button
              onClick={generateShareableLink}
              disabled={shareable.loading}
              style={{ padding: "7px 18px", borderRadius: 8, fontSize: ".78rem", fontWeight: 700, cursor: shareable.loading ? "not-allowed" : "pointer", border: "none", background: "#63b3ed", color: "#000", opacity: shareable.loading ? .6 : 1, whiteSpace: "nowrap" }}
            >
              {shareable.loading ? "Gerando..." : "Gerar link"}
            </button>
          </div>

          {shareable.url && (
            <div style={{ marginTop: "10px", display: "flex", gap: 8, alignItems: "center" }}>
              <input
                readOnly value={shareable.url}
                style={{ flex: 1, padding: "6px 10px", borderRadius: 8, background: "var(--dark2)", border: "1px solid #3a3a3a", color: "var(--gray)", fontSize: ".72rem", outline: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              />
              <button
                onClick={copyShareableLink}
                style={{ padding: "6px 14px", borderRadius: 8, fontSize: ".78rem", fontWeight: 700, cursor: "pointer", border: "1px solid #3a3a3a", background: shareable.copied ? "rgba(74,222,128,.2)" : "var(--dark2)", color: shareable.copied ? "#4ade80" : "var(--gray)", whiteSpace: "nowrap" }}
              >
                {shareable.copied ? "✓ Copiado!" : "Copiar"}
              </button>
              <a href={`https://wa.me/?text=${encodeURIComponent("Olá! Aqui está seu desconto exclusivo no JV IA: " + shareable.url)}`} target="_blank" rel="noopener noreferrer"
                style={{ padding: "6px 14px", borderRadius: 8, fontSize: ".78rem", fontWeight: 700, cursor: "pointer", background: "#25d366", color: "#fff", textDecoration: "none", whiteSpace: "nowrap" }}>
                📲 WhatsApp
              </a>
            </div>
          )}
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou email..."
          style={{ width: "100%", padding: "10px 16px", borderRadius: "10px", background: "var(--dark1)", border: "1px solid #2a2a2a", color: "var(--white)", fontSize: "0.9rem", marginBottom: "1rem", outline: "none", boxSizing: "border-box" }}
        />

        {/* Error */}
        {error && (
          <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "10px", padding: "12px 16px", color: "#f87171", marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ color: "var(--gray)", textAlign: "center", padding: "3rem" }}>Carregando...</div>
        )}

        {/* Users list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {filtered.map((u) => (
            <div key={u.id} style={{ borderRadius: "12px", overflow: "hidden", border: `1px solid ${u.plan === "pro" ? "rgba(245,200,0,0.25)" : "#1f1f1f"}` }}>
            <div style={{ background: "var(--dark1)", padding: "14px 16px" }}>
              {/* Row 1: avatar + info + badge */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                <Image
                  src={u.imageUrl}
                  alt={u.name}
                  width={40}
                  height={40}
                  style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: "var(--white)", fontWeight: 600, fontSize: "0.9rem", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</p>
                  <p style={{ color: "var(--gray)", fontSize: "0.78rem", margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</p>
                </div>
                <span style={{ padding: "3px 10px", borderRadius: "50px", fontSize: "0.72rem", fontWeight: 700, background: u.plan === "pro" ? "rgba(245,200,0,0.15)" : "var(--dark2)", color: u.plan === "pro" ? "var(--yellow)" : "var(--gray)", border: u.plan === "pro" ? "1px solid rgba(245,200,0,0.3)" : "1px solid #2a2a2a", flexShrink: 0 }}>
                  {u.plan === "pro" ? "PRO" : "FREE"}
                </span>
              </div>
              {/* Row 2: action buttons */}
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => togglePlan(u.id, u.plan)}
                  disabled={updating === u.id}
                  style={{ flex: 1, padding: "7px 0", borderRadius: "8px", fontSize: "0.78rem", fontWeight: 700, cursor: updating === u.id ? "not-allowed" : "pointer", opacity: updating === u.id ? 0.5 : 1, border: "none", background: u.plan === "pro" ? "rgba(248,113,113,0.15)" : "rgba(245,200,0,0.15)", color: u.plan === "pro" ? "#f87171" : "var(--yellow)" }}
                >
                  {updating === u.id ? "..." : u.plan === "pro" ? "Remover Pro" : "Dar Pro"}
                </button>
                <button
                  onClick={() => {
                    if (discountOpen === u.id) { setDiscountOpen(null); setGeneratedLink(null); }
                    else { setDiscountOpen(u.id); setGeneratedLink(null); setCopied(false); }
                  }}
                  style={{ flex: 1, padding: "7px 0", borderRadius: "8px", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", border: "1px solid rgba(99,179,237,0.3)", background: discountOpen === u.id ? "rgba(99,179,237,0.15)" : "rgba(99,179,237,0.08)", color: "#63b3ed" }}
                >
                  💸 {discountOpen === u.id ? "Fechar" : "Gerar desconto"}
                </button>
              </div>
            </div>{/* end card body */}

            {/* Discount panel */}
            {discountOpen === u.id && (
              <div style={{ margin: "0 16px 14px", padding: "14px", borderRadius: "10px", background: "var(--dark2)", border: "1px solid rgba(99,179,237,0.2)" }}>
                <p style={{ color: "var(--gray)", fontSize: "0.78rem", marginBottom: "10px" }}>
                  Gerar link de assinatura com desconto para <strong style={{ color: "var(--white)" }}>{u.name}</strong>
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={discountPercent}
                      onChange={(e) => { setDiscountPercent(e.target.value); setGeneratedLink(null); }}
                      style={{ width: "60px", padding: "6px 10px", borderRadius: "8px", background: "var(--dark1)", border: "1px solid #3a3a3a", color: "var(--white)", fontSize: "0.85rem", textAlign: "center", outline: "none" }}
                    />
                    <span style={{ color: "var(--gray)", fontSize: "0.85rem" }}>% de desconto</span>
                  </div>
                  <div style={{ color: "var(--gray)", fontSize: "0.78rem" }}>
                    R$ 97 → <strong style={{ color: "var(--yellow)" }}>R$ {(97 * (1 - Number(discountPercent) / 100)).toFixed(0)}/mês</strong>
                  </div>
                  <button
                    onClick={() => generateDiscountLink(u.id)}
                    disabled={generatingLink}
                    style={{ padding: "6px 16px", borderRadius: "8px", fontSize: "0.78rem", fontWeight: 700, cursor: generatingLink ? "not-allowed" : "pointer", border: "none", background: "#63b3ed", color: "#000", opacity: generatingLink ? 0.6 : 1 }}
                  >
                    {generatingLink ? "Gerando..." : "Gerar link"}
                  </button>
                </div>

                {generatedLink && (
                  <div style={{ marginTop: "10px", display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      readOnly
                      value={generatedLink}
                      style={{ flex: 1, padding: "6px 10px", borderRadius: "8px", background: "var(--dark1)", border: "1px solid #3a3a3a", color: "var(--gray)", fontSize: "0.72rem", outline: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    />
                    <button
                      onClick={copyLink}
                      style={{ padding: "6px 14px", borderRadius: "8px", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", border: "1px solid #3a3a3a", background: copied ? "rgba(74,222,128,0.2)" : "var(--dark1)", color: copied ? "#4ade80" : "var(--gray)", whiteSpace: "nowrap" }}
                    >
                      {copied ? "✓ Copiado!" : "Copiar"}
                    </button>
                  </div>
                )}
              </div>
            )}
            </div>
          ))}
        </div>

        {!loading && filtered.length === 0 && !error && (
          <div style={{ color: "var(--gray)", textAlign: "center", padding: "3rem" }}>Nenhum usuário encontrado.</div>
        )}
      </div>
    </div>
  );
}

