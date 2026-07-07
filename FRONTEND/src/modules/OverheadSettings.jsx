import { useState, useEffect } from "react";
import { settingsApi } from "../api";

const fi = { border:"1px solid #E5E7EB", borderRadius:6, padding:"8px 12px", fontSize:13, outline:"none", background:"#FFFFFF", width:"100%", boxSizing:"border-box" };
const G = "#16a34a", B = "#1E3A5F", MUTED = "#6B7280", BORDER = "#E5E7EB";

const FIXED = [
  { key:"rent",        label:"Rent",             hint:"Monthly rent" },
  { key:"electricity", label:"Electricity",       hint:"Monthly electricity bill" },
  { key:"water",       label:"Water Bill",        hint:"Monthly water bill" },
  { key:"wifi",        label:"WiFi / Internet",   hint:"Monthly internet bill" },
  { key:"other",       label:"Other Fixed Costs", hint:"Any other monthly fixed costs" },
];

const CONSUMABLES = [
  { key:"gas",      label:"Cooking Gas (LPG)", hint:"Cost per cylinder", unit:"cylinder" },
  { key:"firewood", label:"Firewood",           hint:"Cost per bundle",   unit:"bundle" },
  { key:"charcoal", label:"Charcoal",           hint:"Cost per bag",      unit:"bag" },
];

