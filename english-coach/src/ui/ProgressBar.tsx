interface ProgressBarProps {
  value: number;
  height?: number;
  color?: string;
  trackColor?: string;
  radius?: number;
}

export function ProgressBar({
  value,
  height = 6,
  color = "var(--yellow)",
  trackColor = "var(--dark2)",
  radius = 99,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div style={{ width: "100%", height, borderRadius: radius, background: trackColor, overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: radius,
          transition: "width .4s ease",
        }}
      />
    </div>
  );
}
