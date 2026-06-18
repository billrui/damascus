import { useState, useMemo, useEffect } from "react";
import { inventoryApi } from "../api";
import { fmt, fmtK } from "../utils";
import { Card, Btn, SectionHeader, ExpiryBadge } from "../components/UI";
import { useBreakpoint } from "../hooks/useBreakpoint";

const _CATS  = ["Proteins","Grains","Vegetables","Oils","Spices","Dairy","Beverages","Spirits","Produce","Bakery","Utilities","Other"];

const fmtStock = (n) => String(Math.round(parseFloat(n)||0));
const _UNITS = ["g","kg","ml","l","pcs","loaf","tray","slice","bunch","bottle","can","packet","box","bundle","crate","sack","jerrycan","tin","bar","roll","bag","sachet","cup"];

// --- AddIngredientModal ---
function AddIngredientModal({ onClose, onSaved }) {
  const { mobile } = useBreakpoint();
  const [form, setForm] = useState({ name:"", unit:"g", category:"", reorder_level:"", purchase_unit:"", purchase_qty:"", purchase_cost:"", opening_stock:"" });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const set = (k,v) => setForm(p => ({ ...p, [k]:v }));
  const costPerUnit = (form.purchase_cost && form.purchase_qty && parseFloat(form.purchase_qty) > 0)
    ? (() => {
        const v = parseFloat(form.purchase_cost) / parseFloat(form.purchase_qty);
        return v % 1 === 0 ? v : parseFloat(v.toFixed(2));
      })()
    : "";
  const isUtil = form.category === "Utilities";

  const save = async () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!form.category)    { setError("Category is required"); return; }
    setSaving(true); setError("");
    try {
      // Check for duplicate name in the API before saving

      const id  = "ING-" + form.name.replace(/\s+/g,"").toUpperCase().slice(0,6) + "-" + Date.now().toString().slice(-4);
      const ing = await inventoryApi.addIngredient({
        id, name:form.name.trim(), unit:form.unit, category:form.category,
        reorder_level: parseFloat(form.reorder_level)||0,
        purchase_unit: form.purchase_unit||null,
        purchase_qty:  parseFloat(form.purchase_qty)||null,
        purchase_cost: parseFloat(form.purchase_cost)||null,
        cost_per_unit: parseFloat(costPerUnit)||0,
      });
      if (form.opening_stock && parseFloat(form.opening_stock) > 0) {
        const pQty = parseFloat(form.purchase_qty) || 1;
        const hasPurchaseUnit = form.purchase_unit && form.purchase_qty;
        const stockQty = parseFloat(form.opening_stock) * (hasPurchaseUnit ? pQty : 1);
        await inventoryApi.receiveBatch({ ingredient_id: ing.id, qty: stockQty, notes:"Opening stock" });
      }
      onSaved(ing);
    } catch(e) { setError(e?.response?.data?.error || "Save failed"); }
    finally { setSaving(false); }
  };

  const fi = { border:"1px solid #E5E0D5", borderRadius:4, padding:"8px 12px", fontSize:12, outline:"none", background:"#FFF", width:"100%", boxSizing:"border-box", fontFamily:"'Inter',sans-serif" };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#FFF", borderRadius:8, padding:28, width:520, maxWidth:"95vw", boxShadow:"0 8px 32px rgba(0,0,0,0.2)", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600 }}>Add Ingredient</div>
            <div style={{ fontSize:11, color:"#7A7A7A", marginTop:2 }}>Set category to Utilities for water, gas, charcoal</div>
          </div>
          <button onClick={onClose} style={{ border:"none", background:"none", cursor:"pointer", fontSize:22, color:"#7A7A7A" }}>x</button>
        </div>
        {error && <div style={{ padding:"8px 12px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:4, fontSize:11, color:"#8B3A3A", marginBottom:12 }}>{error}</div>}
        {isUtil && <div style={{ padding:"8px 12px", background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:4, fontSize:11, color:"#92400E", marginBottom:12 }}>Utility items appear in the recipe builder for water, gas and charcoal cost tracking.</div>}
        <div style={{ display:"grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap:12 }}>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase" }}>Name *</label>
            <input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Fresh Milk, LPG Gas, Sugar" style={{ ...fi, marginTop:4 }} autoFocus />
          </div>
          <div>
            <label style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase" }}>Category *</label>
            <select value={form.category} onChange={e=>set("category",e.target.value)} style={{ ...fi, marginTop:4, borderColor:isUtil?"#FDE68A":"#E5E0D5", background:isUtil?"#FFFBEB":"#FFF" }}>
              <option value="">Select...</option>
              {_CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase" }}>Cooking Unit</label>
            <select value={form.unit} onChange={e=>set("unit",e.target.value)} style={{ ...fi, marginTop:4 }}>
              {_UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:"1/-1", borderTop:"1px solid #F0EDE6", paddingTop:10, marginTop:4 }}>
            <div style={{ fontSize:9, fontWeight:600, color:"#C5A059", textTransform:"uppercase", marginBottom:6 }}>How you buy it</div>
          </div>
          <div>
            <label style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase" }}>Purchase Unit</label>
            <select value={form.purchase_unit} onChange={e=>set("purchase_unit",e.target.value)} style={{ ...fi, marginTop:4 }}>
              <option value="">Same as cooking</option>
              {_UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase" }}>Units per purchase unit</label>
            <input type="number" min="0" step="0.001" value={form.purchase_qty} onChange={e=>set("purchase_qty",e.target.value)} placeholder="e.g. 1000 (1kg=1000g)" style={{ ...fi, marginTop:4 }} />
          </div>
          <div>
            <label style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase" }}>Cost per {form.purchase_unit || form.unit} (KES)</label>
            <input type="number" min="0" step="0.01" value={form.purchase_cost} onChange={e=>set("purchase_cost",e.target.value)} placeholder={"Cost of 1 " + (form.purchase_unit || form.unit)} style={{ ...fi, marginTop:4 }} />
          </div>
          <div>
            <label style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase" }}>Auto cost per {form.unit}</label>
            <div style={{ marginTop:4, padding:"8px 12px", background:costPerUnit?"#F0FDF4":"#F8F8F8", border:"1px solid #E5E0D5", borderRadius:4, fontSize:13, fontWeight:600, color:costPerUnit?"#16A34A":"#9CA3AF" }}>
              {costPerUnit ? "KES "+costPerUnit : "Fill purchase info"}
            </div>
          </div>
          <div style={{ gridColumn:"1/-1", borderTop:"1px solid #F0EDE6", paddingTop:10, marginTop:4 }}>
            <div style={{ fontSize:9, fontWeight:600, color:"#C5A059", textTransform:"uppercase", marginBottom:6 }}>Stock and Alerts</div>
          </div>
          <div>
            <label style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase" }}>
              Opening Stock ({form.purchase_unit && form.purchase_qty ? form.purchase_unit : form.unit})
            </label>
            <input type="number" min="0" step="0.01" value={form.opening_stock} onChange={e=>set("opening_stock",e.target.value)}
              placeholder={form.purchase_unit && form.purchase_qty ? `Qty in ${form.purchase_unit}s` : "Current qty on hand"}
              style={{ ...fi, marginTop:4 }} />
            {form.purchase_unit && form.purchase_qty && form.opening_stock && (
              <div style={{ fontSize:10, color:"#2E7D64", marginTop:3, fontWeight:600 }}>
                = {(parseFloat(form.opening_stock)||0) * (parseFloat(form.purchase_qty)||1)} {form.unit}
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase" }}>Reorder Level ({form.unit})</label>
            <input type="number" min="0" step="0.01" value={form.reorder_level} onChange={e=>set("reorder_level",e.target.value)} placeholder="Alert below this" style={{ ...fi, marginTop:4 }} />
          </div>
        </div>
        <div style={{ display:"flex", gap:10, marginTop:20 }}>
          <button onClick={onClose} style={{ padding:"10px 20px", borderRadius:4, border:"1px solid #E5E0D5", background:"#FFF", color:"#7A7A7A", fontWeight:600, fontSize:12, cursor:"pointer" }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex:1, padding:"10px", borderRadius:4, border:"none", background:saving?"#9CA3AF":"#1A1A1A", color:"#FFF", fontWeight:600, fontSize:12, cursor:saving?"default":"pointer" }}>
            {saving ? "Saving..." : "Save Ingredient"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- EditIngredientModal ---
function EditIngredientModal({ ingredient, onClose, onSaved }) {
  const { mobile } = useBreakpoint();
  const [form, setForm] = useState({
    name:          ingredient.name || "",
    unit:          ingredient.unit || "g",
    category:      ingredient.category || "",
    reorder_level: String(ingredient.reorderLevel || ingredient.reorder_level || ""),
    cost_per_unit: String(ingredient.costPerUnit || ingredient.cost_per_unit || ""),
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const set = (k,v) => setForm(p => ({ ...p, [k]:v }));
  const fi = { border:"1px solid #E5E0D5", borderRadius:4, padding:"8px 12px", fontSize:12, outline:"none", background:"#FFF", width:"100%", boxSizing:"border-box", fontFamily:"'Inter',sans-serif" };

  const save = async () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    try {
      const updated = await inventoryApi.updateIngredient(ingredient.id, {
        name:          form.name.trim(),
        unit:          form.unit,
        category:      form.category,
        reorder_level: parseFloat(form.reorder_level) || 0,
        cost_per_unit: parseFloat(form.cost_per_unit) || 0,
      });
      onSaved(updated);
    } catch(e) { setError(e?.response?.data?.error || "Save failed"); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#FFF", borderRadius:8, padding:28, width:460, maxWidth:"95vw", boxShadow:"0 8px 32px rgba(0,0,0,0.2)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:600 }}>Edit Ingredient</div>
          <button onClick={onClose} style={{ border:"none", background:"none", cursor:"pointer", fontSize:22, color:"#7A7A7A" }}>x</button>
        </div>
        {error && <div style={{ padding:"8px 12px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:4, fontSize:11, color:"#8B3A3A", marginBottom:12 }}>{error}</div>}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div>
            <label style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase" }}>Name *</label>
            <input value={form.name} onChange={e=>set("name",e.target.value)} style={{ ...fi, marginTop:4 }} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap:12 }}>
            <div>
              <label style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase" }}>Unit</label>
              <select value={form.unit} onChange={e=>set("unit",e.target.value)} style={{ ...fi, marginTop:4 }}>
                {_UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase" }}>Category</label>
              <select value={form.category} onChange={e=>set("category",e.target.value)} style={{ ...fi, marginTop:4 }}>
                <option value="">Select...</option>
                {_CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase" }}>Cost per {form.unit} (KES)</label>
              <input type="number" min="0" step="0.01" value={form.cost_per_unit} onChange={e=>set("cost_per_unit",e.target.value)} style={{ ...fi, marginTop:4 }} />
            </div>
            <div>
              <label style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase" }}>Reorder Level ({form.unit})</label>
              <input type="number" min="0" step="0.01" value={form.reorder_level} onChange={e=>set("reorder_level",e.target.value)} style={{ ...fi, marginTop:4 }} />
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, marginTop:20 }}>
          <button onClick={onClose} style={{ padding:"10px 16px", borderRadius:4, border:"1px solid #E5E0D5", background:"#FFF", color:"#7A7A7A", fontWeight:600, fontSize:12, cursor:"pointer" }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex:1, padding:"10px", borderRadius:4, border:"none", background:saving?"#9CA3AF":"#1A1A1A", color:"#FFF", fontWeight:600, fontSize:12, cursor:"pointer" }}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- DeleteConfirmModal ---
function DeleteConfirmModal({ ingredient, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState("");

  const del = async () => {
    setDeleting(true); setError("");
    try {
      await inventoryApi.deleteIngredient(ingredient.id);
      onDeleted(ingredient.id);
    } catch(e) {
      setError(e?.response?.data?.error || "Delete failed");
    } finally { setDeleting(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#FFF", borderRadius:8, padding:28, width:400, maxWidth:"95vw", boxShadow:"0 8px 32px rgba(0,0,0,0.2)" }}>
        <div style={{ fontSize:15, fontWeight:600, color:"#1A1A1A", marginBottom:8 }}>Delete "{ingredient.name}"?</div>
        <div style={{ fontSize:12, color:"#7A7A7A", marginBottom:20 }}>
          This cannot be undone. Ingredients with active stock batches cannot be deleted.
        </div>
        {error && <div style={{ padding:"8px 12px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:4, fontSize:11, color:"#8B3A3A", marginBottom:14 }}>{error}</div>}
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:4, border:"1px solid #E5E0D5", background:"#FFF", color:"#7A7A7A", fontWeight:600, fontSize:12, cursor:"pointer" }}>Cancel</button>
          <button onClick={del} disabled={deleting} style={{ flex:1, padding:"10px", borderRadius:4, border:"none", background:deleting?"#9CA3AF":"#DC2626", color:"#FFF", fontWeight:600, fontSize:12, cursor:"pointer" }}>
            {deleting ? "Deleting..." : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function InventoryView({ batches, setBatches, ingredients: propIngredients, setIngredients, storeIssues, setStoreIssues, user, subView }) {
  const { mobile } = useBreakpoint();
  const INGREDIENTS = propIngredients || [];
  const [search,    setSearch]    = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterLoc, setFilterLoc] = useState("all");
  const [fefoSort,  setFefoSort]  = useState(true);
  const [showAdd,   setShowAdd]   = useState(false);
  const [editIng,   setEditIng]   = useState(null);
  const [deleteIng, setDeleteIng] = useState(null);
  const [tab,       setTab]       = useState("receive");

  const view = subView || "list";

  const categories = ["all", ...new Set(INGREDIENTS.map(i => i.category))];
  const locations  = ["all", ...new Set(batches.map(b => b.location))];

  const data = useMemo(() => {
    const mapped = INGREDIENTS
      .filter(ing => {
        const matchSearch = ing.name.toLowerCase().includes(search.toLowerCase());
        const matchCat    = filterCat === "all" || ing.category === filterCat;
        return matchSearch && matchCat;
      })
      .map(ing => {
        const ingBatches    = batches.filter(b => b.ingredientId === ing.id && (filterLoc === "all" || b.location === filterLoc));
        const activeBatches = ingBatches.filter(b => b.status === "active");
        const totalActive   = activeBatches.reduce((s, b) => s + (parseFloat(b.remaining)||0), 0);
        const sortedActive  = [...activeBatches].sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
        const earliestExp   = sortedActive[0];
        const isLow         = totalActive <= (ing.reorderLevel || ing.reorder_level || 0);
        const costPerUnit   = parseFloat(ing.costPerUnit ?? ing.cost_per_unit) || 0;
        const value         = totalActive * costPerUnit;
        const expiryMs      = earliestExp ? new Date(earliestExp.expiry).getTime() : Infinity;
        return { ...ing, costPerUnit, ingBatches, activeBatches: sortedActive, totalActive, earliestExp, isLow, value, expiryMs };
      })
      .filter(ing => ing.ingBatches.length > 0 || filterLoc === "all");
    if (fefoSort) {
      mapped.sort((a, b) => {
        const ord = item => {
          if (!item.earliestExp) return 99;
          const days = Math.round((new Date(item.earliestExp.expiry) - new Date()) / 86400000);
          if (days < 0) return 0; if (days === 0) return 1;
          if (days <= 3) return 2; if (days <= 7) return 3; return 4;
        };
        const sa = ord(a), sb = ord(b);
        if (sa !== sb) return sa - sb;
        return a.expiryMs - b.expiryMs;
      });
    }
    return mapped;
  }, [INGREDIENTS, batches, search, filterCat, filterLoc, fefoSort]);

  // Route to receive/issue sub-screens
  if (view === "receive" || view === "issue") {
    const activeTab = tab;
    return (
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ display:"flex", borderBottom:"2px solid #E5E0D5", background:"#FFF", padding:"0 28px", flexShrink:0 }}>
          {[{ id:"receive", label:"Receive Stock" }, { id:"issue", label:"Issue Stock" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding:"14px 24px", border:"none",
              borderBottom: activeTab===t.id ? "2px solid #C5A059" : "2px solid transparent",
              marginBottom:"-2px", background:"transparent",
              fontWeight: activeTab===t.id ? 600 : 400,
              fontSize:13, color: activeTab===t.id ? "#1A1A1A" : "#7A7A7A",
              cursor:"pointer", fontFamily:"inherit"
            }}>{t.label}</button>
          ))}
        </div>
        {activeTab === "receive" && (
          <ReceiveStockView batches={batches} setBatches={setBatches||(() => {})} ingredients={propIngredients||[]} />
        )}
        {activeTab === "issue" && (
          <IssueStockView batches={batches} setBatches={setBatches||(() => {})} storeIssues={storeIssues||[]} setStoreIssues={setStoreIssues||(() => {})} user={user||{}} ingredients={propIngredients||[]} />
        )}
      </div>
    );
  }

  // Main ingredient list
  return (
    <div style={{ flex:1, overflowY:"auto", padding: mobile ? 14 : 28, background:"#F5F2EB" }}>
      {showAdd && (
        <AddIngredientModal
          onClose={() => setShowAdd(false)}
          onSaved={ing => {
            setIngredients && setIngredients(prev => [...(prev||[]), {
              ...ing, reorderLevel: ing.reorder_level||0, costPerUnit: parseFloat(ing.cost_per_unit)||0
            }]);
            setShowAdd(false);
          }}
        />
      )}
      {editIng && (
        <EditIngredientModal
          ingredient={editIng}
          onClose={() => setEditIng(null)}
          onSaved={updated => {
            setIngredients && setIngredients(prev => (prev||[]).map(i =>
              i.id === updated.id
                ? { ...i, ...updated, reorderLevel: updated.reorder_level||0, costPerUnit: parseFloat(updated.cost_per_unit)||0 }
                : i
            ));
            setEditIng(null);
          }}
        />
      )}
      {deleteIng && (
        <DeleteConfirmModal
          ingredient={deleteIng}
          onClose={() => setDeleteIng(null)}
          onDeleted={id => {
            setIngredients && setIngredients(prev => (prev||[]).filter(i => i.id !== id));
            setDeleteIng(null);
          }}
        />
      )}

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <SectionHeader title="Ingredients and Batches" sub="FEFO active - expiring items prioritized" />
        <button onClick={() => setShowAdd(true)} style={{ padding:"8px 18px", borderRadius:4, border:"none", background:"#2E7D64", color:"#FFF", fontWeight:600, fontSize:12, cursor:"pointer" }}>
          + Add Ingredient
        </button>
      </div>

      <div style={{ display:"flex", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth:180, display:"flex", alignItems:"center", gap:8, background:"#FFF", borderRadius:4, padding:"0 14px", border:"1px solid #E5E0D5" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ingredients..."
            style={{ border:"none", outline:"none", fontSize:12, flex:1, padding:"10px 0", background:"transparent", fontFamily:"'Inter',sans-serif" }} />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ padding:"0 16px", borderRadius:4, border:"1px solid #E5E0D5", background:"#FFF", fontSize:12, cursor:"pointer" }}>
          {categories.map(c => <option key={c} value={c}>{c === "all" ? "All Categories" : c}</option>)}
        </select>
        <select value={filterLoc} onChange={e => setFilterLoc(e.target.value)} style={{ padding:"0 16px", borderRadius:4, border:"1px solid #E5E0D5", background:"#FFF", fontSize:12, cursor:"pointer" }}>
          {locations.map(l => <option key={l} value={l}>{l === "all" ? "All Locations" : l}</option>)}
        </select>
        <button onClick={() => setFefoSort(f => !f)} style={{ padding:"0 18px", borderRadius:4, fontSize:11, fontWeight:600, cursor:"pointer", border: fefoSort ? "1px solid #C5A059" : "1px solid #E5E0D5", background: fefoSort ? "#FEF9F0" : "#FFF", color: fefoSort ? "#C5A059" : "#7A7A7A" }}>
          FEFO {fefoSort ? "ON" : "OFF"}
        </button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4,1fr)", gap:12, marginBottom:24 }}>
        {[
          { label:"Total Items",     value:INGREDIENTS.length,                              bg:"#EFF6FF" },
          { label:"Low Stock",       value:data.filter(d => d.isLow).length,               bg:"#FFFBEB", alert:true },
          { label:"Active Batches",  value:batches.filter(b => b.status==="active").length, bg:"#ECFDF5" },
          { label:"Expired Batches", value:batches.filter(b => b.status==="expired").length,bg:"#FEF2F2", alert:true },
        ].map(card => (
          <div key={card.label} style={{ background:card.bg, borderRadius:8, padding:"16px 20px", border:"1px solid #E5E0D5" }}>
            <div style={{ fontSize:11, color:"#7A7A7A" }}>{card.label}</div>
            <div style={{ fontSize:24, fontWeight:700, color: card.alert && card.value > 0 ? "#8B3A3A" : "#1A1A1A", marginTop:4 }}>{card.value}</div>
          </div>
        ))}
      </div>

      {data.length === 0 ? (
        <div style={{ textAlign:"center", padding:60, color:"#9CA3AF", fontSize:13 }}>
          No ingredients found — click <strong>+ Add Ingredient</strong> to get started
        </div>
      ) : (
        <div style={{ background:"#FFF", borderRadius:8, border:"1px solid #E5E0D5", overflow:"hidden" }}>
          <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", minWidth: mobile ? 560 : "auto", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#1A1A1A" }}>
                {["Ingredient","Category","Stock","Unit Cost","Value","Expiry","Status"].map(h => (
                  <th key={h} style={{ padding:"12px 16px", fontSize:10, fontWeight:600, color:"rgba(255,255,255,0.7)", textAlign:"left", textTransform:"uppercase", letterSpacing:1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((ing, idx) => {
                const daysToExp = ing.earliestExp ? Math.round((new Date(ing.earliestExp.expiry) - new Date()) / 86400000) : null;
                const expColor  = daysToExp === null ? "#9CA3AF" : daysToExp < 0 ? "#8B3A3A" : daysToExp <= 3 ? "#B8860B" : "#2E7D64";
                const expBg     = daysToExp === null ? "#F9FAFB" : daysToExp < 0 ? "#FEF2F2" : daysToExp <= 3 ? "#FFFBEB" : "#F0FDF4";
                return (
                  <tr key={ing.id} style={{ borderBottom:"1px solid #F0EDE6", background: idx%2===0 ? "#FFF" : "#FAFAFA" }}>
                    <td style={{ padding:"12px 16px", fontSize:13, fontWeight:600, color:"#1A1A1A" }}>{ing.name}</td>
                    <td style={{ padding:"12px 16px", fontSize:12, color:"#7A7A7A" }}>{ing.category}</td>
                    <td style={{ padding:"12px 16px", fontSize:13, fontWeight:600, color: ing.isLow ? "#8B3A3A" : "#1A1A1A", fontFamily:"monospace" }}>
                      {Math.round(ing.totalActive)} {ing.unit}
                      {ing.isLow && <span style={{ marginLeft:6, fontSize:10, background:"#FEF2F2", color:"#8B3A3A", padding:"2px 6px", borderRadius:3 }}>LOW</span>}
                    </td>
                    <td style={{ padding:"12px 16px", fontSize:12, color:"#4A4A4A", fontFamily:"monospace" }}>KES {Math.round(ing.costPerUnit)}/{ing.unit}</td>
                    <td style={{ padding:"12px 16px", fontSize:12, color:"#4A4A4A", fontFamily:"monospace" }}>KES {Math.round(ing.value).toLocaleString()}</td>
                    <td style={{ padding:"12px 16px" }}>
                      {ing.earliestExp
                        ? <span style={{ background:expBg, color:expColor, fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:4 }}>
                            {daysToExp < 0 ? "Expired" : daysToExp === 0 ? "Today" : daysToExp+"d"}
                          </span>
                        : <span style={{ color:"#9CA3AF", fontSize:11 }}>-</span>}
                    </td>
                    <td style={{ padding:"12px 16px" }}>
                      <span style={{ background: ing.totalActive > 0 ? "#ECFDF5" : "#FEF2F2", color: ing.totalActive > 0 ? "#2E7D64" : "#8B3A3A", fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:4 }}>
                        {ing.totalActive > 0 ? "In Stock" : "Out"}
                      </span>
                    </td>
                    <td style={{ padding:"8px 12px" }}>
                      <div style={{ display:"flex", gap:6 }}>
                        <button onClick={() => setEditIng(ing)} style={{ padding:"5px 12px", borderRadius:4, border:"1px solid #C5A059", background:"#FEF9F0", fontSize:11, cursor:"pointer", color:"#C5A059", fontWeight:600 }}>Edit</button>
                        <button onClick={() => setDeleteIng(ing)} style={{ padding:"5px 12px", borderRadius:4, border:"1px solid #FECACA", background:"#FEF2F2", fontSize:11, cursor:"pointer", color:"#DC2626", fontWeight:600 }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}

// --- InventoryReadOnlyView ---
export function InventoryReadOnlyView({ batches, ingredients }) {
  const { mobile } = useBreakpoint();
  const [search,    setSearch]    = useState("");
  const [liveStock, setLiveStock] = useState(null); // null = use prop batches
  const today = new Date();

  // Refresh stock from backend when component mounts
  useEffect(() => {
    inventoryApi.batches({ limit:500 })
      .then(r => setLiveStock(r.batches || []))
      .catch(() => {});
  }, []);

  const activeBatches = liveStock || batches;
  const ing = (ingredients||[]).filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div style={{ flex:1, overflowY:"auto", padding: mobile ? 14 : 28, background:"#F5F2EB" }}>
      <SectionHeader title="Stock Viewer" sub={liveStock ? `Live stock — ${activeBatches.filter(b=>b.status==="active").length} active batches` : "Loading..."} />
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..."
        style={{ marginTop:16, marginBottom:16, padding:"8px 14px", border:"1px solid #E5E0D5", borderRadius:4, fontSize:12, width:"100%", maxWidth:300, boxSizing:"border-box" }} />
      <div style={{ background:"#FFF", borderRadius:8, border:"1px solid #E5E0D5", overflow:"hidden" }}>
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", minWidth: mobile ? 560 : "auto", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#1A1A1A" }}>
              {["Ingredient","Category","Stock","Unit","Reorder"].map(h => (
                <th key={h} style={{ padding:"10px 16px", fontSize:10, fontWeight:600, color:"rgba(255,255,255,0.7)", textAlign:"left", textTransform:"uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ing.map((i,idx) => {
              const bId = i.id;
              const stockRaw = parseFloat(activeBatches.filter(b=>(b.ingredientId||b.ingredient_id)===bId&&b.status==="active").reduce((s,b)=>s+(parseFloat(b.remaining)||0),0));
              const stock = Math.round(stockRaw);
              const reorder = i.reorderLevel || i.reorder_level || 0;
              const isLow = stock > 0 && stock <= reorder;
              const isOut = stock <= 0;
              return (
                <tr key={i.id} style={{ borderBottom:"1px solid #F0EDE6", background:idx%2===0?"#FFF":"#FAFAFA" }}>
                  <td style={{ padding:"10px 16px", fontSize:12, fontWeight:600 }}>{i.name}</td>
                  <td style={{ padding:"10px 16px", fontSize:12, color:"#7A7A7A" }}>{i.category}</td>
                  <td style={{ padding:"10px 16px", fontSize:12, fontFamily:"monospace", fontWeight:600, color: isOut?"#DC2626":isLow?"#B8860B":"#2E7D64" }}>
                    {stock} {isOut&&<span style={{fontSize:10,background:"#FEF2F2",color:"#DC2626",padding:"1px 6px",borderRadius:4,fontWeight:700,marginLeft:4}}>OUT</span>}
                    {isLow&&!isOut&&<span style={{fontSize:10,background:"#FFFBEB",color:"#B8860B",padding:"1px 6px",borderRadius:4,fontWeight:700,marginLeft:4}}>LOW</span>}
                  </td>
                  <td style={{ padding:"10px 16px", fontSize:12, color:"#7A7A7A" }}>{i.unit}</td>
                  <td style={{ padding:"10px 16px", fontSize:11, color:"#9CA3AF" }}>{reorder>0?`Reorder at ${reorder}`:"-"}</td>
                </tr>
              );
            })}
            {ing.length===0 && <tr><td colSpan={4} style={{ padding:40, textAlign:"center", color:"#9CA3AF" }}>No ingredients found</td></tr>}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}


export function ReceiveStockView({ batches, setBatches, ingredients: propIngredients = [] }) {
  const { mobile } = useBreakpoint();
  const [selected, setSelected] = useState(null);
  const [form, setForm]         = useState({ batchNo:"", qty:"", costPerUnit:"", expiry:"", location:"Main Store" });
  const [search, setSearch]     = useState("");
  const [saving, setSaving]     = useState(false);
  const [saved,  setSaved]      = useState(false);
  const [error,  setError]      = useState("");
  const [recent, setRecent]     = useState([]);

  useEffect(() => {
    inventoryApi.batches({ limit:20 }).then(r => setRecent(r.batches||[])).catch(()=>{});
  }, [saved]);

  const pick = (ing) => {
    setSelected(ing);
    setForm({ batchNo:"", qty:"", costPerUnit:String(ing.costPerUnit||ing.cost_per_unit||""), expiry:"", location:"Main Store" });
    setError(""); setSaved(false);
  };

  const submit = async () => {
    if (!selected)                       { setError("Select an ingredient from the list"); return; }
    if (!form.qty||Number(form.qty)<=0)  { setError("Enter a valid quantity"); return; }
    setSaving(true); setError("");
    try {
      const pUnit = selected.purchase_unit || selected.purchaseUnit;
      const pQty  = parseFloat(selected.purchase_qty || selected.purchaseQty) || 0;
      const hasPU = pUnit && pQty > 0;
      // Convert purchase units to cooking units (e.g. 3 loaves × 20 = 60 slices)
      const stockQty = hasPU ? Number(form.qty) * pQty : Number(form.qty);
      // Cost per cooking unit = cost per purchase unit ÷ units per purchase
      const costPerCookingUnit = hasPU && form.costPerUnit ? Number(form.costPerUnit) / pQty : Number(form.costPerUnit)||undefined;
      const batch = await inventoryApi.receiveBatch({
        ingredient_id: selected.id,
        batch_no:      form.batchNo||undefined,
        qty:           stockQty,
        expiry:        form.expiry||undefined,
        location:      form.location,
        cost_per_unit: costPerCookingUnit,
      });
      setBatches(p=>[...p,{ id:batch.id, ingredientId:batch.ingredient_id, batchNo:batch.batch_no, qty:batch.qty, remaining:batch.remaining, expiry:batch.expiry, location:batch.location, status:"active" }]);
      setSaved(true); setSelected(null);
      setForm({ batchNo:"", qty:"", costPerUnit:"", expiry:"", location:"Main Store" });
      setTimeout(()=>setSaved(false), 3000);
    } catch(e) { setError(JSON.stringify(e?.response?.data) || e?.message || "Save failed");
    } finally { setSaving(false); }
  };

  const fi = { border:"1px solid #E5E0D5", borderRadius:4, padding:"8px 12px", fontSize:12, outline:"none", background:"#FFFFFF", width:"100%", boxSizing:"border-box", fontFamily:"'Inter',sans-serif" };
  const filtered = propIngredients.filter(i=>i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"#F5F2EB" }}>
      <div style={{ padding: mobile ? "14px 12px 10px" : "20px 28px 12px", flexShrink:0 }}>
        <SectionHeader title="Receive Stock" sub="Click an ingredient to record a delivery" />
        {saved && <div style={{ marginTop:10, padding:"8px 14px", background:"#F0FDF4", border:"1px solid #86EFAC", borderRadius:4, fontSize:11, color:"#15803D", fontWeight:600 }}>Stock received and added to inventory!</div>}
      </div>
      <div style={{ flex:1, display:"grid", gridTemplateColumns: mobile ? "1fr" : "280px 1fr 290px", gap:16, padding: mobile ? "0 12px 16px" : "0 28px 28px", overflow:"hidden" }}>

        {/* LEFT: ingredient list */}
        <div style={{ display:"flex", flexDirection:"column", gap:8, overflow:"hidden" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search ingredients..." style={{ ...fi, flexShrink:0 }} />
          <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:6 }}>
            {filtered.length===0 && <div style={{ padding:24, textAlign:"center", color:"#9CA3AF", fontSize:12 }}>No ingredients yet - add them in Inventory first</div>}
            {filtered.map(ing => {
              const stock = batches.filter(b=>(b.ingredientId||b.ingredient_id)===ing.id&&b.status==="active").reduce((s,b)=>s+(parseFloat(b.remaining)||0),0);
              const isSel = selected?.id===ing.id;
              const isLow = stock<=(ing.reorderLevel||ing.reorder_level||0);
              return (
                <div key={ing.id} onClick={()=>pick(ing)}
                  style={{ padding:"10px 14px", borderRadius:6, cursor:"pointer", border:`1px solid ${isSel?"#C5A059":"#E5E0D5"}`, background:isSel?"#FEF9F0":"#FFF", transition:"all 0.15s" }}>
                  <div style={{ fontSize:12, fontWeight:600, color:"#1A1A1A" }}>{ing.name}</div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
                    <span style={{ fontSize:10, color:"#7A7A7A" }}>{ing.category}</span>
                    <span style={{ fontSize:10, fontWeight:600, color:stock<=0?"#DC2626":isLow?"#B8860B":"#2E7D64" }}>{Math.round(stock)} {ing.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTRE: form */}
        <div style={{ background:"#FFF", border:"1px solid #E5E0D5", borderRadius:8, padding:24, overflowY:"auto" }}>
          {!selected ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", color:"#9CA3AF" }}>
              <div style={{ fontSize:48, marginBottom:12 }}>←</div>
              <div style={{ fontSize:13, fontWeight:500 }}>Select an ingredient from the list</div>
              <div style={{ fontSize:11, marginTop:6 }}>Click any item on the left to record a delivery</div>
            </div>
          ) : (
            <>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:600, color:"#1A1A1A" }}>{selected.name}</div>
                  <div style={{ fontSize:11, color:"#7A7A7A", marginTop:2 }}>{selected.category} · {selected.unit}</div>
                </div>
                <button onClick={()=>setSelected(null)} style={{ border:"1px solid #E5E0D5", background:"#FFF", borderRadius:4, padding:"4px 12px", fontSize:11, cursor:"pointer", color:"#7A7A7A" }}>Change</button>
              </div>
              {error && <div style={{ padding:"8px 12px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:4, fontSize:11, color:"#8B3A3A", marginBottom:14 }}>{error}</div>}
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <div>
                  {(() => {
                    const pUnit = selected.purchase_unit || selected.purchaseUnit;
                    const pQty  = parseFloat(selected.purchase_qty || selected.purchaseQty) || 0;
                    const inSlices = pUnit && pQty && form.qty ? (parseFloat(form.qty)||0) * pQty : null;
                    return (
                      <>
                        <label style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>
                          Quantity Received ({pUnit && pQty ? pUnit : selected.unit}) *
                        </label>
                        <input type="number" min="0" step="0.001" value={form.qty}
                          onChange={e=>setForm(f=>({...f,qty:e.target.value}))}
                          placeholder={pUnit && pQty ? `e.g. 5 ${pUnit}s` : `e.g. 5 ${selected.unit}`}
                          style={{ ...fi, marginTop:4, fontSize:16, fontWeight:600 }} autoFocus />
                        {inSlices!==null && (
                          <div style={{ fontSize:11, color:"#2E7D64", marginTop:4, fontWeight:600 }}>
                            = {inSlices} {selected.unit} will be added to stock
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div style={{ display:"grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap:12 }}>
                  <div>
                    {(() => {
                      const pUnit = selected.purchase_unit || selected.purchaseUnit;
                      const pQty  = parseFloat(selected.purchase_qty || selected.purchaseQty) || 0;
                      return (
                        <>
                          <label style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>
                            Cost per {pUnit && pQty ? pUnit : selected.unit} (KES)
                          </label>
                          <input type="number" min="0" step="0.01" value={form.costPerUnit}
                            onChange={e=>setForm(f=>({...f,costPerUnit:e.target.value}))}
                            placeholder="e.g. 60" style={{ ...fi, marginTop:4 }} />
                          {pUnit && pQty && form.costPerUnit && (
                            <div style={{ fontSize:10, color:"#7A7A7A", marginTop:3 }}>
                              = KES {(parseFloat(form.costPerUnit)/pQty).toFixed(2)} per {selected.unit}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div>
                    <label style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>Total Value</label>
                    <div style={{ marginTop:4, padding:"8px 12px", background:"#F8F8F8", border:"1px solid #E5E0D5", borderRadius:4, fontSize:13, fontWeight:600, color:"#1A1A1A" }}>
                      {form.qty&&form.costPerUnit ? "KES "+(Number(form.qty)*Number(form.costPerUnit)).toFixed(2) : "-"}
                      {(()=>{ const pu=selected.purchase_unit||selected.purchaseUnit; const pq=parseFloat(selected.purchase_qty||selected.purchaseQty)||0; return pu&&pq&&form.qty&&form.costPerUnit ? <div style={{fontSize:10,color:"#7A7A7A",marginTop:2}}>{(Number(form.qty)*pq).toFixed(0)} {selected.unit} total</div> : null; })()}
                    </div>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap:12 }}>
                  <div>
                    <label style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>Expiry Date</label>
                    <input type="date" value={form.expiry} onChange={e=>setForm(f=>({...f,expiry:e.target.value}))} style={{ ...fi, marginTop:4 }} />
                  </div>
                  <div>
                    <label style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>Storage Location</label>
                    <select value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} style={{ ...fi, marginTop:4 }}>
                      {["Main Store","Kitchen","Cold Room","Dry Store"].map(l=><option key={l}>{l}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>Batch / Invoice No (optional)</label>
                  <input value={form.batchNo} onChange={e=>setForm(f=>({...f,batchNo:e.target.value}))} placeholder="e.g. INV-2024-054" style={{ ...fi, marginTop:4 }} />
                </div>
                <button onClick={submit} disabled={saving}
                  style={{ padding:"12px", borderRadius:6, border:"none", background:saving?"#9CA3AF":"linear-gradient(135deg,#1A1A1A,#C5A059)", color:"#FFF", fontWeight:600, fontSize:13, cursor:saving?"default":"pointer" }}>
                  {saving ? "Recording..." : (() => {
                    const pu = selected.purchase_unit||selected.purchaseUnit;
                    const pq = parseFloat(selected.purchase_qty||selected.purchaseQty)||0;
                    return pu&&pq
                      ? `Record: ${form.qty||"?"} ${pu} of ${selected.name} (= ${(parseFloat(form.qty)||0)*pq} ${selected.unit})`
                      : `Record: ${form.qty||"?"} ${selected.unit} of ${selected.name}`;
                  })()}
                </button>
              </div>
            </>
          )}
        </div>

        {/* RIGHT: recent deliveries */}
        <div style={{ background:"#FFF", border:"1px solid #E5E0D5", borderRadius:8, padding:20, overflowY:"auto" }}>
          <div style={{ fontSize:12, fontWeight:600, color:"#1A1A1A", marginBottom:14 }}>Recent Deliveries</div>
          {recent.length===0 && <div style={{ color:"#9CA3AF", fontSize:11, textAlign:"center", marginTop:20 }}>No deliveries recorded yet</div>}
          {recent.map(b=>(
            <div key={b.id} style={{ padding:"10px 0", borderBottom:"1px solid #F0EDE6" }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:12, fontWeight:600, color:"#1A1A1A" }}>{b.ingredient_name||b.name}</span>
                <span style={{ fontSize:11, fontWeight:600, color:"#2E7D64" }}>+{b.qty} {b.unit}</span>
              </div>
              <div style={{ fontSize:10, color:"#7A7A7A", marginTop:2 }}>
                {b.location} · {b.received_date?new Date(b.received_date).toLocaleDateString():"Today"}
                {b.expiry ? ` · exp ${new Date(b.expiry).toLocaleDateString()}` : ""}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- ISSUE STOCK VIEW ---
export function IssueStockView({ batches, setBatches, storeIssues, setStoreIssues, user, ingredients: propIngredients = [] }) {
  const { mobile } = useBreakpoint();

  const [search,   setSearch]   = useState("");
  const [qtys,     setQtys]     = useState({});   // { ingredientId: qtyString }
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [errors,   setErrors]   = useState({});
  const [issueLog, setIssueLog] = useState([]);
  const [notes,    setNotes]    = useState("");

  useEffect(() => {
    inventoryApi.issues({ limit:30 }).then(r=>setIssueLog(r.issues||[])).catch(()=>{});
  }, [saved]);

  const availBatches = (ingId) => batches
    .filter(b=>(b.ingredientId||b.ingredient_id)===ingId&&b.status==="active"&&(parseFloat(b.remaining)||0)>0)
    .sort((a,b)=>new Date(a.expiry)-new Date(b.expiry));
  const totalAvail = (ingId) => availBatches(ingId).reduce((s,b)=>s+(parseFloat(b.remaining)||0),0);

  const filtered = propIngredients
    .filter(i=>i.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>a.name.localeCompare(b.name));

  const hasQtys = Object.values(qtys).some(v=>Number(v)>0);

  const submitAll = async () => {
    const toIssue = filtered.filter(i=>Number(qtys[i.id])>0);
    if (!toIssue.length) return;

    // Validate
    const errs = {};
    toIssue.forEach(ing=>{
      const qty = Number(qtys[ing.id]);
      const avail = totalAvail(ing.id);
      if (qty > avail) errs[ing.id] = `Max ${fmtStock(avail)} ${ing.unit}`;
    });
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true); setErrors({});
    const nb = [...batches];
    let anyFailed = false;

    for (const ing of toIssue) {
      const qty = Number(qtys[ing.id]);
      const eligible = availBatches(ing.id);
      if (!eligible.length) continue;
      try {
        await inventoryApi.recordIssue({
          ingredient_id: ing.id,
          batch_id:      eligible[0].id,
          qty,
          from_location: "Main Store",
          to_location:   "Kitchen",
          notes:         notes || undefined,
        });
        // Deduct FEFO
        let needed = qty;
        for (const b of eligible) {
          if (needed<=0) break;
          const take = Math.min(b.remaining, needed);
          const idx  = nb.findIndex(x=>x.id===b.id);
          nb[idx] = {...nb[idx], remaining: nb[idx].remaining - take};
          if (nb[idx].remaining<=0) nb[idx]={...nb[idx], status:"depleted"};
          needed -= take;
        }
      } catch(e) { anyFailed = true; }
    }

    setBatches(nb);
    setSaving(false);
    setSaved(true);
    setQtys({});
    setNotes("");
    setTimeout(()=>setSaved(false), 3000);
    // Refresh log
    inventoryApi.issues({ limit:30 }).then(r=>setIssueLog(r.issues||[])).catch(()=>{});
  };

  const fi = { border:"1px solid #E5E0D5", borderRadius:4, outline:"none", background:"#FFFFFF", fontFamily:"'Inter',sans-serif" };

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"#F5F2EB" }}>

      {/* Header */}
      <div style={{ padding: mobile ? "14px 12px 10px" : "20px 28px 14px", flexShrink:0, borderBottom:"1px solid #E5E0D5", background:"#FFFFFF" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
          <div>
            <SectionHeader title="Issue Stock to Kitchen" sub="Enter quantities issued — stock deducted automatically (FEFO)" />
            {saved && <div style={{ marginTop:8, padding:"6px 14px", background:"#F0FDF4", border:"1px solid #86EFAC", borderRadius:4, fontSize:11, color:"#15803D", fontWeight:600, display:"inline-block" }}>Stock issued successfully!</div>}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notes (optional)..."
              style={{ ...fi, padding:"8px 12px", fontSize:12, width:220 }} />
            <button onClick={submitAll} disabled={saving||!hasQtys}
              style={{ padding:"10px 24px", borderRadius:6, border:"none", fontWeight:700, fontSize:13, cursor:hasQtys?"pointer":"not-allowed",
                background:hasQtys?"linear-gradient(135deg,#1A1A1A,#C5A059)":"#E5E0D5", color:hasQtys?"#FFF":"#9CA3AF", whiteSpace:"nowrap" }}>
              {saving ? "Issuing..." : `Issue${hasQtys?" ("+Object.values(qtys).filter(v=>Number(v)>0).length+" items)":"..."}`}
            </button>
          </div>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter ingredients..."
          style={{ ...fi, padding:"8px 14px", fontSize:12, width:260, marginTop:12 }} />
      </div>

      {/* Main — two columns */}
      <div style={{ flex:1, display:"flex", flexDirection: mobile ? "column" : "row", overflow: mobile ? "auto" : "hidden", gap:0 }}>

        {/* Issue sheet */}
        <div style={{ flex:1, overflowY:"auto", padding:"16px 28px" }}>
          <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}><table style={{ width:"100%", minWidth: mobile ? 560 : "auto", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#F5F2EB", borderBottom:"2px solid #E5E0D5" }}>
                {["Ingredient","Unit","In Stock","Qty to Issue",""].map(h=>(
                  <th key={h} style={{ padding:"10px 12px", textAlign:"left", fontSize:10, fontWeight:700, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((ing,idx)=>{
                const avail   = totalAvail(ing.id);
                const qty     = qtys[ing.id]||"";
                const hasQty  = Number(qty)>0;
                const err     = errors[ing.id];
                const noStock = avail<=0;
                const isLow   = avail>0 && avail<=(ing.reorderLevel||ing.reorder_level||0);
                return (
                  <tr key={ing.id} style={{
                    background: hasQty?"#FEF9F0":idx%2===0?"#FFFFFF":"#FAFAF8",
                    borderBottom:"1px solid #F0EDE6",
                    opacity: noStock?0.5:1,
                  }}>
                    <td style={{ padding:"10px 12px", fontWeight:600, color:"#1A1A1A" }}>{ing.name}</td>
                    <td style={{ padding:"10px 12px", color:"#7A7A7A", fontSize:11 }}>{ing.unit}</td>
                    <td style={{ padding:"10px 12px" }}>
                      <span style={{ fontWeight:600, color:noStock?"#DC2626":isLow?"#B8860B":"#2E7D64" }}>
                        {noStock?"OUT":Math.round(avail)}
                      </span>
                    </td>
                    <td style={{ padding:"6px 12px", width:140 }}>
                      <input
                        type="number" min="0" step="0.001"
                        value={qty}
                        disabled={noStock}
                        onChange={e=>{
                          setQtys(p=>({...p,[ing.id]:e.target.value}));
                          setErrors(p=>({...p,[ing.id]:undefined}));
                        }}
                        placeholder="0"
                        style={{
                          ...fi, padding:"7px 10px", fontSize:14, fontWeight:hasQty?700:400,
                          width:"100%", boxSizing:"border-box",
                          border:`1px solid ${err?"#FECACA":hasQty?"#C5A059":"#E5E0D5"}`,
                          background:noStock?"#F5F5F5":"#FFFFFF",
                          color:hasQty?"#C5A059":"#1A1A1A",
                        }}
                      />
                      {err && <div style={{ fontSize:10, color:"#DC2626", marginTop:2 }}>{err}</div>}
                    </td>
                    <td style={{ padding:"10px 12px", width:80 }}>
                      {hasQty && (
                        <button onClick={()=>setQtys(p=>({...p,[ing.id]:""}))}
                          style={{ fontSize:11, color:"#DC2626", background:"none", border:"none", cursor:"pointer", padding:0, fontWeight:600 }}>
                          Clear
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>

        {/* Right: recent issues log */}
        <div style={{ width: mobile ? "100%" : 260, background:"#FFFFFF", borderLeft:"1px solid #E5E0D5", overflowY:"auto", padding:20, flexShrink:0 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#1A1A1A", marginBottom:14, letterSpacing:0.3 }}>Recent Issues</div>
          {issueLog.length===0 && <div style={{ color:"#9CA3AF", fontSize:11, textAlign:"center", marginTop:20 }}>No issues recorded yet</div>}
          {issueLog.map(iss=>(
            <div key={iss.id} style={{ padding:"9px 0", borderBottom:"1px solid #F0EDE6" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                <span style={{ fontSize:12, fontWeight:600, color:"#1A1A1A" }}>{iss.ingredient_name||iss.ingredient_id}</span>
                <span style={{ fontSize:11, fontWeight:700, color:"#8B3A3A" }}>-{Math.round(parseFloat(iss.qty)||0)}</span>
              </div>
              <div style={{ fontSize:10, color:"#7A7A7A", marginTop:1 }}>{iss.to_location}</div>
              <div style={{ fontSize:10, color:"#9CA3AF" }}>{iss.issue_date?new Date(iss.issue_date).toLocaleDateString():"Today"} · {iss.issued_by_name||"-"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
