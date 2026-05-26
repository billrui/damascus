import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TAX, SVC } from "../data";
import { fmt } from "../utils";
import { Card, Badge, SectionHeader, Btn } from "../components/UI";

// --- MOCK SHIFT HISTORY (seed data) ------------------------------------------
const today = new Date();
const ds = (offset) => {
  const dt = new Date(today);
  dt.setDate(dt.getDate() + offset);
  return dt.toISOString().split("T")[0];
};

// INIT_SHIFTS removed - shifts are fetched from the API
export const INIT_SHIFTS = [];

// --- HELPERS ------------------------------------------------------------------
const payBreakdown = (sales) => {
  const out = { cash: 0, card: 0, mpesa: 0, gift: 0 };
  sales.forEach((s) => { out[s.payment] = (out[s.payment] || 0) + s.total; });
  return out;
};

const cashSales = (sales) => sales.filter((s) => s.payment === "cash").reduce((a, s) => a + s.total, 0);

const shiftTotal = (shift) => shift.sales.reduce((a, s) => a + s.total, 0);

const pettyTotal = (shift) => (shift.petty || []).reduce((a, p) => a + p.amount, 0);

const expectedCashCalc = (shift) => {
  const cs = cashSales(shift.sales);
  const pt = pettyTotal(shift);
  return shift.float + cs - pt;
};

const variance = (shift) => {
  const expected = expectedCashCalc(shift);
  return shift.actualCash != null ? shift.actualCash - expected : null;
};

const fmtTime = () => {
  const now = new Date();
  return now.toTimeString().slice(0, 5);
};

const DARK_BG  = "#1A1A1A";
const GOLD     = "#C5A059";
const ORANGE   = "#B8860B";
const GREEN    = "#2E7D64";
const RED      = "#8B3A3A";
const GRAY_BG  = "#F5F2EB";

// --- TOAST --------------------------------------------------------------------
function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", top: 20, right: 24, zIndex: 2000,
      background: DARK_BG, color: "#FFFFFF", padding: "12px 20px",
      borderRadius: 6, fontSize: 12, fontWeight: 500,
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      letterSpacing: "0.3px",
    }}>{msg}</div>
  );
}

