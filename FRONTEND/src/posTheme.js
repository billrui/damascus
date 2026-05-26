// --- Damascus Hotel POS - Shared Design Tokens -----------------------------------
// Hospitality-grade design system. Clean, authoritative, no emoji.

export const T = {
  // Backgrounds - warm charcoal palette
  bg:        "#0A0E1A",
  surface:   "#0F1520",
  card:      "#141C2E",
  cardHover: "#1A2540",
  border:    "#1F2D42",

  // Brand colours - refined gold/brass palette
  amber:     "#C5A059",
  amberDim:  "#A0823A",
  amberLight: "#D4B87A",
  green:     "#2E7D64",
  blue:      "#2C3E50",
  red:       "#8B3A3A",
  mpesa:     "#2E7D64",
  success:   "#2E7D64",
  warning:   "#B8860B",
  error:     "#8B3A3A",

  // Text colours
  textPrimary:   "#ECF0F3",
  textSecondary: "#8A9BAF",
  textMuted:     "#4A5A6E",
  textFaint:     "#2A3A4E",

  // Typography - refined, professional
  font:        "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontMono:    "'DM Mono', 'Fira Mono', monospace",
  fontDisplay: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
};

export function pillBtn(active, activeColor = T.amber) {
  return {
    padding: "5px 14px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    letterSpacing: 0.3,
    background: active ? activeColor : T.card,
    color: active ? "#0A0E1A" : T.textSecondary,
    transition: "all 0.14s ease",
  };
}

export function stepBtn(color = T.card) {
  return {
    width: 24,
    height: 24,
    borderRadius: 3,
    border: `1px solid ${T.border}`,
    background: color,
    color: color === T.amber ? "#0A0E1A" : T.textPrimary,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.14s ease",
  };
}

export function actionBtn(bg = T.card, small = false) {
  return {
    background: bg,
    color: bg === T.amber ? "#0A0E1A" : "#FFFFFF",
    border: "none",
    borderRadius: 4,
    padding: small ? "5px 12px" : "9px 18px",
    fontSize: small ? 11 : 12,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    transition: "all 0.14s ease",
    letterSpacing: 0.3,
  };
}

export function badge(color = T.textMuted) {
  return {
    background: `${color}20`,
    color: color,
    borderRadius: 3,
    padding: "2px 8px",
    fontSize: 10,
    fontWeight: 600,
    display: "inline-block",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  };
}

export const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.75)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 999,
  backdropFilter: "blur(2px)",
};

export const modal = {
  background: "#0F1520",
  border: `1px solid ${T.border}`,
  borderRadius: 6,
  padding: 24,
  width: 420,
  maxWidth: "95vw",
  boxShadow: "0 24px 48px rgba(0, 0, 0, 0.4)",
};