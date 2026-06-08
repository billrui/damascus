import { useState, useEffect } from "react";
import KitchenDisplay from "./KitchenDisplay.jsx";
import { MENU_CATEGORIES, TAX, SVC } from "../data";
import { fmt } from "../utils";
import { T, pillBtn, stepBtn, actionBtn, overlay } from "../posTheme";

const TABLES = ["T01","T02","T03","T04","T05","T06","T07","T08","T09","T10","T11","T12","BAR","WALK-IN"];

// Bottom nav icons for mobile
const NAV_ICONS = {
  new_sale: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active?"#C5A059":"#6b7280"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  ),
  kitchen: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active?"#C5A059":"#6b7280"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v4a4 4 0 008 0V3"/><line x1="12" y1="11" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/>
    </svg>
  ),
  invoices: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active?"#C5A059":"#6b7280"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
    </svg>
  ),
};

const KITCHEN_WARN_MS  = 10 * 60 * 1000;
const KITCHEN_ALERT_MS = 20 * 60 * 1000;
const INVOICE_WARN_MS  = 15 * 60 * 1000;
const INVOICE_ALERT_MS = 30 * 60 * 1000;

// --- Helpers ------------------------------------------------------------------
function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  return now;
}

function useBreakpoint() {
  const get = () => ({ mobile: window.innerWidth < 640, tablet: window.innerWidth >= 640 && window.innerWidth < 1024 });
  const [bp, setBp] = useState(get);
  useEffect(() => { const h = () => setBp(get()); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  return bp;
}

function elapsed(ts, now) {
  if (!ts) return 0;
  return now - (typeof ts === "string" ? new Date(ts).getTime() : ts);
}

function elapsedLabel(ms) {
  if (ms < 60_000)   return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m`;
  return `${Math.floor(ms / 3600_000)}h ${Math.floor((ms % 3600_000) / 60_000)}m`;
}

function kitchenFlag(ms) {
  if (ms >= KITCHEN_ALERT_MS) return { color:"#ef4444", bg:"#fff5f5", border:"#fca5a5", label:"DELAYED" };
  if (ms >= KITCHEN_WARN_MS)  return { color:"#d97706", bg:"#fffbeb", border:"#fcd34d", label:"SLOW"    };
  return null;
}

function invoiceFlag(ms) {
  if (ms >= INVOICE_ALERT_MS) return { color:"#ef4444", bg:"#fff5f5", border:"#fca5a5", label:"OVERDUE" };
  if (ms >= INVOICE_WARN_MS)  return { color:"#d97706", bg:"#fffbeb", border:"#fcd34d", label:"WAITING" };
  return null;
}

// --- Small reusable components ------------------------------------------------
function StatusDot({ color }) {
  return <span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:color, flexShrink:0 }} />;
}

function FlagBadge({ flag }) {
  if (!flag) return null;
  return (
    <span style={{
      background: flag.color, color:"#fff", fontSize:9, fontWeight:700,
      padding:"2px 8px", borderRadius:3, letterSpacing:0.8, textTransform:"uppercase",
    }}>
      {flag.label}
    </span>
  );
}

function TimerBadge({ ms, flag }) {
  const color = flag?.color || "#059669";
  return (
    <div style={{
      background: color, color:"#fff",
      fontSize:14, fontWeight:700,
      padding:"5px 12px", borderRadius:6,
      fontVariantNumeric:"tabular-nums",
      minWidth:52, textAlign:"center", lineHeight:1.3, flexShrink:0,
    }}>
      <div>{elapsedLabel(ms)}</div>
      <div style={{ fontSize:7, fontWeight:600, opacity:0.85, letterSpacing:0.8, textTransform:"uppercase" }}>IN KITCHEN</div>
    </div>
  );
}


export default function ManagerPOS({
  user, menuItems: propMenuItems,
  holdList=[], setHoldList,
  openInvoices=[], setOpenInvoices,
  sales=[], setSales,
  batches=[], setBatches,
  recipes={}, ingredients=[],
  hhApplied, setHhApplied, hhDiscount, setHhDiscount,
}) {
  const ITEMS       = propMenuItems || [];
  const menuStock = {}; // stock tracking disabled until production module is active
  const now         = useNow();
  const { mobile, tablet } = useBreakpoint();

  const [tab,        setTab]        = useState(defaultTab || "new_sale");
  const [cart,       setCart]       = useState([]);
  const [table,      setTable]      = useState("T01");
  const [category,   setCategory]   = useState("all");
  const [search,     setSearch]     = useState("");
  const [page,       setPage]       = useState(0);
  const [modal,      setModal]      = useState(null);
  const [activeHold, setActiveHold] = useState(null);
  const [noteTarget, setNoteTarget] = useState(null);
  const [noteText,   setNoteText]   = useState("");
  const [cartOpen,   setCartOpen]   = useState(false); // mobile cart drawer

  const PER_PAGE = mobile ? 6 : tablet ? 8 : 9;

  // -- Menu ---------------------------------------------------------------------
  const categories  = MENU_CATEGORIES.filter(c => c.id==="all"||c.id==="bestseller" ? true : ITEMS.some(m=>m.category===c.id));
  const filtered    = ITEMS.filter(item => {
    const mc = category==="all" ? true : category==="bestseller" ? item.bestseller : item.category===category;
    return mc && item.name.toLowerCase().includes(search.toLowerCase());
  });
  const totalPages  = Math.ceil(filtered.length / PER_PAGE);
  const pageItems   = filtered.slice(page * PER_PAGE, (page+1)*PER_PAGE);

  const addToCart  = (item) => setCart(p => { const ex=p.find(c=>c.id===item.id); return ex?p.map(c=>c.id===item.id?{...c,qty:c.qty+1}:c):[...p,{...item,qty:1,note:""}]; });
  const updateQty  = (id,d) => setCart(p => p.map(c=>c.id===id?{...c,qty:Math.max(0,c.qty+d)}:c).filter(c=>c.qty>0));
  const removeItem = (id)   => setCart(p => p.filter(c=>c.id!==id));
  const inCart     = (id)   => cart.find(c=>c.id===id)?.qty||0;

  const subtotal   = cart.reduce((s,c)=>s+c.price*c.qty,0);
  const tax        = subtotal * TAX;
  const service    = subtotal * SVC;
  const grandTotal = subtotal + tax + service;

  // -- Derived -------------------------------------------------------------------
  const holdPending   = holdList.filter(h=>h.status==="pending");
  const openInvList   = openInvoices.filter(i=>i.status==="open");
  const tableHolds    = holdPending.filter(h=>h.table===table);

  const kitchenOrders = holdPending
    .map(h => { const ms=elapsed(h.createdAt||h.createdDate,now); return {...h,ms,flag:kitchenFlag(ms)}; })
    .sort((a,b)=>b.ms-a.ms);

  const kitchenWarn   = kitchenOrders.filter(h=>h.flag).length;
  const kitchenAlert  = kitchenOrders.filter(h=>h.flag?.color==="#ef4444").length;

  const invoiceList   = openInvList
    .map(inv => { const ms=elapsed(inv.openedAt||inv.createdAt,now); return {...inv,ms,flag:invoiceFlag(ms)}; })
    .sort((a,b)=>b.ms-a.ms);
  const invoiceWarn   = invoiceList.filter(i=>i.flag).length;
  const invoiceAlert  = invoiceList.filter(i=>i.flag?.color==="#ef4444").length;

  const todaySales    = sales.filter(s=>s.date===new Date().toISOString().split("T")[0]);
  const todayRevenue  = todaySales.reduce((s,x)=>s+x.total,0);

  // -- Actions -------------------------------------------------------------------
  const handleSendKitchen = async () => {
    if (!cart.length) return;
    const tempId = `HOLD-${Date.now()}`;
    const entry  = {
      id:tempId, table, waiter:user.name,
      createdAt:   new Date().toISOString(),
      createdDate: new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),
      items:       cart.map(c=>({menuId:c.id,name:c.name,qty:c.qty,price:c.price,emoji:c.emoji,note:c.note||""})),
      subtotal, tax, service, total:grandTotal,
      status:      "pending", createdBy:user.name,
    };
    setHoldList(p=>[entry,...p]);
    setCart([]);
    setCartOpen(false);
    setModal("kitchen_sent");
    setTimeout(()=>setModal(null),2200);
    try {
      const { posApi } = await import("../api/index.js");
      const items = entry.items.map(c=>({menu_item_id:c.menuId,name:c.name,qty:c.qty,price:c.price}));
      const saved = await posApi.createHold({table_no:table,items,total:grandTotal,notes:`Manager: ${user.name}`});
      setHoldList(p=>p.map(h=>h.id===tempId?{...h,id:saved.id,hold_ref:saved.hold_ref}:h));
    } catch(err){ console.error("Hold save failed:",err.message); }
  };

  const handleGenerateBill = async (holdEntry) => {
    const invoice = {
      id:`INV-${String(Date.now()).slice(-6)}`, holdId:holdEntry.id,
      table:holdEntry.table, waiter:holdEntry.waiter||user.name,
      items:holdEntry.items, subtotal:holdEntry.subtotal,
      tax:holdEntry.tax, service:holdEntry.service,
      total:holdEntry.total, status:"open",
      openedAt:new Date().toISOString(), openedBy:user.name,
    };
    setOpenInvoices(p=>[invoice,...p]);
    setHoldList(p=>p.map(h=>h.id===holdEntry.id?{...h,status:"billed",invoiceId:invoice.id}:h));
    setActiveHold(null);
    setModal("bill_sent");
    setTimeout(()=>setModal(null),2500);
    try {
      const { posApi } = await import("../api/index.js");
      await posApi.updateHold(holdEntry.id,{status:"billed"});
    } catch(err){ console.error("Hold update failed:",err.message); }
  };

  // -- RENDER --------------------------------------------------------------------
  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:T.bg,fontFamily:T.font,color:T.textPrimary }}>

      {/* -- TOP BAR -- */}
      <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>

        {/* KPI row */}
        <div style={{ display:"flex", alignItems:"center", padding:mobile?"6px 12px":"6px 16px", borderBottom:`1px solid ${T.border}`, gap:0, overflowX:"auto", flexWrap:mobile?"wrap":"nowrap" }}>
          {/* Manager ID */}
          <div style={{ display:"flex", alignItems:"center", gap:10, paddingRight:16, borderRight:`1px solid ${T.border}`, marginRight:16, flexShrink:0 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:`${T.amber}20`, border:`1px solid ${T.amber}40`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.amber} strokeWidth="2" strokeLinecap="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:T.textPrimary, whiteSpace:"nowrap" }}>{user.name}</div>
              <div style={{ fontSize:9, color:T.amber, textTransform:"uppercase", letterSpacing:1 }}>Manager</div>
            </div>
          </div>

          {/* KPIs */}
          {[
            { label:"Revenue Today",  value:`KES ${(todayRevenue/1000).toFixed(1)}k`, color:T.green   },
            { label:"Sales Today",    value:todaySales.length,                         color:"#8b5cf6" },
            { label:"Kitchen Queue",  value:holdPending.length,  color:kitchenAlert>0?"#ef4444":kitchenWarn>0?"#d97706":T.blue },
            { label:"Open Invoices",  value:openInvList.length,  color:invoiceAlert>0?"#ef4444":invoiceWarn>0?"#d97706":T.green },
          ].map(k=>(
            <div key={k.label} style={{ padding:mobile?"4px 10px":"4px 16px", borderRight:`1px solid ${T.border}`, flexShrink:0 }}>
              <div style={{ fontSize:9, color:T.textMuted, textTransform:"uppercase", letterSpacing:0.8, whiteSpace:"nowrap" }}>{k.label}</div>
              <div style={{ fontSize:mobile?14:18, fontWeight:800, color:k.color }}>{k.value}</div>
            </div>
          ))}

          {/* Happy hour - hidden on mobile, shown on tablet+ */}
          {!mobile && (
            <div style={{ display:"flex", gap:6, alignItems:"center", marginLeft:"auto", paddingLeft:16, flexShrink:0 }}>
              <span style={{ fontSize:10, color:T.textMuted, whiteSpace:"nowrap" }}>Happy Hour</span>
              <input type="number" value={hhDiscount} min={1} max={100}
                onChange={e=>setHhDiscount&&setHhDiscount(Math.max(1,Math.min(100,parseInt(e.target.value)||0)))}
                style={{ width:40, background:T.card, border:`1px solid ${T.border}`, color:T.textPrimary, borderRadius:6, padding:"3px 5px", fontSize:12, fontFamily:T.font }}/>
              <span style={{ fontSize:11, color:T.textMuted }}>%</span>
              <button onClick={()=>setHhApplied&&setHhApplied(v=>!v)}
                style={{ ...actionBtn(hhApplied?T.red:T.amber), color:hhApplied?"#fff":T.bg, fontSize:11, padding:"5px 12px", whiteSpace:"nowrap" }}>
                {hhApplied ? `Stop ${hhDiscount}% HH` : `Start HH ${hhDiscount}%`}
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", padding:mobile?"0 8px":"0 16px", overflowX:"auto" }}>
          <TabBtn label="New Sale"
            active={tab==="new_sale"} onClick={()=>setTab("new_sale")} />

        </div>
      </div>

      {/* -- CONTENT -- */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", position:"relative" }}>

        {/* -- NEW SALE — full viewport on mobile --------------------------------- */}
        {tab==="new_sale" && (
          <div style={{
            flex:1, display:"flex", overflow:"hidden",
            ...(mobile ? { position:"fixed", inset:0, zIndex:40, paddingBottom:64, flexDirection:"column" } : { flexDirection:"row" }),
          }}>
            {/* CART - left panel on desktop, slide-up drawer on mobile */}
            {(!mobile || cartOpen) && (
              <>
                {/* Backdrop (mobile only) */}
                {mobile && cartOpen && (
                  <div onClick={()=>setCartOpen(false)}
                    style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:49 }} />
                )}

                <div style={{
                  ...(mobile ? {
                    position:"fixed", bottom:0, left:0, right:0,
                    maxHeight:"75vh", zIndex:50,
                    borderRadius:"12px 12px 0 0",
                    boxShadow:"0 -8px 32px rgba(0,0,0,0.4)",
                    overflowY:"auto",
                  } : {
                    width:300, display:"flex", flexDirection:"column",
                  }),
                  background:T.surface, borderRight:mobile?"none":`1px solid ${T.border}`,
                  flexShrink:0,
                }}>

                  {/* Mobile drag handle */}
                  {mobile && (
                    <div style={{ padding:"10px 0 6px", display:"flex", justifyContent:"center" }}>
                      <div style={{ width:40, height:4, borderRadius:2, background:T.border }} />
                    </div>
                  )}

                  {/* Header + table grid */}
                  <div style={{ padding:"12px 14px", borderBottom:`1px solid ${T.border}` }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                      <div>
                        <div style={{ fontSize:11, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:1 }}>Order Entry</div>
                        <div style={{ fontSize:10, color:T.textMuted, marginTop:1 }}>{user.name}</div>
                      </div>
                      <div style={{ fontSize:11, color:T.textSecondary, background:T.card, padding:"4px 10px", borderRadius:4, border:`1px solid ${T.border}`, fontVariantNumeric:"tabular-nums" }}>
                        {new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                      </div>
                    </div>

                    {/* Table grid */}
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:4 }}>
                      {TABLES.map(t=>{
                        const hasPending = holdList.some(h=>h.table===t&&h.status==="pending");
                        const hasBilled  = holdList.some(h=>h.table===t&&h.status==="billed");
                        const isActive   = table===t;
                        return (
                          <button key={t} onClick={()=>setTable(t)} style={{
                            padding:"5px 2px", borderRadius:4, cursor:"pointer",
                            fontSize:10, fontWeight:700, transition:"all .1s",
                            border:`1px solid ${isActive?T.amber:hasBilled?T.green:hasPending?T.amber+"44":T.border}`,
                            background:isActive?T.amber:hasBilled?T.green+"22":hasPending?T.amber+"18":T.card,
                            color:isActive?T.bg:hasBilled?T.green:hasPending?T.amber:T.textSecondary,
                          }}>{t}</button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Kitchen orders for this table */}
                  {tableHolds.length>0 && (
                    <div style={{ padding:"8px 12px", borderBottom:`1px solid ${T.border}`, background:`${T.amber}08` }}>
                      <div style={{ fontSize:9, fontWeight:700, color:T.amber, marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Kitchen - Table {table}</div>
                      {tableHolds.map(h=>(
                        <div key={h.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 8px", background:T.card, border:`1px solid ${T.border}`, borderRadius:6, marginBottom:4 }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:11, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {h.items.map(i=>`${i.qty}- ${i.name}`).join(", ")}
                            </div>
                            <div style={{ fontSize:10, color:T.textMuted, marginTop:1 }}>{h.createdDate} - KES {fmt(h.total)}</div>
                          </div>
                          {!openInvoices.find(i=>i.holdId===h.id) ? (
                            <button onClick={()=>{setActiveHold(h);setModal("confirm_bill");}}
                              style={{ ...actionBtn(T.green,true), marginLeft:8, whiteSpace:"nowrap", fontSize:10 }}>
                              Generate Bill
                            </button>
                          ) : (
                            <span style={{ fontSize:10, color:T.green, marginLeft:8, fontWeight:600 }}>Billed</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Cart label */}
                  <div style={{ padding:"8px 12px 4px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ fontSize:9, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:1 }}>Order - Table {table}</div>
                    {cart.length>0 && <button onClick={()=>setCart([])} style={{ fontSize:10, color:T.red, background:"none", border:"none", cursor:"pointer", fontWeight:700 }}>Clear</button>}
                  </div>

                  {/* Cart items */}
                  <div style={{ flex:1, overflowY:"auto", padding:"0 12px", ...(mobile?{maxHeight:"30vh"}:{}) }}>
                    {cart.length===0 ? (
                      <div style={{ textAlign:"center", padding:"28px 0", color:T.textFaint }}>
                        <div style={{ width:32, height:32, border:`1px solid ${T.border}`, borderRadius:8, margin:"0 auto 8px", display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <div style={{ width:14, height:14, border:`1px solid ${T.border}`, borderRadius:3 }} />
                        </div>
                        <div style={{ fontSize:12 }}>Tap items to add to order</div>
                      </div>
                    ) : cart.map(item=>(
                      <div key={item.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 0", borderBottom:`1px solid ${T.border}` }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</div>
                          {item.note && <div style={{ fontSize:10, color:T.amber, fontStyle:"italic", marginTop:1 }}>{item.note}</div>}
                          <div style={{ fontSize:11, color:T.textMuted }}>KES {fmt(item.price)}</div>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                          <button onClick={()=>updateQty(item.id,-1)} style={stepBtn(T.card)}>-</button>
                          <span style={{ color:T.amber, fontWeight:800, fontSize:13, minWidth:16, textAlign:"center" }}>{item.qty}</span>
                          <button onClick={()=>updateQty(item.id,1)} style={stepBtn(T.amber)}>+</button>
                        </div>
                        <div style={{ textAlign:"right", minWidth:50 }}>
                          <div style={{ fontSize:12, fontWeight:700 }}>KES {fmt(item.price*item.qty)}</div>
                          <button onClick={()=>{setNoteTarget(item.id);setNoteText(item.note||"");}} style={{ fontSize:9, color:T.textMuted, background:"none", border:"none", cursor:"pointer", padding:0 }}>Note</button>
                        </div>
                        <button onClick={()=>removeItem(item.id)} style={{ background:"none", border:"none", cursor:"pointer", color:T.textFaint, fontSize:13, padding:"0 2px" }}>-</button>
                      </div>
                    ))}
                  </div>

                  {/* Totals + send */}
                  {cart.length>0 && (
                    <div style={{ borderTop:`1px solid ${T.border}`, padding:"12px 14px", background:T.card }}>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
                        {[["Subtotal",subtotal],["Tax 16%",tax],["Total",grandTotal]].map(([l,v])=>(
                          <div key={l} style={{ textAlign:"center" }}>
                            <div style={{ fontSize:9, color:T.textMuted, marginBottom:2, textTransform:"uppercase", letterSpacing:0.5 }}>{l}</div>
                            <div style={{ fontSize:l==="Total"?14:11, fontWeight:l==="Total"?800:600, color:l==="Total"?T.amber:T.textPrimary }}>KES {fmt(v)}</div>
                          </div>
                        ))}
                      </div>
                      <button onClick={handleSendKitchen} style={{
                        width:"100%", padding:"11px", borderRadius:6, border:"none", cursor:"pointer",
                        background:T.amber, color:T.bg, fontWeight:700, fontSize:13,
                        letterSpacing:0.5, fontFamily:T.font,
                      }}>
                        Send to Kitchen
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* MENU GRID */}
            <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:T.bg, minWidth:0 }}>

              {/* Search + categories */}
              <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, padding:mobile?"8px 10px 0":"10px 14px 0", flexShrink:0 }}>
                <input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="Search menu items..."
                  style={{ width:"100%", padding:"8px 12px", border:`1px solid ${T.border}`, borderRadius:6, fontSize:13, outline:"none", marginBottom:8, boxSizing:"border-box", background:T.card, color:T.textPrimary, fontFamily:T.font }}/>
                <div style={{ display:"flex", gap:0, overflowX:"auto" }}>
                  {categories.map(cat=>(
                    <button key={cat.id} onClick={()=>{setCategory(cat.id);setPage(0);}} style={{
                      padding:"7px 12px", border:"none", cursor:"pointer", fontWeight:600,
                      whiteSpace:"nowrap", fontSize:11, background:"transparent",
                      color:category===cat.id?T.textPrimary:T.textMuted,
                      borderBottom:`2px solid ${category===cat.id?T.amber:"transparent"}`,
                      transition:"all .1s", fontFamily:T.font,
                    }}>{cat.label}</button>
                  ))}
                </div>
              </div>

              {/* Items grid */}
              <div style={{ flex:1, overflowY:"auto", padding:mobile?10:14 }}>
                {ITEMS.length===0 ? (
                  <EmptyState title="Menu items loading" subtitle="Items will appear once connected to the server" />
                ) : (
                  <>
                    <div style={{ display:"grid", gridTemplateColumns:mobile?"repeat(2,1fr)":tablet?"repeat(3,1fr)":"repeat(3,1fr)", gap:mobile?8:10 }}>
                      {pageItems.map(item=>{
                        const qty = inCart(item.id);
                        return (
                          <div key={item.id} onClick={()=>addToCart(item)} style={{
                            borderRadius:8, overflow:"hidden", cursor:"pointer",
                            border:`2px solid ${qty>0?T.amber:T.border}`,
                            background:T.card, transition:"all .12s",
                            boxShadow:qty>0?`0 0 0 1px ${T.amber}33`:undefined,
                          }}>
                            {/* Item colour bar instead of emoji */}
                            <div style={{
                              height:mobile?56:70, position:"relative",
                              background: (menuStock[item.id] === 0)
                                ? "linear-gradient(135deg,#374151,#4B5563)"
                                : qty>0
                                  ? `linear-gradient(135deg,${T.amberDim},#b45309)`
                                  : "linear-gradient(135deg,#1e293b,#334155)",
                              display:"flex", alignItems:"center", justifyContent:"center",
                            }}>
                              {/* Item initial / short name */}
                              <div style={{
                                fontSize:mobile?18:22, fontWeight:800,
                                color:qty>0?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.35)",
                                letterSpacing:1,
                              }}>
                                {item.name.slice(0,2).toUpperCase()}
                              </div>
                              {qty>0 && (
                                <div style={{
                                  position:"absolute", top:5, right:5,
                                  background:T.amber, color:T.bg,
                                  borderRadius:"50%", width:20, height:20,
                                  fontSize:11, fontWeight:800,
                                  display:"flex", alignItems:"center", justifyContent:"center",
                                }}>{qty}</div>
                              )}
                              {menuStock[item.id] === 0 && (
                                <div style={{
                                  position:"absolute", top:5, left:5,
                                  background:"#DC2626", color:"#fff",
                                  fontSize:7, fontWeight:700, padding:"1px 5px", borderRadius:3,
                                  textTransform:"uppercase", letterSpacing:0.5,
                                }}>OUT</div>
                              )}
                              {menuStock[item.id] > 0 && (
                                <div style={{
                                  position:"absolute", bottom:4, right:5,
                                  background:"rgba(0,0,0,0.5)", color:"#86EFAC",
                                  fontSize:7, fontWeight:700, padding:"1px 5px", borderRadius:3,
                                }}>x{menuStock[item.id]}</div>
                              )}
                              {item.bestseller && menuStock[item.id] !== 0 && (
                                <div style={{
                                  position:"absolute", top:5, left:5,
                                  background:T.red, color:"#fff",
                                  fontSize:7, fontWeight:700, padding:"1px 5px", borderRadius:3,
                                  textTransform:"uppercase", letterSpacing:0.5,
                                }}>Popular</div>
                              )}
                              {item.on_sale && (
                                <div style={{
                                  position:"absolute", bottom:4, left:5,
                                  background:"#7c3aed", color:"#fff",
                                  fontSize:7, fontWeight:700, padding:"1px 5px", borderRadius:3,
                                  textTransform:"uppercase",
                                }}>Sale</div>
                              )}
                            </div>
                            <div style={{ padding:mobile?"6px 8px":"7px 10px" }}>
                              <div style={{ fontSize:mobile?11:12, fontWeight:600, color:T.textPrimary, marginBottom:2, lineHeight:1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</div>
                              <div style={{ fontSize:mobile?11:13, fontWeight:800, color:qty>0?T.amber:T.textSecondary }}>KES {fmt(item.price)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {totalPages>1 && (
                      <div style={{ display:"flex", justifyContent:"center", gap:8, marginTop:14 }}>
                        <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{...pillBtn(false),opacity:page===0?0.4:1}}>Prev</button>
                        <span style={{ fontSize:12, color:T.textMuted, padding:"6px 10px" }}>{page+1} / {totalPages}</span>
                        <button onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} disabled={page>=totalPages-1} style={{...pillBtn(false),opacity:page>=totalPages-1?0.4:1}}>Next</button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Mobile: floating cart button */}
              {mobile && tab==="new_sale" && (
                <div style={{ padding:"10px 14px", borderTop:`1px solid ${T.border}`, background:T.surface, flexShrink:0 }}>
                  <button onClick={()=>setCartOpen(true)} style={{
                    width:"100%", padding:"11px", borderRadius:6, border:"none", cursor:"pointer",
                    background:cart.length>0?T.amber:T.card,
                    color:cart.length>0?T.bg:T.textMuted,
                    fontWeight:700, fontSize:13, fontFamily:T.font,
                    display:"flex", alignItems:"center", justifyContent:"center", gap:10,
                  }}>
                    <span>View Order</span>
                    {cart.length>0 && (
                      <span style={{ background:"rgba(0,0,0,0.2)", color:"#fff", borderRadius:10, padding:"1px 8px", fontSize:12, fontWeight:800 }}>
                        {cart.reduce((s,c)=>s+c.qty,0)} items - KES {fmt(grandTotal)}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* -- KITCHEN MONITOR — full viewport ------------------------------------ */}
        {tab==="kitchen" && (
          <div style={{
            flex:1, display:"flex", flexDirection:"column", overflow:"hidden",
            ...(mobile ? { position:"fixed", inset:0, zIndex:40, paddingBottom:64 } : {}),
          }}>
            <KitchenDisplay
              holdList={holdList}
              setHoldList={setHoldList}
              readOnly={true}
              user={user}
            />
          </div>
        )}

        {/* -- OPEN INVOICES — full viewport on mobile ---------------------------- */}
        {tab==="invoices" && (
          <div style={{
            flex:1, overflowY:"auto",
            padding:mobile?12:20,
            ...(mobile ? { position:"fixed", inset:0, zIndex:40, paddingBottom:76 } : {}),
            background:T.bg,
          }}>

            {invoiceAlert>0 && (
              <AlertBanner>
                <div style={{ fontWeight:700, color:"#ef4444", fontSize:13 }}>
                  {invoiceAlert} invoice{invoiceAlert>1?"s":""} unpaid for over {INVOICE_ALERT_MS/60000} minutes
                </div>
                <div style={{ fontSize:12, color:"#b91c1c", marginTop:2 }}>
                  These receipts need immediate attention at the cashier point
                </div>
              </AlertBanner>
            )}

            {invoiceList.length===0 ? (
              <EmptyState title="No open invoices" subtitle="All bills have been settled" />
            ) : (
              <>
                <div style={{ fontSize:10, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>
                  {invoiceList.length} open invoice{invoiceList.length>1?"s":""} - sorted by wait time
                </div>

                <div style={{ display:"grid", gridTemplateColumns:mobile?"1fr":tablet?"repeat(2,1fr)":"repeat(auto-fill,minmax(280px,1fr))", gap:mobile?10:12 }}>
                  {invoiceList.map(inv=>{
                    const f = inv.flag;
                    return (
                      <div key={inv.id} style={{
                        background:f?f.bg:T.card,
                        border:`1px solid ${f?f.border:T.border}`,
                        borderTop:`3px solid ${f?.color||T.blue}`,
                        borderRadius:8, padding:14,
                      }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                          <div>
                            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                              <span style={{ fontWeight:700, fontSize:14, color:f?f.color:T.blue }}>#{inv.id}</span>
                              <FlagBadge flag={f} />
                            </div>
                            <div style={{ fontSize:11, color:T.textSecondary }}>
                              Table {inv.table} - {inv.waiter||"-"} - {inv.items?.length||0} item{inv.items?.length!==1?"s":""}
                            </div>
                          </div>
                          <div style={{
                            background:f?f.color:T.textMuted, color:"#fff",
                            fontSize:13, fontWeight:700,
                            padding:"5px 12px", borderRadius:6,
                            fontVariantNumeric:"tabular-nums", flexShrink:0,
                          }}>
                            {elapsedLabel(inv.ms)}
                          </div>
                        </div>

                        <div style={{ borderTop:`1px solid ${f?f.border:T.border}`, paddingTop:8, marginBottom:8 }}>
                          {(inv.items||[]).slice(0,3).map((i,idx)=>(
                            <div key={idx} style={{ fontSize:11, color:T.textSecondary, padding:"2px 0" }}>
                              {i.qty}- {i.name}
                            </div>
                          ))}
                          {(inv.items||[]).length>3 && (
                            <div style={{ fontSize:10, color:T.textMuted }}>+{inv.items.length-3} more items</div>
                          )}
                        </div>

                        {inv.discount && (
                          <div style={{ fontSize:11, color:T.amber, marginBottom:6 }}>
                            Discount KES {fmt(inv.discount)} applied by {inv.discountedBy}
                          </div>
                        )}

                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <span style={{ fontSize:15, fontWeight:800, color:T.amber }}>KES {fmt(inv.finalTotal??inv.total)}</span>
                          <span style={{ fontSize:10, color:T.textMuted, fontStyle:"italic" }}>Payment at cashier</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* -- NOTE MODAL -- */}
      {noteTarget && (
        <div style={overlay}>
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:24, width:mobile?"90vw":300 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>Item Note</div>
            <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="e.g. no onions, extra sauce..."
              style={{ width:"100%", height:80, borderRadius:6, border:`1px solid ${T.border}`, padding:10, fontSize:13, resize:"none", outline:"none", boxSizing:"border-box", background:T.card, color:T.textPrimary, fontFamily:T.font }}/>
            <div style={{ display:"flex", gap:8, marginTop:12 }}>
              <button onClick={()=>setNoteTarget(null)} style={actionBtn(T.textFaint)}>Cancel</button>
              <button onClick={()=>{setCart(p=>p.map(c=>c.id===noteTarget?{...c,note:noteText}:c));setNoteTarget(null);}}
                style={{ ...actionBtn(T.amber), flex:1, color:T.bg }}>Save Note</button>
            </div>
          </div>
        </div>
      )}

      {/* -- CONFIRM BILL MODAL -- */}
      {modal==="confirm_bill" && activeHold && (
        <div style={overlay}>
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, width:mobile?"90vw":360, overflow:"hidden" }}>
            <div style={{ background:T.card, padding:"16px 20px", borderBottom:`1px solid ${T.border}` }}>
              <div style={{ fontSize:15, fontWeight:700, color:T.textPrimary }}>Generate Customer Bill</div>
              <div style={{ fontSize:11, color:T.textMuted, marginTop:2 }}>Table {activeHold.table} - {activeHold.createdDate}</div>
            </div>
            <div style={{ padding:20 }}>
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:8, padding:"12px 14px", marginBottom:14 }}>
                {activeHold.items.map(i=>(
                  <div key={i.menuId||i.name} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"4px 0", borderBottom:`1px solid ${T.border}`, color:T.textSecondary }}>
                    <span>{i.qty}- {i.name}</span>
                    <span style={{ fontWeight:600, color:T.textPrimary }}>KES {fmt(i.price*i.qty)}</span>
                  </div>
                ))}
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:14, fontWeight:800, marginTop:10 }}>
                  <span>Total</span>
                  <span style={{ color:T.amber }}>KES {fmt(activeHold.total)}</span>
                </div>
              </div>
              <div style={{ fontSize:12, color:T.textSecondary, background:`${T.amber}10`, border:`1px solid ${T.amber}30`, borderRadius:6, padding:"8px 12px", marginBottom:14 }}>
                This creates an open invoice at the cashier point for payment collection.
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={()=>{setModal(null);setActiveHold(null);}} style={actionBtn(T.card)}>Cancel</button>
                <button onClick={()=>handleGenerateBill(activeHold)} style={{ ...actionBtn(T.green), flex:1 }}>Send to Cashier</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -- TOAST -- */}
      {(modal==="kitchen_sent"||modal==="bill_sent") && (
        <div style={{
          position:"fixed", bottom:28, left:"50%", transform:"translateX(-50%)",
          background:modal==="bill_sent"?T.green:T.amber,
          color:modal==="bill_sent"?"#fff":T.bg,
          borderRadius:8, padding:"12px 24px",
          fontSize:13, fontWeight:700,
          boxShadow:"0 6px 24px rgba(0,0,0,.4)",
          zIndex:999, whiteSpace:"nowrap",
        }}>
          {modal==="kitchen_sent" ? "Order sent to kitchen" : "Bill sent to cashier"}
        </div>
      )}
      {/* ── Mobile bottom navigation ─────────────────────────────────────────── */}
      {mobile && (
        <div style={{
          position:"fixed", bottom:0, left:0, right:0, height:64, zIndex:60,
          background:T.surface, borderTop:`1px solid ${T.border}`,
          display:"flex", alignItems:"stretch",
          boxShadow:"0 -4px 24px rgba(0,0,0,0.4)",
        }}>
          {/* Back button */}
          <button onClick={() => window.dispatchEvent(new CustomEvent("navigate", { detail:"dashboard" }))}
            style={{ flex:"0 0 56px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, background:"none", border:"none", cursor:"pointer", padding:"8px 0", borderTop:"2px solid transparent" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            <span style={{ fontSize:10, fontWeight:500, color:"#6b7280" }}>Back</span>
          </button>

          {[
            { id:'new_sale', label:'New Sale',  badge:0 },
            { id:'kitchen',  label:'Kitchen',   badge:kitchenWarn },
            { id:'invoices', label:'Invoices',  badge:invoiceWarn },
          ].map(({ id, label, badge }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)}
                style={{
                  flex:1, display:"flex", flexDirection:"column", alignItems:"center",
                  justifyContent:"center", gap:3, background:"none", border:"none",
                  cursor:"pointer", position:"relative", padding:"8px 0",
                  borderTop: active ? `2px solid ${T.amber}` : "2px solid transparent",
                  transition:"all 0.15s ease",
                }}>
                {NAV_ICONS[id](active)}
                <span style={{
                  fontSize:10, fontWeight: active ? 700 : 500,
                  color: active ? T.amber : "#6b7280",
                  letterSpacing:0.3,
                }}>
                  {label}
                </span>
                {badge > 0 && (
                  <div style={{
                    position:"absolute", top:8, right:"25%",
                    minWidth:16, height:16, borderRadius:8,
                    background: badge > 0 && (id==="kitchen" ? kitchenAlert : invoiceAlert) > 0 ? "#ef4444" : "#d97706",
                    color:"#fff", fontSize:9, fontWeight:700,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    padding:"0 4px",
                  }}>
                    {badge}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AlertBanner({ children }) {
  return (
    <div style={{
      background:"#fff5f5", border:"1px solid #fca5a5", borderLeft:"4px solid #ef4444",
      borderRadius:6, padding:"12px 16px", marginBottom:16,
      display:"flex", alignItems:"flex-start", gap:12,
    }}>
      <div style={{ width:16, height:16, borderRadius:"50%", background:"#ef4444", flexShrink:0, marginTop:1 }} />
      <div>{children}</div>
    </div>
  );
}

function EmptyState({ title, subtitle }) {
  return (
    <div style={{ textAlign:"center", padding:"80px 20px", color:T.textMuted }}>
      <div style={{ width:48, height:48, border:`2px solid ${T.border}`, borderRadius:12, margin:"0 auto 16px", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ width:20, height:20, border:`2px solid ${T.border}`, borderRadius:4 }} />
      </div>
      <div style={{ fontSize:15, fontWeight:700, color:T.textPrimary, marginBottom:6 }}>{title}</div>
      <div style={{ fontSize:12, color:T.textMuted }}>{subtitle}</div>
    </div>
  );
}

function TabBtn({ label, badgeVal, badgeColor, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding:"10px 16px", border:"none", cursor:"pointer", fontWeight:600, fontSize:12,
      background:"transparent", color:active ? T.textPrimary : T.textMuted,
      borderBottom:`2px solid ${active ? T.amber : "transparent"}`,
      transition:"all .12s", fontFamily:T.font, whiteSpace:"nowrap",
      display:"flex", alignItems:"center", gap:6,
    }}>
      {label}
      {!!badgeVal && (
        <span style={{
          background: badgeColor || T.amber, color:"#fff",
          fontSize:9, fontWeight:800, borderRadius:10,
          padding:"1px 6px", minWidth:16, textAlign:"center",
        }}>
          {badgeVal}
        </span>
      )}
    </button>
  );
}

