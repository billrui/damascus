import { useState, useEffect } from "react";
import { settingsApi } from "../api";

const fi = { border:"1px solid #E5E0D5", borderRadius:4, padding:"8px 12px", fontSize:13, outline:"none", background:"#FFFFFF", width:"100%", boxSizing:"border-box", fontFamily:"'Inter',sans-serif" };

const FIELDS = [
  { key:"daily_overhead_rent",        label:"Daily Rent",        hint:"Monthly rent ÷ 30" },
  { key:"daily_overhead_wages",       label:"Daily Wages",       hint:"Total staff wages ÷ working days" },
  { key:"daily_overhead_electricity", label:"Daily Electricity", hint:"Monthly bill ÷ 30" },
  { key:"daily_overhead_other",       label:"Other Daily Costs", hint:"Any other fixed daily costs" },
];

export default function OverheadSettings({ onBack }) {
  const [vals,   setVals]   = useState({});
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState("");

  useEffect(() => {
    settingsApi.get().then(s => setVals(s)).catch(() => setError("Could not load settings"));
  }, []);

  const total = FIELDS.reduce((s, f) => s + (parseFloat(vals[f.key]) || 0), 0);

  const save = async () => {
    setSaving(true); setError(""); setSaved(false);
    try {
      await settingsApi.update(vals);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch(e) {
      setError(e?.response?.data?.error || "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <div style={{ flex:1, overflowY:"auto", background:"#F5F2EB", padding:20, fontFamily:"'Inter',sans-serif" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <button onClick={onBack} style={{ border:"1px solid #E5E0D5", background:"#FFF", borderRadius:4, padding:"6px 14px", fontSize:12, cursor:"pointer" }}>← Back</button>
        <div>
          <div style={{ fontSize:15, fontWeight:600 }}>Daily Overhead Settings</div>
          <div style={{ fontSize:11, color:"#7A7A7A" }}>These costs are spread across all items sold each day</div>
        </div>
      </div>

      <div style={{ background:"#FFF", border:"1px solid #E5E0D5", borderRadius:8, padding:20, maxWidth:500 }}>
        {error && <div style={{ padding:"8px 12px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:4, fontSize:11, color:"#8B3A3A", marginBottom:14 }}>{error}</div>}

        {FIELDS.map(f => (
          <div key={f.key} style={{ marginBottom:14 }}>
            <label style={{ fontSize:10, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>{f.label}</label>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
              <span style={{ fontSize:12, color:"#7A7A7A", fontWeight:600 }}>KES</span>
              <input type="number" min="0" step="1"
                value={vals[f.key] || ""}
                onChange={e => setVals(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder="0"
                style={{ ...fi, flex:1 }} />
            </div>
            <div style={{ fontSize:10, color:"#9CA3AF", marginTop:3 }}>{f.hint}</div>
          </div>
        ))}

        <div style={{ padding:"12px 14px", background:"#F8F8F8", borderRadius:6, border:"1px solid #E5E0D5", marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
            <span style={{ color:"#7A7A7A" }}>Total daily overhead</span>
            <span style={{ fontWeight:600 }}>KES {total.toFixed(2)}</span>
          </div>
          <div style={{ fontSize:11, color:"#9CA3AF", marginTop:4 }}>
            Spread across all items sold — the more you sell, the lower the overhead per item
          </div>
        </div>

        <button onClick={save} disabled={saving}
          style={{ width:"100%", padding:"11px", borderRadius:6, border:"none",
            background: saved ? "#16A34A" : saving ? "#9CA3AF" : "#1A1A1A",
            color:"#FFF", fontWeight:600, fontSize:13, cursor: saving ? "default" : "pointer" }}>
          {saved ? "✓ Saved" : saving ? "Saving..." : "Save Overhead Settings"}
        </button>
      </div>

      {/* Utilities reminder */}
      <div style={{ marginTop:16, padding:"12px 16px", background:"#FFFBEB", border:"1px solid #FEF3C7", borderRadius:8, maxWidth:500 }}>
        <div style={{ fontSize:12, fontWeight:600, color:"#B8860B", marginBottom:6 }}>💡 Per-batch utilities (water, gas, charcoal)</div>
        <div style={{ fontSize:12, color:"#7A7A7A" }}>
          Add water, gas/LPG, charcoal, and firewood as ingredients in Inventory under the
          <strong> "Utilities"</strong> category. Then attach them to your recipe with the
          quantity used per batch. The cost deducts automatically just like any other ingredient.
        </div>
      </div>
    </div>
  );
}
