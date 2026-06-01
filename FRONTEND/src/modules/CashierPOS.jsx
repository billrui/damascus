import { useState, useEffect, useRef } from "react";
import { TAX, SVC, d } from "../data";
import { fmt, deductStock } from "../utils";
import { T, pillBtn, actionBtn, overlay, modal as modalStyle } from "../posTheme";
import { shiftsApi } from "../api/index.js";
import { ReceiptModal } from "../components/POSShared";

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const Icon = {
  Cash: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2"/>
      <circle cx="12" cy="12" r="3"/>
      <path d="M6 12h.01M18 12h.01"/>
    </svg>
  ),
  Mpesa: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2"/>
      <path d="M12 18h.01"/>
      <path d="M9 7l3 3 3-3"/>
    </svg>
  ),
  Split: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5M8 3H3v5M3 16v5h5M21 16v5h-5"/>
      <path d="M21 3l-7 7M3 3l7 7M3 21l7-7M21 21l-7-7"/>
    </svg>
  ),
  Check: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  ),
  Phone: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.62 1.18 2 2 0 012.61 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.09a16 16 0 006 6l.98-.98a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
    </svg>
  ),
  Clock: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
    </svg>
  ),
  ChevronLeft: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6"/>
    </svg>
  ),
  Receipt: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/>
      <path d="M8 10h8M8 14h5"/>
    </svg>
  ),
  Spinner: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
        style={{ animation: "spin 1s linear infinite", transformOrigin: "center" }}/>
    </svg>
  ),
  User: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Table: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="4" rx="1"/><path d="M6 7v14M18 7v14M6 13h12"/>
    </svg>
  ),
};

// ── Keyframe injection ────────────────────────────────────────────────────────
const styleTag = `
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
@keyframes slideIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
@keyframes glow { 0%,100% { box-shadow: 0 0 0 0 rgba(197,160,89,0); } 50% { box-shadow: 0 0 16px 2px rgba(197,160,89,0.18); } }
.cashier-inv-card:hover { background: #1A2540 !important; }
.pay-method-btn:hover { filter: brightness(1.12); transform: translateY(-1px); }
.quick-cash-btn:hover { filter: brightness(1.15); transform: translateY(-1px); }
.confirm-btn:not(:disabled):hover { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 4px 24px rgba(197,160,89,0.18); }
.confirm-btn { transition: all 0.18s cubic-bezier(.4,0,.2,1); }
`;

function useElapsed(createdAt) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    if (!createdAt) return;
    const update = () => {
      const diff = Math.floor((Date.now() - new Date(createdAt)) / 60000);
      if (diff < 1) setElapsed("Just now");
      else if (diff < 60) setElapsed(`${diff}m ago`);
      else setElapsed(`${Math.floor(diff/60)}h ${diff%60}m`);
    };
    update();
    const t = setInterval(update, 30000);
    return () => clearInterval(t);
  }, [createdAt]);
  return elapsed;
}

