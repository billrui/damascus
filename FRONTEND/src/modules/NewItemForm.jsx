import { useState, useEffect, useRef } from "react";
import { itemsApi, inventoryApi, settingsApi } from "../api";

const CATEGORIES = ["Beverages","Food","Breakfast","Starters","Mains","Desserts","Specials","Snacks","By-Order"];

const newRow = (inv) => ({
  _id: (crypto.randomUUID?.() || String(Math.random())),
  ingredientId: inv?.id || "",
  name: inv?.name || "",
  unit: inv?.unit || "",
  qty: "",
});

const fi = {
  border:"1px solid #E5E0D5", borderRadius:6, padding:"9px 12px",
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

// Search bar to add an ingredient to the recipe (one place to add, not per-row).
function AddIngredientSearch({ inventory, chosenIds, onAdd }) {
  const [query, setQuery] = useState("");
  const [open, setOpen]   = useState(false);
  const ref               = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const matches = inventory
    .filter(i => !chosenIds.includes(i.id))
    .filter(i => i.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  const choose = (inv) => { onAdd(inv); setQuery(""); setOpen(false); };

  return (
    <div ref={ref} style={{ position:"relative", marginBottom:12 }}>
      <div style={{ position:"relative" }}>
        <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#C5A059", fontSize:14 }}>⌕</span>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search an ingredient to add..."
          style={{ ...fi, paddingLeft:34, borderColor:"#E5E0D5", background:"#FEFCF8" }}
        />
      </div>
      {open && matches.length > 0 && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, marginTop:4, background:"#FFF", border:"1px solid #E5E0D5", borderRadius:8, zIndex:999, boxShadow:"0 8px 24px rgba(0,0,0,0.10)", maxHeight:240, overflowY:"auto", padding:4 }}>
          {matches.map(inv => (
            <div key={inv.id} onMouseDown={() => choose(inv)}
              style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", cursor:"pointer", borderRadius:6 }}
              onMouseEnter={e => e.currentTarget.style.background="#FEF9F0"}
              onMouseLeave={e => e.currentTarget.style.background="transparent"}>
              <div style={{ width:30, height:30, borderRadius:"50%", background:"#F0FDF4", border:"1px solid #86EFAC", color:"#16A34A", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, flexShrink:0 }}>
                {(inv.name||"?").charAt(0).toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12.5, fontWeight:600, color:"#1A1A1A", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{inv.name}</div>
                <div style={{ fontSize:10, color:"#9CA3AF" }}>in stock: {Math.round(inv.qty ?? 0)} {inv.unit} · KES {Math.round(inv.costPerUnit)}/{inv.unit}</div>
              </div>
              <span style={{ fontSize:11, color:"#C5A059", fontWeight:700 }}>+ Add</span>
            </div>
          ))}
        </div>
      )}
      {open && query.length > 0 && matches.length === 0 && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, marginTop:4, background:"#FFFBEB", border:"1px solid #FEF3C7", borderRadius:8, zIndex:999, padding:"10px 12px", fontSize:11, color:"#B8860B" }}>
          No match. Add it under Ingredients first.
        </div>
      )}
    </div>
  );
}

// One linked ingredient, shown as a tidy card.
function IngredientCard({ row, index, invItem, onChange, onRemove }) {
  const cost = (parseFloat(row.qty) || 0) * (invItem?.costPerUnit || 0);
  const stock = Math.round(invItem?.qty ?? 0);
  const over  = (parseFloat(row.qty) || 0) > stock && stock >= 0 && row.qty !== "";
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:12,
      background:"#FFF", border:"1px solid #EFE9DD", borderRadius:10,
      padding:"10px 12px", marginBottom:8,
    }}>
      {/* Avatar */}
      <div style={{ width:38, height:38, borderRadius:"50%", background:"#F0FDF4", border:"1px solid #86EFAC", color:"#16A34A", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:700, flexShrink:0 }}>
        {(row.name||"?").charAt(0).toUpperCase()}
      </div>

      {/* Name + stock */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:"#1A1A1A", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{row.name}</div>
        <div style={{ fontSize:10.5, color:"#9CA3AF" }}>
          in stock: {stock} {row.unit} · KES {Math.round(invItem?.costPerUnit || 0)}/{row.unit}
        </div>
      </div>

      {/* Qty with unit suffix */}
      <div style={{ position:"relative", width:118, flexShrink:0 }}>
        <input
          type="number" min="0" step="0.001" value={row.qty}
          onChange={e => onChange(index, { qty: e.target.value })}
          placeholder="0"
          style={{ ...fi, padding:"7px 38px 7px 10px", fontSize:13, textAlign:"right",
            borderColor: over ? "#FCA5A5" : "#E5E0D5" }}
        />
        <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", fontSize:11, color:"#9CA3AF", fontWeight:600, pointerEvents:"none" }}>{row.unit || "qty"}</span>
      </div>

      {/* Line cost */}
      <div style={{ width:72, textAlign:"right", flexShrink:0 }}>
        <div style={{ fontSize:12.5, fontWeight:600, color: cost > 0 ? "#2E7D64" : "#C7C2B6" }}>{cost > 0 ? "KES " + Math.round(cost) : "—"}</div>
        <div style={{ fontSize:9, color:"#B0A99A", textTransform:"uppercase", letterSpacing:0.4 }}>per batch</div>
      </div>

      {/* Remove */}
      <button onClick={() => onRemove(index)} title="Remove" aria-label="Remove ingredient"
        style={{ width:28, height:28, border:"none", borderRadius:6, background:"transparent", color:"#C7C2B6", cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}
        onMouseEnter={e => { e.currentTarget.style.background="#FEF2F2"; e.currentTarget.style.color="#DC2626"; }}
        onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#C7C2B6"; }}>×</button>
    </div>
  );
}

