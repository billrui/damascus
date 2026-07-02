import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { inventoryApi, itemsApi } from "../api/index.js";
import { MENU_CATEGORIES } from "../data";
import { classifyExpiry } from "../utils";
import NewItemForm from "./NewItemForm";
import { IssueStockView } from "./StockModules";
import ProductionScreen   from "./ProductionScreen";
import OverheadSettings   from "./OverheadSettings";

// --- HELPERS ------------------------------------------------------------------
const CATEGORY_MAP = Object.fromEntries(
  (MENU_CATEGORIES || []).map((c) => [c.id, c.label])
);

function genItemCode(idx) {
  return String(idx + 1).padStart(4, "0");
}

// Merge menu items with stock data from batches/ingredients
function buildStockRows(items, batches, ingredients) {
  return items.map((item, idx) => {
    // Try to find a matching ingredient by name similarity
    const ing = ingredients.find((i) =>
      i.name.toLowerCase().includes(item.name.toLowerCase().split(" ")[0]) ||
      item.name.toLowerCase().includes(i.name.toLowerCase().split(" ")[0])
    );
    const itemBatches = ing
      ? batches.filter((b) => b.ingredientId === ing.id && b.status === "active")
      : [];
    const stock    = itemBatches.reduce((s, b) => s + b.remaining, 0);
    const reorder  = ing?.reorderLevel || Math.floor(Math.random() * 6 + 1);
    const expiry   = itemBatches.length
      ? itemBatches.sort((a, b) => new Date(a.expiry) - new Date(b.expiry))[0]?.expiry
      : null;
    const wPrice   = Math.round(item.price * 0.95);   // wholesale ~5% off
    const promPrice = item.onSale ? item.originalPrice : item.price;
    return {
      ...item,
      code:      genItemCode(idx),
      stock:     item.made_to_order ? 999 : (Number(item.qty_available) > 0 ? Number(item.qty_available) : (ing ? stock : 0)),
      reorder,
      cost:      item.cost,
      rPrice:    item.price,
      wPrice,
      promPrice,
      tax:       item.price > 500 ? "16% Inc." : "0%",
      expiry,
      ing,
    };
  });
}

// --- ACTION DROPDOWN (shared) -------------------------------------------------
function ActionDropdown({ children, items: dropItems }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, left: 0 });
  const btnRef  = useRef(null);
  const menuRef = useRef(null);
  const MENU_W  = 190;

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    let left = r.right - MENU_W;          // right-align to the button
    if (left < 8) left = 8;               // keep on-screen
    setPos({ top: r.bottom + 4, left });
  };

  const toggle = () => { if (!open) place(); setOpen(o => !o); };

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  return (
    <div style={{ display: "inline-block" }}>
      <button
        ref={btnRef}
        onClick={toggle}
        style={{
          padding: "5px 12px", borderRadius: 4, border: "none",
          background: open ? "#1A1A1A" : "#4A4A4A", color: "#FFFFFF",
          fontWeight: 600, fontSize: 11, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 5, transition: "background 0.15s"
        }}
      >
        Action <span style={{ fontSize: 9 }}>▾</span>
      </button>
      {open && createPortal(
        <div ref={menuRef} style={{
          position: "fixed", top: pos.top, left: pos.left, zIndex: 4000,
          background: "#FFFFFF", borderRadius: 6,
          boxShadow: "0 8px 28px rgba(0,0,0,0.18)", border: "1px solid #E5E0D5",
          minWidth: MENU_W, overflow: "hidden", padding: 4
        }}>
          {dropItems.map((di, i) =>
            di === "divider" ? (
              <div key={i} style={{ height: 1, background: "#F0EDE6", margin: "4px 0" }} />
            ) : (
              <ActionItem key={i} {...di} onClick={() => { setOpen(false); di.onClick(); }} />
            )
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

function ActionItem({ icon, label, color, onClick, danger }) {
  const [hov, setHov] = useState(false);
  return (
    <div 
      onClick={onClick} 
      onMouseEnter={() => setHov(true)} 
      onMouseLeave={() => setHov(false)}
      style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: 10, 
        padding: "9px 14px", 
        cursor: "pointer", 
        borderRadius: 5,
        background: hov ? (danger ? "#FEF2F2" : "#F8F8F8") : "#FFFFFF", 
        transition: "background 0.1s" 
      }}
    >
      <span style={{ fontSize: 11, width: 18, textAlign: "center", fontWeight: 600, color }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: hov ? color : "#4A4A4A" }}>{label}</span>
    </div>
  );
}

// --- TABLE CHROME (shared) ----------------------------------------------------
function TableToolbar({ search, setSearch, pageSize, setPageSize, onPageSizeChange, hidSearch }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, color: "#4A4A4A" }}>Show</span>
      <select 
        value={pageSize} 
        onChange={(e) => { setPageSize(Number(e.target.value)); onPageSizeChange?.(); }}
        style={{ 
          padding: "4px 8px", 
          border: "1px solid #E5E0D5", 
          borderRadius: 4, 
          fontSize: 12,
          background: "#FFFFFF",
          cursor: "pointer",
        }}
      >
        {[10, 25, 50, 100].map((n) => <option key={n}>{n}</option>)}
      </select>
      <span style={{ fontSize: 12, color: "#4A4A4A" }}>entries</span>
      <div style={{ flex: 1 }} />
      {["Copy", "Excel", "PDF", "Print", "CSV", "Columns"].map((btn) => (
        <button 
          key={btn} 
          style={{ 
            padding: "5px 12px", 
            background: "#C5A059", 
            color: "#FFFFFF", 
            border: "none", 
            borderRadius: 4, 
            fontWeight: 600, 
            fontSize: 11, 
            cursor: "pointer" 
          }}
        >
          {btn}
        </button>
      ))}

    </div>
  );
}

