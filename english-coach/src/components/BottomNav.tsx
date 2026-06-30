"use client";

import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/app", icon: "home", label: "Início" },
  { href: "/app/pesquisa", icon: "pesquisa", label: "Pesquisa" },
  { href: "/app/comunidade", icon: "comunidade", label: "Comunidade" },
  { href: "/app/progresso", icon: "progresso", label: "Progresso" },
  { href: "/app/perfil", icon: "perfil", label: "Perfil" },
];

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const color = active ? "#fff" : "#666";
  const strokeWidth = active ? "2" : "1.5";

  const icons: Record<string, React.ReactNode> = {
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
    pesquisa: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
    comunidade: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
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
  };

  return <>{icons[name] ?? null}</>;
}

function NavItems() {
  const pathname = usePathname();

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", width: "100%" }}>
      {NAV_ITEMS.map(item => {
        const active = item.href === "/app"
          ? pathname === "/app"
          : pathname.startsWith(item.href);
        return (
          <a
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              padding: "8px 0 10px",
              textDecoration: "none",
            }}
          >
            <NavIcon name={item.icon} active={active} />
            <span style={{ fontSize: "0.6rem", fontWeight: 700, color: active ? "#fff" : "#666" }}>
              {item.label}
            </span>
          </a>
        );
      })}
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
