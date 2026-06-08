import { useState, useEffect, useCallback } from "react";
import { productionApi, itemsApi } from "../api";

const G = "#16a34a", R = "#DC2626", A = "#D97706", B = "#1E3A5F", MUTED = "#6B7280", BORDER = "#E5E7EB";
const fi = { border:`1px solid ${BORDER}`, borderRadius:6, padding:"8px 12px", fontSize:13, outline:"none", background:"#fff", width:"100%", boxSizing:"border-box" };

function Section({ title, children, action }) {
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, paddingBottom:6, borderBottom:`1px solid ${BORDER}` }}>
        <div style={{ fontSize:11, fontWeight:700, color:MUTED, letterSpacing:1.5, textTransform:"uppercase" }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function LiveCard({ item }) {
  const pct = item.total_cooked > 0 ? Math.round((item.total_sold / item.total_cooked) * 100) : 0;
  const remaining = Number(item.total_remaining);
  const cooked = Number(item.total_cooked);
  const color = remaining === 0 ? MUTED : remaining / cooked < 0.2 ? R : remaining / cooked < 0.5 ? A : G;

  return (
    <div style={{ background:"#fff", border:`2px solid ${color}`, borderRadius:8, padding:"14px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <div style={{ fontSize:14, fontWeight:700, color:"#111827" }}>{item.name}</div>
        <div style={{ fontSize:12, color:MUTED }}>{item.unit}</div>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:8 }}>
        <span style={{ color:MUTED }}>Cooked: <b style={{ color:"#111827" }}>{item.total_cooked}</b></span>
        <span style={{ color:MUTED }}>Sold: <b style={{ color:G }}>{item.total_sold}</b></span>
        <span style={{ color:MUTED }}>Left: <b style={{ color, fontSize:14 }}>{remaining}</b></span>
      </div>
      <div style={{ height:6, borderRadius:3, background:"#F3F4F6", overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:3, transition:"width 0.3s" }} />
      </div>
      <div style={{ fontSize:10, color:MUTED, marginTop:4 }}>{pct}% sold</div>
    </div>
  );
}

export default function ProductionView({ user, activeShift, onBatchRecorded }) {
  const [tab, setTab]           = useState("live");
  const [groups, setGroups]     = useState([]);
  const [live, setLive]         = useState([]);
  const [batches, setBatches]   = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  // Record batch modal
  const [showRecord, setShowRecord] = useState(false);
  const [recGroup, setRecGroup]     = useState("");
  const [recQty, setRecQty]         = useState("");
  const [recNotes, setRecNotes]     = useState("");
  const [recording, setRecording]   = useState(false);

  // Group setup modal
  const [showSetup, setShowSetup]   = useState(false);
  const [setupName, setSetupName]   = useState("");
  const [setupUnit, setSetupUnit]   = useState("portions");
  const [setupItems, setSetupItems] = useState([]);
  const [saving, setSaving]         = useState(false);

  // Close batch modal
  const [closingBatch, setClosingBatch] = useState(null);
  const [closeDecision, setCloseDecision] = useState("carryover");
  const [closeNotes, setCloseNotes]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, l, b, m] = await Promise.all([
        productionApi.getGroups(),
        productionApi.getLive(),
        productionApi.getBatches({ status: "active" }),
        itemsApi.list(),
      ]);
      setGroups(g.groups || []);
      setLive(l.live || []);
      setBatches(b.batches || []);
      setMenuItems(m || []);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const recordBatch = async () => {
    if (!recGroup || !recQty) return;
    setRecording(true);
    try {
      await productionApi.createBatch({ group_id: recGroup, qty_cooked: recQty, shift_id: activeShift?.id, notes: recNotes });
      setShowRecord(false); setRecGroup(""); setRecQty(""); setRecNotes("");
      load();
      if (onBatchRecorded) onBatchRecorded();
    } catch(e) { setError(e.message); }
    finally { setRecording(false); }
  };

  const closeBatch = async () => {
    if (!closingBatch) return;
    try {
      await productionApi.closeBatch(closingBatch.id, { decision: closeDecision, qty: closingBatch.qty_remaining, notes: closeNotes });
      setClosingBatch(null); setCloseNotes("");
      load();
    } catch(e) { setError(e.message); }
  };

  const saveGroup = async () => {
    if (!setupName) return;
    setSaving(true);
    try {
      await productionApi.createGroup({ name: setupName, unit: setupUnit, items: setupItems });
      setShowSetup(false); setSetupName(""); setSetupItems([]);
      load();
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const toggleMenuItem = (id) => {
    setSetupItems(p => p.find(i => i.menu_item_id === id)
      ? p.filter(i => i.menu_item_id !== id)
      : [...p, { menu_item_id: id, portions: 1 }]
    );
  };

  const liveWithData = live.filter(l => Number(l.total_cooked) > 0);
  const emptyGroups  = live.filter(l => Number(l.total_cooked) === 0);

  return (
    <div style={{ flex:1, overflowY:"auto", background:"#F8FAFC", padding:"24px 28px" }}>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:800, color:"#111827" }}>Production</div>
          <div style={{ fontSize:12, color:MUTED }}>Track what's cooked and what remains</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => setShowRecord(true)} style={{ padding:"8px 16px", borderRadius:6, border:"none", background:G, color:"#fff", fontWeight:600, fontSize:13, cursor:"pointer" }}>
            + Record Batch
          </button>
          {user?.role === "admin" && (
            <button onClick={() => setShowSetup(true)} style={{ padding:"8px 16px", borderRadius:6, border:`1px solid ${BORDER}`, background:"#fff", color:B, fontWeight:600, fontSize:13, cursor:"pointer" }}>
              ⚙ Setup Groups
            </button>
          )}
        </div>
      </div>

      {error && <div style={{ padding:"8px 12px", background:"#FEF2F2", border:`1px solid #FECACA`, borderRadius:6, fontSize:12, color:R, marginBottom:16 }}>{error}</div>}

      {/* Tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        {[["live","Live Tracker"],["batches","Today's Batches"],["groups","Groups"]].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding:"7px 16px", borderRadius:6, border:"none", cursor:"pointer", fontWeight:600, fontSize:13,
            background: tab === id ? B : "#fff",
            color: tab === id ? "#fff" : MUTED,
            boxShadow: tab === id ? `0 2px 8px ${B}33` : "none",
          }}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:"48px", color:MUTED }}>Loading...</div>
      ) : tab === "live" ? (
        <Section title="Live Food Tracker — Today">
          {liveWithData.length === 0 ? (
            <div style={{ background:"#fff", border:`1px solid ${BORDER}`, borderRadius:8, padding:"48px", textAlign:"center", color:MUTED }}>
              <div style={{ fontSize:32, marginBottom:8 }}>🍳</div>
              <div style={{ fontSize:14, fontWeight:600 }}>No batches recorded today</div>
              <div style={{ fontSize:12, marginTop:4 }}>Click "Record Batch" to start tracking</div>
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap:12 }}>
              {liveWithData.map(item => <LiveCard key={item.group_id} item={item} />)}
            </div>
          )}
          {emptyGroups.length > 0 && (
            <div style={{ marginTop:16 }}>
              <div style={{ fontSize:11, color:MUTED, marginBottom:8 }}>Not yet cooked today:</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {emptyGroups.map(g => (
                  <span key={g.group_id} style={{ padding:"4px 12px", borderRadius:20, background:"#F3F4F6", fontSize:12, color:MUTED }}>{g.name}</span>
                ))}
              </div>
            </div>
          )}
        </Section>
      ) : tab === "batches" ? (
        <Section title="Today's Batches" action={
          <button onClick={load} style={{ fontSize:11, color:B, cursor:"pointer", border:"none", background:"none", fontWeight:600 }}>↻ Refresh</button>
        }>
          {batches.length === 0 ? (
            <div style={{ background:"#fff", border:`1px solid ${BORDER}`, borderRadius:8, padding:"32px", textAlign:"center", color:MUTED, fontSize:13 }}>No active batches today</div>
          ) : (
            <div style={{ background:"#fff", border:`1px solid ${BORDER}`, borderRadius:8, overflow:"hidden" }}>
              {batches.map((b, i) => (
                <div key={b.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 16px", borderBottom: i < batches.length-1 ? `1px solid ${BORDER}` : "none" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#111827" }}>{b.group_name}</div>
                    <div style={{ fontSize:11, color:MUTED }}>{b.cooked_by_name} · {new Date(b.cooked_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
                  </div>
                  <div style={{ textAlign:"right", fontSize:12 }}>
                    <div style={{ fontWeight:700, color:G }}>{b.qty_remaining} {b.unit} left</div>
                    <div style={{ color:MUTED }}>{b.qty_sold}/{b.qty_cooked} sold</div>
                  </div>
                  <button onClick={() => { setClosingBatch(b); setCloseDecision("carryover"); }} style={{ padding:"5px 12px", borderRadius:6, border:`1px solid ${BORDER}`, background:"#F9FAFB", fontSize:11, cursor:"pointer", fontWeight:600 }}>
                    Close
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>
      ) : (
        <Section title="Production Groups" action={
          user?.role === "admin" && <button onClick={() => setShowSetup(true)} style={{ padding:"5px 12px", borderRadius:6, border:`1px solid ${BORDER}`, background:"#fff", fontSize:12, cursor:"pointer", fontWeight:600, color:B }}>+ New Group</button>
        }>
          {groups.length === 0 ? (
            <div style={{ background:"#fff", border:`1px solid ${BORDER}`, borderRadius:8, padding:"32px", textAlign:"center", color:MUTED, fontSize:13 }}>
              No groups set up yet. Admin needs to create production groups first.
            </div>
          ) : (
            <div style={{ background:"#fff", border:`1px solid ${BORDER}`, borderRadius:8, overflow:"hidden" }}>
              {groups.map((g, i) => (
                <div key={g.id} style={{ padding:"12px 16px", borderBottom: i < groups.length-1 ? `1px solid ${BORDER}` : "none" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:"#111827" }}>{g.name} <span style={{ fontSize:11, color:MUTED }}>({g.unit})</span></div>
                      <div style={{ fontSize:11, color:MUTED, marginTop:2 }}>
                        {(g.items||[]).map(i => i.menu_item_name).join(", ") || "No items linked"}
                      </div>
                    </div>
                    <span style={{ fontSize:11, color:MUTED }}>{(g.items||[]).length} items</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Record Batch Modal */}
      {showRecord && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
          <div style={{ background:"#fff", borderRadius:10, padding:24, width:380, maxWidth:"90vw" }}>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:16 }}>Record Production Batch</div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, fontWeight:600, color:MUTED, textTransform:"uppercase" }}>Food Group</label>
              <select value={recGroup} onChange={e => setRecGroup(e.target.value)} style={{...fi, marginTop:4}}>
                <option value="">Select group...</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.unit})</option>)}
              </select>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, fontWeight:600, color:MUTED, textTransform:"uppercase" }}>Quantity Cooked</label>
              <input type="number" min="1" value={recQty} onChange={e => setRecQty(e.target.value)} placeholder="e.g. 50" style={{...fi, marginTop:4}} />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, fontWeight:600, color:MUTED, textTransform:"uppercase" }}>Notes (optional)</label>
              <input type="text" value={recNotes} onChange={e => setRecNotes(e.target.value)} placeholder="e.g. Morning batch" style={{...fi, marginTop:4}} />
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setShowRecord(false)} style={{ flex:1, padding:10, borderRadius:6, border:`1px solid ${BORDER}`, background:"#fff", cursor:"pointer", fontWeight:600 }}>Cancel</button>
              <button onClick={recordBatch} disabled={recording || !recGroup || !recQty} style={{ flex:2, padding:10, borderRadius:6, border:"none", background: recording ? "#9CA3AF" : G, color:"#fff", cursor:"pointer", fontWeight:600 }}>
                {recording ? "Recording..." : "Record Batch"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Batch Modal */}
      {closingBatch && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
          <div style={{ background:"#fff", borderRadius:10, padding:24, width:380, maxWidth:"90vw" }}>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>Close Batch — {closingBatch.group_name}</div>
            <div style={{ fontSize:12, color:MUTED, marginBottom:16 }}>{closingBatch.qty_remaining} {closingBatch.unit} remaining</div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, fontWeight:600, color:MUTED, textTransform:"uppercase" }}>What to do with remainder?</label>
              <div style={{ display:"flex", gap:8, marginTop:8 }}>
                <button onClick={() => setCloseDecision("carryover")} style={{ flex:1, padding:"10px", borderRadius:6, border:`2px solid ${closeDecision==="carryover"?G:BORDER}`, background: closeDecision==="carryover"?"#F0FDF4":"#fff", cursor:"pointer", fontWeight:600, fontSize:12, color: closeDecision==="carryover"?G:"#374151" }}>
                  🔄 Carry Over
                </button>
                <button onClick={() => setCloseDecision("wasted")} style={{ flex:1, padding:"10px", borderRadius:6, border:`2px solid ${closeDecision==="wasted"?R:BORDER}`, background: closeDecision==="wasted"?"#FEF2F2":"#fff", cursor:"pointer", fontWeight:600, fontSize:12, color: closeDecision==="wasted"?R:"#374151" }}>
                  🗑 Wastage
                </button>
              </div>
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, fontWeight:600, color:MUTED, textTransform:"uppercase" }}>Notes</label>
              <input type="text" value={closeNotes} onChange={e => setCloseNotes(e.target.value)} placeholder="Reason or notes..." style={{...fi, marginTop:4}} />
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setClosingBatch(null)} style={{ flex:1, padding:10, borderRadius:6, border:`1px solid ${BORDER}`, background:"#fff", cursor:"pointer", fontWeight:600 }}>Cancel</button>
              <button onClick={closeBatch} style={{ flex:2, padding:10, borderRadius:6, border:"none", background:B, color:"#fff", cursor:"pointer", fontWeight:600 }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Setup Group Modal */}
      {showSetup && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
          <div style={{ background:"#fff", borderRadius:10, padding:24, width:500, maxWidth:"90vw", maxHeight:"80vh", overflowY:"auto" }}>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:16 }}>Create Production Group</div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, fontWeight:600, color:MUTED, textTransform:"uppercase" }}>Group Name</label>
              <input type="text" value={setupName} onChange={e => setSetupName(e.target.value)} placeholder="e.g. Tea, Managu, Ugali" style={{...fi, marginTop:4}} />
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, fontWeight:600, color:MUTED, textTransform:"uppercase" }}>Unit</label>
              <select value={setupUnit} onChange={e => setSetupUnit(e.target.value)} style={{...fi, marginTop:4}}>
                {["cups","portions","pieces","kg","litres","bundles","plates"].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, fontWeight:600, color:MUTED, textTransform:"uppercase", marginBottom:8, display:"block" }}>
                Link Menu Items ({setupItems.length} selected)
              </label>
              <input type="text" placeholder="Search menu items..." onChange={e => {
                const el = document.getElementById('mi-list');
                if (el) el.querySelectorAll('[data-name]').forEach(row => {
                  row.style.display = row.dataset.name.includes(e.target.value.toUpperCase()) ? '' : 'none';
                });
              }} style={{...fi, marginBottom:8}} />
              <div id="mi-list" style={{ maxHeight:200, overflowY:"auto", border:`1px solid ${BORDER}`, borderRadius:6 }}>
                {menuItems.map(m => (
                  <div key={m.id} data-name={m.name} onClick={() => toggleMenuItem(m.id)} style={{ padding:"8px 12px", cursor:"pointer", background: setupItems.find(i=>i.menu_item_id===m.id) ? "#F0FDF4" : "#fff", borderBottom:`1px solid ${BORDER}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:12, color:"#111827" }}>{m.name}</span>
                    {setupItems.find(i=>i.menu_item_id===m.id) && <span style={{ fontSize:11, color:G, fontWeight:700 }}>✓</span>}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setShowSetup(false)} style={{ flex:1, padding:10, borderRadius:6, border:`1px solid ${BORDER}`, background:"#fff", cursor:"pointer", fontWeight:600 }}>Cancel</button>
              <button onClick={saveGroup} disabled={saving || !setupName} style={{ flex:2, padding:10, borderRadius:6, border:"none", background: saving?"#9CA3AF":B, color:"#fff", cursor:"pointer", fontWeight:600 }}>
                {saving ? "Saving ..." : "Create Group"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
