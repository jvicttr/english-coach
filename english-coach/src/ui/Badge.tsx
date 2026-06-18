import { CSSProperties, ReactNode } from "react";

type BadgeVariant = "yellow" | "yellow-ghost" | "gray" | "green" | "red";

interface BadgeProps {
  variant?: BadgeVariant;
  size?: "xs" | "sm";
  children: ReactNode;
  style?: CSSProperties;
}

const VARIANT: Record<BadgeVariant, { background: string; color: string; border: string }> = {
  "yellow":       { background: "var(--yellow)",                       color: "var(--black)", border: "none" },
  "yellow-ghost": { background: "rgba(245,200,0,.1)",                  color: "var(--yellow)", border: "1px solid rgba(245,200,0,.35)" },
  "gray":         { background: "var(--dark2)",                        color: "var(--gray)",  border: "1px solid #2a2a2a" },
  "green":        { background: "rgba(74,222,128,.12)",                color: "#4ade80",      border: "1px solid rgba(74,222,128,.3)" },
  "red":          { background: "rgba(248,113,113,.12)",               color: "#f87171",      border: "1px solid rgba(248,113,113,.3)" },
};

const SIZE = {
  xs: { fontSize: "0.62rem", padding: "1px 6px" },
  sm: { fontSize: "0.75rem", padding: "3px 10px" },
};

export function Badge({ variant = "yellow", size = "sm", children, style }: BadgeProps) {
  const v = VARIANT[variant];
  const s = SIZE[size];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "50px",
        fontWeight: 700,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
        fontFamily: "'Inter', sans-serif",
        ...s,
        ...v,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
