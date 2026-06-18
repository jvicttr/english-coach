import { CSSProperties, ReactNode } from "react";

interface SectionLabelProps {
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
}

export function SectionLabel({ children, color = "var(--yellow)", style }: SectionLabelProps) {
  return (
    <p
      style={{
        fontSize: ".72rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: ".08em",
        color,
        margin: 0,
        ...style,
      }}
    >
      {children}
    </p>
  );
}
