import { useState, useCallback, useMemo, useEffect } from "react";
import { fmt, fmtK } from "../utils";
import { inventoryApi } from "../api";

const FONTS = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Cormorant+Garamond:wght@400;500;600&display=swap";

const computeVariance = (system, physical) =>
  parseFloat(physical) - parseFloat(system);

const classifyExpiry = (dateStr) => {
  if (!dateStr) return { status:"unknown", label:"-", color:"#94a3b8", bg:"#f1f5f9" };
  const days = Math.round((new Date(dateStr) - new Date()) / 86400000);
  if (days < 0)   return { status:"expired",  days, label:"Expired",       color:"#8B3A3A", bg:"#FEF2F2" };
  if (days === 0) return { status:"expiring", days, label:"Expires Today", color:"#DC2626", bg:"#FEF2F2" };
  if (days <= 3)  return { status:"critical", days, label:String(days)+"d left", color:"#B8860B", bg:"#FFF7ED" };
  if (days <= 7)  return { status:"warning",  days, label:String(days)+"d left", color:"#EAB308", bg:"#FEFCE8" };
  return              { status:"ok",         days, label:String(days)+"d left", color:"#2E7D64", bg:"#F0FDF4" };
};

const ALL_CATEGORIES = ["Proteins","Grains","Vegetables","Oils","Spices","Dairy","Beverages","Spirits","Produce","Bakery","Utilities","Other"];
const UNITS = ["g","kg","ml","l","pcs","bunch","bottle","can","packet","box","bundle","crate"];

function TableSkeleton() {
  return (
    <div style={{ padding:"0 0 8px" }}>
      {[1,2,3,4,5,6].map(i => (
        <div key={i} style={{ height:52, background:"#F3F4F6", borderRadius:6, marginBottom:6, opacity:1-i*0.12, animation:"skeletonPulse 1.4s ease-in-out infinite" }}/>
      ))}
    </div>
  );
}

function ExpiryBadge({ dateStr }) {
  const e = classifyExpiry(dateStr);
  return <span style={{ background:e.bg, color:e.color, fontSize:10, fontWeight:600, padding:"3px 10px", borderRadius:4, letterSpacing:0.3, whiteSpace:"nowrap" }}>{e.label}</span>;
}

function VarianceCell({ variance, shrinkageValue }) {
  if (variance === null || isNaN(variance)) return <span style={{ color:"#D1D5DB" }}>-</span>;
  const isPos  = variance > 0;
  const isZero = variance === 0;
  const color  = isZero ? "#6B7280" : isPos ? "#2E7D64" : "#8B3A3A";
  const bg     = isZero ? "#F3F4F6" : isPos ? "#ECFDF5" : "#FEF2F2";
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
      <span style={{ background:bg, color, fontWeight:600, fontSize:11, padding:"2px 8px", borderRadius:4, display:"inline-flex", alignItems:"center", gap:3, fontFamily:"'Inter', monospace" }}>
        {isPos ? "+" : ""}{variance.toFixed(2)}
      </span>
      {!isZero && <span style={{ fontSize:10, color, fontWeight:500 }}>{isPos ? "surplus" : "loss"} {fmtK(Math.abs(shrinkageValue))}</span>}
    </div>
  );
}

function AuditInput({ value, onChange }) {
  return (
    <input type="number" min="0" step="0.01" value={value ?? ""} onChange={e => onChange(e.target.value)}
      placeholder="Count"
      style={{ width:90, border:"1px solid #C5A059", borderRadius:4, padding:"5px 8px", fontSize:12, textAlign:"center", fontFamily:"'Inter', monospace", outline:"none", background:"#FEF9F0", color:"#A0823A", fontWeight:500 }} />
  );
}