export default function NewItemForm({ onSave, onCancel, liveIngredients = [] }) {
  const [name,        setName]        = useState("");
  const [category,    setCategory]    = useState("");
  const [price,       setPrice]       = useState("");
  const [cost,        setCost]        = useState("");
  const [description, setDescription] = useState("");
  const [bestseller,  setBestseller]  = useState(false);
  const [batchSize,   setBatchSize]   = useState(1);
  const [recipe,      setRecipe]      = useState([]);
  const [inventory,   setInventory]   = useState(liveIngredients);
  const [dailyOH,     setDailyOH]     = useState(0);
  const [saving,      setSaving]      = useState(false);
  const [errors,      setErrors]      = useState({});
  const [saved,       setSaved]       = useState(false);
  const [apiError,    setApiError]    = useState("");
  const [image,       setImage]       = useState(null);   // base64 thumbnail
  const fileRef = useRef(null);

  // Read a chosen photo, shrink it to a small square thumbnail (keeps the DB light)
  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setApiError("");
    if (file.type === "image/heic" || file.type === "image/heif" || /\.hei[cf]$/i.test(file.name)) {
      setApiError("That photo is in HEIC format (common on iPhones). Please choose a JPG or PNG, or set your phone camera to 'Most Compatible'.");
      return;
    }
    if (!file.type.startsWith("image/")) { setApiError("Please choose an image file (JPG or PNG)."); return; }
    const reader = new FileReader();
    reader.onerror = () => setApiError("Couldn't read that file — try another photo.");
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => setApiError("That image couldn't be loaded. Try a JPG or PNG photo.");
      img.onload = () => {
        try {
          if (!img.width || !img.height) { setApiError("That image appears empty. Try another photo."); return; }
          const size = 220;
          const canvas = document.createElement("canvas");
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext("2d");
          const scale = Math.max(size / img.width, size / img.height);
          const w = img.width * scale, h = img.height * scale;
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
          const data = canvas.toDataURL("image/jpeg", 0.72);
          if (!data || data.length < 200 || !data.startsWith("data:image")) {
            setApiError("Couldn't process that photo. Try a different JPG or PNG.");
            return;
          }
          setImage(data);
        } catch (err) {
          setApiError("Couldn't process that photo (unsupported format). Try a JPG or PNG.");
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

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

  // Recipe links REAL ingredients only. Utilities (water, gas, charcoal) are
  // deducted once at day-end, not per plate, so they're kept out of here.
  const recipeStock = inventory.filter(i => i.category !== "Utilities");
  const chosenIds   = recipe.map(r => r.ingredientId);

  const addIngredient    = (inv) => setRecipe(p => [...p, newRow(inv)]);
  const removeIngredient = (i)   => setRecipe(p => p.filter((_, idx) => idx !== i));
  const updateIngredient = (i, val) => setRecipe(p => p.map((r, idx) => idx === i ? { ...r, ...val } : r));

  const cp             = parseFloat(cost) || 0;
  const sp             = parseFloat(price) || 0;
  const profit         = sp > 0 ? sp - cp : null;
  const gp             = sp > 0 ? +((sp - cp) / sp * 100).toFixed(1) : null;
  const gpColor        = gp === null ? "#9CA3AF" : gp >= 60 ? "#16A34A" : gp >= 40 ? "#B8860B" : "#DC2626";

  const validate = () => {
    const e = {};
    if (!name.trim())                     e.name     = "Required";
    if (!category)                        e.category = "Required";
    if (!price || parseFloat(price) <= 0) e.price    = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true); setApiError("");
    try {
      const id = "MI-" + name.replace(/\s+/g,"").toUpperCase().slice(0,6) + "-" + Date.now().toString().slice(-4);

      const item = await itemsApi.create({
        id,
        name:        name.trim(),
        category:    category.toLowerCase().replace(/\s+/g,"-"),
        price:       parseFloat(price),
        cost:        cp || undefined,
        description: description || undefined,
        bestseller,
        image:       image || undefined,
      });

      setSaved(true);
      setTimeout(() => { setSaved(false); onSave?.(item); }, 1600);
    } catch(e) {
      setApiError(e?.response?.data?.error || "Couldn't save — check the backend is running and try again.");
    } finally { setSaving(false); }
  };

  const linkedCount = recipe.filter(r => r.ingredientId && parseFloat(r.qty) > 0).length;

  return (
    <div style={{ flex:1, overflowY:"auto", background:"#F5F2EB", padding:"20px", fontFamily:"'Inter',sans-serif" }}>

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#1A1A1A,#C5A059)", borderRadius:"10px 10px 0 0", padding:"16px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:600, color:"#FFF" }}>{name || "New Menu Item"}</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.6)", marginTop:2 }}>Name, price and category — stock is handled separately</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ background:"#FFF", border:"1px solid #E5E0D5", borderTop:"none", borderRadius:"0 0 10px 10px", padding:"22px" }}>

        {apiError && (
          <div style={{ padding:"8px 12px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:6, fontSize:11, color:"#8B3A3A", marginBottom:16 }}>{apiError}</div>
        )}

        {/* ── Basic Details ── */}
        <div style={{ fontSize:11, fontWeight:600, color:"#C5A059", marginBottom:10, letterSpacing:0.3, textTransform:"uppercase" }}>Basic Details</div>

        {/* Product photo */}
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:18 }}>
          <div style={{ width:88, height:88, borderRadius:10, border:"1px solid #E5E0D5", background:"#FAF8F3", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            {image
              ? <img src={image} alt="preview" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              : <span style={{ fontSize:10, color:"#B8B0A0", textAlign:"center", padding:6 }}>No photo</span>}
          </div>
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:"#4A4A4A", marginBottom:2 }}>Product Photo</div>
            <div style={{ fontSize:10.5, color:"#9CA3AF", marginBottom:8 }}>Shown on the POS so staff spot it fast (e.g. a soda bottle, fish, ugali). Auto-shrunk to a small thumbnail.</div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} style={{ display:"none" }} />
            <div style={{ display:"flex", gap:8 }}>
              <button type="button" onClick={() => fileRef.current?.click()} style={{ padding:"6px 14px", borderRadius:6, border:"1px solid #C5A059", background:"#fff", color:"#8A6D1B", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                {image ? "Change photo" : "Upload photo"}
              </button>
              {image && (
                <button type="button" onClick={() => { setImage(null); if (fileRef.current) fileRef.current.value = ""; }} style={{ padding:"6px 12px", borderRadius:6, border:"1px solid #E5E0D5", background:"#fff", color:"#8B3A3A", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:14, marginBottom:18 }}>
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
          <div style={{ gridColumn:"1/-1" }}>
            <Field label="Description" hint="Optional — shown on the POS">
              <input value={description} onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Spiced with ginger, served hot" style={fi} />
            </Field>
          </div>
        </div>

        <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginBottom:22 }}>
          <input type="checkbox" checked={bestseller} onChange={e => setBestseller(e.target.checked)} style={{ accentColor:"#C5A059", width:14, height:14 }} />
          <span style={{ fontSize:12, color:"#4A4A4A", fontWeight:500 }}>Mark as Bestseller</span>
        </label>

        {/* Buttons */}
        <div style={{ display:"flex", gap:10, marginTop:22 }}>
          {onCancel && (
            <button onClick={onCancel} style={{ padding:"11px 20px", borderRadius:8, border:"1px solid #E5E0D5", background:"#FFF", color:"#7A7A7A", fontWeight:600, fontSize:13, cursor:"pointer" }}>Cancel</button>
          )}
          <button onClick={handleSave} disabled={saving || saved}
            style={{ flex:1, padding:"12px", borderRadius:8, border:"none",
              background: saved ? "#16A34A" : saving ? "#9CA3AF" : "linear-gradient(135deg,#1A1A1A,#C5A059)",
              color:"#FFF", fontWeight:600, fontSize:13, cursor: saving ? "default" : "pointer", transition:"all 0.3s" }}>
            {saved ? "✓ Saved" : saving ? "Saving..." : "Save menu item"}
          </button>
        </div>
      </div>
    </div>
  );
}
