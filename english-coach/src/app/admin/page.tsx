"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type User = {
  id: string;
  name: string;
  email: string;
  imageUrl: string;
  plan: "free" | "pro";
  createdAt: number;
};

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => {
        if (r.status === 403) throw new Error("Acesso negado.");
        return r.json();
      })
      .then((d) => { setUsers(d.users ?? []); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

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

  return (
    <div style={{ minHeight: "100vh", background: "var(--black)", fontFamily: "'Inter', sans-serif", padding: "2rem 1.2rem" }}>
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
            <div
              key={u.id}
              style={{ background: "var(--dark1)", border: `1px solid ${u.plan === "pro" ? "rgba(245,200,0,0.25)" : "#1f1f1f"}`, borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}
            >
              {/* Avatar */}
              <Image
                src={u.imageUrl}
                alt={u.name}
                width={40}
                height={40}
                style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
              />

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: "var(--white)", fontWeight: 600, fontSize: "0.9rem", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</p>
                <p style={{ color: "var(--gray)", fontSize: "0.78rem", margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</p>
              </div>

              {/* Plan badge */}
              <span style={{ padding: "3px 10px", borderRadius: "50px", fontSize: "0.72rem", fontWeight: 700, background: u.plan === "pro" ? "rgba(245,200,0,0.15)" : "var(--dark2)", color: u.plan === "pro" ? "var(--yellow)" : "var(--gray)", border: u.plan === "pro" ? "1px solid rgba(245,200,0,0.3)" : "1px solid #2a2a2a", flexShrink: 0 }}>
                {u.plan === "pro" ? "PRO" : "FREE"}
              </span>

              {/* Toggle button */}
              <button
                onClick={() => togglePlan(u.id, u.plan)}
                disabled={updating === u.id}
                style={{ padding: "6px 14px", borderRadius: "8px", fontSize: "0.78rem", fontWeight: 700, cursor: updating === u.id ? "not-allowed" : "pointer", opacity: updating === u.id ? 0.5 : 1, border: "none", background: u.plan === "pro" ? "rgba(248,113,113,0.15)" : "rgba(245,200,0,0.15)", color: u.plan === "pro" ? "#f87171" : "var(--yellow)", flexShrink: 0, whiteSpace: "nowrap" }}
              >
                {updating === u.id ? "..." : u.plan === "pro" ? "Remover Pro" : "Dar Pro"}
              </button>
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