function Pagination({ page, setPage, totalPages, filtered, pageSize }) {
  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "space-between", 
      marginTop: 16, 
      fontSize: 12, 
      color: "#7A7A7A", 
      flexWrap: "wrap", 
      gap: 8 
    }}>
      <span>Showing {filtered === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, filtered)} of {filtered} entries</span>
      <div style={{ display: "flex", gap: 4 }}>
        <PagBtn label="Previous" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} />
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
          <PagBtn key={p} label={String(p)} onClick={() => setPage(p)} active={page === p} />
        ))}
        <PagBtn label="Next" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0} />
      </div>
    </div>
  );
}

function PagBtn({ label, onClick, disabled, active }) {
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      style={{ 
        padding: "5px 12px", 
        borderRadius: 4, 
        border: "1px solid #E5E0D5", 
        background: active ? "#C5A059" : disabled ? "#F8F8F8" : "#FFFFFF", 
        color: active ? "#FFFFFF" : disabled ? "#D1D5DB" : "#4A4A4A", 
        fontWeight: active ? 600 : 500, 
        fontSize: 11, 
        cursor: disabled ? "default" : "pointer" 
      }}
    >
      {label}
    </button>
  );
}

// --- ITEM PROFILE MODAL -------------------------------------------------------
function ItemProfileModal({ item, onClose }) {
  if (!item) return null;
  return (
    <div style={{ 
      position: "fixed", 
      inset: 0, 
      background: "rgba(0,0,0,0.5)", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      zIndex: 300 
    }}>
      <div style={{ 
        background: "#FFFFFF", 
        borderRadius: 8, 
        width: 480, 
        maxHeight: "80vh", 
        overflow: "hidden", 
        display: "flex", 
        flexDirection: "column", 
        boxShadow: "0 20px 40px rgba(0,0,0,0.15)" 
      }}>
        <div style={{ 
          background: "linear-gradient(135deg, #C5A059, #A0823A)", 
          padding: "16px 20px", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between" 
        }}>
          <div style={{ color: "#FFFFFF", fontWeight: 700, fontSize: 14, letterSpacing: 0.5 }}>
            Item Profile
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              background: "rgba(255,255,255,0.15)", 
              border: "none", 
              color: "#FFFFFF", 
              width: 28, 
              height: 28, 
              borderRadius: 4, 
              cursor: "pointer", 
              fontWeight: 700 
            }}
          >
            -
          </button>
        </div>
        <div style={{ padding: 24, overflowY: "auto" }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ 
              fontSize: 40, 
              marginBottom: 8,
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 500,
            }}>
              {item.emoji || "-"}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#1A1A1A" }}>{item.name}</div>
            <div style={{ fontSize: 11, color: "#7A7A7A", marginTop: 4 }}>
              {item.description || "No description available"}
            </div>
          </div>
          {[
            ["Category", CATEGORY_MAP[item.category] || item.category], 
            ["Selling Price", `KES ${item.price?.toLocaleString()}`], 
            ["Bestseller", item.bestseller ? "Yes" : "No"]
          ].map(([k, v]) => (
            <div key={k} style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              padding: "8px 0", 
              borderBottom: "1px solid #F0EDE6", 
              fontSize: 12 
            }}>
              <span style={{ color: "#7A7A7A", fontWeight: 500 }}>{k}</span>
              <span style={{ color: "#1A1A1A", fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ 
          padding: "12px 20px", 
          borderTop: "1px solid #F0EDE6", 
          display: "flex", 
          justifyContent: "flex-end" 
        }}>
          <button 
            onClick={onClose} 
            style={{ 
              padding: "8px 20px", 
              borderRadius: 4, 
              border: "1px solid #E5E0D5", 
              background: "#FFFFFF", 
              fontWeight: 600, 
              fontSize: 12, 
              cursor: "pointer" 
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// --- ADJUST STOCK MODAL -------------------------------------------------------
// --- STOCK SESSION ENTRY MODAL ------------------------------------------------
// Hotel scenario:
//   - Items like tea are loaded per service session (Morning / Lunch / Dinner / Custom)
//   - Each entry creates a new batch with that session's quantity and unit
//   - Adjustments (damage, correction) reduce from the active batch
//   - Full audit trail: who entered, which session, what unit, what quantity

const UNITS = [
  { id:"cups",    label:"Cups",        abbr:"cups" },
  { id:"pieces",  label:"Pieces",      abbr:"pcs"  },
  { id:"kg",      label:"Kilograms",   abbr:"kg"   },
  { id:"g",       label:"Grams",       abbr:"g"    },
  { id:"liters",  label:"Liters",      abbr:"L"    },
  { id:"ml",      label:"Millilitres", abbr:"ml"   },
  { id:"bottles", label:"Bottles",     abbr:"btl"  },
  { id:"plates",  label:"Plates",      abbr:"pls"  },
  { id:"portions",label:"Portions",    abbr:"ptn"  },
  { id:"loaves",  label:"Loaves",      abbr:"lv"   },
  { id:"slices",  label:"Slices",      abbr:"slc"  },
  { id:"bags",    label:"Bags",        abbr:"bag"  },
];

function AdjustStockModal({ item, onClose, onSave }) {
  const [qty,    setQty]    = useState("");
  const [unit,   setUnit]   = useState(item.unit || "cups");
  const [note,   setNote]   = useState("");
  const [saving, setSaving] = useState(false);

  if (!item) return null;

  const unitMeta = UNITS.find(u => u.id === unit) || { abbr: unit };
  const parsed   = parseFloat(qty) || 0;
  const after    = (item.stock || 0) + parsed;

  const handleSave = async () => {
    if (!parsed || parsed <= 0) return;
    setSaving(true);
    await onSave(item.id, parsed, "stock_in", note, unit);
    setSaving(false);
    onClose();
  };

  const INP = {
    width:"100%", padding:"9px 11px",
    border:"1px solid #E5E0D5", borderRadius:4,
    fontSize:13, boxSizing:"border-box",
    background:"#fff", fontFamily:"inherit", color:"#1A1A1A",
  };
  const LBL = {
    fontSize:10, fontWeight:700, color:"#555",
    display:"block", marginBottom:5,
    textTransform:"uppercase", letterSpacing:0.6,
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300 }}>
      <div style={{ background:"#fff", borderRadius:8, width:"min(440px,96vw)", display:"flex", flexDirection:"column", boxShadow:"0 24px 64px rgba(0,0,0,0.25)", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ background:"linear-gradient(135deg,#C5A059,#A0823A)", padding:"16px 20px", display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
          <div>
            <div style={{ color:"#fff", fontWeight:700, fontSize:15 }}>Add Stock</div>
            <div style={{ color:"rgba(255,255,255,0.8)", fontSize:12, marginTop:3 }}>{item.name}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ color:"rgba(255,255,255,0.65)", fontSize:10, textTransform:"uppercase", letterSpacing:0.5 }}>Current Stock</div>
            <div style={{ color:"#fff", fontSize:22, fontWeight:800 }}>
              {item.stock || 0} <span style={{ fontSize:12, fontWeight:500 }}>{unitMeta.abbr}</span>
            </div>
          </div>
        </div>

        <div style={{ padding:"20px", display:"flex", flexDirection:"column", gap:14 }}>

          {/* Quantity + Unit */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div>
              <label style={LBL}>Quantity to Add</label>
              <input
                type="number" min="0.5" step="0.5"
                value={qty} onChange={e => setQty(e.target.value)}
                placeholder="e.g. 100"
                style={{ ...INP, fontSize:20, fontWeight:700 }}
                autoFocus
              />
            </div>
            <div>
              <label style={LBL}>Unit</label>
              <select value={unit} onChange={e => setUnit(e.target.value)} style={INP}>
                {UNITS.map(u => (
                  <option key={u.id} value={u.id}>{u.label} ({u.abbr})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Before / After */}
          {parsed > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
              {[
                { label:"Before", value: item.stock || 0, color:"#555"    },
                { label:"Adding", value:`+${parsed}`,     color:"#2E7D64" },
                { label:"After",  value: after,           color: after <= (item.reorder||5) ? "#8B3A3A" : "#2E7D64" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background:"#F8F8F5", borderRadius:6, padding:"10px", textAlign:"center", border:"1px solid #E5E0D5" }}>
                  <div style={{ fontSize:9, color:"#888", fontWeight:700, textTransform:"uppercase", letterSpacing:0.5, marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:20, fontWeight:800, color }}>{value}</div>
                  <div style={{ fontSize:9, color:"#aaa", marginTop:2 }}>{unitMeta.abbr}</div>
                </div>
              ))}
            </div>
          )}

          {/* Note */}
          <div>
            <label style={LBL}>Note <span style={{ color:"#aaa", fontWeight:400 }}>(optional)</span></label>
            <input value={note} onChange={e => setNote(e.target.value)}
              placeholder="e.g. Morning load, lunch replenishment..."
              style={INP} />
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding:"14px 20px", borderTop:"1px solid #E5E0D5", display:"flex", gap:10, background:"#FAFAF8" }}>
          <button onClick={onClose} style={{ padding:"9px 20px", border:"1px solid #E5E0D5", borderRadius:4, background:"#fff", color:"#555", cursor:"pointer", fontSize:13 }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || parsed <= 0} style={{
            flex:1, padding:"9px", border:"none", borderRadius:4,
            background: saving || parsed <= 0 ? "#ccc" : "#2E7D64",
            color:"#fff", cursor: saving || parsed <= 0 ? "not-allowed" : "pointer",
            fontSize:13, fontWeight:700,
          }}>
            {saving ? "Saving-" : `Add ${parsed > 0 ? parsed + " " + unitMeta.abbr : "Stock"}`}
          </button>
        </div>
      </div>
    </div>
  );
}


