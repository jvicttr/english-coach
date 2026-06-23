"use client";

import { usePathname, useRouter } from "next/navigation";

const LEFT_ITEMS = [
  { href: "/app", icon: "home", label: "Início" },
  { href: "/app/trilha", icon: "trilha", label: "Trilha" },
];

const RIGHT_ITEMS = [
  { href: "/app/progresso", icon: "progresso", label: "Progresso" },
  { href: "/app/perfil", icon: "perfil", label: "Perfil" },
];

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const color = active ? "#fff" : "#666";
  const strokeWidth = active ? "2" : "1.5";

  const icons = {
    home: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
    trilha: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/><polyline points="10 12 14 16 10 20"/>
      </svg>
    ),
    progresso: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
    perfil: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
    globe: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    ),
    escrever: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    ),
  };

  return icons[name as keyof typeof icons] || null;
}

function NavItem({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <a
      href={href}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 0 10px", textDecoration: "none" }}
    >
      <NavIcon name={icon} active={active} />
      <span style={{ fontSize: "0.6rem", fontWeight: 700, color: active ? "#fff" : "#666" }}>{label}</span>
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
            background: "var(--yellow)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: "translateY(-6px)",
            transition: "transform .15s, opacity .15s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = "translateY(-9px)";
            e.currentTarget.style.opacity = "0.9";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = "translateY(-6px)";
            e.currentTarget.style.opacity = "1";
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {isComunidade ? (
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            ) : (
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
            )}
          </svg>
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
