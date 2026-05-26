import { useState, useEffect, useRef } from "react";
import { itemsApi, inventoryApi, settingsApi } from "../api";

const CATEGORIES = ["Beverages","Food","Breakfast","Starters","Mains","Desserts","Specials","Snacks","By-Order"];

const fi = {
  border:"1px solid #E5E0D5", borderRadius:4, padding:"8px 12px",
  fontSize:13, outline:"none", background:"#FFFFFF",
  width:"100%", boxSizing:"border-box", fontFamily:"'Inter',sans-serif",
  color:"#1A1A1A",
};

function Field({ label, required, hint, error, children }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
      <label style={{ fontSize:10, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>
        {label}{required && <span style={{ color:"#8B3A3A", marginLeft:2 }}>*</span>}
      </label>
      {children}
      {hint  && !error && <div style={{ fontSize:10, color:"#9CA3AF" }}>{hint}</div>}
      {error && <div style={{ fontSize:10, color:"#8B3A3A" }}>{error}</div>}
    </div>
  );
}

function IngredientRow({ row, index, inventory, onChange, onRemove }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState(row.name || "");
  const ref               = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const matches = inventory
    .filter(i => i.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  const pick = (inv) => {
    onChange(index, { ...row, ingredientId: inv.id, name: inv.name, unit: inv.unit });
    setQuery(inv.name);
    setOpen(false);
  };

  const linked    = !!row.ingredientId;
  const invItem   = inventory.find(i => i.id === row.ingredientId);
  const lineTotal = (parseFloat(row.qty) || 0) * (invItem?.costPerUnit || 0);
  const isUtil    = invItem?.category === "Utilities";

  return (
    <div style={{
      display:"grid", gridTemplateColumns:"1fr 90px 90px 80px 28px",
      gap:6, alignItems:"center",
      background: isUtil ? "#FFFBEB" : linked ? "#F0FDF4" : "#F8F8F8",
      border: `1px solid ${isUtil ? "#FDE68A" : linked ? "#86EFAC" : "#E5E0D5"}`,
      borderRadius:6, padding:"8px 10px", marginBottom:6,
    }}>
      {/* Ingredient search */}
      <div ref={ref} style={{ position:"relative" }}>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); onChange(index, { ...row, ingredientId:"", name: e.target.value }); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search ingredient or utility..."
          style={{ ...fi, padding:"6px 10px", fontSize:12,
            borderColor: isUtil ? "#FDE68A" : linked ? "#86EFAC" : "#E5E0D5",
            paddingRight: linked ? 24 : 10 }}
        />
        {linked && <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", color: isUtil ? "#B8860B" : "#16A34A", fontSize:11, fontWeight:700 }}>{isUtil ? "⚡" : "✓"}</span>}
        {open && matches.length > 0 && (
          <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#FFF", border:"1px solid #C5A059", borderRadius:4, zIndex:999, boxShadow:"0 4px 12px rgba(0,0,0,0.12)", maxHeight:200, overflowY:"auto" }}>
            {matches.map(inv => (
              <div key={inv.id} onMouseDown={() => pick(inv)}
                style={{ padding:"8px 12px", cursor:"pointer", borderBottom:"1px solid #F5F5F5",
                  background: inv.category === "Utilities" ? "#FFFBEB" : "#FFF" }}
                onMouseEnter={e => e.currentTarget.style.opacity="0.8"}
                onMouseLeave={e => e.currentTarget.style.opacity="1"}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ fontSize:12, fontWeight:600, color:"#1A1A1A" }}>{inv.name}</div>
                  {inv.category === "Utilities" && <span style={{ fontSize:9, background:"#FDE68A", color:"#92400E", padding:"1px 6px", borderRadius:3, fontWeight:600 }}>UTILITY</span>}
                </div>
                <div style={{ fontSize:10, color:"#7A7A7A" }}>{inv.unit} · KES {inv.costPerUnit}/unit · stock: {inv.qty ?? "?"}</div>
              </div>
            ))}
          </div>
        )}
        {open && query.length > 0 && matches.length === 0 && (
          <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#FFFBEB", border:"1px solid #FEF3C7", borderRadius:4, zIndex:999, padding:"8px 12px", fontSize:11, color:"#B8860B" }}>
            Not found — add to Inventory first (use category "Utilities" for water, gas, charcoal)
          </div>
        )}
      </div>

      {/* Qty */}
      <input
        type="number" min="0" step="0.001"
        value={row.qty}
        onChange={e => onChange(index, { ...row, qty: e.target.value })}
        placeholder={"qty (" + (row.unit || "unit") + ")"}
        style={{ ...fi, padding:"6px 10px", fontSize:12, textAlign:"right" }}
      />

      {/* Overhead cost per serving */}
      <input
        type="number" min="0" step="0.01"
        value={row.overheadCost || ""}
        onChange={e => onChange(index, { ...row, overheadCost: e.target.value })}
        placeholder="overhead KES"
        title="Extra fixed cost per serving (water, gas, firewood)"
        style={{ ...fi, padding:"6px 10px", fontSize:12, textAlign:"right",
          background: row.overheadCost ? "#FFFBEB" : "#FFF",
          borderColor: row.overheadCost ? "#FDE68A" : "#E5E0D5" }}
      />

      {/* Line cost */}
      <div style={{ fontSize:11, color: lineTotal > 0 ? "#2E7D64" : "#9CA3AF", textAlign:"right", fontWeight:500 }}>
        {lineTotal > 0 ? "KES " + lineTotal.toFixed(2) : "—"}
      </div>

      <button onClick={() => onRemove(index)}
        style={{ width:28, height:28, border:"none", borderRadius:4, background:"#FEF2F2", color:"#8B3A3A", cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
    </div>
  );
}

export default function NewItemForm({ onSave, onCancel, liveIngredients = [] }) {
  const [name,        setName]        = useState("");
  const [category,    setCategory]    = useState("");
  const [price,       setPrice]       = useState("");
  const [description, setDescription] = useState("");
  const [bestseller,  setBestseller]  = useState(false);
  const [batchSize,   setBatchSize]   = useState(1);
  const [recipe,      setRecipe]      = useState([{ ingredientId:"", name:"", qty:"", unit:"", overheadCost:"" }]);
  const [inventory,   setInventory]   = useState(liveIngredients);
  const [dailyOH,     setDailyOH]     = useState(0);
  const [saving,      setSaving]      = useState(false);
  const [errors,      setErrors]      = useState({});
  const [saved,       setSaved]       = useState(false);
  const [apiError,    setApiError]    = useState("");

  useEffect(() => {
    settingsApi.get()
      .then(s => {
        const total = ['daily_overhead_rent','daily_overhead_wages','daily_overhead_electricity','daily_overhead_other']
          .reduce((sum, k) => sum + (parseFloat(s[k]) || 0), 0);
        setDailyOH(total);
      })
      .catch(() => {});

    inventoryApi.ingredients()
      .then(data => setInventory((data || []).map(i => ({
        id: i.id, name: i.name, unit: i.unit,
        category: i.category || "",
        costPerUnit: parseFloat(i.cost_per_unit || 0),
        qty: parseFloat(i.total_remaining ?? 0),
      }))))
      .catch(() => setInventory(liveIngredients));
  }, []);

  const addIngredient    = () => setRecipe(p => [...p, { ingredientId:"", name:"", qty:"", unit:"", overheadCost:"" }]);
  const removeIngredient = (i) => setRecipe(p => p.filter((_, idx) => idx !== i));
  const updateIngredient = (i, val) => setRecipe(p => p.map((r, idx) => idx === i ? { ...r, ...val } : r));

  // Cost calculations
  const ingredientCost = recipe.reduce((sum, r) => {
    const inv = inventory.find(i => i.id === r.ingredientId);
    return sum + (parseFloat(r.qty) || 0) * (inv?.costPerUnit || 0);
  }, 0);
  const overheadTotal   = recipe.reduce((sum, r) => sum + (parseFloat(r.overheadCost) || 0), 0);
  const batchQty        = Math.max(1, parseInt(batchSize) || 1);
  const costPerServing  = (ingredientCost + overheadTotal) / batchQty;
  const sp              = parseFloat(price) || 0;
  const gp              = sp > 0 ? ((sp - costPerServing) / sp * 100).toFixed(1) : null;
  const gpColor         = gp === null ? "#9CA3AF" : gp >= 60 ? "#16A34A" : gp >= 40 ? "#B8860B" : "#DC2626";

  const validate = () => {
    const e = {};
    if (!name.trim())                         e.name     = "Required";
    if (!category)                            e.category = "Required";
    if (!price || parseFloat(price) <= 0)     e.price    = "Required";
    if (!recipe.some(r => r.ingredientId && parseFloat(r.qty) > 0))
      e.recipe = "Link at least one ingredient so stock can auto-deduct";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true); setApiError("");
    try {
      const id = "MI-" + name.replace(/\s+/g,"").toUpperCase().slice(0,6) + "-" + Date.now().toString().slice(-4);
      const linkedRecipe = recipe
        .filter(r => r.ingredientId && parseFloat(r.qty) > 0)
        .map(r => ({ ingredient_id: r.ingredientId, qty: parseFloat(r.qty), overhead_cost: parseFloat(r.overheadCost) || 0 }));

      const item = await itemsApi.create({
        id,
        name:        name.trim(),
        batch_size:  batchQty,
        category:    category.toLowerCase().replace(/\s+/g,"-"),
        price:       parseFloat(price),
        cost:        parseFloat(costPerServing.toFixed(4)) || undefined,
        description: description || undefined,
        bestseller,
        recipe:      linkedRecipe,
      });

      setSaved(true);
      setTimeout(() => { setSaved(false); onSave?.(item); }, 1800);
    } catch(e) {
      setApiError(e?.response?.data?.error || "Save failed — is the backend running?");
    } finally { setSaving(false); }
  };

  // Separate utilities from regular ingredients for display
  const utilities  = inventory.filter(i => i.category === "Utilities");
  const hasUtils   = utilities.length > 0;

  return (
    <div style={{ flex:1, overflowY:"auto", background:"#F5F2EB", padding:"20px", fontFamily:"'Inter',sans-serif" }}>

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#1A1A1A,#C5A059)", borderRadius:"8px 8px 0 0", padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:15, fontWeight:600, color:"#FFF" }}>{name || "New Menu Item"}</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.6)", marginTop:2 }}>Ingredients + utilities auto-deduct from stock on every sale</div>
        </div>
        {gp !== null && (
          <div style={{ background:"rgba(255,255,255,0.12)", borderRadius:6, padding:"6px 14px", textAlign:"center" }}>
            <div style={{ fontSize:18, fontWeight:700, color: gp >= 40 ? "#86EFAC" : "#FCA5A5" }}>{gp}%</div>
            <div style={{ fontSize:9, color:"rgba(255,255,255,0.6)" }}>Gross Profit</div>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ background:"#FFF", border:"1px solid #E5E0D5", borderTop:"none", borderRadius:"0 0 8px 8px", padding:"20px" }}>

        {apiError && (
          <div style={{ padding:"8px 12px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:4, fontSize:11, color:"#8B3A3A", marginBottom:16 }}>{apiError}</div>
        )}

        {/* ── Basic Details ── */}
        <div style={{ fontSize:11, fontWeight:600, color:"#C5A059", marginBottom:10, letterSpacing:0.3, textTransform:"uppercase" }}>Basic Details</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
          <Field label="Item Name" required error={errors.name}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Masala Tea, Pilau Special"
              style={{ ...fi, borderColor: errors.name ? "#FCA5A5" : "#E5E0D5" }} />
          </Field>
          <Field label="Category" required error={errors.category}>
            <select value={category} onChange={e => setCategory(e.target.value)}
              style={{ ...fi, borderColor: errors.category ? "#FCA5A5" : "#E5E0D5" }}>
              <option value="">Select...</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Selling Price (KES)" required error={errors.price}>
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:11, color:"#7A7A7A", fontWeight:600 }}>KES</span>
              <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
                placeholder="e.g. 50"
                style={{ ...fi, paddingLeft:46, borderColor: errors.price ? "#FCA5A5" : "#E5E0D5" }} />
            </div>
          </Field>
          <Field label="Batch Size" hint="How many servings does one full recipe make? e.g. 90 cups from 10L tea">
            <input type="number" min="1" step="1" value={batchSize} onChange={e => setBatchSize(e.target.value)}
              placeholder="e.g. 90" style={fi} />
          </Field>
          <div style={{ gridColumn:"1/-1" }}>
            <Field label="Description" hint="Optional — shown on POS">
              <input value={description} onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Spiced with ginger, served hot" style={fi} />
            </Field>
          </div>
        </div>

        <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginBottom:20 }}>
          <input type="checkbox" checked={bestseller} onChange={e => setBestseller(e.target.checked)} style={{ accentColor:"#C5A059", width:14, height:14 }} />
          <span style={{ fontSize:12, color:"#4A4A4A", fontWeight:500 }}>Mark as Bestseller</span>
        </label>

        {/* ── Recipe & Ingredients ── */}
        <div style={{ fontSize:11, fontWeight:600, color:"#C5A059", marginBottom:6, letterSpacing:0.3, textTransform:"uppercase" }}>
          Recipe — Ingredients & Utilities
        </div>
        <div style={{ fontSize:11, color:"#7A7A7A", marginBottom:10 }}>
          Search ingredients below. For water, gas, charcoal — add them in Inventory under <strong>Utilities</strong> category, they'll show with a ⚡ badge. The <em>Overhead</em> column is for any extra fixed cost per serving you want to add manually.
        </div>

        {/* Utilities quick-reminder */}
        {!hasUtils && (
          <div style={{ padding:"8px 12px", background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:6, fontSize:11, color:"#92400E", marginBottom:10 }}>
            💡 No utilities found in inventory yet. Go to <strong>Inventory → + Add Ingredient</strong> and add Water, LPG Gas, Charcoal or Firewood with category set to <strong>"Utilities"</strong> — they'll appear here in the search.
          </div>
        )}

        {errors.recipe && (
          <div style={{ padding:"8px 12px", background:"#FFFBEB", border:"1px solid #FEF3C7", borderRadius:4, fontSize:11, color:"#B8860B", marginBottom:10 }}>{errors.recipe}</div>
        )}

        {/* Column headers */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 90px 90px 80px 28px", gap:6, padding:"0 10px", marginBottom:4 }}>
          {["Ingredient / Utility","Qty","Overhead (KES)","Line Cost",""].map((h,i) => (
            <div key={i} style={{ fontSize:9, fontWeight:600, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:0.5, textAlign: i >= 2 ? "right" : "left" }}>{h}</div>
          ))}
        </div>

        {recipe.map((row, i) => (
          <IngredientRow key={i} index={i} row={row} inventory={inventory} onChange={updateIngredient} onRemove={removeIngredient} />
        ))}

        <button onClick={addIngredient}
          style={{ width:"100%", padding:"8px", border:"1px dashed #C5A059", borderRadius:6, background:"#FEF9F0", color:"#C5A059", fontWeight:600, fontSize:12, cursor:"pointer", marginTop:4 }}>
          + Add Ingredient / Utility
        </button>

        {/* Cost summary */}
        {costPerServing > 0 && (
          <div style={{ marginTop:14, padding:"12px 14px", background:"#F8F8F8", borderRadius:6, border:"1px solid #E5E0D5" }}>
            <div style={{ fontSize:10, fontWeight:600, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5, marginBottom:10 }}>
              Cost Breakdown — per serving (batch of {batchQty})
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:8 }}>
              <div style={{ background:"#FFF", borderRadius:4, padding:"8px 10px", border:"1px solid #E5E0D5" }}>
                <div style={{ fontSize:9, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:0.5 }}>Ingredients</div>
                <div style={{ fontSize:14, fontWeight:600, color:"#1A1A1A", marginTop:2 }}>KES {(ingredientCost/batchQty).toFixed(2)}</div>
              </div>
              <div style={{ background:"#FFFBEB", borderRadius:4, padding:"8px 10px", border:"1px solid #FDE68A" }}>
                <div style={{ fontSize:9, color:"#92400E", textTransform:"uppercase", letterSpacing:0.5 }}>Overheads</div>
                <div style={{ fontSize:14, fontWeight:600, color:"#92400E", marginTop:2 }}>KES {overheadTotal.toFixed(2)}</div>
              </div>
              <div style={{ background:"#FEF2F2", borderRadius:4, padding:"8px 10px", border:"1px solid #FECACA" }}>
                <div style={{ fontSize:9, color:"#8B3A3A", textTransform:"uppercase", letterSpacing:0.5 }}>True cost</div>
                <div style={{ fontSize:14, fontWeight:600, color:"#8B3A3A", marginTop:2 }}>KES {costPerServing.toFixed(2)}</div>
              </div>
              <div style={{ background: gp >= 40 ? "#F0FDF4" : "#FEF2F2", borderRadius:4, padding:"8px 10px", border:`1px solid ${gp >= 40 ? "#86EFAC" : "#FECACA"}` }}>
                <div style={{ fontSize:9, color: gpColor, textTransform:"uppercase", letterSpacing:0.5 }}>GP %</div>
                <div style={{ fontSize:14, fontWeight:600, color: gpColor, marginTop:2 }}>{gp !== null ? gp + "%" : "—"}</div>
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#4A4A4A" }}>
              <span>Profit per serving: <strong style={{ color: gpColor }}>KES {sp > 0 ? (sp - costPerServing).toFixed(2) : "—"}</strong></span>
              {dailyOH > 0 && <span style={{ color:"#9CA3AF", fontSize:11 }}>+ KES {dailyOH}/day fixed overhead shared across all sales</span>}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display:"flex", gap:10, marginTop:20 }}>
          {onCancel && (
            <button onClick={onCancel} style={{ padding:"10px 20px", borderRadius:6, border:"1px solid #E5E0D5", background:"#FFF", color:"#7A7A7A", fontWeight:600, fontSize:13, cursor:"pointer" }}>Cancel</button>
          )}
          <button onClick={handleSave} disabled={saving || saved}
            style={{ flex:1, padding:"11px", borderRadius:6, border:"none",
              background: saved ? "#16A34A" : saving ? "#9CA3AF" : "linear-gradient(135deg,#1A1A1A,#C5A059)",
              color:"#FFF", fontWeight:600, fontSize:13, cursor: saving ? "default" : "pointer", transition:"all 0.3s" }}>
            {saved ? "✓ Saved — stock deduction active" : saving ? "Saving..." : "Save Menu Item"}
          </button>
        </div>
      </div>
    </div>
  );
}