// --- UPDATE PRICE MODAL -------------------------------------------------------
function UpdatePriceModal({ item, onClose, onSave }) {
  const [rPrice,  setRPrice]  = useState(String(item?.rPrice  || ""));
  const [wPrice,  setWPrice]  = useState(String(item?.wPrice  || ""));
  const [pPrice,  setPPrice]  = useState(String(item?.promPrice || ""));
  const [cost,    setCost]    = useState(String(item?.cost    || ""));
  if (!item) return null;
  const margin = rPrice && cost ? ((parseFloat(rPrice) - parseFloat(cost)) / parseFloat(rPrice) * 100).toFixed(1) : "-";
  const mColor = parseFloat(margin) > 50 ? "#2E7D64" : parseFloat(margin) > 25 ? "#B8860B" : "#8B3A3A";
  return (
    <div style={{ 
      position: "fixed", 
      inset: 0, 
      background: "rgba(0,0,0,0.5)", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      zIndex: 300 
    }}>
      <div style={{ 
        background: "#FFFFFF", 
        borderRadius: 8, 
        width: 460, 
        boxShadow: "0 20px 40px rgba(0,0,0,0.15)", 
        overflow: "hidden" 
      }}>
        <div style={{ 
          background: "linear-gradient(135deg, #C5A059, #A0823A)", 
          padding: "16px 20px", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between" 
        }}>
          <div>
            <div style={{ color: "#FFFFFF", fontWeight: 700, fontSize: 14, letterSpacing: 0.5 }}>
              Update Pricing
            </div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 }}>
              {item.name}
            </div>
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              background: "rgba(255,255,255,0.15)", 
              border: "none", 
              color: "#FFFFFF", 
              width: 28, 
              height: 28, 
              borderRadius: 4, 
              cursor: "pointer", 
              fontWeight: 700 
            }}
          >
            -
          </button>
        </div>
        <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Margin preview */}
          <div style={{ 
            background: `${mColor}10`, 
            border: `1px solid ${mColor}30`, 
            borderRadius: 6, 
            padding: "10px 16px", 
            display: "flex", 
            gap: 24, 
            alignItems: "center" 
          }}>
            <div>
              <div style={{ fontSize: 9, color: "#7A7A7A", fontWeight: 600 }}>COST</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#4A4A4A" }}>
                KES {parseFloat(cost || 0).toFixed(2)}
              </div>
            </div>
            <div style={{ color: "#D1D5DB" }}>-</div>
            <div>
              <div style={{ fontSize: 9, color: "#7A7A7A", fontWeight: 600 }}>RETAIL</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#4A4A4A" }}>
                KES {parseFloat(rPrice || 0).toFixed(2)}
              </div>
            </div>
            <div style={{ color: "#D1D5DB" }}>-</div>
            <div>
              <div style={{ fontSize: 9, color: "#7A7A7A", fontWeight: 600 }}>MARGIN</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: mColor }}>{margin}%</div>
            </div>
          </div>
          {[
            ["Cost Price *", cost, setCost, "#8B3A3A"], 
            ["Retail Price *", rPrice, setRPrice, "#2E7D64"], 
            ["Wholesale Price", wPrice, setWPrice, "#0D9488"], 
            ["Promotional Price", pPrice, setPPrice, "#B8860B"]
          ].map(([lbl, val, setter, clr]) => (
            <div key={lbl}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#4A4A4A", display: "block", marginBottom: 5 }}>
                {lbl}
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ 
                  position: "absolute", 
                  left: 10, 
                  top: "50%", 
                  transform: "translateY(-50%)", 
                  fontSize: 11, 
                  color: "#7A7A7A", 
                  fontWeight: 600 
                }}>
                  KES
                </span>
                <input 
                  type="number" 
                  min="0" 
                  value={val} 
                  onChange={(e) => setter(e.target.value)}
                  style={{ 
                    width: "100%", 
                    padding: "9px 12px 9px 48px", 
                    border: `1px solid ${clr}40`, 
                    borderRadius: 4, 
                    fontSize: 13, 
                    outline: "none", 
                    boxSizing: "border-box", 
                    fontWeight: 500 
                  }}
                  onFocus={(e) => e.target.style.borderColor = clr}
                  onBlur={(e) => e.target.style.borderColor = `${clr}40`}
                />
              </div>
            </div>
          ))}
        </div>
        <div style={{ 
          padding: "12px 22px", 
          borderTop: "1px solid #F0EDE6", 
          display: "flex", 
          gap: 10, 
          justifyContent: "flex-end", 
          background: "#F8F8F8" 
        }}>
          <button 
            onClick={onClose} 
            style={{ 
              padding: "8px 20px", 
              borderRadius: 4, 
              border: "1px solid #E5E0D5", 
              background: "#FFFFFF", 
              fontWeight: 600, 
              fontSize: 12, 
              cursor: "pointer" 
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => { onSave(item.id, { rPrice: parseFloat(rPrice), wPrice: parseFloat(wPrice), pPrice: parseFloat(pPrice), cost: parseFloat(cost) }); onClose(); }}
            style={{ 
              padding: "8px 22px", 
              borderRadius: 4, 
              border: "none", 
              background: "#C5A059", 
              color: "#FFFFFF", 
              fontWeight: 600, 
              fontSize: 12, 
              cursor: "pointer" 
            }}
          >
            Save Prices
          </button>
        </div>
      </div>
    </div>
  );
}

