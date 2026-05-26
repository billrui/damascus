import { classifyExpiry } from "../utils";
import { T } from "../posTheme";

// Shared label style used by Input and Select
const labelStyle = {
  fontSize: 11, fontWeight: 600, color: T.textSecondary,
  display: "block", marginBottom: 4, fontFamily: T.font,
  textTransform: "uppercase", letterSpacing: 0.5,
};

export const Card = ({ children, style = {} }) => (
  <div style={{
    background: T.card, borderRadius: 10, padding: 18,
    border: `1px solid ${T.border}`, ...style
  }}>
    {children}
  </div>
);

export const Badge = ({ children, color = T.textMuted, bg }) => (
  <span style={{
    background: bg || color + "18", color, fontSize: 10.5, fontWeight: 700,
    padding: "2px 8px", borderRadius: 3, display: "inline-block",
    textTransform: "uppercase", letterSpacing: 0.5, fontFamily: T.font,
  }}>
    {children}
  </span>
);

export const Button = ({ children, onClick, variant = "primary", size = "md", style = {} }) => {
  const base = {
    border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600,
    transition: "all 0.15s", fontFamily: T.font, letterSpacing: 0.2,
  };
  const sizes = {
    sm: { padding: "5px 12px", fontSize: 11.5 },
    md: { padding: "8px 18px", fontSize: 12.5 },
    lg: { padding: "11px 24px", fontSize: 13.5 },
  };
  const variants = {
    primary:  { background: T.amber, color: "#0c0f18" },
    secondary:{ background: T.card, color: T.textSecondary, border: `1px solid ${T.border}` },
    danger:   { background: T.red, color: "#fff" },
    success:  { background: T.green, color: "#fff" },
    ghost:    { background: "transparent", color: T.textMuted },
  };
  return (
    <button onClick={onClick} style={{ ...base, ...sizes[size], ...variants[variant], ...style }}>
      {children}
    </button>
  );
};

// Alias for backward compatibility - allows using both Button and Btn
export const Btn = Button;

export const Input = ({ label, ...props }) => (
  <div>
    {label && <label style={labelStyle}>{label}</label>}
    <input {...props} style={{
      width: "100%", padding: "8px 11px", borderRadius: 6,
      border: `1px solid ${T.border}`, fontSize: 12.5, outline: "none",
      background: T.card, color: T.textPrimary, boxSizing: "border-box",
      fontFamily: T.font,
      ...props.style,
    }} />
  </div>
);

export const Select = ({ label, children, ...props }) => (
  <div>
    {label && <label style={labelStyle}>{label}</label>}
    <select {...props} style={{
      width: "100%", padding: "8px 11px", borderRadius: 6,
      border: `1px solid ${T.border}`, fontSize: 12.5, outline: "none",
      background: T.card, color: T.textPrimary, boxSizing: "border-box",
      cursor: "pointer", fontFamily: T.font,
      ...props.style,
    }}>{children}</select>
  </div>
);

export const SectionHeader = ({ title, sub, action }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
    <div>
      <h2 style={{
        margin: 0, fontSize: 16, fontWeight: 700, color: T.textPrimary,
        fontFamily: T.font, letterSpacing: 0.2,
      }}>{title}</h2>
      {sub && <p style={{
        margin: "3px 0 0", fontSize: 11.5, color: T.textMuted, fontFamily: T.font,
      }}>{sub}</p>}
    </div>
    {action}
  </div>
);

export const ExpiryBadge = ({ batch }) => {
  const e = classifyExpiry(batch);
  return <Badge color={e.color} bg={e.bg}>{e.label}</Badge>;
};

export const FlagBadge = ({ flag }) => {
  const map = {
    critical: { color: T.red,   bg: T.red+"18",   label: "Critical"     },
    warning:  { color: "#e07b39", bg: "#e07b3918", label: "Warning"      },
    under:    { color: T.blue,  bg: T.blue+"18",   label: "Under-issued" },
    ok:       { color: T.green, bg: T.green+"18",  label: "OK"           },
  };
  const m = map[flag] || map.ok;
  return <Badge color={m.color} bg={m.bg}>{m.label}</Badge>;
};