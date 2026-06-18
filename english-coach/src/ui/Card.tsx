import { CSSProperties, ReactNode } from "react";

type CardVariant = "default" | "elevated" | "highlight" | "success" | "danger";

interface CardProps {
  variant?: CardVariant;
  padding?: string | number;
  radius?: number;
  children: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
  className?: string;
}

const VARIANT: Record<CardVariant, { background: string; border: string }> = {
  default:   { background: "var(--dark1)", border: "1px solid #1f1f1f" },
  elevated:  { background: "var(--dark2)", border: "1px solid #2a2a2a" },
  highlight: { background: "rgba(245,200,0,.06)", border: "1px solid rgba(245,200,0,.3)" },
  success:   { background: "rgba(74,222,128,.08)", border: "1px solid rgba(74,222,128,.2)" },
  danger:    { background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.2)" },
};

export function Card({
  variant = "default",
  padding = "14px 16px",
  radius = 16,
  children,
  style,
  onClick,
  className,
}: CardProps) {
  const v = VARIANT[variant];
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        ...v,
        borderRadius: radius,
        padding,
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
