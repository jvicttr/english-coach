"use client";

import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/app", icon: "🏠", label: "Início" },
  { href: "/app/trilha", icon: "🗺️", label: "Trilha" },
  { href: "/app/flashcards", icon: "🃏", label: "Flashcards" },
  { href: "/app/progresso", icon: "📊", label: "Progresso" },
];

function NavItems() {
  const pathname = usePathname();
  return (
    <>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));
        return (
          <a
            key={item.href}
            href={item.href}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 0 10px", textDecoration: "none" }}
          >
            <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
            <span style={{ fontSize: "0.6rem", fontWeight: 700, color: active ? "var(--yellow)" : "#444" }}>{item.label}</span>
          </a>
        );
      })}
    </>
  );
}

const NAV_STYLE = { background: "#0d0d0d", borderTop: "1px solid #1e1e1e", display: "grid", gridTemplateColumns: "repeat(4,1fr)", paddingBottom: "env(safe-area-inset-bottom, 0px)" } as const;

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