// ── Invoice card ──────────────────────────────────────────────────────────────
function InvoiceCard({ inv, isSelected, onSelect, onReceipt, normalizeItems }) {
  const elapsed  = useElapsed(inv.createdAt || inv.created_at);
  const isPaid   = inv.status === "paid";
  const isVoided = inv.status === "voided";
  const dispTotal = inv.finalTotal ?? inv.total;
  const items = normalizeItems(inv.items);

  const borderColor = isSelected ? T.amber
    : isPaid   ? `${T.success}60`
    : isVoided ? `${T.error}60`
    : T.border;

  return (
    <div className="cashier-inv-card" onClick={() => onSelect(inv)}
      style={{
        borderRadius: 8, padding: "14px 16px", marginBottom: 10,
        cursor: isPaid || isVoided ? "default" : "pointer",
        background: isSelected ? `${T.amber}0D` : T.card,
        border: `1px solid ${borderColor}`,
        transition: "all 0.18s cubic-bezier(.4,0,.2,1)",
        opacity: isPaid || isVoided ? 0.75 : 1,
        animation: "slideIn 0.2s ease",
        boxShadow: isSelected ? `0 0 0 1px ${T.amber}40, 0 2px 12px rgba(0,0,0,0.3)` : "none",
      }}>

      {/* Top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: isPaid ? T.success : isVoided ? T.error : T.amber, letterSpacing: 0.2 }}>
              INV-{inv.id}
            </span>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 3, letterSpacing: 0.5,
              background: isPaid ? `${T.success}20` : isVoided ? `${T.error}20` : `${T.amber}18`,
              color: isPaid ? T.success : isVoided ? T.error : T.amber,
            }}>
              {isPaid ? "PAID" : isVoided ? "VOID" : "OPEN"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: T.textSecondary }}>
              <Icon.Table /> Table {inv.table || "—"}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: T.textMuted }}>
              <Icon.User /> {inv.waiter || "—"}
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, letterSpacing: -0.3, fontFamily: T.fontMono }}>
            {fmt(dispTotal)}
          </div>
          {!isPaid && !isVoided && (
            <div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end", marginTop: 3, color: T.textMuted, fontSize: 10 }}>
              <Icon.Clock /> {elapsed}
            </div>
          )}
        </div>
      </div>

      {/* Items preview */}
      <div style={{ fontSize: 10, color: T.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: 0.1 }}>
        {items.length > 0 ? items.map(i => `${i.qty}× ${i.name}`).join(" · ") : "No items"}
      </div>

      {/* Paid footer */}
      {isPaid && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
          <span style={{ fontSize: 9, color: T.success, letterSpacing: 0.3, fontWeight: 600 }}>
            {inv.payMethod?.toUpperCase() || "PAID"} · {inv.paidBy || ""}
          </span>
          <button onClick={e => { e.stopPropagation(); onReceipt(inv); }}
            style={{ background: `${T.success}15`, border: `1px solid ${T.success}40`, borderRadius: 4, padding: "3px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: T.success, fontSize: 10, fontWeight: 600, fontFamily: T.font }}>
            <Icon.Receipt /> Receipt
          </button>
        </div>
      )}
    </div>
  );
}

// ── Payment method button ─────────────────────────────────────────────────────
function PayBtn({ label, icon: IconComp, color, active, onClick }) {
  return (
    <button className="pay-method-btn" onClick={onClick}
      style={{
        padding: "16px 8px 14px", borderRadius: 8, cursor: "pointer",
        border: `2px solid ${active ? color : T.border}`,
        background: active ? `${color}14` : T.card,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        fontFamily: T.font, transition: "all 0.18s cubic-bezier(.4,0,.2,1)",
        boxShadow: active ? `0 0 0 1px ${color}30, 0 4px 16px ${color}18` : "none",
        position: "relative", overflow: "hidden",
      }}>
      {active && (
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${color}08, transparent)`, pointerEvents: "none" }} />
      )}
      <div style={{ color: active ? color : T.textMuted, transition: "color 0.18s" }}><IconComp /></div>
      <div style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? color : T.textSecondary, letterSpacing: 0.3, transition: "all 0.18s" }}>
        {label}
      </div>
      {active && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: color, borderRadius: "0 0 6px 6px" }} />
      )}
    </button>
  );
}

// ── Quick cash button ─────────────────────────────────────────────────────────
function QuickCashBtn({ value, label, active, onClick }) {
  return (
    <button className="quick-cash-btn" onClick={onClick}
      style={{
        flex: 1, padding: "11px 4px", borderRadius: 6, cursor: "pointer",
        border: `1px solid ${active ? T.success : T.border}`,
        background: active ? T.success : T.card,
        color: active ? "#fff" : T.textSecondary,
        fontSize: 11, fontWeight: 700, fontFamily: T.font,
        transition: "all 0.15s cubic-bezier(.4,0,.2,1)",
        letterSpacing: 0.2,
      }}>
      {label}
    </button>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
      {children}
    </div>
  );
}

// ── Field label ───────────────────────────────────────────────────────────────
function FieldLabel({ children, color }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: color || T.textMuted, letterSpacing: 0.5, marginBottom: 6 }}>
      {children}
    </div>
  );
}

// ── Main CashierPOS ───────────────────────────────────────────────────────────
// Inline OpenShiftModal for cashier screen
function OpenShiftModal({ user, onOpen, onClose }) {
  const [cashFloat,  setCashFloat]  = useState("");
  const [mpesaFloat, setMpesaFloat] = useState("");
  const [err,        setErr]        = useState("");

  const cashTotal  = parseFloat(cashFloat)  || 0;
  const mpesaTotal = parseFloat(mpesaFloat) || 0;
  const grandTotal = cashTotal + mpesaTotal;

  const handle = () => {
    if (cashTotal <= 0) { setErr("Enter the cash amount in the till before opening"); return; }
    onOpen(cashTotal, mpesaTotal);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:T.surface, borderRadius:10, width:"100%", maxWidth:400, boxShadow:"0 24px 48px rgba(0,0,0,0.5)", overflow:"hidden", border:`1px solid ${T.border}` }}>

        <div style={{ background:T.bg, padding:"20px 24px 16px", borderBottom:`1px solid ${T.border}` }}>
          <div style={{ fontSize:15, fontWeight:700, color:T.amber }}>Open New Shift</div>
          <div style={{ fontSize:10, color:T.textMuted, marginTop:3 }}>
            {user.name} — {new Date().toLocaleDateString("en-KE", { weekday:"long", day:"numeric", month:"long" })}
          </div>
        </div>

        <div style={{ padding:24 }}>
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:11, fontWeight:700, color:T.textSecondary, marginBottom:8 }}>Cash in Till (KES) *</div>
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:12, color:T.success, fontWeight:700 }}>KES</span>
              <input type="number" min="0" value={cashFloat}
                onChange={e => { setCashFloat(e.target.value); setErr(""); }}
                placeholder="0.00" autoFocus
                style={{ width:"100%", padding:"13px 12px 13px 52px", border:`1.5px solid ${err ? T.error : T.success}50`, borderRadius:6, fontSize:18, fontWeight:700, outline:"none", boxSizing:"border-box", fontFamily:"monospace", background:T.card, color:T.success }}
              />
            </div>
            <div style={{ fontSize:10, color:T.textMuted, marginTop:5 }}>Count all notes and coins physically in the till</div>
          </div>

          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, color:T.textSecondary, marginBottom:8 }}>M-Pesa Till Balance (KES)</div>
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:12, color:"#1D4ED8", fontWeight:700 }}>KES</span>
              <input type="number" min="0" value={mpesaFloat}
                onChange={e => { setMpesaFloat(e.target.value); setErr(""); }}
                placeholder="0.00 (optional)"
                style={{ width:"100%", padding:"13px 12px 13px 52px", border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:18, fontWeight:700, outline:"none", boxSizing:"border-box", fontFamily:"monospace", background:T.card, color:"#1D4ED8" }}
              />
            </div>
            <div style={{ fontSize:10, color:T.textMuted, marginTop:5 }}>Check your M-Pesa till account balance</div>
          </div>

          {grandTotal > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:20, background:T.bg, borderRadius:8, padding:"14px 12px" }}>
              {[["Cash", cashTotal, T.success],["M-Pesa", mpesaTotal, "#1D4ED8"],["Total", grandTotal, T.amber]].map(([label, value, color]) => (
                <div key={label} style={{ textAlign:"center" }}>
                  <div style={{ fontSize:9, fontWeight:700, color:T.textMuted, letterSpacing:1, textTransform:"uppercase", marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:14, fontWeight:800, color, fontFamily:"monospace" }}>{value.toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}

          {err && <div style={{ fontSize:11, color:T.error, marginBottom:14, fontWeight:600 }}>{err}</div>}

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={onClose} style={{ flex:1, padding:"12px", borderRadius:6, border:`1px solid ${T.border}`, background:T.card, fontSize:12, fontWeight:600, color:T.textSecondary, cursor:"pointer", fontFamily:T.font }}>
              Cancel
            </button>
            <button onClick={handle} disabled={cashTotal <= 0} style={{ flex:2, padding:"12px", borderRadius:6, border:"none", background: cashTotal > 0 ? T.amber : T.border, fontSize:13, fontWeight:700, color: cashTotal > 0 ? T.bg : T.textMuted, cursor: cashTotal > 0 ? "pointer" : "not-allowed", fontFamily:T.font }}>
              Open Shift — KES {grandTotal.toLocaleString()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CashierPOS({ user, sales, setSales, batches, setBatches, openInvoices, setOpenInvoices, recipes, ingredients, holdList = [], setHoldList, activeShift }) {

  const [selectedInv,   setSelectedInv]   = useState(null);
  const [payMethod,     setPayMethod]     = useState("cash");
  const [mpesaPhone,    setMpesaPhone]    = useState("");
  const [mpesaRef,      setMpesaRef]      = useState("");
  const [mpesaStatus,   setMpesaStatus]   = useState("idle"); // idle | sending | pending | success | failed
  const [tendered,      setTendered]      = useState("");
  const [splitEnabled,  setSplitEnabled]  = useState(false);
  const [cashPart,      setCashPart]      = useState("");
  const [mpesaPart,     setMpesaPart]     = useState("");
  const [splitPhone,    setSplitPhone]    = useState("");
  const [splitRef,      setSplitRef]      = useState("");
  const [step,          setStep]          = useState("list");
  const [processing,    setProcessing]    = useState(false);
  const [filter,        setFilter]        = useState("open");
  const [receipt,       setReceipt]       = useState(null);
  const [showShiftWarning, setShowShiftWarning] = useState(false);
  const [showOpenShift,    setShowOpenShift]    = useState(false);

  const phoneInputRef = useRef(null);

  // ── Normalize items ──────────────────────────────────────────────────────────
  const normalizeItems = (raw) => {
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) return parsed;
      if (parsed?.items && Array.isArray(parsed.items)) return parsed.items;
    } catch (_) {}
    return [];
  };

  const openList   = openInvoices
    .map(inv => ({ ...inv, items: normalizeItems(inv.items) }))
    .filter(inv => filter === "all" ? true : inv.status === "open");

  // Orders marked done by kitchen — ready to invoice
  const readyOrders = holdList.filter(h => h.status === "bumped");

  const tenderedNum  = parseFloat(tendered) || 0;
  const billTotal    = selectedInv ? (selectedInv.finalTotal ?? selectedInv.total) : 0;
  const changeDue    = tenderedNum - billTotal;
  const cashPartNum  = parseFloat(cashPart)  || 0;
  const mpesaPartNum = parseFloat(mpesaPart) || 0;
  const splitTotal   = cashPartNum + mpesaPartNum;
  const splitShort   = billTotal - splitTotal;

  // Fixed quick cash denominations
  const QUICK_CASH = [100, 200, 500, 1000, 2000];

  // ── Format phone ─────────────────────────────────────────────────────────────
  const formatPhone = (raw) => {
    const digits = raw.replace(/\D/g, "").slice(0, 12);
    if (digits.length <= 4) return digits;
    if (digits.length <= 7) return `${digits.slice(0,4)} ${digits.slice(4)}`;
    return `${digits.slice(0,4)} ${digits.slice(4,7)} ${digits.slice(7)}`;
  };

  // ── STK push simulation (replace with real API call when Daraja is ready) ───
  const handleStkPush = async () => {
    setMpesaStatus("sending");
    await new Promise(r => setTimeout(r, 1200));
    setMpesaStatus("pending");
    // When Daraja callback fires, set to "success" and set mpesaRef
  };

  // ── Payment confirmation ─────────────────────────────────────────────────────
  const handleConfirmPayment = async () => {
    setProcessing(true);
    try {
      const total = Math.round(selectedInv.finalTotal ?? selectedInv.total);
      const items = normalizeItems(selectedInv.items).map(i => ({
        menu_item_id: i.menuId || i.menu_item_id,
        qty:          i.qty,
        unit_price:   i.price || i.unit_price || 0,
        name:         i.name || "",
      }));

      let paymentMethod = payMethod;
      let paymentRef    = null;
      let tenderedAmt   = tenderedNum || total;

      if (splitEnabled) {
        paymentMethod = "split";
        paymentRef    = `CASH:${cashPartNum}|MPESA:${mpesaPartNum}|REF:${splitRef}|PHONE:${splitPhone}`;
        tenderedAmt   = splitTotal;
      } else if (payMethod === "mpesa") {
        paymentRef  = `PHONE:${mpesaPhone}|REF:${mpesaRef}`;
        tenderedAmt = total;
      }

      const { posApi } = await import("../api/index.js");
      const saved = await posApi.createSale({
        items,
        customer:    selectedInv.table ? `Table ${selectedInv.table}` : "Walk-in",
        table_no:    selectedInv.table || null,
        payment:     paymentMethod,
        payment_ref: paymentRef,
        tendered:    tenderedAmt,
        total,
        waiter_id:   selectedInv.waiter_id || null,
        shift_id:    activeShift?._dbId || activeShift?.id || null,
      });

      setSales(p => [...p, {
        id: saved.id, date: d(0),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        customer: saved.customer, table: saved.table_no,
        items, total, payment: paymentMethod,
        cashier: user?.name, waiter: selectedInv.waiter,
      }]);
      deductStock(selectedInv.items, setBatches, recipes);
      // Remove invoice immediately so poll can't restore it
      setOpenInvoices(p => p.filter(inv => inv.id !== selectedInv.id));

      if (saved.id) {
        const receiptUrl = posApi.receiptUrl(saved.id);
        window.open(receiptUrl, "_blank");
      }

      setProcessing(false);
      setStep("done");
    } catch (err) {
      console.error("Payment failed:", err.message);
      const total = Math.round(selectedInv.finalTotal ?? selectedInv.total);
      setSales(p => [...p, { id: `LOCAL-${Date.now()}`, date: d(0), total, payment: payMethod, items: selectedInv.items || [] }]);
      deductStock(selectedInv.items, setBatches, recipes);
      setOpenInvoices(p => p.filter(inv => inv.id !== selectedInv.id));
      setProcessing(false);
      setStep("done");
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────────────
  const handleReset = (removeInvId = null) => {
    if (removeInvId) setOpenInvoices(p => p.filter(inv => inv.id !== removeInvId));
    setSelectedInv(null); setStep("list"); setPayMethod("cash");
    setMpesaPhone(""); setMpesaRef(""); setMpesaStatus("idle");
    setTendered(""); setSplitEnabled(false);
    setCashPart(""); setMpesaPart(""); setSplitPhone(""); setSplitRef("");
  };

  const handleOpenShiftDirect = async (float, mpesaFloat = 0) => {
    try {
      const shift = await shiftsApi.open({ opening_float: float, mpesa_float: mpesaFloat });
      const normalized = {
        id:         shift.id,
        ref:        shift.shift_ref,
        date:       shift.opened_at?.split("T")[0],
        cashier:    shift.opened_by_name || user.name,
        openedAt:   shift.opened_at ? new Date(shift.opened_at).toTimeString().slice(0,5) : "",
        closedAt:   null,
        float:      parseFloat(shift.opening_float || float),
        mpesaFloat: parseFloat(shift.mpesa_float || mpesaFloat || 0),
        status:     "open",
        sales: [], voids: [], discounts: 0, petty: [],
        _dbId:      shift.id,
      };
      // Update activeShift via context — need to bubble up
      window.dispatchEvent(new CustomEvent("shift:opened", { detail: normalized }));
      setShowOpenShift(false);
      setShowShiftWarning(false);
    } catch (err) {
      if (err?.response?.status === 409) {
        setShowOpenShift(false);
        setShowShiftWarning(false);
        window.dispatchEvent(new CustomEvent("shift:reload"));
      } else {
        alert("Failed to open shift: " + (err?.response?.data?.message || err.message));
      }
    }
  };

  const handleSelectInv = (inv) => {
    if (inv.status === "paid" || inv.status === "voided") return;
    if (!activeShift) { setShowShiftWarning(true); return; }
    setSelectedInv(inv); setStep("pay"); setTendered("");
    setMpesaPhone(""); setMpesaRef(""); setMpesaStatus("idle");
  };

  // ── Can confirm ──────────────────────────────────────────────────────────────
  const canConfirm = (() => {
    if (splitEnabled) return splitTotal >= billTotal && (mpesaPartNum === 0 || splitPhone.replace(/\s/g,"").length >= 9);
    if (payMethod === "cash") return !tendered || changeDue >= 0;
    if (payMethod === "mpesa") return mpesaStatus === "success" || (mpesaPhone.replace(/\s/g,"").length >= 9 && mpesaRef.length >= 4);
    return false;
  })();

  const inputBase = (color) => ({
    width: "100%", boxSizing: "border-box",
    padding: "11px 14px", borderRadius: 6,
    border: `1px solid ${color}50`,
    background: T.bg, color: T.textPrimary,
    fontSize: 13, fontWeight: 500, outline: "none",
    fontFamily: T.font, transition: "border-color 0.15s",
  });

  // ── MPESA status helpers ─────────────────────────────────────────────────────
  const mpesaStatusConfig = {
    idle:    { color: T.textMuted,  label: "Awaiting STK push",            bg: T.card  },
    sending: { color: T.amber,      label: "Sending payment request...",    bg: `${T.amber}0D` },
    pending: { color: T.amber,      label: "Waiting for customer to pay",   bg: `${T.amber}0D` },
    success: { color: T.success,    label: "Payment confirmed",             bg: `${T.success}0D` },
    failed:  { color: T.error,      label: "Payment failed — try again",    bg: `${T.error}0D` },
  };
  const msc = mpesaStatusConfig[mpesaStatus];

  // ── Open count ───────────────────────────────────────────────────────────────
  const openCount = openInvoices.filter(i => i.status === "open").length;

  return (
    <>
      <style>{styleTag}</style>
      <div style={{ flex: 1, display: "flex", overflow: "hidden", background: T.bg, fontFamily: T.font, color: T.textPrimary }}>

        {/* ── LEFT: Invoice sidebar ─────────────────────────────────────────── */}
        <div style={{ width: 390, display: "flex", flexDirection: "column", background: T.surface, borderRight: `1px solid ${T.border}` }}>

          {/* Header */}
          <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.amber, letterSpacing: 1.2, textTransform: "uppercase" }}>
                  Cashier Terminal
                </div>
                <div style={{ fontSize: 10, color: T.textMuted, marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}>
                  <Icon.User /> {user.name}
                </div>
              </div>
              <div style={{
                background: openCount > 0 ? `${T.amber}18` : T.card,
                border: `1px solid ${openCount > 0 ? T.amber : T.border}`,
                color: openCount > 0 ? T.amber : T.textMuted,
                padding: "5px 12px", borderRadius: 5, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                animation: openCount > 0 ? "glow 3s ease-in-out infinite" : "none",
              }}>
                {openCount} OPEN
              </div>
            </div>
            {/* Ready Orders alert */}
            {readyOrders.length > 0 && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", marginTop: 10,
                background: `${T.success}12`, border: `1px solid ${T.success}40`,
                borderRadius: 7, cursor: "pointer",
              }} onClick={() => setFilter("ready")}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.success, letterSpacing: 0.3 }}>
                    {readyOrders.length} Order{readyOrders.length > 1 ? "s" : ""} Ready from Kitchen
                  </div>
                  <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>Tap to view and send to invoice</div>
                </div>
                <div style={{
                  background: T.success, color: "#fff", borderRadius: "50%",
                  width: 28, height: 28, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 13, fontWeight: 800,
                }}>
                  {readyOrders.length}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 6, background: T.bg, borderRadius: 6, padding: 4, marginTop: 8 }}>
              {[["open","Invoices"],["ready","Ready"],["all","All"]].map(([k,l]) => {
                const badge = k === "ready" ? readyOrders.length : 0;
                return (
                  <button key={k} onClick={() => setFilter(k)}
                    style={{
                      ...pillBtn(filter === k), flex: 1, fontSize: 11, letterSpacing: 0.3,
                      borderRadius: 4, padding: "6px 0", position: "relative",
                    }}>
                    {l}
                    {badge > 0 && (
                      <span style={{
                        position: "absolute", top: -4, right: 4,
                        background: T.success, color: "#fff",
                        borderRadius: "50%", width: 14, height: 14,
                        fontSize: 8, fontWeight: 800,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>{badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* No-shift warning banner */}
          {!activeShift && (
            <div style={{
              margin: "12px 14px 0",
              padding: "12px 14px",
              background: `${T.error}12`,
              border: `1px solid ${T.error}40`,
              borderRadius: 7,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.error, marginBottom: 2 }}>
                  No shift open
                </div>
                <div style={{ fontSize: 10, color: T.textSecondary }}>
                  Open a shift before processing payments
                </div>
              </div>
              <button
                onClick={() => setShowOpenShift(true)}
                style={{
                  padding: "7px 14px", borderRadius: 6, border: `1px solid ${T.error}60`,
                  background: `${T.error}18`, color: T.error,
                  fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: T.font,
                  whiteSpace: "nowrap",
                }}>
                Open Shift
              </button>
            </div>
          )}

          {/* Invoice list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 8px" }}>

            {/* Ready orders from kitchen */}
            {filter === "ready" && (
              <div>
                {readyOrders.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px 0", color: T.textMuted }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary }}>No ready orders yet</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>Kitchen will mark orders done here</div>
                  </div>
                ) : readyOrders.map(hold => {
                  const items = Array.isArray(hold.items) ? hold.items : [];
                  const total = items.reduce((s, i) => s + (i.price ?? i.unit_price ?? 0) * i.qty, 0);
                  return (
                    <div key={hold.id} style={{
                      borderRadius: 8, padding: "14px 16px", marginBottom: 10,
                      background: `${T.success}08`, border: `1px solid ${T.success}40`,
                      animation: "slideIn 0.2s ease",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: T.success }}>
                            Table {hold.table || hold.table_no || "—"}
                          </div>
                          <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>
                            {hold.waiter_name || hold.waiter || "Staff"}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, fontFamily: T.fontMono }}>{fmt(total)}</div>
                          <div style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 3, background: `${T.success}20`, color: T.success, marginTop: 3 }}>READY</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {items.map(i => `${i.qty}× ${i.name}`).join(" · ")}
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const { posApi } = await import("../api/index.js");
                            const inv = await posApi.createInvoice({
                              hold_id:  hold.id,
                              table_no: hold.table || hold.table_no,
                              items,
                              total,
                            });
                            if (inv?.id) {
                              setHoldList(p => p.map(h => h.id === hold.id ? { ...h, status: "billed" } : h));
                              setFilter("open");
                            }
                          } catch(e) { console.error("Invoice error:", e); }
                        }}
                        style={{
                          width: "100%", padding: "10px", borderRadius: 6,
                          border: `1px solid ${T.success}60`, background: `${T.success}18`,
                          color: T.success, fontSize: 12, fontWeight: 700,
                          cursor: "pointer", fontFamily: T.font, letterSpacing: 0.3,
                        }}>
                        Send to Invoice
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {filter !== "ready" && openList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "64px 0", animation: "fadeIn 0.3s ease" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: T.card, border: `1px solid ${T.border}`, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon.Receipt />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary }}>No open invoices</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 5, lineHeight: 1.5 }}>Awaiting orders from service staff</div>
              </div>
            ) : openList.map(inv => (
              <InvoiceCard key={inv.id} inv={inv}
                isSelected={selectedInv?.id === inv.id}
                onSelect={handleSelectInv}
                onReceipt={setReceipt}
                normalizeItems={normalizeItems}
              />
            ))}
          </div>
        </div>

        {/* ── RIGHT: Payment panel ──────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

          {/* Empty state */}
          {step === "list" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.3s ease" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: T.surface, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, color: T.textFaint }}>
                <Icon.Receipt />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.textSecondary }}>Select an open invoice</div>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>Choose an invoice from the list to process payment</div>
            </div>
          )}

          {/* Payment panel */}
          {(step === "pay" || step === "confirm") && selectedInv && (
            <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 120px", animation: "fadeIn 0.22s ease" }}>

              {/* Invoice header bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={handleReset}
                    style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: "7px 10px", cursor: "pointer", color: T.textSecondary, display: "flex", alignItems: "center", fontFamily: T.font, transition: "all 0.15s" }}>
                    <Icon.ChevronLeft />
                  </button>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, letterSpacing: -0.2 }}>Invoice INV-{selectedInv.id}</div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2, display: "flex", gap: 10 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Icon.Table /> Table {selectedInv.table || "—"}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Icon.User /> {selectedInv.waiter || "—"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Grand Total hero ─────────────────────────────────────────── */}
              <div style={{
                background: `linear-gradient(135deg, ${T.surface}, ${T.card})`,
                border: `1px solid ${T.amber}30`,
                borderRadius: 10, padding: "20px 24px", marginBottom: 20,
                boxShadow: `0 0 0 1px ${T.amber}12, 0 8px 32px rgba(0,0,0,0.4)`,
                animation: "glow 4s ease-in-out infinite",
              }}>
                {/* Items summary */}
                <div style={{ marginBottom: 16 }}>
                  {normalizeItems(selectedInv.items).map((item, idx) => (
                    <div key={item.menuId || idx} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
                      <span style={{ fontSize: 12, color: T.textSecondary }}>{item.qty}× {item.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, fontFamily: T.fontMono }}>
                        {fmt((item.price ?? item.unit_price ?? 0) * item.qty)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Subtotals row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                  {[["Subtotal", selectedInv.subtotal], ["Tax 16%", selectedInv.tax], ["Service 5%", selectedInv.service]].map(([l, v]) => (
                    <div key={l} style={{ background: T.bg, borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 700, letterSpacing: 0.5 }}>{l}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, marginTop: 3, fontFamily: T.fontMono }}>{fmt(v)}</div>
                    </div>
                  ))}
                </div>

                {/* Grand total */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, borderTop: `1px solid ${T.amber}25` }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.amber, letterSpacing: 1.2, textTransform: "uppercase" }}>Grand Total</div>
                    {selectedInv.discount && (
                      <div style={{ fontSize: 10, color: T.amberDim, marginTop: 2 }}>Disc. -{fmt(selectedInv.discount)}</div>
                    )}
                  </div>
                  <div style={{ fontSize: 34, fontWeight: 800, color: T.amber, fontFamily: T.fontMono, letterSpacing: -1, lineHeight: 1 }}>
                    {fmt(billTotal)}
                  </div>
                </div>
              </div>

              {/* ── Payment method tabs ──────────────────────────────────────── */}
              <div style={{ marginBottom: 20 }}>
                <SectionLabel>Payment Method</SectionLabel>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <PayBtn label="Cash"   icon={Icon.Cash}  color={T.success} active={!splitEnabled && payMethod === "cash"}
                    onClick={() => { setSplitEnabled(false); setPayMethod("cash"); setTendered(""); }} />
                  <PayBtn label="M-Pesa" icon={Icon.Mpesa} color={T.mpesa}   active={!splitEnabled && payMethod === "mpesa"}
                    onClick={() => { setSplitEnabled(false); setPayMethod("mpesa"); setMpesaPhone(""); setMpesaRef(""); setMpesaStatus("idle"); setTimeout(() => phoneInputRef.current?.focus(), 100); }} />
                  <PayBtn label="Split"  icon={Icon.Split} color={T.amber}   active={splitEnabled}
                    onClick={() => { setSplitEnabled(true); setPayMethod("cash"); setCashPart(""); setMpesaPart(""); setSplitPhone(""); setSplitRef(""); }} />
                </div>
              </div>

              {/* ── CASH panel ───────────────────────────────────────────────── */}
              {!splitEnabled && payMethod === "cash" && (
                <div style={{ background: `${T.success}08`, border: `1px solid ${T.success}30`, borderRadius: 8, padding: 20, marginBottom: 20, animation: "fadeIn 0.2s ease" }}>
                  <SectionLabel>Cash Collection</SectionLabel>

                  {/* Fixed denominations */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                    {QUICK_CASH.map(v => (
                      <QuickCashBtn key={v}
                        value={v} label={`${v}`}
                        active={tendered === String(v)}
                        onClick={() => setTendered(String(v))}
                      />
                    ))}
                    <QuickCashBtn value="exact" label="Exact"
                      active={tendered === String(Math.round(billTotal))}
                      onClick={() => setTendered(String(Math.round(billTotal)))}
                    />
                  </div>

                  {/* Amount received */}
                  <div style={{ marginBottom: 14 }}>
                    <FieldLabel color={T.success}>Amount Received (KES)</FieldLabel>
                    <input type="number" min={0} value={tendered}
                      onChange={e => setTendered(e.target.value)}
                      placeholder={String(Math.round(billTotal))}
                      style={{ ...inputBase(T.success), fontSize: 18, fontWeight: 700, fontFamily: T.fontMono, textAlign: "right", letterSpacing: -0.5 }}
                    />
                  </div>

                  {/* Change due */}
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    borderRadius: 8, padding: "14px 18px",
                    background: tenderedNum > 0 ? (changeDue >= 0 ? `${T.success}14` : `${T.error}14`) : T.bg,
                    border: `1px solid ${tenderedNum > 0 ? (changeDue >= 0 ? `${T.success}40` : `${T.error}40`) : T.border}`,
                    transition: "all 0.2s ease",
                  }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: 0.5, marginBottom: 3 }}>
                        {changeDue < 0 && tenderedNum > 0 ? "SHORT BY" : "CHANGE DUE"}
                      </div>
                      <div style={{ fontSize: 10, color: T.textFaint }}>
                        {tenderedNum > 0 ? `${fmt(tenderedNum)} received` : "Enter amount received"}
                      </div>
                    </div>
                    <div style={{
                      fontSize: 28, fontWeight: 800, fontFamily: T.fontMono, letterSpacing: -1,
                      color: tenderedNum > 0 ? (changeDue >= 0 ? T.success : T.error) : T.textFaint,
                      transition: "color 0.2s ease",
                    }}>
                      {tenderedNum > 0 ? (changeDue >= 0 ? fmt(changeDue) : fmt(Math.abs(changeDue))) : "—"}
                    </div>
                  </div>
                </div>
              )}

              {/* ── M-PESA panel ─────────────────────────────────────────────── */}
              {!splitEnabled && payMethod === "mpesa" && (
                <div style={{ background: `${T.mpesa}08`, border: `1px solid ${T.mpesa}30`, borderRadius: 8, padding: 20, marginBottom: 20, animation: "fadeIn 0.2s ease" }}>
                  <SectionLabel>M-Pesa Payment</SectionLabel>

                  {/* Phone field */}
                  <div style={{ marginBottom: 14 }}>
                    <FieldLabel color={T.mpesa}>Customer Phone Number</FieldLabel>
                    <div style={{ position: "relative" }}>
                      <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.mpesa, display: "flex", alignItems: "center" }}>
                        <Icon.Phone />
                      </div>
                      <input ref={phoneInputRef}
                        value={formatPhone(mpesaPhone)}
                        onChange={e => { setMpesaPhone(e.target.value.replace(/\D/g,"")); setMpesaStatus("idle"); setMpesaRef(""); }}
                        placeholder="0712 345 678" maxLength={14}
                        style={{ ...inputBase(T.mpesa), paddingLeft: 36, fontSize: 16, fontWeight: 600, fontFamily: T.fontMono, letterSpacing: 1 }}
                      />
                    </div>
                  </div>

                  {/* STK Push button */}
                  <button
                    onClick={handleStkPush}
                    disabled={mpesaPhone.replace(/\D/g,"").length < 9 || mpesaStatus === "sending" || mpesaStatus === "pending" || mpesaStatus === "success"}
                    style={{
                      width: "100%", padding: "13px", borderRadius: 6, cursor: "pointer",
                      border: `1px solid ${T.mpesa}60`,
                      background: mpesaStatus === "success" ? `${T.success}18` : `${T.mpesa}18`,
                      color: mpesaStatus === "success" ? T.success : T.mpesa,
                      fontWeight: 700, fontSize: 13, fontFamily: T.font, letterSpacing: 0.4,
                      marginBottom: 14, transition: "all 0.18s",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}>
                    {mpesaStatus === "sending" && (
                      <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>
                        <Icon.Spinner />
                      </span>
                    )}
                    {mpesaStatus === "idle" && "Send STK Push to Customer"}
                    {mpesaStatus === "sending" && "Sending request..."}
                    {mpesaStatus === "pending" && "Waiting for payment..."}
                    {mpesaStatus === "success" && "Payment Confirmed"}
                    {mpesaStatus === "failed" && "Retry STK Push"}
                  </button>

                  {/* Status card */}
                  <div style={{
                    borderRadius: 7, padding: "12px 16px",
                    background: msc.bg, border: `1px solid ${msc.color}30`,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    marginBottom: mpesaStatus === "pending" ? 14 : 0,
                    transition: "all 0.25s ease",
                  }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: msc.color, letterSpacing: 0.5, marginBottom: 2 }}>
                        {mpesaStatus.toUpperCase()}
                      </div>
                      <div style={{ fontSize: 11, color: T.textSecondary, animation: mpesaStatus === "pending" ? "pulse 2s ease infinite" : "none" }}>
                        {msc.label}
                      </div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: msc.color, fontFamily: T.fontMono }}>{fmt(billTotal)}</div>
                  </div>

                  {/* Manual ref entry (shown when pending or for fallback) */}
                  {(mpesaStatus === "pending" || mpesaStatus === "idle") && (
                    <div style={{ marginTop: 14 }}>
                      <FieldLabel color={T.mpesa}>M-Pesa Confirmation Code (optional fallback)</FieldLabel>
                      <input value={mpesaRef}
                        onChange={e => { setMpesaRef(e.target.value.toUpperCase()); if (e.target.value.length >= 8) setMpesaStatus("success"); }}
                        placeholder="e.g. SHF6Y3ZQWP"
                        style={{ ...inputBase(T.mpesa), letterSpacing: 2, fontFamily: T.fontMono, fontWeight: 700 }}
                      />
                    </div>
                  )}

                  {/* Success: show code */}
                  {mpesaStatus === "success" && mpesaRef && (
                    <div style={{ marginTop: 14, background: `${T.success}10`, border: `1px solid ${T.success}30`, borderRadius: 6, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: T.success, letterSpacing: 0.5 }}>TRANSACTION CODE</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: T.success, fontFamily: T.fontMono, letterSpacing: 2 }}>{mpesaRef}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ── SPLIT panel ──────────────────────────────────────────────── */}
              {splitEnabled && (
                <div style={{ background: `${T.amber}08`, border: `1px solid ${T.amber}30`, borderRadius: 8, padding: 20, marginBottom: 20, animation: "fadeIn 0.2s ease" }}>
                  <SectionLabel>Split Payment</SectionLabel>

                  {/* Balance tracker */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 18 }}>
                    {[
                      ["Bill Total", billTotal, T.amber],
                      ["Amount Paid", splitTotal, T.success],
                      ["Remaining", Math.max(0, splitShort), splitShort > 0 ? T.error : T.success],
                    ].map(([l, v, c]) => (
                      <div key={l} style={{ textAlign: "center", background: T.card, borderRadius: 7, padding: "10px 6px", border: `1px solid ${c}25` }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, letterSpacing: 0.5 }}>{l}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: c, marginTop: 4, fontFamily: T.fontMono, letterSpacing: -0.5 }}>{fmt(v)}</div>
                      </div>
                    ))}
                  </div>

                  {/* Balance bar */}
                  <div style={{ height: 4, background: T.border, borderRadius: 2, marginBottom: 18, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, billTotal > 0 ? (splitTotal/billTotal)*100 : 0)}%`, background: splitShort <= 0 ? T.success : T.amber, borderRadius: 2, transition: "width 0.3s ease" }} />
                  </div>

                  {/* Cash portion */}
                  <div style={{ marginBottom: 14 }}>
                    <FieldLabel color={T.success}>Cash Amount (KES)</FieldLabel>
                    <input type="number" min={0} value={cashPart} onChange={e => setCashPart(e.target.value)}
                      placeholder="0"
                      style={{ ...inputBase(T.success), fontSize: 16, fontWeight: 700, fontFamily: T.fontMono }}
                    />
                  </div>

                  {/* M-Pesa portion */}
                  <div style={{ marginBottom: mpesaPartNum > 0 ? 14 : 0 }}>
                    <FieldLabel color={T.mpesa}>M-Pesa Amount (KES)</FieldLabel>
                    <input type="number" min={0} value={mpesaPart} onChange={e => setMpesaPart(e.target.value)}
                      placeholder="0"
                      style={{ ...inputBase(T.mpesa), fontSize: 16, fontWeight: 700, fontFamily: T.fontMono }}
                    />
                  </div>

                  {/* M-Pesa details — only if mpesa portion entered */}
                  {mpesaPartNum > 0 && (
                    <div style={{ animation: "fadeIn 0.2s ease" }}>
                      <div style={{ marginBottom: 12 }}>
                        <FieldLabel color={T.mpesa}>Customer Phone</FieldLabel>
                        <div style={{ position: "relative" }}>
                          <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.mpesa }}><Icon.Phone /></div>
                          <input value={formatPhone(splitPhone)} onChange={e => setSplitPhone(e.target.value.replace(/\D/g,""))}
                            placeholder="0712 345 678" maxLength={14}
                            style={{ ...inputBase(T.mpesa), paddingLeft: 36, fontFamily: T.fontMono, letterSpacing: 1 }}
                          />
                        </div>
                      </div>
                      <div>
                        <FieldLabel color={T.mpesa}>M-Pesa Reference Code</FieldLabel>
                        <input value={splitRef} onChange={e => setSplitRef(e.target.value.toUpperCase())}
                          placeholder="e.g. SHF6Y3ZQWP"
                          style={{ ...inputBase(T.mpesa), fontFamily: T.fontMono, letterSpacing: 2, fontWeight: 700 }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Sticky confirm button ─────────────────────────────────────────── */}
          {(step === "pay" || step === "confirm") && selectedInv && (
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              padding: "16px 28px 20px",
              background: `linear-gradient(to top, ${T.bg} 70%, transparent)`,
              backdropFilter: "blur(4px)",
            }}>
              <button className="confirm-btn"
                onClick={handleConfirmPayment}
                disabled={!canConfirm}
                style={{
                  width: "100%", padding: "16px", borderRadius: 8,
                  border: `1px solid ${canConfirm ? T.amber : T.border}`,
                  background: canConfirm
                    ? `linear-gradient(135deg, ${T.amber}22, ${T.amber}10)`
                    : T.card,
                  color: canConfirm ? T.amber : T.textMuted,
                  fontWeight: 800, fontSize: 15, cursor: canConfirm ? "pointer" : "not-allowed",
                  fontFamily: T.font, letterSpacing: 0.6,
                  boxShadow: canConfirm ? `0 0 0 1px ${T.amber}30` : "none",
                }}>
                {canConfirm ? `Confirm Payment — ${fmt(billTotal)}` : "Complete payment details above"}
              </button>
            </div>
          )}

          {/* ── Processing overlay ───────────────────────────────────────────── */}
          {processing && (
            <div style={{ position: "absolute", inset: 0, background: `${T.bg}CC`, backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "36px 52px", textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
                <div style={{ color: T.amber, marginBottom: 16, animation: "spin 1s linear infinite", display: "inline-block" }}>
                  <Icon.Spinner />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, letterSpacing: 0.3 }}>Processing payment</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>Please wait</div>
              </div>
            </div>
          )}

          {/* ── Done screen ──────────────────────────────────────────────────── */}
          {step === "done" && selectedInv && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, animation: "fadeIn 0.3s ease" }}>
              <div style={{ background: T.surface, border: `1px solid ${T.success}30`, borderRadius: 12, padding: "40px 48px", textAlign: "center", maxWidth: 420, width: "100%", boxShadow: `0 0 0 1px ${T.success}12, 0 16px 48px rgba(0,0,0,0.5)` }}>

                {/* Check icon */}
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: `${T.success}14`, border: `2px solid ${T.success}40`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: T.success }}>
                  <Icon.Check />
                </div>

                <div style={{ fontSize: 20, fontWeight: 800, color: T.success, marginBottom: 4, letterSpacing: 0.3 }}>Payment Received</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 2 }}>Invoice INV-{selectedInv.id}</div>
                <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 20, display: "flex", justifyContent: "center", gap: 12 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Icon.Table /> Table {selectedInv.table}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Icon.User /> {selectedInv.waiter}</span>
                </div>

                <div style={{ fontSize: 36, fontWeight: 800, color: T.amber, fontFamily: T.fontMono, letterSpacing: -1.5, marginBottom: 8 }}>
                  {fmt(selectedInv.finalTotal ?? selectedInv.total)}
                </div>

                <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 20, padding: "8px 14px", background: T.card, borderRadius: 6, display: "inline-block" }}>
                  {splitEnabled ? `Split — Cash ${fmt(cashPartNum)} + M-Pesa ${fmt(mpesaPartNum)}`
                    : payMethod === "mpesa" ? `M-Pesa · ${formatPhone(mpesaPhone)}${mpesaRef ? ` · ${mpesaRef}` : ""}`
                    : "Cash"}
                </div>

                {!splitEnabled && payMethod === "cash" && changeDue > 0 && (
                  <div style={{ fontSize: 15, fontWeight: 800, color: T.success, background: `${T.success}12`, border: `1px solid ${T.success}30`, borderRadius: 7, padding: "10px 18px", marginBottom: 20, fontFamily: T.fontMono }}>
                    Change: {fmt(changeDue)}
                  </div>
                )}

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { setReceipt(openInvoices.find(i => i.id === selectedInv.id) || selectedInv); }}
                    style={{ flex: 1, padding: "12px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.card, color: T.textSecondary, cursor: "pointer", fontFamily: T.font, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.15s" }}>
                    <Icon.Receipt /> Receipt
                  </button>
                  <button onClick={() => { const id = selectedInv?.id; handleReset(id); }}
                    style={{ flex: 2, padding: "12px", borderRadius: 7, border: `1px solid ${T.amber}60`, background: `${T.amber}14`, color: T.amber, cursor: "pointer", fontFamily: T.font, fontSize: 13, fontWeight: 800, letterSpacing: 0.4, transition: "all 0.15s" }}>
                    Next Customer
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Receipt modal ────────────────────────────────────────────────── */}
        {/* Open shift directly from cashier screen */}
        {showOpenShift && (
          <OpenShiftModal
            user={user}
            onOpen={handleOpenShiftDirect}
            onClose={() => setShowOpenShift(false)}
          />
        )}

        {/* Shift required modal */}
        {showShiftWarning && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 60, padding: 24,
          }}>
            <div style={{
              background: T.surface, borderRadius: 12, padding: "32px 36px",
              textAlign: "center", maxWidth: 360, width: "100%",
              border: `1px solid ${T.error}40`,
              boxShadow: `0 0 0 1px ${T.error}20, 0 16px 48px rgba(0,0,0,0.6)`,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: `${T.error}14`, border: `2px solid ${T.error}40`,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.error} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, marginBottom: 8 }}>
                Shift Not Open
              </div>
              <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>
                You must open a shift before processing any payments. Please go to Shift & Cash to open your shift first.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setShowShiftWarning(false)}
                  style={{
                    flex: 1, padding: "11px", borderRadius: 7,
                    border: `1px solid ${T.border}`, background: T.card,
                    color: T.textSecondary, cursor: "pointer",
                    fontFamily: T.font, fontSize: 12, fontWeight: 600,
                  }}>
                  Cancel
                </button>
                <button
                  onClick={() => { setShowShiftWarning(false); setShowOpenShift(true); }}
                  style={{
                    flex: 2, padding: "11px", borderRadius: 7,
                    border: `1px solid ${T.amber}60`, background: `${T.amber}18`,
                    color: T.amber, cursor: "pointer",
                    fontFamily: T.font, fontSize: 13, fontWeight: 800, letterSpacing: 0.4,
                  }}>
                  Open Shift Now
                </button>
              </div>
            </div>
          </div>
        )}

        {receipt && (
          <ReceiptModal
            invoice={receipt}
            payMethod={splitEnabled ? "split" : payMethod}
            tendered={splitEnabled ? splitTotal : tenderedNum}
            change={splitEnabled ? Math.max(0, splitTotal - billTotal) : Math.max(0, changeDue)}
            onClose={() => { const id = receipt?.id; setReceipt(null); handleReset(id); }}
          />
        )}
      </div>
    </>
  );
}
