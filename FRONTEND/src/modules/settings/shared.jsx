// --- SHARED DESIGN TOKENS ----------------------------------------------------
export const C = {
  bg:        "#F5F2EB",
  surface:   "#FFFFFF",
  surfaceAlt:"#F8F8F8",
  border:    "#E5E0D5",
  borderMid: "#D1C9B8",
  sidebar:   "#1A1A1A",
  sidebarHover: "rgba(197, 160, 89, 0.08)",
  accent:    "#C5A059",
  accentHover: "#A0823A",
  blue:      "#2C3E50",
  blueLight: "#E8ECF0",
  green:     "#2E7D64",
  greenLight:"#ECFDF5",
  red:       "#8B3A3A",
  redLight:  "#FEF2F2",
  yellow:    "#B8860B",
  yellowLight:"#FEF9F0",
  textPrimary:"#1A1A1A",
  textSecondary:"#4A4A4A",
  textMuted:  "#7A7A7A",
  gold:      "#C5A059",
};

// --- TOAST SYSTEM -------------------------------------------------------------
import { useState, useCallback, useEffect } from "react";

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }, []);

  return { toasts, toast };
}

export function ToastContainer({ toasts }) {
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === "success" ? C.green : t.type === "error" ? C.red : C.yellow,
          color: "#FFFFFF", padding: "10px 16px", borderRadius: 4, fontSize: 12, fontWeight: 500,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", gap: 8,
          animation: "slideInRight 0.25s ease", minWidth: 220, maxWidth: 340,
        }}>
          <span>{t.type === "success" ? "-" : t.type === "error" ? "-" : "!"}</span>
          {t.message}
        </div>
      ))}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

// --- UI PRIMITIVES ------------------------------------------------------------
export function Card({ children, style = {} }) {
  return (
    <div style={{ background: C.surface, borderRadius: 6, border: `1px solid ${C.border}`, overflow: "hidden", ...style }}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div style={{ padding: "16px 20px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, letterSpacing: "0.3px" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function CardBody({ children, style = {} }) {
  return <div style={{ padding: "16px 20px", ...style }}>{children}</div>;
}

export function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12, marginTop: 8 }}>
      {children}
    </div>
  );
}

export function FormRow({ label, hint, children, required }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: "12px 24px", alignItems: "start", padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary, letterSpacing: "0.3px" }}>
          {label}{required && <span style={{ color: C.red, marginLeft: 2 }}>*</span>}
        </div>
        {hint && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3, lineHeight: 1.4 }}>{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function Input({ value, onChange, placeholder, type = "text", style = {}, disabled }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        width: "100%", padding: "8px 12px", borderRadius: 4, border: `1px solid ${C.borderMid}`,
        fontSize: 12, color: C.textPrimary, background: disabled ? C.surfaceAlt : C.surface,
        outline: "none", transition: "border-color 0.15s", fontFamily: "'Inter', sans-serif",
        ...style,
      }}
      onFocus={e => !disabled && (e.target.style.borderColor = C.accent)}
      onBlur={e => (e.target.style.borderColor = C.borderMid)}
    />
  );
}

export function Select({ value, onChange, options, style = {}, disabled }) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      style={{
        width: "100%", padding: "8px 12px", borderRadius: 4, border: `1px solid ${C.borderMid}`,
        fontSize: 12, color: C.textPrimary, background: C.surface, outline: "none",
        cursor: disabled ? "default" : "pointer", fontFamily: "'Inter', sans-serif",
        ...style,
      }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange, disabled, size = "md" }) {
  const w = size === "sm" ? 32 : 40;
  const h = size === "sm" ? 18 : 22;
  const dot = size === "sm" ? 12 : 16;
  const offset = size === "sm" ? 3 : 3;
  const travel = size === "sm" ? 14 : 18;
  return (
    <div
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: w, height: h, borderRadius: h / 2, position: "relative", cursor: disabled ? "default" : "pointer",
        background: checked ? C.green : C.borderMid, transition: "background 0.2s", flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{
        position: "absolute", top: offset, left: checked ? travel : offset,
        width: dot, height: dot, borderRadius: "50%", background: "#FFFFFF",
        transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
      }} />
    </div>
  );
}

export function Btn({ children, onClick, variant = "primary", size = "md", disabled, style = {}, icon }) {
  const base = {
    display: "inline-flex", alignItems: "center", gap: 6,
    borderRadius: 4, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
    border: "none", transition: "all 0.15s", opacity: disabled ? 0.5 : 1,
    fontSize: size === "sm" ? 11 : 12,
    padding: size === "sm" ? "6px 12px" : "9px 18px",
    letterSpacing: "0.3px",
  };
  const variants = {
    primary:   { background: C.accent, color: "#FFFFFF" },
    secondary: { background: C.surfaceAlt, color: C.textPrimary, border: `1px solid ${C.border}` },
    danger:    { background: C.red, color: "#FFFFFF" },
    ghost:     { background: "transparent", color: C.textSecondary },
    success:   { background: C.green, color: "#FFFFFF" },
  };
  return (
    <button onClick={() => !disabled && onClick?.()} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>
      {icon && <span>{icon}</span>}
      {children}
    </button>
  );
}

export function Badge({ label, color = "gray" }) {
  const colors = {
    gray:   { bg: "#F8F8F8", text: C.textSecondary },
    green:  { bg: C.greenLight, text: C.green },
    red:    { bg: C.redLight, text: C.red },
    yellow: { bg: C.yellowLight, text: C.yellow },
    blue:   { bg: C.blueLight, text: C.blue },
    orange: { bg: "#FEF9F0", text: C.accent },
  };
  const { bg, text } = colors[color] || colors.gray;
  return (
    <span style={{ background: bg, color: text, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, display: "inline-block", letterSpacing: "0.3px" }}>
      {label}
    </span>
  );
}

export function Modal({ open, onClose, title, children, width = 480 }) {
  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: C.surface, borderRadius: 6, width, maxWidth: "95vw", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 40px rgba(0,0,0,0.15)" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, letterSpacing: "0.3px" }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.textMuted, lineHeight: 1, padding: "4px 8px" }}>-</button>
        </div>
        <div style={{ padding: "20px" }}>{children}</div>
      </div>
    </div>
  );
}

export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = "Confirm", danger = false }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={400}>
      <p style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.5, marginBottom: 20 }}>{message}</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn variant={danger ? "danger" : "primary"} onClick={() => { onConfirm(); onClose(); }}>
          {confirmLabel}
        </Btn>
      </div>
    </Modal>
  );
}

export function EmptyState({ icon, title, subtitle }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: C.textMuted }}>
      <div style={{ fontSize: 32, marginBottom: 12, color: C.accent, opacity: 0.5 }}>{icon || "-"}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: C.textSecondary, marginBottom: 6, letterSpacing: "0.3px" }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11 }}>{subtitle}</div>}
    </div>
  );
}