// --- STOCK MANAGEMENT VIEW ----------------------------------------------------
// --- EDIT ITEM MODAL ---------------------------------------------------------
function EditItemModal({ item, onClose, onSave }) {
  const [form, setForm] = useState({
    name:           item.name          || "",
    category:       item.category      || "",
    price:          item.price         || item.rPrice || 0,
    cost:           item.cost          || 0,
    description:    item.description   || "",
    bestseller:     item.bestseller    || false,
    on_sale:        item.on_sale       || item.onSale || false,
    original_price: item.original_price|| item.originalPrice || "",
    active:         item.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const CATS = ["beverages","starters","mains","pasta","desserts","other"];
  const INP = { width:"100%", padding:"8px 10px", border:"1px solid #E5E0D5", borderRadius:4, fontSize:13, boxSizing:"border-box", background:"#fff", fontFamily:"inherit" };
  const LBL = { fontSize:11, fontWeight:600, color:"#555", marginBottom:4, display:"block", textTransform:"uppercase", letterSpacing:0.5 };
  const margin = form.price > 0 && form.cost > 0 ? ((form.price - form.cost) / form.price * 100).toFixed(1) : null;

  // ── Recipe editing ──
  const [inventory, setInventory] = useState([]);
  const [recipe,    setRecipe]    = useState(
    (item.recipe || []).map(r => ({
      _id: (crypto.randomUUID?.() || String(Math.random())),
      ingredient_id: r.ingredient_id, name: r.name, unit: r.unit, qty: String(r.qty ?? ""),
    }))
  );
  const [recipeErr, setRecipeErr] = useState("");
  const [search,    setSearch]    = useState("");
  const [showDrop,  setShowDrop]  = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    // fresh recipe (in case the passed item didn't carry it) + ingredient list
    itemsApi.get(item.id).then(full => {
      if (full?.recipe?.length) {
        setRecipe(full.recipe.map(r => ({
          _id: (crypto.randomUUID?.() || String(Math.random())),
          ingredient_id: r.ingredient_id, name: r.name, unit: r.unit, qty: String(r.qty ?? ""),
        })));
      }
    }).catch(() => {});
    inventoryApi.ingredients().then(data => setInventory((data || []).map(i => ({
      id: i.id, name: i.name, unit: i.unit, category: i.category || "",
      costPerUnit: parseFloat(i.cost_per_unit || 0),
    })))).catch(() => {});
  }, [item.id]);

  useEffect(() => {
    const close = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setShowDrop(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const chosen   = recipe.map(r => r.ingredient_id);
  const matches  = inventory
    .filter(i => i.category !== "Utilities" && !chosen.includes(i.id))
    .filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 8);

  const addLine = (inv) => {
    setRecipe(p => [...p, { _id:(crypto.randomUUID?.()||String(Math.random())), ingredient_id:inv.id, name:inv.name, unit:inv.unit, qty:"" }]);
    setSearch(""); setShowDrop(false);
  };
  const setQty    = (id, v) => setRecipe(p => p.map(r => r._id === id ? { ...r, qty: v } : r));
  const removeLine= (id)    => setRecipe(p => p.filter(r => r._id !== id));

  const saveAll = async () => {
    if (!form.name.trim()) return;
    setSaving(true); setRecipeErr("");
    try {
      await onSave({
        name: form.name.trim(), category: form.category,
        price: parseFloat(form.price) || 0,
        description: form.description, bestseller: form.bestseller,
        active: form.active,
      });
    } catch (e) {
      setRecipeErr(e?.response?.data?.error || "Couldn't save — try again.");
      setSaving(false);
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:16 }}>
      <div style={{ background:"#fff", borderRadius:8, width:"min(600px,96vw)", maxHeight:"90vh", display:"flex", flexDirection:"column", boxShadow:"0 20px 60px rgba(0,0,0,0.25)" }}>
        <div style={{ padding:"16px 22px", borderBottom:"1px solid #E5E0D5", display:"flex", alignItems:"center", justifyContent:"space-between", background:"#FAFAF8" }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:"#1A1A1A" }}>Edit Item</div>
            <div style={{ fontSize:11, color:"#888", marginTop:2 }}>#{item.id} - {item.name}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:"#aaa" }}>×</button>
        </div>
        <div style={{ overflowY:"auto", padding:"20px 22px", flex:1 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px 16px" }}>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={LBL}>Item Name *</label>
              <input value={form.name} onChange={e=>set("name",e.target.value)} style={INP} placeholder="e.g. Grilled Chicken" />
            </div>
            <div>
              <label style={LBL}>Category</label>
              <select value={form.category} onChange={e=>set("category",e.target.value)} style={INP}>
                <option value="">-- select --</option>
                {CATS.map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={LBL}>Status</label>
              <select value={form.active?"active":"inactive"} onChange={e=>set("active",e.target.value==="active")} style={INP}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label style={LBL}>Selling Price (KES)</label>
              <input type="number" value={form.price} onChange={e=>set("price",e.target.value)} style={INP} min={0} />
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={LBL}>Description</label>
              <textarea value={form.description} onChange={e=>set("description",e.target.value)}
                style={{ ...INP, height:64, resize:"none" }} placeholder="Brief description" />
            </div>
            <div style={{ gridColumn:"1/-1", display:"flex", gap:24 }}>
              {[{key:"bestseller",label:"Mark as Popular"}].map(({key,label})=>(
                <label key={key} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:13, color:"#333" }}>
                  <input type="checkbox" checked={form[key]} onChange={e=>set(key,e.target.checked)} style={{ width:15, height:15 }} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          {recipeErr && <div style={{ marginTop:14, padding:"8px 12px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:6, fontSize:12, color:"#8B3A3A" }}>{recipeErr}</div>}
        </div>
        <div style={{ padding:"14px 22px", borderTop:"1px solid #E5E0D5", display:"flex", gap:10, background:"#FAFAF8" }}>
          <button onClick={onClose} style={{ padding:"9px 20px", border:"1px solid #E5E0D5", borderRadius:4, background:"#fff", color:"#555", cursor:"pointer", fontSize:13 }}>Cancel</button>
          <button disabled={saving||!form.name.trim()} onClick={saveAll}
            style={{ flex:1, padding:"9px 20px", border:"none", borderRadius:4, background:saving||!form.name.trim()?"#ccc":"#C5A059", color:"#fff", cursor:saving?"wait":"pointer", fontSize:13, fontWeight:700 }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- DELETE CONFIRM MODAL -----------------------------------------------------
function DeleteConfirmModal({ item, onClose, onConfirm }) {
  if (!item) return null;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}>
      <div style={{ background:"#fff", borderRadius:8, width:"min(360px,95vw)", padding:28, boxShadow:"0 16px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ fontSize:15, fontWeight:700, color:"#8B3A3A", marginBottom:8 }}>Delete Item</div>
        <div style={{ fontSize:13, color:"#555", lineHeight:1.6, marginBottom:20 }}>
          This action cannot be undone. <strong>{item.name}</strong> will be permanently removed from the menu.
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:"9px", border:"1px solid #E5E0D5", borderRadius:4, background:"#fff", color:"#555", cursor:"pointer", fontSize:13 }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex:1, padding:"9px", border:"none", borderRadius:4, background:"#8B3A3A", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:700 }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// --- UNIFIED ITEMS TABLE -----------------------------------------------------
// Merges Item List + Item Stock into one view.
// Columns: Code - Name - Category - Unit - Stock - Reorder - Cost - Retail - Status - Action
// Actions: Add Stock - Update Price - Edit - Profile - Delete
function ItemsTable({ items, setItems, batches, setBatches, ingredients, onNewItem, onNavigate, isAdmin }) {
  const [search,      setSearch]      = useState("");
  const [filterCat,   setFilterCat]   = useState("all");
  const [pageSize,    setPageSize]    = useState(25);
  const [page,        setPage]        = useState(1);
  const [adjustItem,  setAdjustItem]  = useState(null);
  const [priceItem,   setPriceItem]   = useState(null);
  const [editItem,    setEditItem]    = useState(null);
  const [profileItem, setProfileItem] = useState(null);
  const [deleteItem,  setDeleteItem]  = useState(null);

  const rows = buildStockRows(items, batches, ingredients);

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q) || r.code.includes(q);
    const matchCat = filterCat === "all" || r.category === filterCat;
    return matchSearch && matchCat;
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Get live stock after local adjustments
  const getLiveStock = (item) => {
    const orig = items.find(i => i.id === item.id);
    return Number(orig?._stockOverride ?? item.stock ?? 0);
  };

  const handleAdjust = async (itemId, delta, reason, note, unit) => {
    setItems(prev => prev.map(it => {
      if (it.id !== itemId) return it;
      return { ...it, _stockOverride: (it._stockOverride ?? rows.find(r => r.id === it.id)?.stock ?? 0) + delta };
    }));
    try {
      const { inventoryApi } = await import("../api/index.js");
      await inventoryApi.receiveBatch({ ingredient_id: itemId, qty: delta, notes: note || "Stock addition" });
    } catch (err) { console.error("Stock adjust failed:", err.message); }
  };

  const handlePriceSave = async (itemId, prices) => {
    setItems(prev => prev.map(it => it.id !== itemId ? it : { ...it, price: prices.rPrice, cost: prices.cost }));
    try {
      const { itemsApi } = await import("../api/index.js");
      await itemsApi.update(itemId, { price: prices.rPrice, cost: prices.cost });
    } catch (err) { console.error("Price update failed:", err.message); }
  };

  const CATS = [{ id:"all", label:"All" }, ...(MENU_CATEGORIES||[]).filter(c => c.id !== "all" && c.id !== "bestseller")];

  const TH = { padding:"10px 10px", textAlign:"left", fontSize:10, fontWeight:700, color:"#FFFFFF", whiteSpace:"nowrap", letterSpacing:0.5 };
  const TD = { padding:"9px 10px", fontSize:12, color:"#4A4A4A", borderBottom:"1px solid #F0EDE6" };

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", background:"#F5F2EB", overflow:"hidden" }}>

      {/* Header */}
      <div style={{ background:"#FFFFFF", borderBottom:"1px solid #E5E0D5", padding:"12px 20px", display:"flex", alignItems:"center", gap:10, flexShrink:0, flexWrap:"wrap" }}>
        <div style={{ width:6, height:6, borderRadius:"50%", background:"#C5A059" }} />
        <span style={{ fontSize:15, fontWeight:700, color:"#1A1A1A" }}>Items</span>
        <span style={{ fontSize:11, color:"#9CA3AF" }}>{filtered.length} item{filtered.length!==1?"s":""}</span>
        <div style={{ flex:1 }} />
        <button onClick={onNewItem}
          style={{ padding:"7px 14px", background:"#C5A059", color:"#fff", border:"none", borderRadius:4, fontWeight:600, fontSize:11, cursor:"pointer" }}>
          + New Item
        </button>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>

        {/* KPIs */}
        <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
          {[
            { label:"Total Items",  value:rows.length,                                                                color:"#C5A059", bg:"#FEF9F0" },
            { label:"Low Stock",    value:rows.filter(r => getLiveStock(r) <= r.reorder && getLiveStock(r) > 0).length, color:"#B8860B", bg:"#FFFBEB" },
            { label:"Out of Stock", value:rows.filter(r => getLiveStock(r) === 0).length,                            color:"#8B3A3A", bg:"#FEF2F2" },
            { label:"Active",       value:rows.filter(r => r.active !== false).length,                               color:"#2E7D64", bg:"#F0FDF4" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} style={{ background:bg, border:`1px solid ${color}33`, borderRadius:6, padding:"10px 16px", minWidth:100 }}>
              <div style={{ fontSize:9, color:"#888", fontWeight:700, textTransform:"uppercase", letterSpacing:0.5 }}>{label}</div>
              <div style={{ fontSize:22, fontWeight:800, color, marginTop:2 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search items..."
            style={{ padding:"7px 12px", border:"1px solid #E5E0D5", borderRadius:4, fontSize:12, outline:"none", minWidth:200, background:"#fff" }} />
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {CATS.map(c => (
              <button key={c.id} onClick={() => { setFilterCat(c.id); setPage(1); }}
                style={{ padding:"5px 12px", borderRadius:4, border:"1px solid #E5E0D5", fontSize:11, cursor:"pointer", fontWeight:filterCat===c.id?700:500, background:filterCat===c.id?"#C5A059":"#fff", color:filterCat===c.id?"#fff":"#555", transition:"all .1s" }}>
                {c.label}
              </button>
            ))}
          </div>
          <TableToolbar search="" setSearch={()=>{}} pageSize={pageSize} setPageSize={v=>{ setPageSize(v); setPage(1); }} onPageSizeChange={()=>{}} />
        </div>

        {/* Table */}
        <div style={{ background:"#fff", borderRadius:6, border:"1px solid #E5E0D5", overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:780 }}>
              <thead>
                <tr style={{ background:"#C5A059" }}>
                  {["Code","Item Name","Category","Unit","Stock","Reorder","Cost (KES)","Price (KES)","Status","Action"].map(h => (
                    <th key={h} style={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={10} style={{ padding:"40px", textAlign:"center", color:"#9CA3AF", fontSize:13 }}>No items found</td></tr>
                ) : paginated.map((row, idx) => {
                  const liveStock = getLiveStock(row);
                  const isLow     = liveStock <= row.reorder && liveStock > 0;
                  const isOut     = liveStock === 0;
                  const stockColor = isOut ? "#8B3A3A" : isLow ? "#B8860B" : "#2E7D64";

                  return (
                    <tr key={row.id} style={{ background:idx%2===0?"#fff":"#FDFCFA" }}>
                      <td style={{ ...TD, color:"#9CA3AF", fontFamily:"monospace", fontSize:11 }}>{row.code}</td>
                      <td style={TD}>
                        <div style={{ fontWeight:600, color:"#1A1A1A" }}>{row.name}</div>
                        {row.bestseller && <span style={{ fontSize:9, background:"#FEF3C7", color:"#92400E", padding:"1px 5px", borderRadius:3, fontWeight:700 }}>Popular</span>}
                      </td>
                      <td style={{ ...TD, textTransform:"capitalize" }}>{row.category || "-"}</td>
                      <td style={TD}>{row.unit || "-"}</td>
                      <td style={{ ...TD, fontWeight:700, color:stockColor }}>
                        {liveStock}
                        {isLow && <span style={{ marginLeft:4, fontSize:9, background:"#FEF3C7", color:"#92400E", padding:"1px 5px", borderRadius:3, fontWeight:700 }}>LOW</span>}
                        {isOut && <span style={{ marginLeft:4, fontSize:9, background:"#FEF2F2", color:"#8B3A3A", padding:"1px 5px", borderRadius:3, fontWeight:700 }}>OUT</span>}
                      </td>
                      <td style={TD}>{row.reorder}</td>
                      <td style={TD}>{Number(row.cost||0).toFixed(2)}</td>
                      <td style={{ ...TD, fontWeight:600, color:"#2E7D64" }}>{Number(row.rPrice||0).toFixed(2)}</td>
                      <td style={TD}>
                        <span style={{ fontSize:10, padding:"2px 8px", borderRadius:3, fontWeight:600, background:row.active===false?"#FEF2F2":"#ECFDF5", color:row.active===false?"#8B3A3A":"#2E7D64" }}>
                          {row.active===false ? "Inactive" : "Active"}
                        </span>
                      </td>
                      <td style={TD}>
                        <ActionDropdown items={[
                          { icon:"-", color:"#2E7D64", label:"Add Stock",     onClick:() => setAdjustItem({ ...row, stock:liveStock }) },
                          { icon:"-", color:"#C5A059", label:"Update Price",  onClick:() => setPriceItem({ ...row, rPrice:Number(row.rPrice||0), cost:Number(row.cost||0) }) },
                          "divider",
                          { icon:"-", color:"#0D9488", label:"Edit Item",     onClick:() => setEditItem(row) },
                          { icon:"-", color:"#6B7280", label:"Item Profile",  onClick:() => setProfileItem(row) },
                          "divider",
                          { icon:"-", color:"#8B3A3A", label:"Delete",        onClick:() => setDeleteItem(row), danger:true },
                        ]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <Pagination page={page} setPage={setPage} totalPages={totalPages} filtered={filtered.length} pageSize={pageSize} />
      </div>

      {/* Modals */}
      {adjustItem  && <AdjustStockModal item={adjustItem}  onClose={() => setAdjustItem(null)}  onSave={handleAdjust} />}
      {priceItem   && <UpdatePriceModal item={priceItem}   onClose={() => setPriceItem(null)}   onSave={handlePriceSave} />}
      {profileItem && <ItemProfileModal item={profileItem} onClose={() => setProfileItem(null)} />}
      {editItem    && (
        <EditItemModal item={editItem} onClose={() => setEditItem(null)}
          onSave={async (updates) => {
            try {
              const { itemsApi } = await import("../api/index.js");
              const saved = await itemsApi.update(editItem.id, updates);
              setItems(p => p.map(x => x.id === editItem.id ? { ...x, ...saved } : x));
            } catch (err) {
              setItems(p => p.map(x => x.id === editItem.id ? { ...x, ...updates } : x));
            }
            setEditItem(null);
          }}
        />
      )}
      {deleteItem  && (
        <DeleteConfirmModal item={deleteItem} onClose={() => setDeleteItem(null)}
          onConfirm={async () => {
            try { const { itemsApi } = await import("../api/index.js"); await itemsApi.remove(deleteItem.id); } catch (err) {}
            setItems(p => p.filter(x => x.id !== deleteItem.id));
            setDeleteItem(null);
          }}
        />
      )}
    </div>
  );
}

// --- ITEMS PARENT VIEW --------------------------------------------------------
export default function ItemsView({ subView: propSubView = "new", batches, setBatches, user, menuItems: propMenuItems, setMenuItems: propSetMenuItems, ingredients: propIngredients, setIngredients: propSetIngredients, recipes: propRecipes, setRecipes: propSetRecipes, onNavigate }) {
  const [items,       setItems]       = useState(
    (propMenuItems || []).map((m) => ({ ...m, brand: m.brand || m.name.toUpperCase().slice(0, 8) }))
  );
  const [storeIssues, setStoreIssues] = useState([]);

  // Sub-views driven by receive/issue which aren't in main sidebar
  const [localSubView, setLocalSubView] = useState(null);
  const subView = localSubView || propSubView;

  useEffect(() => {
    if (!propMenuItems) return;
    setItems(propMenuItems.map((m) => ({ ...m, brand: m.brand || m.name.toUpperCase().slice(0, 8) })));
  }, [propMenuItems]);

  // Fetch fresh stock on mount
  useEffect(() => {
    import("../api/index.js").then(({ itemsApi }) => {
      itemsApi.stockAvailable().then(fresh => {
        if (fresh?.length && propSetMenuItems) propSetMenuItems(fresh);
      }).catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset local override whenever parent nav changes
  useEffect(() => { setLocalSubView(null); }, [propSubView]);

  const handleSave = (payload) => {
    const newItem = {
      id: payload.id, name: payload.name,
      brand: payload.brand || payload.name.toUpperCase().slice(0, 6),
      category: payload.category,
      price: payload.price || payload.sellingPrice || 0,
      cost: payload.cost || payload.costPrice || 0,
      emoji: payload.emoji || "-",
      description: payload.description || "",
      onSale: payload.isOnSale || false,
      bestseller: payload.isBestseller || false,
      originalPrice: payload.originalPrice,
      sku: payload.sku, unit: payload.unit,
      openingStock: payload.openingStock,
      itemType: payload.itemType,
    };

    if (payload.itemType === "ingredient") {
      const newIngredient = {
        id: payload.id,
        name: payload.name,
        unit: payload.unit || "pcs",
        category: payload.category || "other",
        reorderLevel: payload.reorderLevel || 5,
        costPerUnit: payload.cost || 0,
      };
      propSetIngredients?.((p) => p.find(i => i.id === newIngredient.id) ? p : [...p, newIngredient]);

      if (payload.openingStock > 0) {
        const newBatch = {
          id: "B" + String(Date.now()).slice(-6),
          ingredientId: payload.id,
          batchNo: payload.batchNo || "OPENING",
          qty: payload.openingStock,
          remaining: payload.openingStock,
          expiry: payload.expiryDate || null,
          supplier: payload.supplier || "",
          location: payload.location || "Main Store",
          receivedDate: new Date().toISOString().split("T")[0],
          costPerUnit: payload.cost || 0,
          status: "active",
        };
        setBatches((p) => [...p, newBatch]);
      }
    } else {
      setItems((p) => [...p, newItem]);
      propSetMenuItems?.((p) => p.find(i => i.id === newItem.id) ? p : [...p, newItem]);

      const recipeLines = (payload.ingredients || []).filter(i => i.name && i.ingredientId);
      if (recipeLines.length > 0) {
        propSetRecipes?.((prev) => ({
          ...prev,
          [payload.id]: recipeLines.map(i => ({ ingredientId: i.ingredientId, qty: parseFloat(i.qty) || 0 })),
        }));
      }
    }

    onNavigate?.("items:list");
  };

  const navigate = (view) => {
    if (view === "issue" || view === "produce" || view === "overheads") { setLocalSubView(view); }
    else { setLocalSubView(null); onNavigate?.(`items:${view}`); }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#F5F2EB" }}>
      {subView === "new" && <NewItemForm onSave={handleSave} onCancel={() => onNavigate?.("items:list")} liveIngredients={propIngredients||[]} />}
      {(subView === "list" || subView === "stock") && (
        <ItemsTable
          items={items} setItems={setItems}
          batches={batches} setBatches={setBatches}
          ingredients={propIngredients||[]}
          onNewItem={() => onNavigate?.("items:new")}
          onNavigate={navigate}
          isAdmin={user?.role === "admin"}
        />
      )}
      {subView === "produce"    && <ProductionScreen   onBack={() => { setLocalSubView(null); onNavigate?.("items:list"); }} />}
      {subView === "issue"   && <IssueStockView   batches={batches} setBatches={setBatches} storeIssues={storeIssues} setStoreIssues={setStoreIssues} user={user} />}
    </div>
  );
}