export default function OverheadSettings({ onBack, mode = "all" }) {
  const showFixed       = mode === "overheads" || mode === "all";
  const showConsumables = mode === "utilities" || mode === "all";
  const showStaff       = mode === "overheads" || mode === "all";
  const [fixed,       setFixed]       = useState({});
  const [consumables, setConsumables] = useState({});
  const [customCons,  setCustomCons]  = useState([]);   // user-added utilities: {label, cost, days}
  const [staff,       setStaff]       = useState([{ name: "", salary: "" }]);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [error,       setError]       = useState("");
  const [editing,     setEditing]     = useState(false);

  const loadSettings = () => settingsApi.get().then(s => {
      const f = {}, c = {};
      FIXED.forEach(x => { f[x.key] = s[`overhead_fixed_${x.key}`] || ""; });
      CONSUMABLES.forEach(x => {
        c[x.key] = {
          cost: s[`overhead_${x.key}_cost`] || "",
          days: s[`overhead_${x.key}_days`] || "",
        };
      });
      setFixed(f);
      setConsumables(c);
      if (s.overhead_custom_consumables) {
        try { const arr = JSON.parse(s.overhead_custom_consumables); if (Array.isArray(arr)) setCustomCons(arr); } catch {}
      }
      if (s.staff_salaries) {
        try { setStaff(JSON.parse(s.staff_salaries)); } catch {}
      }
    }).catch(() => setError("Could not load settings"));

  useEffect(() => { loadSettings(); }, []);

  const fixedDaily      = FIXED.reduce((s, f) => s + (parseFloat(fixed[f.key]) || 0) / 30, 0);
  const consumableDaily = CONSUMABLES.reduce((s, c) => {
    const cost = parseFloat(consumables[c.key]?.cost) || 0;
    const days = parseFloat(consumables[c.key]?.days) || 1;
    return s + cost / days;
  }, 0) + customCons.reduce((s, c) => s + (parseFloat(c.cost) || 0) / (parseFloat(c.days) || 1), 0);

  const addCustom    = () => setCustomCons(p => [...p, { label: "", cost: "", days: "" }]);
  const removeCustom = (i) => setCustomCons(p => p.filter((_, idx) => idx !== i));
  const updateCustom = (i, field, val) => setCustomCons(p => p.map((c, idx) => idx === i ? { ...c, [field]: val } : c));
  const staffTotal  = staff.reduce((s, e) => s + (parseFloat(e.salary) || 0), 0);
  const staffDaily  = staffTotal / 30;
  const totalDaily  = fixedDaily + consumableDaily + staffDaily;

  const addStaff    = () => setStaff(p => [...p, { name: "", salary: "" }]);
  const removeStaff = (i) => setStaff(p => p.filter((_, idx) => idx !== i));
  const updateStaff = (i, field, val) => setStaff(p => p.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const save = async () => {
    setSaving(true); setError(""); setSaved(false);
    try {
      const payload = {};
      FIXED.forEach(x => { payload[`overhead_fixed_${x.key}`] = fixed[x.key] || 0; });
      CONSUMABLES.forEach(x => {
        payload[`overhead_${x.key}_cost`] = consumables[x.key]?.cost || 0;
        payload[`overhead_${x.key}_days`] = consumables[x.key]?.days || 1;
      });
      payload.overhead_custom_consumables = JSON.stringify(customCons.filter(c => c.label && c.label.trim()));
      payload.staff_salaries = JSON.stringify(staff.filter(e => e.name));
      await settingsApi.update(payload);
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2500);
    } catch(e) {
      setError(e?.response?.data?.error || "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <div style={{ flex:1, overflowY:"auto", background:"#F8FAFC", padding:24, fontFamily:"Inter, sans-serif" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
        {onBack && <button onClick={onBack} style={{ border:`1px solid ${BORDER}`, background:"#FFF", borderRadius:6, padding:"6px 14px", fontSize:12, cursor:"pointer" }}>← Back</button>}
        <div>
          <div style={{ fontSize:16, fontWeight:700, color:"#111827" }}>
            {mode === "utilities" ? "Utilities" : mode === "overheads" ? "Overheads" : "Overhead & Utilities"}
          </div>
          <div style={{ fontSize:12, color:MUTED }}>
            {mode === "utilities"
              ? "Cooking gas, firewood & charcoal — daily running cost"
              : mode === "overheads"
                ? "Fixed monthly bills & staff salaries — daily cost"
                : "Set costs once — system auto-deducts from daily profit"}
          </div>
        </div>
      </div>

      {error && <div style={{ padding:"8px 12px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:6, fontSize:12, color:"#DC2626", marginBottom:16 }}>{error}</div>}

      {/* ── READ-ONLY SUMMARY (default view) ── */}
      {!editing && (
        <div style={{ maxWidth:900 }}>
          {showConsumables && (
            <div style={{ background:"#fff", border:`1px solid ${BORDER}`, borderRadius:8, padding:8, marginBottom:16 }}>
              {CONSUMABLES.map(c => {
                const cost = parseFloat(consumables[c.key]?.cost) || 0;
                const days = parseFloat(consumables[c.key]?.days) || 0;
                const daily = days > 0 ? cost / days : 0;
                return (
                  <div key={c.key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderBottom:`1px solid #F1F5F9` }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:"#111827" }}>{c.label}</div>
                      <div style={{ fontSize:11, color:MUTED, marginTop:2 }}>
                        {cost > 0 ? `KES ${cost.toLocaleString()} per ${c.unit} · lasts ${days||"-"} day${days===1?"":"s"}` : "Not set"}
                      </div>
                    </div>
                    <div style={{ fontWeight:700, color:G, fontSize:14 }}>KES {daily.toFixed(0)}<span style={{ fontSize:11, fontWeight:400, color:MUTED }}>/day</span></div>
                  </div>
                );
              })}
              {customCons.filter(c => c.label && c.label.trim()).map((c, i) => {
                const cost = parseFloat(c.cost) || 0;
                const days = parseFloat(c.days) || 0;
                const daily = days > 0 ? cost / days : 0;
                return (
                  <div key={"custro-" + i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderBottom:`1px solid #F1F5F9` }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:"#111827" }}>{c.label}</div>
                      <div style={{ fontSize:11, color:MUTED, marginTop:2 }}>
                        {cost > 0 ? `KES ${cost.toLocaleString()} · lasts ${days||"-"} day${days===1?"":"s"}` : "Not set"}
                      </div>
                    </div>
                    <div style={{ fontWeight:700, color:G, fontSize:14 }}>KES {daily.toFixed(0)}<span style={{ fontSize:11, fontWeight:400, color:MUTED }}>/day</span></div>
                  </div>
                );
              })}
            </div>
          )}
          {showFixed && (
            <div style={{ background:"#fff", border:`1px solid ${BORDER}`, borderRadius:8, padding:8, marginBottom:16 }}>
              {FIXED.map(f => {
                const monthly = parseFloat(fixed[f.key]) || 0;
                const daily = monthly / 30;
                return (
                  <div key={f.key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderBottom:`1px solid #F1F5F9` }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:"#111827" }}>{f.label}</div>
                      <div style={{ fontSize:11, color:MUTED, marginTop:2 }}>{monthly > 0 ? `KES ${monthly.toLocaleString()} / month` : "Not set"}</div>
                    </div>
                    <div style={{ fontWeight:700, color:G, fontSize:14 }}>KES {daily.toFixed(0)}<span style={{ fontSize:11, fontWeight:400, color:MUTED }}>/day</span></div>
                  </div>
                );
              })}
            </div>
          )}
          {showStaff && (
            <div style={{ background:"#fff", border:`1px solid ${BORDER}`, borderRadius:8, padding:8, marginBottom:16 }}>
              {staff.filter(e => e.name).length === 0 ? (
                <div style={{ padding:"12px 14px", fontSize:12, color:MUTED }}>No staff salaries set</div>
              ) : staff.filter(e => e.name).map((e, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderBottom:`1px solid #F1F5F9` }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#111827" }}>{e.name}</div>
                  <div style={{ fontSize:12, color:MUTED }}>KES {(parseFloat(e.salary)||0).toLocaleString()}/month · <span style={{ color:G, fontWeight:700 }}>KES {((parseFloat(e.salary)||0)/30).toFixed(0)}/day</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── EDITABLE FORM ── */}
      {editing && (<>
      <div style={{ display:"grid", gridTemplateColumns: (showFixed && showConsumables) ? "1fr 1fr" : "1fr", gap:20, maxWidth:900 }}>

        {/* Fixed Monthly */}
        {showFixed && (
        <div style={{ background:"#fff", border:`1px solid ${BORDER}`, borderRadius:8, padding:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:B, letterSpacing:1, textTransform:"uppercase", marginBottom:16, paddingBottom:8, borderBottom:`1px solid ${BORDER}` }}>Fixed Monthly Bills</div>
          <div style={{ fontSize:11, color:MUTED, marginBottom:14 }}>Enter monthly amount — system divides by 30 for daily cost</div>
          {FIXED.map(f => (
            <div key={f.key} style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, fontWeight:600, color:"#374151", textTransform:"uppercase", letterSpacing:0.5 }}>{f.label}</label>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
                <span style={{ fontSize:12, color:MUTED, fontWeight:600, minWidth:30 }}>KES</span>
                <input type="number" min="0" value={fixed[f.key] || ""} onChange={e => setFixed(p => ({...p, [f.key]: e.target.value}))} placeholder="0" style={{...fi, flex:1}} />
                <span style={{ fontSize:11, color:MUTED, minWidth:60 }}>= KES {((parseFloat(fixed[f.key])||0)/30).toFixed(0)}/day</span>
              </div>
            </div>
          ))}
          <div style={{ padding:"10px 14px", background:"#F0FDF4", borderRadius:6, border:`1px solid ${G}30`, marginTop:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
              <span style={{ color:MUTED }}>Fixed daily cost</span>
              <span style={{ fontWeight:700, color:G }}>KES {fixedDaily.toFixed(0)}/day</span>
            </div>
          </div>
        </div>
        )}

        {/* Consumables */}
        {showConsumables && (
        <div style={{ background:"#fff", border:`1px solid ${BORDER}`, borderRadius:8, padding:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:B, letterSpacing:1, textTransform:"uppercase", marginBottom:16, paddingBottom:8, borderBottom:`1px solid ${BORDER}` }}>Consumables</div>
          <div style={{ fontSize:11, color:MUTED, marginBottom:14 }}>Enter cost and how many days it lasts</div>
          {CONSUMABLES.map(c => (
            <div key={c.key} style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, fontWeight:600, color:"#374151", textTransform:"uppercase", letterSpacing:0.5 }}>{c.label}</label>
              <div style={{ display:"flex", gap:8, marginTop:4 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:MUTED, marginBottom:2 }}>Cost per {c.unit}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ fontSize:11, color:MUTED }}>KES</span>
                    <input type="number" min="0" value={consumables[c.key]?.cost || ""} onChange={e => setConsumables(p => ({...p, [c.key]: {...p[c.key], cost: e.target.value}}))} placeholder="0" style={{...fi}} />
                  </div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:MUTED, marginBottom:2 }}>Lasts (days)</div>
                  <input type="number" min="1" value={consumables[c.key]?.days || ""} onChange={e => setConsumables(p => ({...p, [c.key]: {...p[c.key], days: e.target.value}}))} placeholder="7" style={{...fi}} />
                </div>
                <div style={{ display:"flex", alignItems:"flex-end", paddingBottom:2 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:G, whiteSpace:"nowrap" }}>
                    KES {((parseFloat(consumables[c.key]?.cost)||0)/(parseFloat(consumables[c.key]?.days)||1)).toFixed(0)}/day
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Custom utilities the user adds */}
          {customCons.map((c, i) => (
            <div key={"cust-" + i} style={{ marginBottom:16, paddingTop:12, borderTop:`1px dashed ${BORDER}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <input value={c.label} onChange={e => updateCustom(i, "label", e.target.value)} placeholder="Utility name (e.g. Water, Electricity)" style={{ ...fi, flex:1, fontWeight:600 }} />
                <button onClick={() => removeCustom(i)} title="Remove" style={{ border:"none", background:"transparent", color:"#DC2626", cursor:"pointer", fontSize:18, fontWeight:700, lineHeight:1, padding:"0 4px" }}>×</button>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:MUTED, marginBottom:2 }}>Cost</div>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ fontSize:11, color:MUTED }}>KES</span>
                    <input type="number" min="0" value={c.cost} onChange={e => updateCustom(i, "cost", e.target.value)} placeholder="0" style={{...fi}} />
                  </div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:MUTED, marginBottom:2 }}>Lasts (days)</div>
                  <input type="number" min="1" value={c.days} onChange={e => updateCustom(i, "days", e.target.value)} placeholder="7" style={{...fi}} />
                </div>
                <div style={{ display:"flex", alignItems:"flex-end", paddingBottom:2 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:G, whiteSpace:"nowrap" }}>
                    KES {((parseFloat(c.cost)||0)/(parseFloat(c.days)||1)).toFixed(0)}/day
                  </span>
                </div>
              </div>
            </div>
          ))}

          <button onClick={addCustom} style={{ marginTop:4, marginBottom:8, padding:"8px 16px", borderRadius:6, border:`1px dashed ${B}`, background:"#F8FAFC", color:B, fontSize:12, fontWeight:700, cursor:"pointer" }}>+ Add another utility</button>

          <div style={{ padding:"10px 14px", background:"#F0FDF4", borderRadius:6, border:`1px solid ${G}30`, marginTop:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
              <span style={{ color:MUTED }}>Consumable daily cost</span>
              <span style={{ fontWeight:700, color:G }}>KES {consumableDaily.toFixed(0)}/day</span>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Staff Salaries */}
      {showStaff && (
      <div style={{ maxWidth:900, marginTop:20, background:"#fff", border:`1px solid ${BORDER}`, borderRadius:8, padding:20 }}>
        <div style={{ fontSize:12, fontWeight:700, color:B, letterSpacing:1, textTransform:"uppercase", marginBottom:16, paddingBottom:8, borderBottom:`1px solid ${BORDER}` }}>Staff Salaries</div>
        <div style={{ fontSize:11, color:MUTED, marginBottom:14 }}>Enter each employee name and monthly salary — system divides by 30 for daily cost</div>
        {staff.map((e, i) => (
          <div key={i} style={{ display:"flex", gap:10, marginBottom:10, alignItems:"center" }}>
            <input type="text" placeholder="Employee name" value={e.name} onChange={ev => updateStaff(i, "name", ev.target.value)} style={{...fi, flex:2}} />
            <div style={{ display:"flex", alignItems:"center", gap:4, flex:1 }}>
              <span style={{ fontSize:11, color:MUTED }}>KES</span>
              <input type="number" min="0" placeholder="Monthly salary" value={e.salary} onChange={ev => updateStaff(i, "salary", ev.target.value)} style={{...fi}} />
            </div>
            <span style={{ fontSize:11, color:G, minWidth:70, fontWeight:600 }}>KES {((parseFloat(e.salary)||0)/30).toFixed(0)}/day</span>
            <button onClick={() => removeStaff(i)} style={{ border:"none", background:"#FEF2F2", color:"#DC2626", borderRadius:4, padding:"4px 10px", cursor:"pointer", fontSize:12 }}>✕</button>
          </div>
        ))}
        <button onClick={addStaff} style={{ marginTop:6, padding:"6px 16px", borderRadius:6, border:`1px solid ${BORDER}`, background:"#F9FAFB", fontSize:12, cursor:"pointer", fontWeight:600 }}>+ Add Employee</button>
        <div style={{ padding:"10px 14px", background:"#F0FDF4", borderRadius:6, border:`1px solid ${G}30`, marginTop:12, display:"flex", justifyContent:"space-between" }}>
          <span style={{ color:MUTED, fontSize:13 }}>Total salary daily cost</span>
          <span style={{ fontWeight:700, color:G, fontSize:13 }}>KES {staffDaily.toFixed(0)}/day · KES {staffTotal.toLocaleString()}/month · {staff.filter(e=>e.name).length} staff</span>
        </div>
      </div>
      )}
      </>)}

      {/* Total Summary */}
      <div style={{ maxWidth:900, marginTop:16, padding:"16px 20px", background:B, borderRadius:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)", marginBottom:2 }}>
            {mode === "utilities" ? "Total Daily Utilities" : "Total Daily Overhead"}
          </div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>Auto-deducted from daily revenue to show true profit</div>
        </div>
        <div style={{ fontSize:28, fontWeight:800, color:"#fff" }}>KES {(mode === "utilities" ? consumableDaily : mode === "overheads" ? (fixedDaily + staffDaily) : totalDaily).toFixed(0)}<span style={{ fontSize:14, fontWeight:400, color:"rgba(255,255,255,0.6)" }}>/day</span></div>
      </div>

      <div style={{ maxWidth:900, marginTop:16, display:"flex", gap:10 }}>
        {!editing ? (
          <button onClick={() => { setEditing(true); setSaved(false); }} style={{ padding:"12px 32px", borderRadius:6, border:`1px solid ${B}`, background:"#FFF", color:B, fontWeight:600, fontSize:14, cursor:"pointer" }}>
            ✎ Edit {mode === "utilities" ? "Utilities" : mode === "overheads" ? "Overheads" : "Settings"}
          </button>
        ) : (
          <>
            <button onClick={save} disabled={saving} style={{ padding:"12px 32px", borderRadius:6, border:"none", background: saved ? G : saving ? "#9CA3AF" : B, color:"#FFF", fontWeight:600, fontSize:14, cursor: saving ? "default" : "pointer" }}>
              {saved ? "✓ Saved" : saving ? "Saving..." : (mode === "utilities" ? "Save Utilities" : mode === "overheads" ? "Save Overheads" : "Save Overhead Settings")}
            </button>
            <button onClick={() => { setEditing(false); setError(""); loadSettings(); }} disabled={saving} style={{ padding:"12px 24px", borderRadius:6, border:`1px solid ${BORDER}`, background:"#FFF", color:MUTED, fontWeight:600, fontSize:14, cursor:"pointer" }}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