// --- OPEN SHIFT MODAL ---------------------------------------------------------
function OpenShiftModal({ user, onOpen, onClose }) {
  const [float, setFloat] = useState("5000");
  const [err,   setErr]   = useState("");

  const handle = () => {
    const f = parseFloat(float);
    if (isNaN(f) || f < 0) { setErr("Enter a valid opening float amount"); return; }
    onOpen(f);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#FFFFFF", borderRadius:8, width:"100%", maxWidth:420, boxShadow:"0 20px 40px rgba(0,0,0,0.15)", overflow:"hidden" }}>
        <div style={{ background:DARK_BG, padding:"22px 24px 18px" }}>
          <div style={{ fontSize:15, fontWeight:600, color:GOLD, letterSpacing:"0.5px" }}>Open New Shift</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginTop:2 }}>
            {user.name} - {user.role} - {new Date().toLocaleDateString("en-KE", { weekday:"long", day:"numeric", month:"long" })}
          </div>
        </div>
        <div style={{ padding:24 }}>
          <div style={{ marginBottom:18 }}>
            <label style={{ fontSize:11, fontWeight:600, color:"#4A4A4A", display:"block", marginBottom:6, letterSpacing:"0.5px" }}>
              Opening Float (KES) *
            </label>
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:11, color:"#7A7A7A", fontWeight:600 }}>KES</span>
              <input
                type="number"
                value={float}
                onChange={(e) => { setFloat(e.target.value); setErr(""); }}
                style={{ width:"100%", padding:"11px 12px 11px 48px", border:`1px solid ${err ? RED : "#E5E0D5"}`, borderRadius:4, fontSize:14, fontWeight:600, outline:"none", boxSizing:"border-box", fontFamily:"'Inter', sans-serif" }}
              />
            </div>
            {err && <div style={{ fontSize:10, color:RED, marginTop:4 }}>{err}</div>}
            <div style={{ fontSize:10, color:"#7A7A7A", marginTop:5, letterSpacing:"0.3px" }}>Count cash in till and enter exact amount before starting.</div>
          </div>
          {/* Quick float presets */}
          <div style={{ display:"flex", gap:8, marginBottom:20 }}>
            {[2000,5000,10000].map((v) => (
              <button key={v} onClick={() => setFloat(String(v))} style={{
                flex:1, padding:"8px 0", borderRadius:4,
                border:`1px solid ${float===String(v) ? GOLD : "#E5E0D5"}`,
                background: float===String(v) ? "#FEF9F0" : "#FFFFFF",
                color: float===String(v) ? GOLD : "#7A7A7A",
                fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'Inter', sans-serif",
              }}>KES {v.toLocaleString()}</button>
            ))}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={onClose} style={{ flex:1, padding:"11px", borderRadius:4, border:"1px solid #E5E0D5", background:"#FFFFFF", fontSize:12, fontWeight:600, color:"#7A7A7A", cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>Cancel</button>
            <button onClick={handle} style={{ flex:2, padding:"11px", borderRadius:4, border:"none", background:DARK_BG, fontSize:12, fontWeight:600, color:GOLD, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
              Open Shift
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- PETTY CASH MODAL ---------------------------------------------------------
function PettyCashModal({ user, onAdd, onClose }) {
  const [desc,   setDesc]   = useState("");
  const [amount, setAmount] = useState("");
  const [err,    setErr]    = useState({});

  const handle = () => {
    const e = {};
    if (!desc.trim()) e.desc = "Description required";
    const a = parseFloat(amount);
    if (isNaN(a) || a <= 0) e.amount = "Enter a valid amount";
    if (Object.keys(e).length) { setErr(e); return; }
    onAdd({ id:`P${Date.now()}`, time:fmtTime(), desc:desc.trim(), amount:a, by:user.name });
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#FFFFFF", borderRadius:8, width:"100%", maxWidth:400, boxShadow:"0 20px 40px rgba(0,0,0,0.15)" }}>
        <div style={{ padding:"20px 24px 14px", borderBottom:"1px solid #F0EDE6", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:14, fontWeight:600, color:"#1A1A1A", letterSpacing:"0.5px" }}>Petty Cash Disbursement</div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:4, border:"1px solid #E5E0D5", background:"#FFFFFF", cursor:"pointer", fontSize:13 }}>-</button>
        </div>
        <div style={{ padding:24 }}>
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:600, color:"#4A4A4A", display:"block", marginBottom:5, letterSpacing:"0.5px" }}>
              Description *
            </label>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g., Market - produce"
              style={{ width:"100%", padding:"10px 12px", border:`1px solid ${err.desc ? RED : "#E5E0D5"}`, borderRadius:4, fontSize:12, outline:"none", boxSizing:"border-box", fontFamily:"'Inter', sans-serif" }} />
            {err.desc && <div style={{ fontSize:10, color:RED, marginTop:3 }}>{err.desc}</div>}
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ fontSize:11, fontWeight:600, color:"#4A4A4A", display:"block", marginBottom:5, letterSpacing:"0.5px" }}>
              Amount (KES) *
            </label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
              style={{ width:"100%", padding:"10px 12px", border:`1px solid ${err.amount ? RED : "#E5E0D5"}`, borderRadius:4, fontSize:13, fontWeight:600, outline:"none", boxSizing:"border-box", fontFamily:"'Inter', sans-serif" }} />
            {err.amount && <div style={{ fontSize:10, color:RED, marginTop:3 }}>{err.amount}</div>}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:4, border:"1px solid #E5E0D5", background:"#FFFFFF", fontSize:12, fontWeight:600, color:"#7A7A7A", cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>Cancel</button>
            <button onClick={handle} style={{ flex:2, padding:"10px", borderRadius:4, border:"none", background:GOLD, fontSize:12, fontWeight:600, color:"#FFFFFF", cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
              Record Disbursement
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- CLOSE SHIFT MODAL --------------------------------------------------------
function CloseShiftModal({ shift, onClose, onConfirm }) {
  const [actualCash, setActualCash] = useState("");
  const [notes,      setNotes]      = useState("");
  const [err,        setErr]        = useState("");

  const expected = expectedCashCalc(shift);
  const actual   = parseFloat(actualCash);
  const diff     = !isNaN(actual) ? actual - expected : null;

  const handle = () => {
    const a = parseFloat(actualCash);
    if (isNaN(a) || a < 0) { setErr("Enter actual cash counted"); return; }
    onConfirm(a, notes);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#FFFFFF", borderRadius:8, width:"100%", maxWidth:480, maxHeight:"90vh", display:"flex", flexDirection:"column", boxShadow:"0 20px 40px rgba(0,0,0,0.15)" }}>
        <div style={{ background:DARK_BG, padding:"22px 24px 18px", borderRadius:"8px 8px 0 0" }}>
          <div style={{ fontSize:15, fontWeight:600, color:GOLD, letterSpacing:"0.5px" }}>Close Shift</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginTop:2 }}>
            {shift.cashier} - Opened {shift.openedAt} - {new Date().toLocaleDateString("en-KE")}
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:24 }}>
          {/* Expected summary */}
          <div style={{ background:"#F8F8F8", borderRadius:6, padding:16, marginBottom:20 }}>
            <div style={{ fontSize:10, fontWeight:600, color:"#7A7A7A", letterSpacing:0.5, marginBottom:12, textTransform:"uppercase" }}>
              Expected Till Count
            </div>
            {[
              ["Opening Float",   `KES ${shift.float.toLocaleString()}`,           "#4A4A4A"],
              ["Cash Sales",      `KES ${cashSales(shift.sales).toLocaleString()}`, GREEN],
              ["Petty Cash Out",  `- KES ${pettyTotal(shift).toLocaleString()}`,    RED],
              ["Expected Cash",   `KES ${expected.toLocaleString()}`,               DARK_BG],
            ].map(([label, val, color]) => (
              <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:label==="Petty Cash Out"?"1px solid #E5E0D5":"none" }}>
                <span style={{ fontSize:11, color:"#7A7A7A" }}>{label}</span>
                <span style={{ fontSize:12, fontWeight:600, color }}>{val}</span>
              </div>
            ))}
          </div>

          {/* Actual cash input */}
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:11, fontWeight:600, color:"#4A4A4A", display:"block", marginBottom:6, letterSpacing:"0.5px" }}>
              Actual Cash in Till (KES) *
            </label>
            <input
              type="number"
              value={actualCash}
              onChange={(e) => { setActualCash(e.target.value); setErr(""); }}
              placeholder="Count and enter total cash"
              style={{ width:"100%", padding:"12px", border:`1px solid ${err ? RED : "#E5E0D5"}`, borderRadius:4, fontSize:15, fontWeight:600, outline:"none", boxSizing:"border-box", fontFamily:"'Inter', monospace" }}
            />
            {err && <div style={{ fontSize:10, color:RED, marginTop:4 }}>{err}</div>}
          </div>

          {/* Live variance indicator */}
          {diff !== null && (
            <div style={{
              borderRadius:6, padding:"12px 16px", marginBottom:16,
              background: diff === 0 ? "#ECFDF5" : diff > 0 ? "#EFF6FF" : "#FEF2F2",
              border: `1px solid ${diff === 0 ? "#D1FAE5" : diff > 0 ? "#BFDBFE" : "#FECACA"}`,
              display:"flex", alignItems:"center", justifyContent:"space-between",
            }}>
              <span style={{ fontSize:12, fontWeight:600, color: diff===0 ? GREEN : diff>0 ? "#1D4ED8" : RED }}>
                {diff === 0 ? "Till Balanced" : diff > 0 ? `Over by KES ${diff.toLocaleString()}` : `Short by KES ${Math.abs(diff).toLocaleString()}`}
              </span>
              <span style={{ fontSize:16, fontWeight:700, color: diff===0?GREEN:diff>0?"#1D4ED8":RED }}>
                {diff > 0 ? "+" : ""}{diff.toLocaleString()}
              </span>
            </div>
          )}

          {/* Notes */}
          <div style={{ marginBottom:4 }}>
            <label style={{ fontSize:11, fontWeight:600, color:"#4A4A4A", display:"block", marginBottom:6, letterSpacing:"0.5px" }}>
              Shift Notes <span style={{ fontWeight:400, color:"#7A7A7A" }}>(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Handover notes for next cashier..."
              style={{ width:"100%", padding:"10px 12px", border:"1px solid #E5E0D5", borderRadius:4, fontSize:12, outline:"none", resize:"none", boxSizing:"border-box", fontFamily:"'Inter', sans-serif" }}
            />
          </div>
        </div>

        <div style={{ padding:"16px 24px", borderTop:"1px solid #F0EDE6", display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:"11px", borderRadius:4, border:"1px solid #E5E0D5", background:"#FFFFFF", fontSize:12, fontWeight:600, color:"#7A7A7A", cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>Cancel</button>
          <button onClick={handle} style={{ flex:2, padding:"11px", borderRadius:4, border:"none", background:RED, fontSize:12, fontWeight:600, color:"#FFFFFF", cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
            Close Shift
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Z-REPORT MODAL -----------------------------------------------------------
function ZReportModal({ shift, onClose }) {
  const pay     = payBreakdown(shift.sales);
  const total   = shiftTotal(shift);
  const taxAmt  = Math.round(total / (1 + TAX + SVC) * TAX);
  const svcAmt  = Math.round(total / (1 + TAX + SVC) * SVC);
  const netSales= total - taxAmt - svcAmt;
  const exp     = expectedCashCalc(shift);
  const diff    = shift.actualCash != null ? shift.actualCash - exp : null;
  const ptTotal = pettyTotal(shift);
  const voidTotal = (shift.voids||[]).reduce((a,v)=>a+v.amount,0);

  const Row = ({ label, val, bold, color, border }) => (
    <div style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom: border ? "1px solid #E5E0D5" : "none" }}>
      <span style={{ fontSize:11, color: bold ? "#1A1A1A" : "#7A7A7A", fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ fontSize:11, fontWeight: bold ? 700 : 600, color: color || "#1A1A1A" }}>{val}</span>
    </div>
  );

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#FFFFFF", borderRadius:8, width:"100%", maxWidth:500, maxHeight:"92vh", display:"flex", flexDirection:"column", boxShadow:"0 20px 40px rgba(0,0,0,0.15)" }}>

        {/* Header */}
        <div style={{ background:DARK_BG, padding:"20px 24px 16px", borderRadius:"8px 8px 0 0", textAlign:"center" }}>
          <div style={{ fontSize:10, color:GOLD, fontWeight:600, letterSpacing:2, marginBottom:4, textTransform:"uppercase" }}>Z-REPORT</div>
          <div style={{ fontSize:17, fontWeight:600, color:"#FFFFFF", letterSpacing:"0.5px" }}>DAMASCUS HOTEL</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginTop:2 }}>
            {shift.date} - {shift.openedAt} - {shift.closedAt || "Open"} - {shift.cashier}
          </div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:1 }}>Shift: {shift.id}</div>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:24 }}>

          {/* Sales Summary */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", letterSpacing:1, marginBottom:8, textTransform:"uppercase" }}>Sales Summary</div>
            <Row label="Gross Revenue"    val={`KES ${total.toLocaleString()}`}     bold />
            <Row label="Net Sales"        val={`KES ${netSales.toLocaleString()}`}  />
            <Row label={`VAT (${(TAX*100).toFixed(0)}%)`} val={`KES ${taxAmt.toLocaleString()}`} />
            <Row label={`Service (${(SVC*100).toFixed(0)}%)`} val={`KES ${svcAmt.toLocaleString()}`} border />
            <Row label="Total Transactions" val={shift.sales.length} bold />
            <Row label="Discounts Given"  val={`KES ${(shift.discounts||0).toLocaleString()}`} color={RED} />
            <Row label="Void Amount"      val={`KES ${voidTotal.toLocaleString()}`} color={RED} />
          </div>

          {/* Payment Breakdown */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", letterSpacing:1, marginBottom:8, textTransform:"uppercase" }}>Payment Methods</div>
            {[
              ["Cash", pay.cash || 0, GREEN], 
              ["Card", pay.card || 0, "#C5A059"], 
              ["M-Pesa", pay.mpesa || 0, "#2E7D64"], 
              ["Gift Card", pay.gift || 0, "#8B3A3A"]
            ].map(([label, val, color]) => (
              <div key={label} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"6px 0" }}>
                <span style={{ fontSize:11, color:"#4A4A4A" }}>{label}</span>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:80, height:4, background:"#F0EDE6", borderRadius:2, overflow:"hidden" }}>
                    <div style={{ width:`${total > 0 ? (val/total*100) : 0}%`, height:"100%", background:color, borderRadius:2 }} />
                  </div>
                  <span style={{ fontSize:11, fontWeight:600, color, minWidth:80, textAlign:"right" }}>KES {val.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Cash Reconciliation */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", letterSpacing:1, marginBottom:8, textTransform:"uppercase" }}>Cash Reconciliation</div>
            <Row label="Opening Float"  val={`KES ${shift.float.toLocaleString()}`} />
            <Row label="Cash Sales"     val={`KES ${(pay.cash||0).toLocaleString()}`} />
            <Row label="Petty Cash Out" val={`- KES ${ptTotal.toLocaleString()}`} color={RED} border />
            <Row label="Expected Cash"  val={`KES ${exp.toLocaleString()}`} bold />
            {diff !== null && (
              <Row
                label="Actual Cash Counted"
                val={`KES ${shift.actualCash.toLocaleString()}`}
                bold color={diff === 0 ? GREEN : diff > 0 ? "#C5A059" : RED}
              />
            )}
            {diff !== null && (
              <div style={{ marginTop:8, padding:"10px 12px", borderRadius:4, background: diff===0 ? "#ECFDF5" : diff>0 ? "#EFF6FF" : "#FEF2F2", border:`1px solid ${diff===0 ? "#D1FAE5" : diff>0 ? "#BFDBFE" : "#FECACA"}` }}>
                <span style={{ fontSize:11, fontWeight:600, color: diff===0 ? GREEN : diff>0 ? "#C5A059" : RED }}>
                  {diff === 0 ? "Balanced" : diff > 0 ? `Over KES ${diff.toLocaleString()}` : `Short KES ${Math.abs(diff).toLocaleString()}`}
                </span>
              </div>
            )}
          </div>

          {/* Petty cash log */}
          {(shift.petty||[]).length > 0 && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", letterSpacing:1, marginBottom:8, textTransform:"uppercase" }}>Petty Cash Log</div>
              {(shift.petty||[]).map((p) => (
                <div key={p.id} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #F0EDE6" }}>
                  <span style={{ fontSize:11, color:"#4A4A4A" }}>{p.time} - {p.desc}</span>
                  <span style={{ fontSize:11, fontWeight:600, color:RED }}>- KES {p.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {/* Voids */}
          {(shift.voids||[]).length > 0 && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", letterSpacing:1, marginBottom:8, textTransform:"uppercase" }}>Void Transactions</div>
              {(shift.voids||[]).map((v) => (
                <div key={v.id} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #F0EDE6" }}>
                  <span style={{ fontSize:11, color:"#4A4A4A" }}>{v.time} - {v.item} <span style={{ color:"#7A7A7A" }}>({v.reason})</span></span>
                  <span style={{ fontSize:11, fontWeight:600, color:RED }}>KES {v.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {/* Top items */}
          <div>
            <div style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", letterSpacing:1, marginBottom:8, textTransform:"uppercase" }}>Top Items</div>
            {(() => {
              const counts = {};
              shift.sales.forEach((s) => s.items.forEach((i) => { counts[i.menuId] = (counts[i.menuId]||0) + i.qty; }));
              return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,qty]) => {
                const m = menuItems.find((x)=>x.id===id);
                return m ? (
                  <div key={id} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0" }}>
                    <span style={{ fontSize:11, color:"#4A4A4A" }}>{m.name}</span>
                    <span style={{ fontSize:11, fontWeight:500, color:"#7A7A7A" }}>-{qty} - KES {(m.price*qty).toLocaleString()}</span>
                  </div>
                ) : null;
              });
            })()}
          </div>

          {shift.notes && (
            <div style={{ marginTop:16, padding:"10px 14px", background:"#FEF9F0", borderRadius:4, border:"1px solid #FDE68A" }}>
              <div style={{ fontSize:9, fontWeight:600, color:GOLD, marginBottom:3, letterSpacing:"0.5px" }}>Shift Notes</div>
              <div style={{ fontSize:11, color:"#B8860B" }}>{shift.notes}</div>
            </div>
          )}
        </div>

        <div style={{ padding:"14px 24px", borderTop:"1px solid #F0EDE6", display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:4, border:"1px solid #E5E0D5", background:"#FFFFFF", fontSize:12, fontWeight:600, color:"#7A7A7A", cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>Close</button>
          <button onClick={() => window.print()} style={{ flex:1, padding:"10px", borderRadius:4, border:"none", background:DARK_BG, fontSize:12, fontWeight:600, color:GOLD, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
            Print Report
          </button>
        </div>
      </div>
    </div>
  );
}

// --- SHIFT DETAIL MODAL -------------------------------------------------------
function ShiftDetailModal({ shift, onZReport, onClose }) {
  const pay   = payBreakdown(shift.sales);
  const total = shiftTotal(shift);
  const diff  = variance(shift);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#FFFFFF", borderRadius:8, width:"100%", maxWidth:520, maxHeight:"88vh", display:"flex", flexDirection:"column", boxShadow:"0 20px 40px rgba(0,0,0,0.15)" }}>
        <div style={{ padding:"20px 24px 14px", borderBottom:"1px solid #F0EDE6", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:"#1A1A1A", letterSpacing:"0.5px" }}>{shift.id}</div>
            <div style={{ fontSize:10, color:"#7A7A7A", marginTop:2 }}>{shift.date} - {shift.cashier} - {shift.openedAt}-{shift.closedAt}</div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button onClick={onZReport} style={{ padding:"6px 14px", borderRadius:4, border:"none", background:DARK_BG, fontSize:11, fontWeight:600, color:GOLD, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>Z-Report</button>
            <button onClick={onClose} style={{ width:30, height:30, borderRadius:4, border:"1px solid #E5E0D5", background:"#FFFFFF", cursor:"pointer", fontSize:13 }}>-</button>
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:24 }}>
          {/* KPIs */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
            {[
              { label:"Revenue", val:`KES ${total.toLocaleString()}`, color:"#1A1A1A" },
              { label:"Orders",  val:shift.sales.length,              color:"#C5A059" },
              { label:diff===null?"Float":diff===0?"Balanced":diff>0?"Over":"Short",
                val: diff===null?`KES ${shift.float.toLocaleString()}`:diff===0?"KES 0":`${diff>0?"+":""}KES ${diff.toLocaleString()}`,
                color: diff===null?"#1A1A1A":diff===0?GREEN:diff>0?"#C5A059":RED },
            ].map((k)=>(
              <Card key={k.label} style={{ padding:12, textAlign:"center" }}>
                <div style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", letterSpacing:0.5, marginBottom:4, textTransform:"uppercase" }}>{k.label}</div>
                <div style={{ fontSize:14, fontWeight:700, color:k.color }}>{k.val}</div>
              </Card>
            ))}
          </div>

          {/* Payment breakdown */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:10, fontWeight:600, color:"#7A7A7A", marginBottom:8, letterSpacing:"0.5px", textTransform:"uppercase" }}>Payment Breakdown</div>
            <div style={{ display:"flex", gap:4, height:6, borderRadius:3, overflow:"hidden", marginBottom:8 }}>
              {[["cash","#2E7D64"],["card","#C5A059"],["mpesa","#2E7D64"],["gift","#8B3A3A"]].map(([k,c])=>
                total>0&&(pay[k]||0)>0 ? <div key={k} style={{ flex:pay[k]||0, background:c }} /> : null
              )}
            </div>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
              {[["Cash", pay.cash || 0, GREEN], ["Card", pay.card || 0, "#C5A059"], ["M-Pesa", pay.mpesa || 0, "#2E7D64"]].map(([l,v,c])=>(
                <span key={l} style={{ fontSize:10, color:c, fontWeight:600 }}>{l}: KES {v.toLocaleString()}</span>
              ))}
            </div>
          </div>

          {/* Transaction list */}
          <div>
            <div style={{ fontSize:10, fontWeight:600, color:"#7A7A7A", marginBottom:8, letterSpacing:"0.5px", textTransform:"uppercase" }}>
              Transactions ({shift.sales.length})
            </div>
            <div style={{ overflowY:"auto", maxHeight:240 }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead>
                  <tr style={{ background:"#F8F8F8" }}>
                    {["Invoice","Time","Items","Payment","Total"].map((h)=>(
                      <th key={h} style={{ padding:"6px 10px", textAlign:"left", fontSize:9, fontWeight:600, color:"#7A7A7A", borderBottom:"1px solid #F0EDE6", letterSpacing:"0.5px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shift.sales.map((s,i)=>(
                    <tr key={s.id} style={{ borderBottom:i<shift.sales.length-1?"1px solid #F0EDE6":"none" }}>
                      <td style={{ padding:"6px 10px", fontWeight:600, fontSize:11 }}>{s.id}</td>
                      <td style={{ padding:"6px 10px", color:"#7A7A7A", fontSize:11 }}>{s.time}</td>
                      <td style={{ padding:"6px 10px", color:"#7A7A7A", fontSize:11 }}>{s.items.reduce((a,x)=>a+x.qty,0)}</td>
                      <td style={{ padding:"6px 10px" }}>
                        <Badge
                          color={s.payment==="cash"?GREEN:s.payment==="card"?"#C5A059":"#2E7D64"}
                          bg={s.payment==="cash"?"#ECFDF5":s.payment==="card"?"#FEF9F0":"#ECFDF5"}
                        >{s.payment}</Badge>
                      </td>
                      <td style={{ padding:"6px 10px", fontWeight:600, fontSize:11 }}>KES {s.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Petty cash */}
          {(shift.petty||[]).length>0 && (
            <div style={{ marginTop:16 }}>
              <div style={{ fontSize:10, fontWeight:600, color:"#7A7A7A", marginBottom:8, letterSpacing:"0.5px", textTransform:"uppercase" }}>
                Petty Cash ({shift.petty.length})
              </div>
              {(shift.petty||[]).map((p)=>(
                <div key={p.id} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #F0EDE6" }}>
                  <span style={{ fontSize:11, color:"#4A4A4A" }}>{p.time} - {p.desc} <span style={{ color:"#7A7A7A" }}>by {p.by}</span></span>
                  <span style={{ fontSize:11, fontWeight:600, color:RED }}>-KES {p.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- LIVE SHIFT PANEL (active shift) -----------------------------------------
function LiveShiftPanel({ shift, setShift, onClose, onCloseShift, user }) {
  const [showPetty,  setShowPetty]  = useState(false);
  const [showZReport,setShowZReport]= useState(false);
  const total = shiftTotal(shift);
  const pay   = payBreakdown(shift.sales);
  const exp   = expectedCashCalc(shift);
  const pt    = pettyTotal(shift);

  const addPetty = (entry) => {
    setShift((prev) => ({ ...prev, petty: [...(prev.petty||[]), entry] }));
    setShowPetty(false);
  };

  return (
    <div style={{ background:"#FFFFFF", borderRadius:8, border:`1px solid ${GOLD}`, padding:0, overflow:"hidden", boxShadow:`0 2px 8px ${GOLD}20` }}>
      {/* Active header */}
      <div style={{ background:DARK_BG, padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ width:8, height:8, borderRadius:"50%", background:"#22C55E", display:"inline-block", boxShadow:"0 0 0 2px rgba(34,197,94,0.2)" }} />
          <div>
            <div style={{ color:GOLD, fontWeight:600, fontSize:12, letterSpacing:"0.5px" }}>ACTIVE SHIFT - {shift.id}</div>
            <div style={{ color:"rgba(255,255,255,0.4)", fontSize:9 }}>
              Opened {shift.openedAt} - Float KES {shift.float.toLocaleString()} - {shift.cashier}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => setShowPetty(true)} style={{ padding:"6px 12px", borderRadius:4, border:"1px solid rgba(255,255,255,0.15)", background:"transparent", color:"rgba(255,255,255,0.7)", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
            Petty Cash
          </button>
          <button onClick={() => setShowZReport(true)} style={{ padding:"6px 12px", borderRadius:4, border:`1px solid ${GOLD}`, background:"transparent", color:GOLD, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
            X-Read
          </button>
          <button onClick={onCloseShift} style={{ padding:"6px 14px", borderRadius:4, border:"none", background:RED, color:"#FFFFFF", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
            Close Shift
          </button>
        </div>
      </div>

      {/* Live stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:1, background:"#F0EDE6" }}>
        {[
          { label:"Revenue",   val:`KES ${total.toLocaleString()}`,              color:"#1A1A1A" },
          { label:"Orders",    val:shift.sales.length,                           color:"#C5A059" },
          { label:"Cash in Till", val:`KES ${exp.toLocaleString()}`,             color:GREEN },
          { label:"Petty Out", val:`KES ${pt.toLocaleString()}`,                  color:pt>0?RED:"#7A7A7A" },
        ].map((k)=>(
          <div key={k.label} style={{ background:"#FFFFFF", padding:"14px 16px" }}>
            <div style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", letterSpacing:0.5, marginBottom:4, textTransform:"uppercase" }}>{k.label}</div>
            <div style={{ fontSize:16, fontWeight:700, color:k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Payment split */}
      <div style={{ padding:"12px 20px 14px", borderTop:"1px solid #F0EDE6", display:"flex", gap:16, flexWrap:"wrap" }}>
        {[["Cash", pay.cash || 0, GREEN], ["Card", pay.card || 0, "#C5A059"], ["M-Pesa", pay.mpesa || 0, "#2E7D64"], ["Gift", pay.gift || 0, "#8B3A3A"]].map(([l,v,c])=>(
          <div key={l}>
            <div style={{ fontSize:9, color:"#7A7A7A", fontWeight:600, letterSpacing:"0.5px" }}>{l}</div>
            <div style={{ fontSize:12, fontWeight:600, color:v>0?c:"#D1D5DB" }}>KES {v.toLocaleString()}</div>
          </div>
        ))}
        {(shift.petty||[]).length>0 && (
          <div style={{ marginLeft:"auto" }}>
            <div style={{ fontSize:9, color:"#7A7A7A", fontWeight:600, letterSpacing:"0.5px" }}>Petty Cash ({shift.petty.length} entries)</div>
            <div style={{ fontSize:12, fontWeight:600, color:RED }}>-KES {pt.toLocaleString()}</div>
          </div>
        )}
      </div>

      {showPetty && <PettyCashModal user={user} onAdd={addPetty} onClose={() => setShowPetty(false)} />}
      {showZReport && <ZReportModal shift={{ ...shift, closedAt:null }} onClose={() => setShowZReport(false)} />}
    </div>
  );
}

// --- MAIN SHIFT VIEW ----------------------------------------------------------
export function ShiftView({ sales, user, shifts: shiftsProp, setShifts: setShiftsProp, activeShift: activeShiftProp, setActiveShift: setActiveShiftProp, menuItems = [] }) {
  const [_shiftsLocal,      _setShiftsLocal]      = useState(INIT_SHIFTS);
  const [_activeShiftLocal, _setActiveShiftLocal] = useState(null);
  // Use lifted state when provided, otherwise local
  const shifts      = shiftsProp      !== undefined ? shiftsProp      : _shiftsLocal;
  const setShifts   = setShiftsProp   !== undefined ? setShiftsProp   : _setShiftsLocal;
  const activeShift = activeShiftProp !== undefined ? activeShiftProp : _activeShiftLocal;
  const setActiveShift = setActiveShiftProp !== undefined ? setActiveShiftProp : _setActiveShiftLocal;
  const [modal,       setModal]       = useState(null); // open | close | detail | zreport
  const [detailShift, setDetailShift] = useState(null);
  const [toast,       setToast]       = useState("");
  const [tab,         setTab]         = useState("history"); // history | summary

  // -- Shift history filters --
  const [filterCashier, setFilterCashier] = useState("all");
  const [filterFrom,    setFilterFrom]    = useState("");
  const [filterTo,      setFilterTo]      = useState("");

  const allCashiers = [...new Set(shifts.map((s) => s.cashier))].sort();

  const filteredShifts = shifts.filter((s) => {
    if (filterCashier !== "all" && s.cashier !== filterCashier) return false;
    if (filterFrom && s.date < filterFrom) return false;
    if (filterTo   && s.date > filterTo)   return false;
    return true;
  });

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  // -- Sync live sales into active shift --------------------------------------
  useEffect(() => {
    if (!activeShift) return;
    const today = ds(0);
    const shiftSaleIds = new Set((activeShift.sales||[]).map(s => s.id));
    const newSales = (sales||[]).filter(s => s.date === today && !shiftSaleIds.has(s.id));
    if (newSales.length > 0) {
      setActiveShift(prev => prev ? { ...prev, sales: [...(prev.sales||[]), ...newSales] } : prev);
    }
  }, [sales]);

  // -- Open Shift --
  const handleOpenShift = (float) => {
    const now = fmtTime();
    const newShift = {
      id:        `SHF-${String(Date.now()).slice(-4)}`,
      date:      ds(0),
      cashier:   user.name,
      openedAt:  now,
      closedAt:  null,
      float,
      status:    "open",
      sales:     [...sales.filter((s) => s.date === ds(0))],
      voids:     [],
      discounts: 0,
      petty:     [],
    };
    setActiveShift(newShift);
    setModal(null);
    showToast(`Shift ${newShift.id} opened at ${now}`);
  };

  // -- Close Shift --
  const handleCloseShift = (actualCash, notes) => {
    const closed = {
      ...activeShift,
      closedAt:   fmtTime(),
      actualCash,
      notes,
      status:     "closed",
    };
    setShifts((prev) => [closed, ...prev]);
    setActiveShift(null);
    setModal(null);
    showToast(`Shift ${closed.id} closed. ${variance(closed) === 0 ? "Till balanced" : variance(closed) > 0 ? `Over KES ${variance(closed)}` : `Short KES ${Math.abs(variance(closed))}`}`);
    setDetailShift(closed);
    setModal("zreport");
  };

  // -- Summary chart data --
  const summaryData = shifts.slice(0, 7).reverse().map((s) => ({
    name: `${s.cashier.split(" ")[0]} ${s.openedAt}`,
    revenue: shiftTotal(s),
    cash:    payBreakdown(s.sales).cash || 0,
    card:    payBreakdown(s.sales).card || 0,
    mpesa:   payBreakdown(s.sales).mpesa || 0,
    short:   variance(s) < 0 ? Math.abs(variance(s)) : 0,
    over:    variance(s) > 0 ? variance(s) : 0,
  }));

  const totalRevAll   = filteredShifts.reduce((a, s) => a + shiftTotal(s), 0);
  const avgRevPerShift = filteredShifts.length > 0 ? Math.round(totalRevAll / filteredShifts.length) : 0;
  const shortages     = filteredShifts.filter((s) => (variance(s)||0) < 0);
  const totalShortage = shortages.reduce((a, s) => a + Math.abs(variance(s)||0), 0);

  return (
    <div style={{ flex:1, overflowY:"auto", padding:28, background:GRAY_BG, position:"relative" }}>
      <Toast msg={toast} />

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
        <SectionHeader
          title="Shift & Cash Management"
          sub={`${shifts.length} closed shifts - ${new Date().toLocaleDateString("en-KE")}`}
        />
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          {/* Tab switcher */}
          <div style={{ display:"flex", background:"#FFFFFF", border:"1px solid #E5E0D5", borderRadius:4, padding:3, gap:3 }}>
            {[["history","History"],["summary","Summary"]].map(([id,label])=>(
              <button key={id} onClick={() => setTab(id)} style={{
                padding:"6px 16px", borderRadius:4, border:"none", cursor:"pointer",
                background: tab===id ? DARK_BG : "transparent",
                color: tab===id ? GOLD : "#7A7A7A",
                fontSize:11, fontWeight:600, transition:"all 0.15s", fontFamily:"'Inter', sans-serif",
              }}>{label}</button>
            ))}
          </div>
          {!activeShift && (
            <button
              onClick={() => setModal("open")}
              style={{ padding:"8px 20px", borderRadius:4, border:"none", background:DARK_BG, color:GOLD, fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:6, fontFamily:"'Inter', sans-serif" }}
            >
              Open Shift
            </button>
          )}
        </div>
      </div>

      {/* -- ACTIVE SHIFT BANNER -- */}
      {activeShift && (
        <div style={{ marginBottom:24 }}>
          <LiveShiftPanel
            shift={activeShift}
            setShift={setActiveShift}
            user={user}
            onCloseShift={() => setModal("close")}
          />
        </div>
      )}

      {/* -- HISTORY TAB -- */}
      {tab === "history" && (
        <>
          {/* Filter bar */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={filterCashier}
              onChange={(e) => setFilterCashier(e.target.value)}
              style={{ padding: "8px 14px", borderRadius: 4, border: "1px solid #E5E0D5", background: "#FFFFFF", fontSize: 11, color: "#4A4A4A", cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
              <option value="all">All Cashiers</option>
              {allCashiers.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#FFFFFF", border: "1px solid #E5E0D5", borderRadius: 4, padding: "0 12px" }}>
              <span style={{ fontSize: 10, color: "#7A7A7A", fontWeight: 600, letterSpacing:"0.5px" }}>From</span>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                style={{ border: "none", outline: "none", fontSize: 11, padding: "8px 0", background: "transparent", color: "#4A4A4A", fontFamily: "'Inter', sans-serif" }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#FFFFFF", border: "1px solid #E5E0D5", borderRadius: 4, padding: "0 12px" }}>
              <span style={{ fontSize: 10, color: "#7A7A7A", fontWeight: 600, letterSpacing:"0.5px" }}>To</span>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                style={{ border: "none", outline: "none", fontSize: 11, padding: "8px 0", background: "transparent", color: "#4A4A4A", fontFamily: "'Inter', sans-serif" }}
              />
            </div>
            {(filterCashier !== "all" || filterFrom || filterTo) && (
              <button
                onClick={() => { setFilterCashier("all"); setFilterFrom(""); setFilterTo(""); }}
                style={{ padding: "7px 14px", borderRadius: 4, border: "1px solid #FECACA", background: "#FFFFFF", fontSize: 10, fontWeight: 600, color: RED, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                Clear Filters
              </button>
            )}
            <span style={{ marginLeft: "auto", fontSize: 10, color: "#7A7A7A" }}>
              {filteredShifts.length} of {shifts.length} shifts
            </span>
          </div>

          {/* Summary KPI row */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
            {[
              { label:"TOTAL SHIFTS",    val:shifts.length,                       color:"#1A1A1A" },
              { label:"AVG REVENUE",     val:`KES ${avgRevPerShift.toLocaleString()}`, color:"#C5A059" },
              { label:"CASH SHORTAGES",  val:shortages.length,                    color:shortages.length>0?RED:GREEN },
              { label:"TOTAL SHORT",     val:`KES ${totalShortage.toLocaleString()}`, color:totalShortage>0?RED:GREEN },
            ].map((k)=>(
              <Card key={k.label} style={{ padding:16, borderTop:`3px solid ${k.color}` }}>
                <div style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", letterSpacing:0.5, marginBottom:6, textTransform:"uppercase" }}>{k.label}</div>
                <div style={{ fontSize:18, fontWeight:700, color:k.color }}>{k.val}</div>
              </Card>
            ))}
          </div>

          {/* Shifts table */}
          <Card style={{ padding:0, overflow:"hidden" }}>
            <div style={{ padding:"14px 20px", borderBottom:"1px solid #F0EDE6", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ fontSize:13, fontWeight:600, color:"#1A1A1A", letterSpacing:"0.5px" }}>Shift History</div>
              <div style={{ fontSize:10, color:"#7A7A7A" }}>{filteredShifts.length} shifts shown</div>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:"#F8F8F8" }}>
                    {["Shift","Date","Cashier","Opened","Closed","Orders","Revenue","Cash","Card","M-Pesa","Variance",""].map((h)=>(
                      <th key={h} style={{ padding:"9px 12px", textAlign:"left", fontSize:9, fontWeight:600, color:"#7A7A7A", borderBottom:"1px solid #F0EDE6", whiteSpace:"nowrap", letterSpacing:"0.5px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredShifts.map((s, i) => {
                    const pay  = payBreakdown(s.sales);
                    const tot  = shiftTotal(s);
                    const diff = variance(s);
                    return (
                      <tr key={s.id} style={{ borderBottom:i<filteredShifts.length-1?"1px solid #F0EDE6":"none", cursor:"pointer" }}
                        onMouseEnter={(e) => e.currentTarget.style.background="#F8F8F8"}
                        onMouseLeave={(e) => e.currentTarget.style.background=""}
                      >
                        <td style={{ padding:"9px 12px", fontSize:11, fontWeight:600, color:"#C5A059" }}>{s.id}</td>
                        <td style={{ padding:"9px 12px", fontSize:11, color:"#7A7A7A" }}>{s.date}</td>
                        <td style={{ padding:"9px 12px", fontSize:11 }}>{s.cashier.split(" ")[0]}</td>
                        <td style={{ padding:"9px 12px", fontSize:11, color:"#7A7A7A", fontFamily:"monospace" }}>{s.openedAt}</td>
                        <td style={{ padding:"9px 12px", fontSize:11, color:"#7A7A7A", fontFamily:"monospace" }}>{s.closedAt||"-"}</td>
                        <td style={{ padding:"9px 12px", fontSize:11, textAlign:"center" }}>{s.sales.length}</td>
                        <td style={{ padding:"9px 12px", fontSize:11, fontWeight:600 }}>KES {tot.toLocaleString()}</td>
                        <td style={{ padding:"9px 12px", fontSize:11, color:GREEN }}>KES {(pay.cash||0).toLocaleString()}</td>
                        <td style={{ padding:"9px 12px", fontSize:11, color:"#C5A059" }}>KES {(pay.card||0).toLocaleString()}</td>
                        <td style={{ padding:"9px 12px", fontSize:11, color:"#2E7D64" }}>KES {(pay.mpesa||0).toLocaleString()}</td>
                        <td style={{ padding:"9px 12px" }}>
                          {diff === null ? <Badge color="#7A7A7A" bg="#F8F8F8">Open</Badge>
                            : diff === 0  ? <Badge color={GREEN} bg="#ECFDF5">Balanced</Badge>
                            : diff > 0    ? <Badge color="#C5A059" bg="#FEF9F0">+{diff.toLocaleString()}</Badge>
                            :               <Badge color={RED} bg="#FEF2F2">-{Math.abs(diff).toLocaleString()}</Badge>}
                        </td>
                        <td style={{ padding:"9px 12px" }}>
                          <div style={{ display:"flex", gap:6 }}>
                            <button
                              onClick={() => { setDetailShift(s); setModal("detail"); }}
                              style={{ padding:"5px 12px", borderRadius:4, border:"1px solid #E5E0D5", background:"#FFFFFF", fontSize:10, fontWeight:600, color:"#4A4A4A", cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
                              View
                            </button>
                            <button
                              onClick={() => { setDetailShift(s); setModal("zreport"); }}
                              style={{ padding:"5px 12px", borderRadius:4, border:"none", background:DARK_BG, fontSize:10, fontWeight:600, color:GOLD, cursor:"pointer", fontFamily:"'Inter', sans-serif" }}>
                              Z
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredShifts.length === 0 && (
                    <tr>
                      <td colSpan={12} style={{ padding: "32px", textAlign: "center", color: "#7A7A7A", fontSize: 12 }}>
                        No shifts match current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* -- SUMMARY TAB -- */}
      {tab === "summary" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
          <Card>
            <SectionHeader title="Revenue per Shift" />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={summaryData} margin={{ top:0, right:10, left:0, bottom:50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize:9, fill:"#7A7A7A" }} angle={-35} textAnchor="end" axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v)=>`${(v/1000).toFixed(0)}K`} tick={{ fontSize:9, fill:"#7A7A7A" }} axisLine={false} tickLine={false} width={36} />
                <Tooltip formatter={(v)=>[`KES ${v.toLocaleString()}`]} contentStyle={{ borderRadius:6, border:"1px solid #E5E0D5", fontSize:11 }} />
                <Bar dataKey="cash"  stackId="a" fill={GREEN}    name="Cash" />
                <Bar dataKey="card"  stackId="a" fill="#C5A059"  name="Card" />
                <Bar dataKey="mpesa" stackId="a" fill="#2E7D64"  name="M-Pesa" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <SectionHeader title="Variance History" />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={summaryData} margin={{ top:0, right:10, left:0, bottom:50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize:9, fill:"#7A7A7A" }} angle={-35} textAnchor="end" axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:9, fill:"#7A7A7A" }} axisLine={false} tickLine={false} width={36} />
                <Tooltip formatter={(v)=>[`KES ${v.toLocaleString()}`]} contentStyle={{ borderRadius:6, border:"1px solid #E5E0D5", fontSize:11 }} />
                <Bar dataKey="over"  fill="#C5A059" radius={[4,4,0,0]} name="Over" />
                <Bar dataKey="short" fill={RED}     radius={[4,4,0,0]} name="Short" />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display:"flex", gap:12, marginTop:8, justifyContent:"center" }}>
              <span style={{ fontSize:10, color:"#C5A059", fontWeight:600 }}>- Over</span>
              <span style={{ fontSize:10, color:RED, fontWeight:600 }}>- Short</span>
            </div>
          </Card>

          {/* Cashier performance */}
          <Card style={{ gridColumn:"1/-1" }}>
            <SectionHeader title="Cashier Performance" />
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"#F8F8F8" }}>
                  {["Cashier","Shifts","Revenue","Avg / Shift","Balanced","Issues"].map((h)=>(
                    <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:9, fontWeight:600, color:"#7A7A7A", borderBottom:"1px solid #F0EDE6", letterSpacing:"0.5px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const byName = {};
                  shifts.forEach((s)=>{
                    if (!byName[s.cashier]) byName[s.cashier]={ shifts:0, revenue:0, balanced:0, issues:0 };
                    byName[s.cashier].shifts++;
                    byName[s.cashier].revenue += shiftTotal(s);
                    const v = variance(s);
                    if (v===0) byName[s.cashier].balanced++;
                    else if (v!==null) byName[s.cashier].issues++;
                  });
                  return Object.entries(byName).map(([name,d], i)=>(
                    <tr key={name} style={{ borderBottom:i<Object.keys(byName).length-1?"1px solid #F0EDE6":"none" }}>
                      <td style={{ padding:"9px 12px", fontSize:12, fontWeight:600, color:"#1A1A1A" }}>{name}</td>
                      <td style={{ padding:"9px 12px", fontSize:11, color:"#7A7A7A" }}>{d.shifts}</td>
                      <td style={{ padding:"9px 12px", fontSize:11, fontWeight:600 }}>KES {d.revenue.toLocaleString()}</td>
                      <td style={{ padding:"9px 12px", fontSize:11}}>KES {Math.round(d.revenue/d.shifts).toLocaleString()}</td>

<td style={{ padding:"9px 12px" }}><Badge color={GREEN} bg="#ECFDF5">{d.balanced} / {d.shifts}</Badge></td> <td style={{ padding:"9px 12px" }}> {d.issues>0 ? <Badge color={RED} bg="#FEF2F2">{d.issues} variance(s)</Badge> : <Badge color={GREEN} bg="#ECFDF5">Clean</Badge>} </td> </tr> )); })()} </tbody> </table> </Card> </div> )}
{/* -- MODALS -- */}
{modal === "open" && <OpenShiftModal user={user} onOpen={handleOpenShift} onClose={() => setModal(null)} />}
{modal === "close" && activeShift && <CloseShiftModal shift={activeShift} onClose={() => setModal(null)} onConfirm={handleCloseShift} />}
{modal === "detail" && detailShift && (
<ShiftDetailModal
shift={detailShift}
onZReport={() => setModal("zreport")}
onClose={() => setModal(null)}
/>
)}
{modal === "zreport" && detailShift && <ZReportModal shift={detailShift} onClose={() => setModal(null)} />}

</div> ); }