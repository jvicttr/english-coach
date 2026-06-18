interface DotsLoaderProps {
  size?: number;
  color?: string;
}

export function DotsLoader({ size = 9, color = "var(--yellow)" }: DotsLoaderProps) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: color,
            display: "inline-block",
            animation: "bounce 0.8s infinite",
            animationDelay: `${delay}ms`,
          }}
        />
      ))}
    </div>
  );
}
