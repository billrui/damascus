import { useState, useMemo, useEffect, Fragment } from "react";
import { inventoryApi, itemsApi } from "../api";
import { fmt, fmtK } from "../utils";
import { Card, Btn, SectionHeader, ExpiryBadge } from "../components/UI";
import { useBreakpoint } from "../hooks/useBreakpoint";

const _CATS  = ["Proteins","Grains","Vegetables","Oils","Spices","Dairy","Beverages","Spirits","Produce","Bakery","Utilities","Supplies","Other"];

const fmtStock = (n) => String(Math.round(parseFloat(n)||0));
// Quantities (recipe amounts, deductions) keep fractions like 0.25 / 0.5 but show whole numbers cleanly
const fmtQty = (n) => { const f = parseFloat(n) || 0; return Number.isInteger(f) ? String(f) : String(parseFloat(f.toFixed(3))); };

// Container presets for receiving stock — multiplier converts ONE container to the
// ingredient's base (cooking) unit. e.g. base unit "ml": a 5 L can = 5000.
const containerOptions = (unit) => {
  const u = (unit || "").toLowerCase().trim().replace(/\.$/, "");
  const direct = { label: `${unit || "unit"} — type total`, mult: 1, direct: true };
  const isMl  = ["ml","mls","milliliter","millilitre","milliliters","millilitres","cc"].includes(u);
  const isL   = ["l","ltr","litre","liter","litres","liters"].includes(u);
  const isG   = ["g","gm","gms","gram","grams","gramme","grammes"].includes(u);
  const isKg  = ["kg","kgs","kilo","kilos","kilogram","kilograms","kgm"].includes(u);
  if (isMl)  return [direct, {label:"250 ml",mult:250},{label:"500 ml",mult:500},{label:"1 L",mult:1000},{label:"2 L",mult:2000},{label:"3 L",mult:3000},{label:"5 L",mult:5000},{label:"10 L",mult:10000},{label:"20 L",mult:20000}];
  if (isL)   return [direct,{label:"1 L",mult:1},{label:"2 L",mult:2},{label:"3 L",mult:3},{label:"5 L",mult:5},{label:"10 L",mult:10},{label:"20 L",mult:20}];
  if (isG)   return [direct,{label:"50 g",mult:50},{label:"100 g",mult:100},{label:"200 g",mult:200},{label:"250 g",mult:250},{label:"500 g",mult:500},{label:"1 kg",mult:1000},{label:"2 kg",mult:2000},{label:"5 kg",mult:5000},{label:"10 kg",mult:10000},{label:"25 kg",mult:25000}];
  if (isKg)  return [direct,{label:"1 kg",mult:1},{label:"2 kg",mult:2},{label:"5 kg",mult:5},{label:"10 kg",mult:10},{label:"25 kg",mult:25},{label:"50 kg",mult:50}];
  // pieces / bottle / can / sachet / slice etc — counted whole
  return [{ label: `${unit || "piece"} (each)`, mult: 1, direct: true }];
};
const _UNITS = ["g","kg","ml","l","pcs","loaf","tray","slice","bunch","bottle","can","packet","box","bundle","crate","sack","jerrycan","tin","bar","roll","bag","sachet","cup"];

