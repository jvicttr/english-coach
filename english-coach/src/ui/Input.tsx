import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  fullWidth?: boolean;
}

export function Input({ fullWidth = true, style, ...rest }: InputProps) {
  return (
    <input
      style={{
        width: fullWidth ? "100%" : undefined,
        background: "#1a1a1a",
        border: "1px solid #2a2a2a",
        borderRadius: 14,
        padding: ".75rem 1rem",
        fontSize: ".9rem",
        color: "#fff",
        outline: "none",
        fontFamily: "'Inter', sans-serif",
        transition: "border-color .15s",
        ...style,
      }}
      {...rest}
    />
  );
}
