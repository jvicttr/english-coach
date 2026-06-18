import { ButtonHTMLAttributes, ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  size?: number;
  radius?: number;
  as?: "button";
}

export function IconButton({
  children,
  size = 36,
  radius = 10,
  style,
  disabled,
  ...rest
}: IconButtonProps) {
  return (
    <button
      disabled={disabled}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: "var(--dark2)",
        border: "1px solid #2a2a2a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
        transition: "opacity .15s",
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Link version of IconButton — renders an <a> tag */
export function IconButtonLink({
  href,
  children,
  size = 36,
  radius = 10,
  style,
  title,
}: {
  href: string;
  children: ReactNode;
  size?: number;
  radius?: number;
  style?: React.CSSProperties;
  title?: string;
}) {
  return (
    <a
      href={href}
      title={title}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: "var(--dark2)",
        border: "1px solid #2a2a2a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        textDecoration: "none",
        ...style,
      }}
    >
      {children}
    </a>
  );
}