// --- AddIngredientModal ---
function AddIngredientModal({ onClose, onSaved }) {
  const { mobile } = useBreakpoint();
  const [form, setForm] = useState({ name:"", unit:"g", category:"", reorder_level:"", purchase_unit:"", purchase_qty:"", purchase_cost:"", opening_stock:"", issued_whole:false });
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
        issued_whole: form.issued_whole === true,
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
            <label style={{ display:"flex", alignItems:"flex-start", gap:8, cursor:"pointer" }}>
              <input type="checkbox" checked={form.issued_whole} onChange={e=>set("issued_whole", e.target.checked)} style={{ marginTop:2, width:15, height:15, flexShrink:0 }} />
              <span>
                <span style={{ fontSize:12, fontWeight:600, color:"#1A1A1A" }}>Issued to kitchen as a whole unit</span>
                <span style={{ display:"block", fontSize:10.5, color:"#9CA3AF", marginTop:2 }}>Tick for bulk items like cooking oil, salt or flour that you hand over whole via Issue Stock. Produce Batch won't deduct these again (avoids double-counting), but they still count toward dish cost.</span>
              </span>
            </label>
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
    reorder_level: (() => { const v = parseFloat(ingredient.reorderLevel ?? ingredient.reorder_level); return Number.isFinite(v) ? String(v) : ""; })(),
    cost_per_unit: (() => { const v = parseFloat(ingredient.costPerUnit ?? ingredient.cost_per_unit); return Number.isFinite(v) ? String(v) : ""; })(),
    issued_whole:  (ingredient.issuedWhole ?? ingredient.issued_whole) === true,
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
        issued_whole:  form.issued_whole === true,
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
          <label style={{ display:"flex", alignItems:"flex-start", gap:8, cursor:"pointer", borderTop:"1px solid #F0EDE6", paddingTop:12, marginTop:2 }}>
            <input type="checkbox" checked={form.issued_whole} onChange={e=>set("issued_whole", e.target.checked)} style={{ marginTop:2, width:15, height:15, flexShrink:0 }} />
            <span>
              <span style={{ fontSize:12, fontWeight:600, color:"#1A1A1A" }}>Issued to kitchen as a whole unit</span>
              <span style={{ display:"block", fontSize:10.5, color:"#9CA3AF", marginTop:2 }}>For bulk items like cooking oil, salt or flour handed over whole. Produce Batch won't deduct these again — still counted for cost.</span>
            </span>
          </label>
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
  const [canForce, setCanForce] = useState(false);

  const del = async (force=false) => {
    setDeleting(true); setError("");
    try {
      await inventoryApi.deleteIngredient(ingredient.id, force);
      onDeleted(ingredient.id);
    } catch(e) {
      setError(e?.response?.data?.error || "Delete failed");
      if (e?.response?.data?.canForce) setCanForce(true);
    } finally { setDeleting(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#FFF", borderRadius:8, padding:28, width:400, maxWidth:"95vw", boxShadow:"0 8px 32px rgba(0,0,0,0.2)" }}>
        <div style={{ fontSize:15, fontWeight:600, color:"#1A1A1A", marginBottom:8 }}>Delete "{ingredient.name}"?</div>
        <div style={{ fontSize:12, color:"#7A7A7A", marginBottom:20 }}>
          {canForce
            ? "This item has stock or recipe links. \u201CDelete anyway\u201D will permanently remove it AND its stock, delivery, and recipe records. This cannot be undone."
            : "This cannot be undone. Empty items delete cleanly; items with stock or recipes will ask you to confirm a full delete."}
        </div>
        {error && <div style={{ padding:"8px 12px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:4, fontSize:11, color:"#8B3A3A", marginBottom:14 }}>{error}</div>}
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:4, border:"1px solid #E5E0D5", background:"#FFF", color:"#7A7A7A", fontWeight:600, fontSize:12, cursor:"pointer" }}>Cancel</button>
          {canForce ? (
            <button onClick={()=>del(true)} disabled={deleting} style={{ flex:1, padding:"10px", borderRadius:4, border:"none", background:deleting?"#9CA3AF":"#B91C1C", color:"#FFF", fontWeight:700, fontSize:12, cursor:"pointer" }}>
              {deleting ? "Deleting..." : "Delete anyway"}
            </button>
          ) : (
            <button onClick={()=>del(false)} disabled={deleting} style={{ flex:1, padding:"10px", borderRadius:4, border:"none", background:deleting?"#9CA3AF":"#DC2626", color:"#FFF", fontWeight:600, fontSize:12, cursor:"pointer" }}>
              {deleting ? "Deleting..." : "Yes, Delete"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Produce Batch: deduct a menu item's recipe ingredients (× batches) from store ──
export function ProduceBatchView({ batches, setBatches, ingredients: propIngredients = [] }) {
  const { mobile } = useBreakpoint();
  const [items,   setItems]   = useState([]);
  const [pickId,  setPickId]  = useState("");
  const [count,   setCount]   = useState(1);
  const [busy,    setBusy]    = useState(false);
  const [done,    setDone]    = useState(null);
  const [error,   setError]   = useState("");
  const [search,  setSearch]  = useState("");

  useEffect(() => {
    itemsApi.list().then(list => setItems((list || []).filter(it => (it.recipe || []).length > 0))).catch(() => {});
  }, [done]);

  const stockOf = (ingId) => batches
    .filter(b => (b.ingredientId || b.ingredient_id) === ingId && b.status === "active")
    .reduce((s, b) => s + (parseFloat(b.remaining) || 0), 0);

  const item    = items.find(it => it.id === pickId);
  const n        = Math.max(1, parseInt(count) || 1);
  const filtered = items
    .filter(it => it.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Build deduction preview
  const lines = (item?.recipe || []).map(r => {
    const ing  = propIngredients.find(i => i.id === r.ingredient_id);
    const name = r.name || ing?.name || r.ingredient_id;
    const unit = r.unit || ing?.unit || "";
    const need = (parseFloat(r.qty) || 0) * n;
    const have = stockOf(r.ingredient_id);
    const issuedWhole = (ing?.issuedWhole ?? ing?.issued_whole) === true;
    return { name, unit, need, have, issuedWhole, short: !issuedWhole && have < need };
  });
  const anyShort = lines.some(l => l.short);

  const produce = async () => {
    if (!item) { setError("Pick an item to produce"); return; }
    setBusy(true); setError("");
    try {
      const res = await inventoryApi.produce({ menu_item_id: item.id, batches: n });
      // refresh batches so stock everywhere reflects the deduction
      const fresh = await inventoryApi.batches({ limit: 500 }).catch(() => null);
      if (fresh && setBatches) setBatches(fresh.batches || []);
      setDone(res);
    } catch (e) {
      const d = e?.response?.data;
      const real = d?.error || d?.message;
      setError(
        real
          ? `Couldn't produce: ${real}`
          : e?.response
            ? `Couldn't produce (server error ${e.response.status}). If this just appeared, the backend may need a restart.`
            : "Couldn't reach the server — is the backend running?"
      );
    } finally { setBusy(false); }
  };

  if (done) {
    return (
      <div style={{ flex:1, overflowY:"auto", padding: mobile ? 16 : 32, background:"#F5F2EB" }}>
        <div style={{ maxWidth:560, margin:"0 auto", background:"#FFF", border:"1px solid #E5E0D5", borderRadius:10, padding:24, textAlign:"center" }}>
          <div style={{ width:48, height:48, borderRadius:"50%", background:"#F0FDF4", border:"1px solid #86EFAC", color:"#16A34A", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, margin:"0 auto 12px" }}>✓</div>
          <div style={{ fontSize:16, fontWeight:600, color:"#1A1A1A" }}>Produced {done.batches} × {done.item}</div>
          {done.servings != null && (
            <div style={{ display:"inline-block", marginTop:8, padding:"6px 14px", background:"#F0FDF4", border:"1px solid #86EFAC", borderRadius:20, fontSize:12, color:"#15803D", fontWeight:600 }}>
              {fmtQty(done.servings)} now available to sell
            </div>
          )}
          <div style={{ fontSize:12, color:"#7A7A7A", marginTop:12, marginBottom:16 }}>These ingredients were deducted from store (FEFO):</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6, textAlign:"left", marginBottom:18 }}>
            {(done.deducted || []).map((d, i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:13, padding:"8px 12px", background:"#FAF8F3", borderRadius:6, border:"1px solid #EFE9DD" }}>
                <span style={{ color:"#1A1A1A" }}>{d.ingredient}</span>
                <span style={{ fontWeight:600, color:"#8B3A3A", fontFamily:"monospace" }}>−{fmtQty(d.qty)}</span>
              </div>
            ))}
          </div>
          <button onClick={() => { setDone(null); setPickId(""); setCount(1); setSearch(""); }}
            style={{ padding:"10px 24px", borderRadius:8, border:"none", background:"linear-gradient(135deg,#1A1A1A,#C5A059)", color:"#FFF", fontWeight:600, fontSize:13, cursor:"pointer" }}>
            Produce another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex:1, overflowY:"auto", padding: mobile ? 16 : 32, background:"#F5F2EB" }}>
      <div style={{ maxWidth:860, margin:"0 auto" }}>
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:18, fontWeight:600, color:"#1A1A1A" }}>Produce a Batch</div>
          <div style={{ fontSize:12, color:"#7A7A7A", marginTop:2 }}>Pick what the kitchen is cooking. The recipe's ingredients are deducted from store (FEFO) — once per batch, not per sale.</div>
        </div>

        {error && <div style={{ padding:"9px 12px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:6, fontSize:12, color:"#8B3A3A", marginBottom:14 }}>{error}</div>}

        {items.length === 0 ? (
          <div style={{ textAlign:"center", padding:"30px 16px", border:"1px dashed #E5E0D5", borderRadius:10, color:"#9CA3AF", background:"#FCFBF8" }}>
            <div style={{ fontSize:13, fontWeight:600, color:"#7A7A7A" }}>No items with recipes yet</div>
            <div style={{ fontSize:11, marginTop:3 }}>Add a menu item and link its ingredients first, then produce it here.</div>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns: mobile ? "1fr" : "300px 1fr", gap:18 }}>
            {/* Pick item */}
            <div style={{ background:"#FFF", border:"1px solid #E5E0D5", borderRadius:10, padding:12, alignSelf:"start" }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item..."
                style={{ width:"100%", boxSizing:"border-box", border:"1px solid #E5E0D5", borderRadius:6, padding:"8px 10px", fontSize:12, outline:"none", marginBottom:8 }} />
              <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:340, overflowY:"auto" }}>
                {filtered.map(it => (
                  <button key={it.id} onClick={() => { setPickId(it.id); setError(""); }}
                    style={{ textAlign:"left", padding:"9px 10px", borderRadius:6, cursor:"pointer",
                      border: `1px solid ${pickId===it.id ? "#C5A059" : "#E5E0D5"}`,
                      background: pickId===it.id ? "#FEF9F0" : "#FFF" }}>
                    <div style={{ fontSize:12.5, fontWeight:600, color:"#1A1A1A" }}>{it.name}</div>
                    <div style={{ fontSize:10, color:"#9CA3AF" }}>{(it.recipe||[]).length} ingredient{(it.recipe||[]).length===1?"":"s"}{it.batch_size?` · makes ${it.batch_size}`:""}</div>
                  </button>
                ))}
                {filtered.length === 0 && <div style={{ fontSize:11, color:"#9CA3AF", padding:8 }}>No match.</div>}
              </div>
            </div>

            {/* Batch + preview */}
            <div style={{ background:"#FFF", border:"1px solid #E5E0D5", borderRadius:10, padding:16 }}>
              {!item ? (
                <div style={{ color:"#9CA3AF", fontSize:13, textAlign:"center", padding:"40px 0" }}>Select an item to produce.</div>
              ) : (
                <>
                  <div style={{ fontSize:15, fontWeight:600, color:"#1A1A1A", marginBottom:2 }}>{item.name}</div>
                  <div style={{ fontSize:11, color:"#9CA3AF", marginBottom:14 }}>{item.batch_size ? `One batch = ${item.batch_size} serving${item.batch_size==1?"":"s"}` : "Recipe quantities are per batch"}</div>

                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
                    <label style={{ fontSize:12, fontWeight:600, color:"#4A4A4A" }}>Batches to produce</label>
                    <input type="number" min="1" step="1" value={count} onChange={e => setCount(e.target.value)}
                      style={{ width:90, border:"1px solid #E5E0D5", borderRadius:6, padding:"8px 10px", fontSize:14, textAlign:"center", outline:"none", fontWeight:600 }} />
                  </div>

                  <div style={{ fontSize:9, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Will deduct from store</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16 }}>
                    {lines.map((l, i) => (
                      <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:12.5, padding:"9px 12px", borderRadius:6,
                        background: l.issuedWhole ? "#F8F8F8" : l.short ? "#FEF2F2" : "#FAF8F3",
                        border:`1px solid ${l.issuedWhole ? "#ECECEC" : l.short ? "#FECACA" : "#EFE9DD"}`,
                        opacity: l.issuedWhole ? 0.7 : 1 }}>
                        <span style={{ fontWeight:600, color: l.issuedWhole ? "#9CA3AF" : "#1A1A1A" }}>{l.name}</span>
                        {l.issuedWhole ? (
                          <span style={{ fontSize:10, color:"#9CA3AF", fontStyle:"italic" }}>issued separately — not deducted</span>
                        ) : (
                          <span style={{ display:"flex", gap:12, alignItems:"center" }}>
                            <span style={{ fontFamily:"monospace", color:"#8B3A3A", fontWeight:600 }}>−{fmtQty(l.need)} {l.unit}</span>
                            <span style={{ fontSize:10, color: l.short ? "#DC2626" : "#9CA3AF" }}>
                              {l.short ? `short (have ${fmtQty(l.have)})` : `have ${fmtQty(l.have)}`}
                            </span>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {anyShort && <div style={{ fontSize:11, color:"#DC2626", marginBottom:12 }}>Not enough stock for one or more ingredients. Receive more, or reduce the batch count.</div>}

                  <button onClick={produce} disabled={busy || anyShort}
                    style={{ width:"100%", padding:"12px", borderRadius:8, border:"none",
                      background: (busy || anyShort) ? "#9CA3AF" : "linear-gradient(135deg,#1A1A1A,#C5A059)",
                      color:"#FFF", fontWeight:600, fontSize:14, cursor: (busy || anyShort) ? "not-allowed" : "pointer" }}>
                    {busy ? "Producing..." : `Produce ${n} batch${n>1?"es":""} of ${item.name}`}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
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
  const [showAdd,   setShowAdd]   = useState(false);
  const [editIng,   setEditIng]   = useState(null);
  const [deleteIng, setDeleteIng] = useState(null);
  const [openRows,  setOpenRows]  = useState(() => new Set());
  const toggleRow = (id) => setOpenRows(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
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
        const ingBatches    = batches.filter(b => (b.ingredientId || b.ingredient_id) === ing.id && (filterLoc === "all" || b.location === filterLoc));
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
    // Always sort by urgency (soonest-to-expire first)
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
    return mapped;
  }, [INGREDIENTS, batches, search, filterCat, filterLoc]);

  // Route to receive/issue sub-screens
  if (view === "receive" || view === "issue") {
    const activeTab = tab;
    return (
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ display:"flex", borderBottom:"2px solid #E5E0D5", background:"#FFF", padding:"0 28px", flexShrink:0 }}>
          {[{ id:"receive", label:"Receive Stock" }, { id:"issue", label:"Issue Stock" }, { id:"produce", label:"Produce Batch" }].map(t => (
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
        {activeTab === "produce" && (
          <ProduceBatchView batches={batches} setBatches={setBatches||(() => {})} ingredients={propIngredients||[]} />
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
                  <Fragment key={ing.id}>
                  <tr style={{ borderBottom: openRows.has(ing.id) ? "none" : "1px solid #F0EDE6", background: idx%2===0 ? "#FFF" : "#FAFAFA" }}>
                    <td onClick={()=>toggleRow(ing.id)} style={{ padding:"12px 16px", fontSize:13, fontWeight:600, color:"#1A1A1A", cursor:"pointer", userSelect:"none" }}>
                      <span style={{ display:"inline-block", width:14, color:"#9CA3AF", transform: openRows.has(ing.id) ? "rotate(90deg)" : "none", transition:"transform .15s" }}>▸</span>
                      {ing.name}
                      {ing.activeBatches.length > 1 && <span style={{ marginLeft:6, fontSize:10, color:"#9CA3AF" }}>({ing.activeBatches.length} batches)</span>}
                    </td>
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
                  {openRows.has(ing.id) && (
                    <tr style={{ borderBottom:"1px solid #F0EDE6", background:"#FBFAF7" }}>
                      <td colSpan={8} style={{ padding:"4px 16px 12px 30px" }}>
                        {ing.activeBatches.length === 0 ? (
                          <div style={{ fontSize:11, color:"#9CA3AF", padding:"8px 0" }}>No active batches in stock.</div>
                        ) : (
                          <div style={{ display:"flex", flexDirection:"column", gap:4, paddingTop:6 }}>
                            {(() => {
                              // Group container batches by bottle size → count of whole bottles
                              const groups = {};
                              ing.activeBatches.forEach(b => {
                                const sz = Number(b.containerSize ?? b.container_size);
                                if (sz > 0) { groups[sz] = (groups[sz]||0) + Number(b.remaining||0); }
                              });
                              const sizes = Object.keys(groups).map(Number).sort((a,b)=>a-b);
                              if (!sizes.length) return null;
                              return (
                                <div style={{ marginBottom:8, padding:"8px 10px", background:"#FBF7EE", border:"1px solid #EFE4CC", borderRadius:6 }}>
                                  <div style={{ fontSize:9, fontWeight:700, color:"#8A7B5C", textTransform:"uppercase", letterSpacing:1, marginBottom:5 }}>Containers in store</div>
                                  <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                                    {sizes.map(sz => (
                                      <span key={sz} style={{ fontSize:12, fontWeight:600, color:"#1A1A1A", background:"#FFF", border:"1px solid #EFE4CC", borderRadius:5, padding:"4px 10px" }}>
                                        {fmtQty(sz)} {ing.unit} ×&nbsp;<span style={{ color:"#C5A059", fontWeight:800 }}>{fmtQty(groups[sz]/sz)}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                            <div style={{ fontSize:9, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>Batches — used first-expired-first (FEFO)</div>
                            {ing.activeBatches.map((b, bi) => {
                              const dleft = Math.round((new Date(b.expiry) - new Date()) / 86400000);
                              const dColor = isNaN(dleft) ? "#9CA3AF" : dleft < 0 ? "#8B3A3A" : dleft <= 3 ? "#B8860B" : "#2E7D64";
                              return (
                                <div key={b.id||bi} style={{ display:"flex", alignItems:"center", gap:12, fontSize:12, padding:"7px 10px", borderRadius:6, background:"#FFF", border:"1px solid #EFE9DD" }}>
                                  {bi === 0
                                    ? <span style={{ fontSize:9, fontWeight:800, color:"#fff", background:"#2E7D64", padding:"2px 7px", borderRadius:10, flexShrink:0 }}>NEXT OUT</span>
                                    : <span style={{ fontSize:9, fontWeight:700, color:"#9CA3AF", width:58, flexShrink:0 }}>#{bi+1}</span>}
                                  <span style={{ fontWeight:700, fontFamily:"monospace", color:"#1A1A1A", minWidth:90 }}>{Math.round(parseFloat(b.remaining)||0)} {ing.unit}</span>
                                  <span style={{ color:"#7A7A7A" }}>exp {b.expiry ? new Date(b.expiry).toLocaleDateString() : "—"}</span>
                                  <span style={{ color:dColor, fontWeight:600 }}>
                                    {isNaN(dleft) ? "" : dleft < 0 ? `expired ${Math.abs(dleft)}d ago` : dleft === 0 ? "expires today" : `${dleft}d left`}
                                  </span>
                                  {(b.batchNo||b.batch_no) && <span style={{ color:"#8A7B5C", fontSize:10, fontWeight:600, marginLeft:"auto", background:"#FBF7EE", border:"1px solid #EFE4CC", borderRadius:5, padding:"2px 7px" }}>{b.batchNo||b.batch_no}</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
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
  const [sizeView,  setSizeView]  = useState({}); // { ingredientId: size | "all" }
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
              // Container sizes held for this item (whole-bottle tracking)
              const myBatches = activeBatches.filter(b=>(b.ingredientId||b.ingredient_id)===bId&&b.status==="active");
              const sizeGroups = {};
              myBatches.forEach(b => { const sz = Number(b.containerSize??b.container_size); if (sz>0) sizeGroups[sz] = (sizeGroups[sz]||0) + Number(b.remaining||0); });
              const sizes = Object.keys(sizeGroups).map(Number).sort((a,b)=>a-b);
              const hasContainers = sizes.length > 0;
              const sel = sizeView[i.id] || "all";
              return (
                <tr key={i.id} style={{ borderBottom:"1px solid #F0EDE6", background:idx%2===0?"#FFF":"#FAFAFA" }}>
                  <td style={{ padding:"10px 16px", fontSize:12, fontWeight:600 }}>{i.name}</td>
                  <td style={{ padding:"10px 16px", fontSize:12, color:"#7A7A7A" }}>{i.category}</td>
                  <td style={{ padding:"10px 16px", fontSize:12, fontFamily:"monospace", fontWeight:600, color: isOut?"#DC2626":isLow?"#B8860B":"#2E7D64" }}>
                    {hasContainers ? (
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                        <select value={sel} onChange={e=>setSizeView(p=>({...p,[i.id]:e.target.value}))}
                          style={{ padding:"4px 8px", border:"1px solid #E5E0D5", borderRadius:4, fontSize:11, fontFamily:"inherit" }}>
                          <option value="all">All sizes</option>
                          {sizes.map(sz => <option key={sz} value={sz}>{fmtQty(sz)} {i.unit}</option>)}
                        </select>
                        <span>{sel === "all" ? `${stock} ${i.unit}` : `${fmtQty(sizeGroups[Number(sel)])} ${i.unit}`}</span>
                        {isOut&&<span style={{fontSize:10,background:"#FEF2F2",color:"#DC2626",padding:"1px 6px",borderRadius:4,fontWeight:700}}>OUT</span>}
                      </div>
                    ) : (
                      <>
                        {stock} {isOut&&<span style={{fontSize:10,background:"#FEF2F2",color:"#DC2626",padding:"1px 6px",borderRadius:4,fontWeight:700,marginLeft:4}}>OUT</span>}
                        {isLow&&!isOut&&<span style={{fontSize:10,background:"#FFFBEB",color:"#B8860B",padding:"1px 6px",borderRadius:4,fontWeight:700,marginLeft:4}}>LOW</span>}
                      </>
                    )}
                  </td>
                  <td style={{ padding:"10px 16px", fontSize:12, color:"#7A7A7A" }}>
                    {hasContainers && sel !== "all"
                      ? <span style={{ fontWeight:700, color:"#1A1A1A" }}><span style={{ color:"#C5A059", fontWeight:800 }}>{fmtQty(sizeGroups[Number(sel)]/Number(sel))}</span> × {fmtQty(Number(sel))} {i.unit} bottles</span>
                      : i.unit}
                  </td>
                  <td style={{ padding:"10px 16px", fontSize:11, color:"#9CA3AF" }}>{reorder>0?`Reorder at ${fmtQty(reorder)}`:"-"}</td>
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
  // Auto batch ref = ingredient name + receive date & time (e.g. "Baking Powder - 18/6/2026 14:30")
  const genBatchNo = (ing) => {
    const d = new Date();
    const date = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
    const time = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
    const name = (ing?.name || "").trim();
    return name ? `${name} - ${date} ${time}` : `${date} ${time}`;
  };
  const [selected, setSelected] = useState(null);
  const [form, setForm]         = useState({ batchNo:"", qty:"", costPerUnit:"", expiry:"", location:"Main Store", containerMult:1, containerIdx:0 });
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
    setForm({ batchNo:genBatchNo(ing), qty:"", costPerUnit:(()=>{const v=parseFloat(ing.costPerUnit??ing.cost_per_unit);return Number.isFinite(v)?String(v):"";})(), expiry:"", location:"Main Store", containerMult:1, containerIdx:0 });
    setError(""); setSaved(false);
  };

  const submit = async () => {
    if (!selected)                       { setError("Select an ingredient from the list"); return; }
    if (!form.qty||Number(form.qty)<=0)  { setError("Enter a valid quantity"); return; }
    if (!form.expiry)                    { setError("Expiry date is required"); return; }
    setSaving(true); setError("");
    try {
      const pUnit = selected.purchase_unit || selected.purchaseUnit;
      const pQty  = parseFloat(selected.purchase_qty || selected.purchaseQty) || 0;
      const hasPU = pUnit && pQty > 0;
      const opts  = containerOptions(selected.unit);
      const cIdx  = Math.min(form.containerIdx ?? 0, opts.length - 1);
      const curOpt = opts[cIdx] || opts[0];
      const usingContainer = curOpt && !curOpt.direct;
      const cMult = curOpt?.mult || 1;
      // Container picker takes priority: N containers × size = base-unit total.
      // Otherwise fall back to the ingredient's purchase-unit conversion.
      const stockQty = usingContainer ? Number(form.qty) * cMult
                      : hasPU         ? Number(form.qty) * pQty
                      :                 Number(form.qty);
      // Cost per cooking unit = cost per purchase unit ÷ units per purchase
      const costPerCookingUnit = hasPU && !usingContainer && form.costPerUnit ? Number(form.costPerUnit) / pQty : Number(form.costPerUnit)||undefined;
      // Label the delivery by its container so the stock breakdown shows
      // "3 × 5 L" rather than a merged litres figure.
      const dn = new Date();
      const dtStamp = `${dn.getDate()}/${dn.getMonth()+1}/${dn.getFullYear()} ${String(dn.getHours()).padStart(2,"0")}:${String(dn.getMinutes()).padStart(2,"0")}`;
      const batchLabel = usingContainer
        ? `${selected.name} · ${fmtQty(form.qty)} × ${curOpt.label} · ${dtStamp}`
        : (form.batchNo || genBatchNo(selected));
      const batch = await inventoryApi.receiveBatch({
        ingredient_id: selected.id,
        batch_no:      batchLabel,
        qty:           stockQty,
        expiry:        form.expiry||undefined,
        location:      form.location,
        cost_per_unit: costPerCookingUnit,
        container_size: usingContainer ? cMult : undefined,
      });
      setBatches(p=>[...p,{ id:batch.id, ingredientId:batch.ingredient_id, ingredient_id:batch.ingredient_id, batchNo:batch.batch_no, batch_no:batch.batch_no, qty:batch.qty, remaining:batch.remaining, expiry:batch.expiry, location:batch.location, container_size:batch.container_size, containerSize:batch.container_size, status:"active" }]);
      setSaved(true); setSelected(null);
      setForm({ batchNo:"", qty:"", costPerUnit:"", expiry:"", location:"Main Store", containerMult:1, containerIdx:0 });
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
                    const opts  = containerOptions(selected.unit);
                    const idx   = Math.min(form.containerIdx ?? 0, opts.length - 1);
                    const curOpt = opts[idx] || opts[0];
                    const cMult = curOpt?.mult || 1;
                    const usingContainer = curOpt && !curOpt.direct;
                    const pUnit = selected.purchase_unit || selected.purchaseUnit;
                    const pQty  = parseFloat(selected.purchase_qty || selected.purchaseQty) || 0;
                    const baseTotal = usingContainer ? (parseFloat(form.qty)||0) * cMult
                                     : (pUnit && pQty && form.qty ? (parseFloat(form.qty)||0) * pQty : null);
                    return (
                      <>
                        {opts.length > 1 && (
                          <div style={{ marginBottom:12 }}>
                            <label style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>Received in</label>
                            <select value={idx} onChange={e=>{ const i = parseInt(e.target.value)||0; setForm(f=>({...f, containerIdx:i, containerMult: opts[i]?.mult || 1 })); }} style={{ ...fi, marginTop:4 }}>
                              {opts.map((o,i) => <option key={i} value={i}>{o.label}</option>)}
                            </select>
                          </div>
                        )}
                        <label style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>
                          {usingContainer ? `Number of ${curOpt.label} containers *` : `Quantity Received (${pUnit && pQty ? pUnit : selected.unit}) *`}
                        </label>
                        <input type="number" min="0" step="0.001" value={form.qty}
                          onChange={e=>setForm(f=>({...f,qty:e.target.value}))}
                          placeholder={usingContainer ? `e.g. 5 × ${curOpt.label}` : (pUnit && pQty ? `e.g. 5 ${pUnit}s` : `e.g. 5 ${selected.unit}`)}
                          style={{ ...fi, marginTop:4, fontSize:16, fontWeight:600 }} autoFocus />
                        {baseTotal!==null && baseTotal>0 && (
                          <div style={{ fontSize:11, color:"#2E7D64", marginTop:4, fontWeight:600 }}>
                            = {fmtQty(baseTotal)} {selected.unit} will be added to stock
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
                      {(() => {
                        const opts  = containerOptions(selected.unit);
                        const cIdx  = Math.min(form.containerIdx ?? 0, opts.length - 1);
                        const curOpt = opts[cIdx] || opts[0];
                        const usingContainer = curOpt && !curOpt.direct;
                        const cMult = curOpt?.mult || 1;
                        const pu = selected.purchase_unit||selected.purchaseUnit;
                        const pq = parseFloat(selected.purchase_qty||selected.purchaseQty)||0;
                        const baseTotal = usingContainer ? (parseFloat(form.qty)||0)*cMult
                                         : (pu&&pq) ? (parseFloat(form.qty)||0)*pq
                                         : (parseFloat(form.qty)||0);
                        if (!form.qty || !form.costPerUnit) return "-";
                        return (
                          <>
                            KES {(baseTotal * Number(form.costPerUnit)).toFixed(0)}
                            {(usingContainer || (pu&&pq)) && <div style={{fontSize:10,color:"#7A7A7A",marginTop:2}}>{fmtQty(baseTotal)} {selected.unit} total</div>}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap:12 }}>
                  <div>
                    <label style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>Expiry Date <span style={{ color:"#DC2626" }}>*</span></label>
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
                  <label style={{ fontSize:9, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>Batch</label>
                  <input value={form.batchNo} readOnly disabled placeholder="auto" style={{ ...fi, marginTop:4, fontFamily:"monospace", color:"#4A4A4A", background:"#F5F2EB", cursor:"not-allowed" }} />
                </div>
                <button onClick={submit} disabled={saving}
                  style={{ padding:"12px", borderRadius:6, border:"none", background:saving?"#9CA3AF":"linear-gradient(135deg,#1A1A1A,#C5A059)", color:"#FFF", fontWeight:600, fontSize:13, cursor:saving?"default":"pointer" }}>
                  {saving ? "Recording..." : (() => {
                    const opts  = containerOptions(selected.unit);
                    const idx   = Math.min(form.containerIdx ?? 0, opts.length - 1);
                    const curOpt = opts[idx] || opts[0];
                    const cMult = curOpt?.mult || 1;
                    const usingContainer = curOpt && !curOpt.direct;
                    const pu = selected.purchase_unit||selected.purchaseUnit;
                    const pq = parseFloat(selected.purchase_qty||selected.purchaseQty)||0;
                    if (usingContainer) {
                      const total = (parseFloat(form.qty)||0) * cMult;
                      return `Record: ${form.qty||"?"} × ${curOpt.label} of ${selected.name} (= ${fmtQty(total)} ${selected.unit})`;
                    }
                    return pu&&pq
                      ? `Record: ${form.qty||"?"} ${pu} of ${selected.name} (= ${fmtQty((parseFloat(form.qty)||0)*pq)} ${selected.unit})`
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
  const [cont,     setCont]     = useState({});   // { ingredientId: containerIdx }
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [errors,   setErrors]   = useState({});
  const [issueLog, setIssueLog] = useState([]);
  const [notes,    setNotes]    = useState("");
  const [dest,     setDest]     = useState("Kitchen");

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

  // Resolve the container choice for a row → base-unit multiplier
  const contInfo = (ing) => {
    const opts = containerOptions(ing.unit);
    const i    = Math.min(cont[ing.id] ?? 0, opts.length - 1);
    const o    = opts[i] || opts[0];
    return { opts, idx:i, curOpt:o, mult:o?.mult || 1, usingContainer: o && !o.direct };
  };

  const submitAll = async () => {
    const toIssue = filtered.filter(i=>Number(qtys[i.id])>0);
    if (!toIssue.length) return;

    // Validate (convert container count → base units before comparing to stock)
    const errs = {};
    toIssue.forEach(ing=>{
      const { mult, usingContainer } = contInfo(ing);
      const qty = Number(qtys[ing.id]) * mult;
      const avail = usingContainer
        ? batches.filter(b => (b.ingredientId??b.ingredient_id)===ing.id && b.status==="active" && Number(b.containerSize??b.container_size)===mult).reduce((s,b)=>s+Number(b.remaining||0),0)
        : totalAvail(ing.id);
      if (qty > avail) errs[ing.id] = usingContainer ? `Only ${fmtQty(avail/mult)} in store` : `Max ${fmtStock(avail)} ${ing.unit}`;
    });
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true); setErrors({});
    const nb = [...batches];
    let anyFailed = false;

    for (const ing of toIssue) {
      const { mult, usingContainer } = contInfo(ing);
      const qty = Number(qtys[ing.id]) * mult;
      let eligible = availBatches(ing.id);
      if (usingContainer) eligible = eligible.filter(b => Number(b.containerSize ?? b.container_size) === mult);
      if (!eligible.length) continue;
      try {
        await inventoryApi.recordIssue({
          ingredient_id: ing.id,
          batch_id:      eligible[0].id,
          qty,
          from_location: "Main Store",
          to_location:   dest,
          container_size: usingContainer ? mult : undefined,
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
            <SectionHeader title={`Issue Stock to ${dest}`} sub="Enter quantities issued — stock deducted automatically (FEFO)" />
            {saved && <div style={{ marginTop:8, padding:"6px 14px", background:"#F0FDF4", border:"1px solid #86EFAC", borderRadius:4, fontSize:11, color:"#15803D", fontWeight:600, display:"inline-block" }}>Stock issued successfully!</div>}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:11, fontWeight:600, color:"#7A7A7A" }}>To:</span>
              <select value={dest} onChange={e=>setDest(e.target.value)}
                style={{ ...fi, padding:"8px 12px", fontSize:12, width:"auto", cursor:"pointer" }}>
                {["Kitchen","Dining","Washrooms","Housekeeping","Bar","General"].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notes (optional)..."
              style={{ ...fi, padding:"8px 12px", fontSize:12, width:200 }} />
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
                const nextBatch = availBatches(ing.id)[0];
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
                    <td style={{ padding:"10px 12px", fontWeight:600, color:"#1A1A1A" }}>
                      {ing.name}
                      {nextBatch && (() => {
                        const dleft = Math.round((new Date(nextBatch.expiry) - new Date()) / 86400000);
                        const dColor = isNaN(dleft) ? "#9CA3AF" : dleft < 0 ? "#8B3A3A" : dleft <= 3 ? "#B8860B" : "#2E7D64";
                        return (
                          <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3, fontSize:10, fontWeight:500 }}>
                            <span style={{ background:"#2E7D64", color:"#fff", fontWeight:700, fontSize:8, padding:"1px 5px", borderRadius:8, flexShrink:0 }}>TAKE</span>
                            <span style={{ color:"#7A7A7A" }}>{nextBatch.batchNo || nextBatch.batch_no || "batch"}</span>
                            {nextBatch.expiry && <span style={{ color:dColor, fontWeight:600 }}>· exp {new Date(nextBatch.expiry).toLocaleDateString()}{!isNaN(dleft) && (dleft<0?" (expired)":dleft<=3?` (${dleft}d)`:"")}</span>}
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ padding:"10px 12px", color:"#7A7A7A", fontSize:11 }}>{ing.unit}</td>
                    <td style={{ padding:"10px 12px" }}>
                      {(() => {
                        const { mult, usingContainer, curOpt } = contInfo(ing);
                        if (usingContainer) {
                          const sizeAvail = batches.filter(b => (b.ingredientId??b.ingredient_id)===ing.id && b.status==="active" && Number(b.containerSize??b.container_size)===mult).reduce((s,b)=>s+Number(b.remaining||0),0);
                          const count = sizeAvail / mult;
                          return (
                            <span style={{ color: count<=0?"#DC2626":count<=2?"#B8860B":"#2E7D64" }}>
                              <span style={{ fontWeight:800, fontSize:15 }}>{fmtQty(count)}</span>
                              <span style={{ fontSize:11, fontWeight:600 }}> × {curOpt.label}</span>
                              {count<=0 && <span style={{ display:"block", fontSize:10, color:"#9CA3AF" }}>none of this size</span>}
                            </span>
                          );
                        }
                        if (noStock) return <span style={{ fontWeight:600, color:"#DC2626" }}>OUT</span>;
                        return <span style={{ fontWeight:600, color: isLow?"#B8860B":"#2E7D64" }}>{Math.round(avail)}</span>;
                      })()}
                    </td>
                    <td style={{ padding:"6px 12px", width:200 }}>
                      {(() => {
                        const { opts, idx:cIdx, curOpt, mult, usingContainer } = contInfo(ing);
                        const baseQty = (parseFloat(qty)||0) * mult;
                        return (
                          <>
                            {opts.length > 1 && (
                              <select value={cIdx} disabled={noStock}
                                onChange={e=>setCont(p=>({...p,[ing.id]: parseInt(e.target.value)||0}))}
                                style={{ ...fi, padding:"5px 8px", fontSize:11, width:"100%", boxSizing:"border-box", marginBottom:5 }}>
                                {opts.map((o,i) => <option key={i} value={i}>{o.label}</option>)}
                              </select>
                            )}
                            <input
                              type="number" min="0" step="0.001"
                              value={qty}
                              disabled={noStock}
                              onChange={e=>{
                                setQtys(p=>({...p,[ing.id]:e.target.value}));
                                setErrors(p=>({...p,[ing.id]:undefined}));
                              }}
                              placeholder={usingContainer ? `# of ${curOpt.label}` : "0"}
                              style={{
                                ...fi, padding:"7px 10px", fontSize:14, fontWeight:hasQty?700:400,
                                width:"100%", boxSizing:"border-box",
                                border:`1px solid ${err?"#FECACA":hasQty?"#C5A059":"#E5E0D5"}`,
                                background:noStock?"#F5F5F5":"#FFFFFF",
                                color:hasQty?"#C5A059":"#1A1A1A",
                              }}
                            />
                            {usingContainer && hasQty && (
                              <div style={{ fontSize:10, color:"#2E7D64", marginTop:3, fontWeight:600 }}>= {fmtQty(baseQty)} {ing.unit}</div>
                            )}
                            {err && <div style={{ fontSize:10, color:"#DC2626", marginTop:2 }}>{err}</div>}
                          </>
                        );
                      })()}
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
