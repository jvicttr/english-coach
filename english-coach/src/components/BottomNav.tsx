"use client";

import { usePathname, useRouter } from "next/navigation";

const LEFT_ITEMS = [
  { href: "/app", icon: "🏠", label: "Início" },
  { href: "/app/trilha", icon: "🗺️", label: "Trilha" },
];

const RIGHT_ITEMS = [
  { href: "/app/mensagens", icon: "💬", label: "Mensagens" },
  { href: "/app/progresso", icon: "📊", label: "Progresso" },
  { href: "/app/perfil", icon: "👤", label: "Perfil" },
];

function NavItem({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <a
      href={href}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 0 10px", textDecoration: "none" }}
    >
      <span style={{ fontSize: "1.1rem" }}>{icon}</span>
      <span style={{ fontSize: "0.6rem", fontWeight: 700, color: active ? "var(--yellow)" : "#444" }}>{label}</span>
    </a>
  );
}

function NavItems() {
  const pathname = usePathname();
  const router = useRouter();
  const isComunidade = pathname.startsWith("/app/comunidade");

  function handleFab() {
    if (isComunidade) {
      // trigger modal on the page via DOM
      document.getElementById("community-fab")?.click();
    } else {
      router.push("/app/comunidade");
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "stretch", width: "100%" }}>
      {/* Left items */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", flex: 1 }}>
        {LEFT_ITEMS.map(item => {
          const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));
          return <NavItem key={item.href} {...item} active={active} />;
        })}
      </div>

      {/* FAB central */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 72, flexShrink: 0, paddingBottom: 2 }}>
        <button
          onClick={handleFab}
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: isComunidade ? "var(--yellow)" : "linear-gradient(135deg, #f5c800, #e0a800)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.3rem",
            boxShadow: "0 4px 16px rgba(245,200,0,0.4)",
            transform: "translateY(-6px)",
            transition: "transform .15s, box-shadow .15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-9px)")}
          onMouseLeave={e => (e.currentTarget.style.transform = "translateY(-6px)")}
        >
          {isComunidade ? "✍️" : "🌎"}
        </button>
      </div>

      {/* Right items */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", flex: 1 }}>
        {RIGHT_ITEMS.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href);
          return <NavItem key={item.href} {...item} active={active} />;
        })}
      </div>
    </div>
  );
}

const NAV_STYLE = { background: "#0d0d0d", borderTop: "1px solid #1e1e1e", paddingBottom: "env(safe-area-inset-bottom, 0px)" } as const;

export function BottomNavFixed() {
  return (
    <nav style={{ ...NAV_STYLE, position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50 }}>
      <NavItems />
    </nav>
  );
}

export function BottomNavFlex({ className }: { className?: string }) {
  return (
    <nav className={className ?? "-mx-3 sm:mx-auto w-full sm:max-w-2xl mt-1"} style={NAV_STYLE}>
      <NavItems />
    </nav>
  );
}