function AuditSummary({ items, auditData }) {
  const summary = useMemo(() => {
    let totalLoss=0, totalSurplus=0, countAudited=0, countDiscrepancy=0;
    items.forEach(item => {
      const physical = auditData[item.id];
      if (physical === undefined || physical === "") return;
      countAudited++;
      const v = computeVariance(item.qty, physical);
      const val = v * item.costPerUnit;
      if (v < 0) { totalLoss += Math.abs(val); countDiscrepancy++; }
      if (v > 0) { totalSurplus += val; }
    });
    return { totalLoss, totalSurplus, countAudited, countDiscrepancy };
  }, [items, auditData]);

  return (
    <div style={{ background:"linear-gradient(135deg, #1A1A1A 0%, #2C3E50 100%)", borderRadius:8, padding:"16px 24px", marginBottom:20, display:"flex", flexWrap:"wrap", gap:30 }}>
      {[
        { label:"Items Audited",    value:String(summary.countAudited)+" / "+String(items.length) },
        { label:"Discrepancies",    value:summary.countDiscrepancy, warn: summary.countDiscrepancy > 0 },
        { label:"Shrinkage (Loss)", value:fmtK(summary.totalLoss),  warn: summary.totalLoss > 0 },
        { label:"Surplus Found",    value:fmtK(summary.totalSurplus), good: summary.totalSurplus > 0 },
      ].map(kpi => (
        <div key={kpi.label} style={{ minWidth:130 }}>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", letterSpacing:1, textTransform:"uppercase" }}>{kpi.label}</div>
          <div style={{ fontSize:18, fontWeight:600, fontFamily:"'Inter', monospace", marginTop:3, color: kpi.warn ? "#FCA5A5" : kpi.good ? "#86EFAC" : "rgba(255,255,255,0.9)" }}>{kpi.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Add Ingredient Modal ──────────────────────────────────────────────────────
function AddIngredientModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    name:"", unit:"g", category:"", reorder_level:"",
    purchase_unit:"", purchase_qty:"", purchase_cost:"", opening_stock:"",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const costPerUnit = (form.purchase_cost && form.purchase_qty && parseFloat(form.purchase_qty) > 0)
    ? (parseFloat(form.purchase_cost) / parseFloat(form.purchase_qty)).toFixed(4)
    : "";

  const save = async () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!form.category)    { setError("Category is required"); return; }
    setSaving(true); setError("");
    try {
      const id = "ING-" + form.name.replace(/\s+/g,"").toUpperCase().slice(0,6) + "-" + Date.now().toString().slice(-4);
      const ing = await inventoryApi.addIngredient({
        id,
        name:           form.name.trim(),
        unit:           form.unit,
        category:       form.category,
        reorder_level:  parseFloat(form.reorder_level) || 0,
        purchase_unit:  form.purchase_unit || null,
        purchase_qty:   parseFloat(form.purchase_qty) || null,
        purchase_cost:  parseFloat(form.purchase_cost) || null,
        cost_per_unit:  parseFloat(costPerUnit) || 0,
      });
      if (form.opening_stock && parseFloat(form.opening_stock) > 0) {
        await inventoryApi.receiveBatch({ ingredient_id: ing.id, qty: parseFloat(form.opening_stock), notes:"Opening stock" });
      }
      onSaved(ing);
    } catch(e) {
      setError(e?.response?.data?.error || "Save failed — is the backend running?");
    } finally { setSaving(false); }
  };

  const fi2 = { border:"1px solid #E5E0D5", borderRadius:4, padding:"8px 12px", fontSize:13, outline:"none", background:"#FFFFFF", width:"100%", boxSizing:"border-box", fontFamily:"'Inter',sans-serif" };
  const isUtil = form.category === "Utilities";

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#FFFFFF", borderRadius:8, padding:28, width:520, maxWidth:"95vw", boxShadow:"0 8px 32px rgba(0,0,0,0.18)", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:"#1A1A1A" }}>Add Ingredient to Inventory</div>
            <div style={{ fontSize:11, color:"#7A7A7A", marginTop:2 }}>For water, gas, charcoal — set category to Utilities</div>
          </div>
          <button onClick={onClose} style={{ border:"none", background:"none", cursor:"pointer", fontSize:20, color:"#7A7A7A", lineHeight:1 }}>×</button>
        </div>

        {error && <div style={{ padding:"8px 12px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:4, fontSize:11, color:"#8B3A3A", marginBottom:14 }}>{error}</div>}

        {isUtil && (
          <div style={{ padding:"8px 12px", background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:4, fontSize:11, color:"#92400E", marginBottom:14 }}>
            ⚡ Utility ingredients (water, gas, charcoal, firewood) will appear with a special badge in the recipe builder so you can attach them to menu items.
          </div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={{ fontSize:10, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>Ingredient Name *</label>
            <input value={form.name} onChange={e => set("name", e.target.value)}
              placeholder="e.g. Fresh Milk, LPG Gas, Charcoal"
              style={{ ...fi2, marginTop:4 }} autoFocus />
          </div>

          <div>
            <label style={{ fontSize:10, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>Category *</label>
            <select value={form.category} onChange={e => set("category", e.target.value)}
              style={{ ...fi2, marginTop:4, borderColor: form.category === "Utilities" ? "#FDE68A" : "#E5E0D5", background: form.category === "Utilities" ? "#FFFBEB" : "#FFF" }}>
              <option value="">Select...</option>
              {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}{c === "Utilities" ? " ⚡ (water, gas, charcoal)" : ""}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize:10, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>Cooking Unit</label>
            <select value={form.unit} onChange={e => set("unit", e.target.value)} style={{ ...fi2, marginTop:4 }}>
              {UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>

          {/* Purchase info */}
          <div style={{ gridColumn:"1/-1", borderTop:"1px solid #F0EDE6", paddingTop:12, marginTop:4 }}>
            <div style={{ fontSize:10, fontWeight:600, color:"#C5A059", textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 }}>
              How you buy it (for auto cost calculation)
            </div>
          </div>

          <div>
            <label style={{ fontSize:10, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>Purchase Unit</label>
            <select value={form.purchase_unit} onChange={e => set("purchase_unit", e.target.value)} style={{ ...fi2, marginTop:4 }}>
              <option value="">Same as cooking unit</option>
              {UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize:10, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>
              Cooking units per purchase unit
            </label>
            <input type="number" min="0" step="0.001" value={form.purchase_qty}
              onChange={e => set("purchase_qty", e.target.value)}
              placeholder="e.g. 1000 (1kg = 1000g)"
              style={{ ...fi2, marginTop:4 }} />
          </div>

          <div>
            <label style={{ fontSize:10, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>Purchase Cost (KES)</label>
            <input type="number" min="0" step="0.01" value={form.purchase_cost}
              onChange={e => set("purchase_cost", e.target.value)}
              placeholder="e.g. 120 for 1kg sugar"
              style={{ ...fi2, marginTop:4 }} />
          </div>

          <div>
            <label style={{ fontSize:10, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>Auto Cost per {form.unit || "unit"}</label>
            <div style={{ marginTop:4, padding:"8px 12px", background: costPerUnit ? "#F0FDF4" : "#F8F8F8", border:"1px solid #E5E0D5", borderRadius:4, fontSize:13, fontWeight:600, color: costPerUnit ? "#16A34A" : "#9CA3AF" }}>
              {costPerUnit ? "KES " + costPerUnit : "Fill purchase info above"}
            </div>
          </div>

          <div style={{ gridColumn:"1/-1", borderTop:"1px solid #F0EDE6", paddingTop:12, marginTop:4 }}>
            <div style={{ fontSize:10, fontWeight:600, color:"#C5A059", textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 }}>Stock & Alerts</div>
          </div>

          <div>
            <label style={{ fontSize:10, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>Opening Stock ({form.unit})</label>
            <input type="number" min="0" step="0.01" value={form.opening_stock}
              onChange={e => set("opening_stock", e.target.value)}
              placeholder="Current quantity on hand"
              style={{ ...fi2, marginTop:4 }} />
          </div>

          <div>
            <label style={{ fontSize:10, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>Reorder Level ({form.unit})</label>
            <input type="number" min="0" step="0.01" value={form.reorder_level}
              onChange={e => set("reorder_level", e.target.value)}
              placeholder="Alert when below this"
              style={{ ...fi2, marginTop:4 }} />
          </div>
        </div>

        <div style={{ display:"flex", gap:10, marginTop:20 }}>
          <button onClick={onClose} style={{ padding:"10px 20px", borderRadius:4, border:"1px solid #E5E0D5", background:"#FFF", color:"#7A7A7A", fontWeight:600, fontSize:12, cursor:"pointer" }}>Cancel</button>
          <button onClick={save} disabled={saving}
            style={{ flex:1, padding:"10px", borderRadius:4, border:"none", background: saving ? "#9CA3AF" : "#1A1A1A", color:"#FFF", fontWeight:600, fontSize:12, cursor: saving ? "default" : "pointer" }}>
            {saving ? "Saving..." : "Save Ingredient"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BatchPanel({ item, onClose }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const handleClose = () => { setVisible(false); setTimeout(onClose, 300); };
  const isUtil = item?.category === "Utilities";

  return (
    <>
      <div onClick={handleClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:200, opacity: visible ? 1 : 0, transition:"opacity 0.3s ease", backdropFilter:"blur(2px)" }}/>
      <div style={{ position:"fixed", right:0, top:0, bottom:0, width:380, background:"#FFFFFF", zIndex:201, overflowY:"auto", boxShadow:"-4px 0 20px rgba(0,0,0,0.1)", transform: visible ? "translateX(0)" : "translateX(100%)", transition:"transform 0.3s cubic-bezier(0.4,0,0.2,1)", display:"flex", flexDirection:"column" }}>
        <div style={{ background: isUtil ? "linear-gradient(135deg,#92400E,#B8860B)" : "linear-gradient(135deg,#C5A059,#A0823A)", padding:24, display:"flex", alignItems:"flex-start", gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.6)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:6 }}>
              {isUtil ? "⚡ Utility" : "Ingredient Details"}
            </div>
            <div style={{ fontSize:18, fontWeight:600, color:"#FFFFFF" }}>{item.name}</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.7)", marginTop:4 }}>{item.category} · {item.unit}</div>
          </div>
          <button onClick={handleClose} style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:4, width:32, height:32, color:"#FFFFFF", cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>
        <div style={{ background:"#F8F8F8", borderBottom:"1px solid #E5E0D5", padding:"16px 24px", display:"flex", gap:24 }}>
          {[
            { label:"System Qty",   value:String(item.qty)+" "+item.unit },
            { label:"Stock Value",  value:fmtK(item.qty * item.costPerUnit) },
            { label:"Unit Cost",    value:fmtK(item.costPerUnit)+"/"+item.unit },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize:9, color:"#7A7A7A", fontWeight:600, textTransform:"uppercase", letterSpacing:0.8 }}>{s.label}</div>
              <div style={{ fontSize:14, fontWeight:600, fontFamily:"'Inter', monospace", color:"#1A1A1A", marginTop:2 }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{ flex:1, padding:"20px 24px", color:"#7A7A7A", fontSize:12, textAlign:"center", marginTop:40 }}>
          {isUtil ? "Utility costs deduct based on recipe usage per batch" : "Click rows in the table to see batch details"}
        </div>
      </div>
    </>
  );
}

function CategoryGroup({ category, items, auditMode, auditData, onPhysicalChange, onRowClick }) {
  const isUtil = category === "Utilities";
  return (
    <div style={{ marginBottom:6 }}>
      <div style={{ background: isUtil ? "#FEF9F0" : "#F8F8F8", borderLeft:"3px solid "+(isUtil ? "#B8860B" : "#C5A059"), padding:"6px 20px", fontSize:10, fontWeight:600, color: isUtil ? "#B8860B" : "#C5A059", letterSpacing:1, textTransform:"uppercase" }}>
        {isUtil ? "⚡ " : ""}{category}
      </div>
      {items.map(item => {
        const physical = auditData[item.id];
        const hasPhysical = physical !== "" && physical !== undefined;
        const variance = hasPhysical ? computeVariance(item.qty, physical) : null;
        const shrinkageValue = variance !== null ? variance * item.costPerUnit : 0;
        const rowBg = !auditMode ? "#FFFFFF" : !hasPhysical ? "#FFFBEB" : variance === 0 ? "#ECFDF5" : variance > 0 ? "#ECFDF5" : "#FEF2F2";
        return (
          <div key={item.id} onClick={() => !auditMode && onRowClick(item)}
            style={{ display:"grid", gridTemplateColumns: auditMode ? "2fr 90px 80px 110px 130px 130px" : "2fr 90px 80px 110px 130px", gap:0, background:rowBg, borderBottom:"1px solid #F0EDE6", alignItems:"center", transition:"background 0.2s ease", cursor: auditMode ? "default" : "pointer" }}
            onMouseEnter={e => { if (!auditMode) e.currentTarget.style.background="#F5F2EB"; }}
            onMouseLeave={e => { if (!auditMode) e.currentTarget.style.background=rowBg; }}>
            <Cell>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                {isUtil && <span style={{ fontSize:9, background:"#FDE68A", color:"#92400E", padding:"1px 5px", borderRadius:3, fontWeight:700 }}>UTILITY</span>}
                <span style={{ fontSize:12, fontWeight:500, color:"#1A1A1A" }}>{item.name}</span>
                {!auditMode && <span style={{ fontSize:9, color:"#C5A059", fontWeight:500, opacity:0.6 }}>view details →</span>}
              </div>
            </Cell>
            <Cell mono>{item.qty} {item.unit}</Cell>
            <Cell><ExpiryBadge dateStr={item.expiryDate}/></Cell>
            <Cell mono>{fmtK(item.qty * item.costPerUnit)}</Cell>
            <Cell mono>{fmtK(item.costPerUnit)}<span style={{ fontSize:10, color:"#7A7A7A" }}>/{item.unit}</span></Cell>
            {auditMode && (
              <Cell>
                <div style={{ display:"flex", flexDirection:"column", gap:4, padding:"6px 0" }}>
                  <AuditInput value={auditData[item.id]} onChange={val => onPhysicalChange(item.id, val)}/>
                  <VarianceCell variance={variance} shrinkageValue={shrinkageValue}/>
                </div>
              </Cell>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Cell({ children, mono }) {
  return (
    <div style={{ padding:"10px 16px", fontSize:12, fontFamily: mono ? "'Inter', monospace" : "'Inter', sans-serif", color: mono ? "#4A4A4A" : "#1A1A1A" }}>
      {children}
    </div>
  );
}

// ── Main InventoryView ────────────────────────────────────────────────────────
export default function InventoryView() {
  const [auditMode,    setAuditMode]    = useState(false);
  const [auditData,    setAuditData]    = useState({});
  const [search,       setSearch]       = useState("");
  const [filterCat,    setFilterCat]    = useState("All");
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [inventory,    setInventory]    = useState([]);
  const [showAdd,      setShowAdd]      = useState(false);
  const [apiError,     setApiError]     = useState("");

  const loadInventory = () => {
    setLoading(true);
    inventoryApi.ingredients()
      .then(data => {
        setInventory((data || []).map(i => ({
          id:          i.id,
          name:        i.name,
          qty:         parseFloat(i.total_remaining ?? i.qty ?? 0),
          unit:        i.unit || "",
          costPerUnit: parseFloat(i.cost_per_unit || 0),
          expiryDate:  i.nearest_expiry || null,
          category:    i.category || "Other",
        })));
        setApiError("");
      })
      .catch(() => setApiError("Backend offline — check server"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadInventory(); }, []);

  const categories = useMemo(() =>
    ["All", ...new Set(["Utilities", ...inventory.map(i => i.category)])],
    [inventory]
  );

  const filtered = useMemo(() =>
    inventory
      .filter(i =>
        (filterCat === "All" || i.category === filterCat) &&
        i.name.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => {
        // Utilities always last, then sort by expiry
        if (a.category === "Utilities" && b.category !== "Utilities") return 1;
        if (b.category === "Utilities" && a.category !== "Utilities") return -1;
        return new Date(a.expiryDate || "9999") - new Date(b.expiryDate || "9999");
      }),
    [inventory, search, filterCat]
  );

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(i => {
      if (!map[i.category]) map[i.category] = [];
      map[i.category].push(i);
    });
    return map;
  }, [filtered]);

  const handlePhysicalChange = useCallback((id, val) => {
    setAuditData(prev => ({ ...prev, [id]: val }));
  }, []);

  const headerCols    = auditMode
    ? ["Item Name","System Qty","Expiry","Stock Value","Unit Cost","Physical Count / Variance"]
    : ["Item Name","System Qty","Expiry","Stock Value","Unit Cost"];
  const gridTemplate  = auditMode
    ? "2fr 90px 80px 110px 130px 130px"
    : "2fr 90px 80px 110px 130px";

  return (
    <div style={{ fontFamily:"'Inter', -apple-system, BlinkMacSystemFont, sans-serif", maxWidth:1200, margin:"0 auto", padding:28, background:"#F5F2EB", minHeight:"100vh" }}>
      <link rel="stylesheet" href={FONTS}/>
      <style>{`
        @keyframes skeletonPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes batchSlideIn  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {showAdd && <AddIngredientModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); loadInventory(); }} />}

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:16, borderBottom:"1px solid #E5E0D5", paddingBottom:20 }}>
        <div>
          <div style={{ fontSize:24, fontWeight:600, color:"#1A1A1A", letterSpacing:"0.5px", fontFamily:"'Cormorant Garamond', serif" }}>Inventory Management</div>
          <div style={{ fontSize:11, color:"#7A7A7A", marginTop:4 }}>FEFO · {filtered.length} items · Utilities tracked ⚡</div>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          {apiError && <span style={{ fontSize:11, color:"#8B3A3A", background:"#FEF2F2", padding:"4px 10px", borderRadius:4 }}>{apiError}</span>}
          <button onClick={() => setShowAdd(true)}
            style={{ padding:"8px 18px", borderRadius:4, border:"none", background:"#2E7D64", color:"#FFF", fontWeight:600, fontSize:12, cursor:"pointer" }}>
            + Add Ingredient
          </button>
          {auditMode ? (
            <>
              <div style={{ padding:"6px 16px", borderRadius:4, background:"#FFFBEB", color:"#B8860B", fontSize:11, fontWeight:600, display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:"#B8860B", display:"inline-block", animation:"skeletonPulse 1.2s infinite" }}/>
                AUDIT IN PROGRESS
              </div>
              <button onClick={() => setAuditMode(false)}
                style={{ padding:"8px 20px", borderRadius:4, border:"1px solid #C5A059", background:"#FFF", color:"#C5A059", fontWeight:600, fontSize:12, cursor:"pointer" }}>
                Complete Audit
              </button>
            </>
          ) : (
            <button onClick={() => { setAuditData({}); setAuditMode(true); }}
              style={{ padding:"8px 20px", borderRadius:4, border:"none", background:"#C5A059", color:"#FFF", fontWeight:600, fontSize:12, cursor:"pointer" }}>
              Start Audit
            </button>
          )}
        </div>
      </div>

      {auditMode && <AuditSummary items={filtered} auditData={auditData}/>}

      {/* Filters */}
      <div style={{ display:"flex", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        <input placeholder="Search inventory..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex:1, minWidth:200, border:"1px solid #E5E0D5", borderRadius:4, padding:"9px 16px", fontSize:12, outline:"none", fontFamily:"'Inter',sans-serif", background:"#FFF" }} />
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilterCat(cat)}
              style={{ padding:"6px 14px", borderRadius:4, fontSize:11, fontWeight:500, border:"1px solid", borderColor: filterCat===cat ? (cat==="Utilities"?"#B8860B":"#C5A059") : "#E5E0D5", background: filterCat===cat ? (cat==="Utilities"?"#B8860B":"#C5A059") : "#FFF", color: filterCat===cat ? "#FFF" : "#4A4A4A", cursor:"pointer", transition:"all 0.2s ease" }}>
              {cat === "Utilities" ? "⚡ "+cat : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ borderRadius:6, border:"1px solid #E5E0D5", overflow:"hidden", background:"#FFF" }}>
        <div style={{ display:"grid", gridTemplateColumns:gridTemplate, background:"#1A1A1A", position:"sticky", top:0, zIndex:10 }}>
          {headerCols.map((h,i) => (
            <div key={i} style={{ padding:"12px 16px", fontSize:10, fontWeight:600, color:"rgba(255,255,255,0.7)", textTransform:"uppercase", letterSpacing:1, fontFamily:"'Inter',sans-serif", ...(i===headerCols.length-1 && auditMode ? { background:"#2C3E50", color:"#C5A059" } : {}) }}>{h}</div>
          ))}
        </div>
        {loading ? (
          <div style={{ padding:16 }}><TableSkeleton/></div>
        ) : (
          <>
            {Object.entries(grouped).map(([cat, items]) => (
              <CategoryGroup key={cat} category={cat} items={items} auditMode={auditMode} auditData={auditData} onPhysicalChange={handlePhysicalChange} onRowClick={setSelectedItem} />
            ))}
            {filtered.length === 0 && (
              <div style={{ padding:60, textAlign:"center", color:"#7A7A7A", fontSize:13 }}>
                {inventory.length === 0 ? "No ingredients yet — click + Add Ingredient to get started" : "No items match your search"}
              </div>
            )}
          </>
        )}
      </div>

      {selectedItem && <BatchPanel item={selectedItem} onClose={() => setSelectedItem(null)}/>}
    </div>
  );
}
