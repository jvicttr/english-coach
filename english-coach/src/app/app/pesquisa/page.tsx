"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

interface UserResult {
  id: string;
  name: string;
  email: string;
  image_url: string | null;
  handle: string | null;
}

function UserCard({ u, onClick }: { u: UserResult; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        padding: "12px 16px",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid #141414",
        cursor: "pointer",
        textAlign: "left",
        transition: "background 0.12s",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "#161616"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{
        width: 48,
        height: 48,
        borderRadius: "50%",
        background: u.image_url ? "transparent" : "#2a2a2a",
        flexShrink: 0,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid #222",
      }}>
        {u.image_url
          ? <img src={u.image_url} alt={u.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {u.name}
        </div>
        {u.handle && (
          <div style={{ fontSize: "0.8rem", color: "#666", marginTop: 2 }}>@{u.handle}</div>
        )}
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  );
}

export default function PesquisaPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [allUsers, setAllUsers] = useState<UserResult[]>([]);
  const [results, setResults] = useState<UserResult[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/users")
      .then(r => r.json())
      .then(d => setAllUsers(d.users || []))
      .catch(() => {})
      .finally(() => setLoadingAll(false));
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoadingSearch(true);
    setSearched(true);
    try {
      const clean = q.startsWith("@") ? q.slice(1) : q;
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(clean)}`);
      const data = await res.json();
      setResults(data.users || []);
    } catch {
      setResults([]);
    } finally {
      setLoadingSearch(false);
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 350);
  }

  function handleClear() {
    setQuery("");
    setResults([]);
    setSearched(false);
    inputRef.current?.focus();
  }

  function goToProfile(userId: string) {
    router.push(`/app/comunidade/perfil/${userId}`);
  }

  const displayUsers = searched ? results : allUsers;
  const isLoading = searched ? loadingSearch : loadingAll;

  return (
    <div style={{ minHeight: "100dvh", background: "#0d0d0d", color: "#fff", paddingTop: "calc(65px + env(safe-area-inset-top))", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{
        position: "sticky",
        top: "calc(65px + env(safe-area-inset-top))",
        zIndex: 10,
        background: "#0d0d0d",
        borderBottom: "1px solid #1e1e1e",
        padding: "14px 16px 12px",
      }}>
        <h1 style={{ margin: "0 0 14px", fontSize: "1.2rem", fontWeight: 700 }}>Pesquisa</h1>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "#1a1a1a",
          border: "1px solid #2a2a2a",
          borderRadius: 14,
          padding: "10px 14px",
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            placeholder="Pesquisar por nome ou @handle..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#fff",
              fontSize: "0.95rem",
              minWidth: 0,
            }}
          />
          {query && (
            <button
              onClick={handleClear}
              style={{
                background: "#333",
                border: "none",
                borderRadius: "50%",
                width: 20,
                height: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
                color: "#999",
                fontSize: "0.75rem",
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "8px 0" }}>
        {!searched && !loadingAll && allUsers.length > 0 && (
          <p style={{ margin: "10px 16px 4px", fontSize: "0.75rem", fontWeight: 700, color: "#444", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Todos os usuários
          </p>
        )}

        {isLoading && (
          <div style={{ textAlign: "center", paddingTop: 48, color: "#555", fontSize: "0.9rem" }}>
            {searched ? "Buscando..." : "Carregando..."}
          </div>
        )}

        {!isLoading && searched && results.length === 0 && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: 72,
            gap: 10,
            color: "#555",
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/>
              <line x1="17" y1="14" x2="22" y2="19"/>
            </svg>
            <p style={{ margin: 0, fontSize: "0.9rem" }}>Nenhum usuário encontrado para &ldquo;{query}&rdquo;</p>
          </div>
        )}

        {!isLoading && displayUsers.map(u => (
          <UserCard key={u.id} u={u} onClick={() => goToProfile(u.id)} />
        ))}
      </div>
    </div>
  );
}
