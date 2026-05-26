import { useState, useEffect } from "react";
import { itemsApi } from "../api";

const fi = {
  border:"1px solid #E5E0D5", borderRadius:4, padding:"8px 12px",
  fontSize:13, outline:"none", background:"#FFFFFF",
  width:"100%", boxSizing:"border-box", fontFamily:"'Inter',sans-serif",
};

export default function ProductionScreen({ onBack }) {
  const [items,    setItems]    = useState([]);
  const [selected, setSelected] = useState(null);
  const [qty,      setQty]      = useState("");
  const [notes,    setNotes]    = useState("");
  const [saving,   setSaving]   = useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState("");
  const [log,      setLog]      = useState([]);

  useEffect(() => {
    itemsApi.stockAvailable()
      .then(setItems)
      .catch(() => setError("Could not load menu items — is the backend running?"));
  }, []);

  useEffect(() => {
    if (!selected) return;
    itemsApi.productionLog(selected.id)
      .then(setLog)
      .catch(() => setLog([]));
  }, [selected]);

  const handleProduce = async () => {
    if (!selected)                   { setError("Select a menu item"); return; }
    if (!qty || parseFloat(qty) <= 0) { setError("Enter a valid quantity"); return; }
    setSaving(true); setError(""); setResult(null);
    try {
      const res = await itemsApi.produce(selected.id, parseFloat(qty), notes || undefined);
      setResult({ item: selected.name, qty: parseFloat(qty), alerts: res.low_stock_alerts || [] });
      setQty(""); setNotes("");
      // Refresh stock counts
      const fresh = await itemsApi.stockAvailable();
      setItems(fresh);
      setSelected(fresh.find(i => i.id === selected.id) || null);
      const freshLog = await itemsApi.productionLog(selected.id);
      setLog(freshLog);
    } catch(e) {
      setError(e?.response?.data?.error || "Failed — check backend");
    } finally { setSaving(false); }
  };

  return (
    <div style={{ flex:1, overflowY:"auto", background:"#F5F2EB", padding:20, fontFamily:"'Inter',sans-serif" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <button onClick={onBack}
          style={{ border:"1px solid #E5E0D5", background:"#FFF", borderRadius:4, padding:"6px 14px", fontSize:12, cursor:"pointer", color:"#4A4A4A" }}>
          ← Back
        </button>
        <div>
          <div style={{ fontSize:16, fontWeight:600, color:"#1A1A1A" }}>Log Production</div>
          <div style={{ fontSize:11, color:"#7A7A7A" }}>Record units made → ingredients deduct from stock immediately</div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, maxWidth:900 }}>

        {/* Left: log form */}
        <div style={{ background:"#FFF", border:"1px solid #E5E0D5", borderRadius:8, padding:20 }}>
          <div style={{ fontSize:12, fontWeight:600, color:"#C5A059", textTransform:"uppercase", letterSpacing:0.5, marginBottom:14 }}>
            What did the kitchen make?
          </div>

          {error && (
            <div style={{ padding:"8px 12px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:4, fontSize:11, color:"#8B3A3A", marginBottom:12 }}>{error}</div>
          )}

          {result && (
            <div style={{ padding:"10px 14px", background:"#F0FDF4", border:"1px solid #86EFAC", borderRadius:6, fontSize:12, color:"#15803D", marginBottom:12 }}>
              <div style={{ fontWeight:600 }}>✓ {result.qty} × {result.item} logged</div>
              <div style={{ fontSize:11, marginTop:2 }}>Ingredients deducted from stock.</div>
              {result.alerts.length > 0 && (
                <div style={{ marginTop:6, padding:"6px 10px", background:"#FFFBEB", border:"1px solid #FEF3C7", borderRadius:4, fontSize:11, color:"#B8860B" }}>
                  ⚠ Low stock: {result.alerts.map(a => a.name).join(", ")}
                </div>
              )}
            </div>
          )}

          {/* Item picker */}
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:10, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>Menu Item</label>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:6, marginTop:6, maxHeight:260, overflowY:"auto" }}>
              {items.map(item => {
                const sel = selected?.id === item.id;
                const avail = parseFloat(item.qty_available || 0);
                return (
                  <div key={item.id} onClick={() => { setSelected(item); setResult(null); setError(""); }}
                    style={{
                      padding:"10px 12px", borderRadius:6, cursor:"pointer",
                      border: sel ? "2px solid #C5A059" : "1px solid #E5E0D5",
                      background: sel ? "#FEF9F0" : "#F8F8F8",
                      transition:"all 0.15s",
                    }}>
                    <div style={{ fontSize:12, fontWeight:600, color:"#1A1A1A" }}>{item.name}</div>
                    <div style={{ fontSize:10, color: avail > 0 ? "#16A34A" : "#9CA3AF", marginTop:2 }}>
                      {avail > 0 ? avail + " ready to sell" : "None ready"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Qty */}
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:10, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>
              How many {selected ? "× " + selected.name : "units"} made?
            </label>
            <input type="number" min="1" step="1" value={qty} onChange={e => setQty(e.target.value)}
              placeholder="e.g. 100"
              style={{ ...fi, marginTop:6, fontSize:15, fontWeight:600, textAlign:"center" }} />
          </div>

          {/* Notes */}
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:10, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Morning batch, special order..."
              style={{ ...fi, marginTop:6 }} />
          </div>

          {/* Ingredient preview */}
          {selected && selected.recipe && selected.recipe.length > 0 && qty && parseFloat(qty) > 0 && (
            <div style={{ marginBottom:16, padding:"10px 14px", background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:6 }}>
              <div style={{ fontSize:10, fontWeight:600, color:"#15803D", marginBottom:8, textTransform:"uppercase", letterSpacing:0.5 }}>Will deduct from stock:</div>
              {selected.recipe.map(r => (
                <div key={r.ingredient_id} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#166534", marginBottom:3 }}>
                  <span>{r.name}</span>
                  <span style={{ fontWeight:600 }}>{(r.qty * parseFloat(qty)).toFixed(3)} {r.unit}</span>
                </div>
              ))}
            </div>
          )}

          <button onClick={handleProduce} disabled={saving || !selected || !qty}
            style={{ width:"100%", padding:"12px", borderRadius:6, border:"none",
              background: (!selected || !qty) ? "#E5E7EB" : saving ? "#9CA3AF" : "#1A1A1A",
              color: (!selected || !qty) ? "#9CA3AF" : "#FFF",
              fontWeight:600, fontSize:13, cursor: (!selected || !qty || saving) ? "default" : "pointer" }}>
            {saving ? "Logging..." : "✓ Log Production & Deduct Stock"}
          </button>
        </div>

        {/* Right: production log */}
        <div style={{ background:"#FFF", border:"1px solid #E5E0D5", borderRadius:8, padding:20 }}>
          <div style={{ fontSize:12, fontWeight:600, color:"#C5A059", textTransform:"uppercase", letterSpacing:0.5, marginBottom:14 }}>
            {selected ? selected.name + " — Production Log" : "Select an item to see its log"}
          </div>
          {log.length === 0 && (
            <div style={{ color:"#9CA3AF", fontSize:12, textAlign:"center", marginTop:40 }}>
              {selected ? "No production logged yet" : "—"}
            </div>
          )}
          {log.map(entry => (
            <div key={entry.id} style={{ padding:"10px 0", borderBottom:"1px solid #F0EDE6" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:13, fontWeight:600, color:"#1A1A1A" }}>{entry.qty_produced} units</span>
                <span style={{ fontSize:10, color:"#9CA3AF" }}>{new Date(entry.created_at).toLocaleString()}</span>
              </div>
              <div style={{ fontSize:11, color:"#7A7A7A", marginTop:2 }}>
                By: {entry.produced_by_name || "—"}{entry.notes ? " · " + entry.notes : ""}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
