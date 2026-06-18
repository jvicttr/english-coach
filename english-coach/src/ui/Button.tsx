import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Shape = "rect" | "pill";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  shape?: Shape;
  size?: Size;
  children: ReactNode;
  fullWidth?: boolean;
}

const SIZE: Record<Size, { padding: string; fontSize: string; height: string }> = {
  sm: { padding: "0 12px", fontSize: ".78rem", height: "32px" },
  md: { padding: "0 16px", fontSize: ".85rem", height: "40px" },
  lg: { padding: "0 24px", fontSize: ".95rem", height: "48px" },
};

const VARIANT: Record<Variant, { background: string; color: string; border: string }> = {
  primary:   { background: "var(--yellow)", color: "var(--black)", border: "none" },
  secondary: { background: "var(--dark2)",  color: "var(--gray)",  border: "1px solid #2a2a2a" },
  ghost:     { background: "transparent",   color: "var(--gray)",  border: "1px solid #2a2a2a" },
};

export function Button({
  variant = "primary",
  shape = "rect",
  size = "md",
  fullWidth = false,
  disabled,
  style,
  children,
  ...rest
}: ButtonProps) {
  const v = VARIANT[variant];
  const s = SIZE[size];
  return (
    <button
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        ...s,
        borderRadius: shape === "pill" ? "50px" : "12px",
        fontWeight: 700,
        fontFamily: "'Inter', sans-serif",
        cursor: disabled ? "default" : "pointer",
        width: fullWidth ? "100%" : undefined,
        transition: "background .15s, opacity .15s",
        opacity: disabled ? 0.5 : 1,
        ...v,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
