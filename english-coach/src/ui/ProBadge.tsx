/** Floating "PRO" label to place absolutely below a UserButton */
export function ProBadge() {
  return (
    <span
      style={{
        position: "absolute",
        bottom: -4,
        left: "50%",
        transform: "translateX(-50%)",
        fontSize: "0.52rem",
        fontWeight: 800,
        background: "linear-gradient(135deg,#f5c800,#e0a800)",
        color: "#000",
        padding: "1px 5px",
        borderRadius: "50px",
        whiteSpace: "nowrap",
        lineHeight: 1.4,
        pointerEvents: "none",
      }}
    >
      PRO
    </span>
  );
}
