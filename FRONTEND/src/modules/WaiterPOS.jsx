import { useState, useEffect } from "react";
import { MENU_CATEGORIES, TAX, SVC } from "../data";
import { fmt } from "../utils";
import { T, pillBtn, stepBtn, actionBtn, overlay } from "../posTheme";
import { useSocket } from "../hooks/useSocket.js";

const TABLES  = ["T01","T02","T03","T04","T05","T06","T07","T08","T09","T10","T11","T12","WALK-IN"];
const MAX_PAX = 8;

export default function WaiterPOS({ user, menuItems: propMenuItems, holdList, setHoldList, openInvoices, setOpenInvoices }) {

  // Normalize hold from backend snake_case → camelCase
  const normalizeHold = (h) => ({
    ...h,
    id:          String(h.id),
    table:       h.table ?? h.table_no ?? "Walk-in",
    waiter:      h.waiter ?? h.waiter_name ?? user?.name ?? "Staff",
    createdDate: h.createdDate ?? (h.created_at
      ? new Date(h.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})
      : new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})),
    items: Array.isArray(h.items) ? h.items
      : (()=>{try{return JSON.parse(h.items||"[]")}catch{return []}})(),
  });

  // Live updates from kitchen — when chef marks done, status becomes "bumped"
  // and order automatically appears in My Orders tab
  useSocket({
    "hold:created": (hold) => setHoldList(prev => {
      const n = normalizeHold(hold);
      if (prev.find(h => String(h.id) === String(n.id))) return prev;
      return [n, ...prev];
    }),
    "hold:updated": (hold) => {
      const n = normalizeHold(hold);
      setHoldList(prev => {
        const updated = prev.some(h => String(h.id) === String(n.id))
          ? prev.map(h => String(h.id) === String(n.id) ? { ...h, ...n } : h)
          : [n, ...prev];

        return updated;
      });
    },
    "hold:deleted": ({ id }) => setHoldList(prev => prev.filter(h => String(h.id) !== String(id))),
    "invoice:updated": (inv) => setOpenInvoices(prev => prev.map(i => i.id === inv.id ? inv : i)),
  });
  const ITEMS = propMenuItems || [];

  // Persons are managed manually — no auto-removal

  // Poll for bumped holds every 5s as fallback if socket misses the event
  useEffect(() => {
    const poll = async () => {
      try {
        const { posApi } = await import("../api/index.js");
        const fresh = await posApi.holds();
        if (!fresh?.length) return;
        setHoldList(prev => {
          // Merge fresh data — update statuses without losing local state
          return fresh.map(h => normalizeHold(h));
        });
      } catch(e) {}
    };
    poll(); // run immediately on mount
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  const [table,      setTable]      = useState("T01");
  const [person,     setPerson]     = useState("P1");
  const [persons,    setPersons]    = useState({});          // { "T01": ["P1","P2"] }
  const [carts,      setCarts]      = useState({});          // { "T01-P1": [items] }
  const [category,   setCategory]   = useState("all");
  const [search,     setSearch]     = useState("");
  const [page,       setPage]       = useState(0);
  const [modal,      setModal]      = useState(null);
  const [activeHold, setActiveHold] = useState(null);
  const [rightTab,   setRightTab]   = useState("menu");
  const [heldOrders, setHeldOrders] = useState([]);  // local only — never sent to backend
  const [addMoreTarget, setAddMoreTarget] = useState(null); // {hold, person, items}
  const [editHold,   setEditHold]   = useState(null);
  const [openOrders, setOpenOrders] = useState({});         // { holdId: true/false } collapsed state
  const [noteTarget,   setNoteTarget]   = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null); // hold to cancel
  const [noteText,   setNoteText]   = useState("");

  // ── helpers ──────────────────────────────────────────────────────────────────
  const key         = (t, p) => t + "||" + p;
  const tablePersons = persons[table] || [];
  const cart         = carts[key(table, person)] || [];

  const setCart = fn => setCarts(prev => ({
    ...prev,
    [key(table, person)]: typeof fn === "function" ? fn(prev[key(table, person)] || []) : fn,
  }));

  const switchTable = t => {
    setTable(t);
    const tPersons = persons[t] || [];
    setPerson(tPersons.length > 0 ? tPersons[0] : null);
    setSearch(""); setPage(0); setEditHold(null);
  };

  const addPerson = () => {
    const cur = persons[table] || [];
    if (cur.length >= MAX_PAX) return;
    const next = "P" + (cur.length + 1);
    const updated = [...cur, next];
    setPersons(p => ({ ...p, [table]: updated }));
    setPerson(next);
  };

  const removePerson = p => {
    const cur = persons[table] || [];
    const upd = cur.filter(x => x !== p);
    setPersons(prev => ({ ...prev, [table]: upd }));
    setCarts(prev => { const n = { ...prev }; delete n[key(table, p)]; return n; });
    if (person === p) setPerson(upd.length > 0 ? upd[0] : null);
  };

  const cancelHold = async (holdId) => {
    try {
      const { posApi } = await import("../api/index.js");
      await posApi.deleteHold(holdId);

      // Find which persons had items only in this hold
      setHoldList(prev => {
        const remaining = prev.filter(h => h.id !== holdId);

        return remaining;
      });
    } catch(e) { console.error(e); }
    setCancelTarget(null);
  };

  const addToCart  = item => setCart(p => { const ex = p.find(c => c.id===item.id); return ex ? p.map(c=>c.id===item.id?{...c,qty:c.qty+1}:c) : [...p,{...item,qty:1,note:""}]; });
  const updateQty  = (id,d) => setCart(p => p.map(c=>c.id===id?{...c,qty:Math.max(0,c.qty+d)}:c).filter(c=>c.qty>0));
  const removeItem = id => setCart(p => p.filter(c=>c.id!==id));
  const inCart     = id => cart.find(c=>c.id===id)?.qty||0;

  // All items across all persons for this table (for the send button)
  const allItems   = tablePersons.flatMap(p => (carts[key(table,p)]||[]).map(i=>({...i,person:p})));
  const subtotal   = allItems.reduce((s,c)=>s+c.price*c.qty, 0);
  const tax        = subtotal * TAX;
  const service    = subtotal * SVC;
  const grandTotal = subtotal + tax + service;

  // Orders for this table
  const tableHolds = holdList.filter(h => h.table===table && ["pending","bumped"].includes(h.status));

  const PER_PAGE  = 9;
  const cats      = MENU_CATEGORIES.filter(c => c.id==="all"||c.id==="bestseller" ? true : ITEMS.some(m=>m.category===c.id));
  const filtered  = ITEMS.filter(item => {
    const mc = category==="all"?true:category==="bestseller"?item.bestseller:item.category===category;
    return mc && item.name.toLowerCase().includes(search.toLowerCase());
  });
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const pageItems  = filtered.slice(page*PER_PAGE, (page+1)*PER_PAGE);

  // ── actions ───────────────────────────────────────────────────────────────────
  const handleSendKitchen = async () => {
    if (!cart.length) return;
    const tempId   = "HOLD-" + Date.now();
    // Build items for current person only — tag each with [P1], [P2] etc
    const items    = cart.map(item => ({
      menu_item_id: String(item.id || "0"),
      name:         item.name,
      qty:          Number(item.qty) || 1,
      price:        Number(item.price) || 0,
      note:         "[" + person + "] " + (item.note || ""),
    }));
    const cartSub   = cart.reduce((s,i) => s + i.price*i.qty, 0);
    const cartTax   = cartSub * TAX;
    const cartSvc   = cartSub * SVC;
    const cartTotal = cartSub + cartTax + cartSvc;
    const hold = {
      id:          tempId,
      table:       table,
      waiter:      user.name,
      createdDate: new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),
      items,
      total:       cartTotal,
      status:      "pending",
    };
    // Optimistic update
    setHoldList(p => [hold, ...p]);
    // Clear current person cart
    setCart([]);
    setModal("kitchen_sent");
    setTimeout(() => {
      setModal(null);
      // Auto-suggest next person if others have empty carts
      const allP = persons[table] || [];
      const nextEmpty = allP.find(p => p !== person && !(carts[key(table, p)]||[]).length);
      if (nextEmpty) setPerson(nextEmpty);
    }, 1200);
    try {
      const { posApi } = await import("../api/index.js");
      const saved = await posApi.createHold({
        table_no: table,
        items,
        total:    cartTotal,
        notes:    "Waiter: " + user.name,
      });
      setHoldList(p => p.map(h => h.id === tempId ? { ...h, id: saved.id } : h));
    } catch(e) { console.error("Send to kitchen failed:", e); }
  };

  const handleHoldOrder = () => {
    // Save cart locally as a held order — NOT sent to kitchen yet
    if (!cart.length) return;
    const holdId = "HELD-" + Date.now();
    const heldItems = cart.map(item => ({
      menu_item_id: String(item.id || "0"),
      name:         item.name,
      qty:          Number(item.qty) || 1,
      price:        Number(item.price) || 0,
      note:         "[" + person + "] " + (item.note || ""),
    }));
    const heldTotal = heldItems.reduce((s,i) => s + i.price*i.qty, 0);
    // Store in local heldOrders — never sent to backend so never overwritten
    setHeldOrders(p => [{
      id:          holdId,
      table:       table,
      waiter:      user.name,
      createdDate: new Date().toISOString(),
      items:       heldItems,
      total:       heldTotal,
      status:      "held",
      _person:     person,
    }, ...p]);
    setCart([]);
    setModal("held");
    setTimeout(() => setModal(null), 2000);
  };

  const handleAddToHold = async hold => {
    if (!cart.length) return;
    // Create a NEW separate hold for these items — keeps each send independent in kitchen
    const newItems = cart.map(c=>({
      menu_item_id:String(c.id), name:c.name, qty:c.qty, price:c.price,
      note:"["+person+"] "+(c.note||""),
    }));
    const newSub   = newItems.reduce((s,i)=>s+i.price*i.qty,0);
    const newTotal = newSub + newSub*TAX + newSub*SVC;
    const tempId   = "HOLD-" + Date.now();
    const newHold  = {
      id:          tempId,
      table:       hold.table || hold.table_no,
      waiter:      user.name,
      createdDate: new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),
      items:       newItems,
      total:       newTotal,
      status:      "pending",
    };
    setHoldList(p => [newHold, ...p]);
    setCart([]);
    setEditHold(null);
    setModal("kitchen_sent");
    setTimeout(()=>setModal(null),2200);
    try {
      const { posApi } = await import("../api/index.js");
      const saved = await posApi.createHold({
        table_no: hold.table || hold.table_no,
        items:    newItems,
        total:    newTotal,
        notes:    "Waiter: " + user.name,
      });
      setHoldList(p => p.map(h => h.id === tempId ? { ...h, id: saved.id } : h));
    } catch(e) { console.error("Add to kitchen failed:", e); }
  };

  const handleBill = async hold => {
    const hItems = Array.isArray(hold.items) ? hold.items
      : (()=>{try{return JSON.parse(hold.items||"[]")}catch{return []}})();
    const sub   = hItems.reduce((s,i)=>s+i.price*i.qty, 0);
    const tax   = sub * TAX;
    const svc   = sub * SVC;
    const total = sub + tax + svc;

    // 1. Print receipt directly to Xprinter XP-58 via network
    const token = localStorage.getItem("access_token");
    if (!token) {
      console.error("No token — please log in again");
    } else {
      try {
        const { posApi } = await import("../api/index.js");
        await posApi.printHold(String(hold.id), hold._person || null);
        console.log("✅ Receipt printed to Xprinter XP-58");
      } catch(printErr) {
        console.error("❌ Print failed:", printErr.response?.data || printErr.message);
        // Fallback — open PDF in browser if printer unreachable
        const BASE   = import.meta.env.VITE_API_URL || "http://localhost:3001";
        const person = hold._person ? `&person=${encodeURIComponent(hold._person)}` : "";
        window.open(`${BASE}/api/pos/holds/${hold.id}/prebill?token=${token}${person}`, "_blank");
      }
    }

    // 2. Send invoice to cashier
    const inv = {
      id:          "INV-"+String(Date.now()).slice(-6),
      holdId:      hold.id,
      _person:     hold._person || null,
      table:       hold.table,
      waiter:      hold.waiter || user.name,
      items:       hItems,
      subtotal:    sub, tax, service: svc, total,
      status:      "open",
      createdAt:   new Date().toISOString(),
      createdTime: new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),
    };

    setOpenInvoices(p => [inv, ...p]);
    setHoldList(p => p.map(h => String(h.id)===String(hold.id)
      ? {...h, status:"billed", invoiceId:inv.id} : h
    ));
    setActiveHold(null);
    setModal("bill_sent");
    setTimeout(() => setModal(null), 2500);

    try {
      const { posApi } = await import("../api/index.js");
      await posApi.updateHold(String(hold.id), { status:"billed" });
      const saved = await posApi.createInvoice({
        hold_id:  hold.id,
        table_no: hold.table,
        items:    hItems,
        total,
        notes:    (hold._person ? hold._person + " — " : "") + "Table " + hold.table,
      });
      // Replace local fake id with real DB id so socket dedup works correctly
      if (saved?.id) {
        setOpenInvoices(p => p.map(i =>
          i.id === inv.id ? { ...i, id: saved.id } : i
        ));
      }
    } catch(e) { console.error("Receipt error:", e.response?.data || e.message); }
  };

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{flex:1,display:"flex",overflow:"hidden",background:T.bg,fontFamily:T.font,color:T.textPrimary}}>

      {/* ── LEFT PANEL ── */}
      <div style={{width:"clamp(120px,35vw,340px)",display:"flex",flexDirection:"column",background:T.surface,borderRight:"1px solid "+T.border}}>

        {/* Header */}
        <div style={{padding:"10px 12px",borderBottom:"1px solid "+T.border}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={{fontSize:13,fontWeight:800,color:T.amber}}>WAITER POS</div>
            <div style={{fontSize:10,color:T.textMuted}}>{user.name} · {new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
          </div>

          {/* Table grid */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
            {TABLES.map(t => {
              const hasPending = holdList.some(h=>h.table===t&&h.status==="pending");
              const hasBumped  = holdList.some(h=>h.table===t&&h.status==="bumped");
              const isActive   = table===t;
              return (
                <button key={t} onClick={()=>switchTable(t)} style={{
                  padding:"4px 1px",borderRadius:5,cursor:"pointer",fontSize:9,fontWeight:700,
                  border:"1px solid "+(isActive?T.amber:hasBumped?T.green:hasPending?T.amber+"55":T.border),
                  background:isActive?T.amber:hasBumped?T.green+"22":hasPending?T.amber+"15":T.card,
                  color:isActive?T.bg:hasBumped?T.green:hasPending?T.amber:T.textSecondary,
                }}>{t==="WALK-IN"?"WALK":t}</button>
              );
            })}
          </div>
        </div>

        {/* Persons panel */}
        <div style={{flexShrink:0,maxHeight:260,overflowY:"auto",padding:"8px 12px",borderBottom:"1px solid "+T.border}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:10,fontWeight:700,color:T.textSecondary,letterSpacing:0.5}}>
              {table==="WALK-IN"?"WALK-IN":"TABLE "+table} — {tablePersons.length} PERSON{tablePersons.length!==1?"S":""}
            </div>
            {tablePersons.length>0&&tablePersons.length<MAX_PAX&&(
              <button onClick={addPerson} style={{
                padding:"4px 12px",borderRadius:12,fontSize:11,fontWeight:700,
                border:"1px solid "+T.amber,background:T.amber+"18",color:T.amber,cursor:"pointer",
              }}>+ Add</button>
            )}
          </div>

          {/* Empty state — no persons added yet */}
          {tablePersons.length===0&&(
            <div style={{textAlign:"center",padding:"30px 0"}}>
              <div style={{fontSize:32,marginBottom:8}}>🪑</div>
              <div style={{fontSize:12,color:T.textMuted,marginBottom:12}}>
                No persons at {table} yet
              </div>
              <button onClick={addPerson} style={{
                padding:"8px 20px",borderRadius:20,
                border:"1px solid "+T.amber,
                background:T.amber,color:T.bg,
                fontSize:12,fontWeight:700,cursor:"pointer",
              }}>+ Add Person</button>
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(70px,1fr))",gap:8,padding:"4px 0"}}>
            {tablePersons.map(p => {
              const pItems    = carts[key(table,p)]||[];
              const cartCount = pItems.reduce((s,i)=>s+i.qty,0);
              const cartTotal = pItems.reduce((s,i)=>s+i.price*i.qty,0);
              const isAct     = person===p;
              const PERSON_COLORS = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#06B6D4","#84CC16"];
              const pColor = PERSON_COLORS[tablePersons.indexOf(p) % PERSON_COLORS.length];
              const sentItems = tableHolds.filter(h=>h.status==="pending").flatMap(h=>{
                const hItems = Array.isArray(h.items)?h.items:(()=>{try{return JSON.parse(h.items||"[]")}catch{return []}})();
                return hItems.filter(i=>{ const m=(i.note||"").match(/^\[([^\]]+)\]/); return m?m[1]===p:p==="P1"; });
              });
              const sentCount = sentItems.reduce((s,i)=>s+i.qty,0);
              const hasItems  = cartCount>0||sentCount>0;

              return (
                <button key={p} onClick={()=>setPerson(p)} style={{
                  border:"2px solid "+(isAct?pColor:pColor+"80"),
                  borderRadius:10, overflow:"hidden",
                  background:isAct?pColor:pColor+"22",
                  cursor:"pointer", padding:"12px 6px",
                  display:"flex", flexDirection:"column",
                  alignItems:"center", gap:4,
                  transition:"all 0.15s",
                  fontFamily:T.font,
                  position:"relative",
                  boxShadow:isAct?`0 4px 12px ${pColor}60`:"none",
                  transform:isAct?"scale(1.06)":"scale(1)",
                }}>
                  {/* P label */}
                  <span style={{
                    fontSize:17, fontWeight:800,
                    color:isAct?"#fff":pColor,
                    letterSpacing:0.5,
                  }}>{p}</span>
                  {/* Status dot */}
                  <div style={{display:"flex",gap:3,flexWrap:"wrap",justifyContent:"center"}}>
                    {cartCount>0&&(
                      <span style={{
                        fontSize:8,padding:"1px 5px",borderRadius:8,
                        background:isAct?"rgba(255,255,255,0.25)":T.amber+"25",
                        color:isAct?"#fff":T.amber,fontWeight:700,
                      }}>{cartCount}</span>
                    )}
                    {sentCount>0&&(
                      <span style={{
                        fontSize:8,padding:"1px 5px",borderRadius:8,
                        background:isAct?"rgba(255,255,255,0.25)":T.green+"25",
                        color:isAct?"#fff":T.green,fontWeight:700,
                      }}>{sentCount}</span>
                    )}
                  </div>
                  {/* Remove × */}
                  {tablePersons.length>1&&(
                    <span onClick={e=>{e.stopPropagation();removePerson(p);}} style={{
                      position:"absolute",top:2,right:4,
                      fontSize:12,color:isAct?"rgba(255,255,255,0.7)":T.textMuted,
                      fontWeight:700,lineHeight:1,cursor:"pointer",
                    }}>×</span>
                  )}
                </button>
              );
            })}


          </div>
        </div>

        {/* Cart for current person */}
        {person&&(<>
        <div style={{
          padding:"8px 12px",
          background: editHold ? T.green+"12" : T.amber+"12",
          borderTop:"2px solid "+(editHold?T.green:T.amber),
          display:"flex",justifyContent:"space-between",alignItems:"center",
        }}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:10,fontWeight:600,color:T.textMuted}}>
              {editHold?"Adding to":"Taking order for"}
            </span>
            <span style={{
              padding:"4px 14px",borderRadius:20,fontSize:13,fontWeight:800,
              background:editHold?T.green:T.amber,
              color:T.bg,letterSpacing:0.5,
            }}>{person}</span>
            <span style={{
              padding:"2px 8px",borderRadius:5,fontSize:11,fontWeight:700,
              border:"1px solid "+T.border,background:T.card,color:T.textSecondary,
            }}>{table==="WALK-IN"?"WALK":table}</span>
          </div>
          <div style={{display:"flex",gap:6}}>
            {editHold&&<button onClick={()=>setEditHold(null)} style={{fontSize:11,color:T.red,background:"none",border:"none",cursor:"pointer",fontWeight:700}}>Cancel</button>}
            {!editHold&&cart.length>0&&<button onClick={()=>setCart([])} style={{fontSize:11,color:T.red,background:T.card,border:"1px solid "+T.border,borderRadius:4,cursor:"pointer",fontWeight:700,padding:"3px 10px"}}>Clear</button>}
          </div>
        </div>

        <div style={{maxHeight:160,overflowY:"auto",padding:"0 12px"}}>
          {cart.length===0?(
            <div style={{textAlign:"center",padding:"30px 0",color:T.textFaint}}>
              <div style={{fontSize:32}}>🍽</div>
              <div style={{fontSize:12,marginTop:8}}>{editHold?"Tap items to add to this order":"Tap items to add for "+person}</div>
            </div>
          ):cart.map(item=>(
            <div key={item.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid "+T.border}}>
              <div style={{fontSize:20,width:26,textAlign:"center"}}>{item.emoji||"🍽"}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
                {item.note&&<div style={{fontSize:10,color:T.amber,fontStyle:"italic"}}>📝 {item.note}</div>}
                <div style={{fontSize:11,color:T.textMuted}}>KES {fmt(item.price)}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <button onClick={()=>updateQty(item.id,-1)} style={stepBtn(T.card)}>-</button>
                <span style={{color:T.amber,fontWeight:800,fontSize:13,minWidth:16,textAlign:"center"}}>{item.qty}</span>
                <button onClick={()=>updateQty(item.id,1)} style={stepBtn(T.amber)}>+</button>
              </div>
              <div style={{textAlign:"right",minWidth:48}}>
                <div style={{fontSize:12,fontWeight:700}}>KES {fmt(item.price*item.qty)}</div>
                <button onClick={()=>{setNoteTarget(item.id);setNoteText(item.note||"");}} style={{fontSize:9,color:T.textMuted,background:"none",border:"none",cursor:"pointer"}}>note</button>
              </div>
              <button onClick={()=>removeItem(item.id)} style={{background:"none",border:"none",cursor:"pointer",color:T.textFaint,fontSize:14}}>×</button>
            </div>
          ))}
        </div>

        {/* Send button — always visible when cart has items */}
        {cart.length>0&&(
          <div style={{borderTop:"1px solid "+T.border,padding:"10px 14px",background:T.card}}>
            {!editHold&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
                {[["Subtotal",subtotal],["Tax 16%",tax],["Total",grandTotal]].map(([l,v])=>(
                  <div key={l} style={{textAlign:"center"}}>
                    <div style={{fontSize:9,color:T.textMuted,marginBottom:2}}>{l}</div>
                    <div style={{fontSize:l==="Total"?13:11,fontWeight:l==="Total"?800:600,color:l==="Total"?T.amber:T.textPrimary}}>KES {fmt(v)}</div>
                  </div>
                ))}
              </div>
            )}
            {editHold?(
              <button onClick={()=>handleAddToHold(editHold)} style={{width:"100%",padding:"11px",borderRadius:10,border:"none",cursor:"pointer",background:"linear-gradient(135deg,#059669,#047857)",color:"#fff",fontWeight:800,fontSize:13,fontFamily:T.font}}>
                ADD TO ORDER & SEND TO KITCHEN
              </button>
            ):(
              <div style={{display:"flex",gap:8}}>
                <button onClick={handleHoldOrder} style={{
                  flex:1, padding:"11px",borderRadius:10,cursor:"pointer",
                  border:"2px solid "+T.border,
                  background:T.card,color:T.textSecondary,
                  fontWeight:700,fontSize:12,fontFamily:T.font,
                }}>
                  Hold
                </button>
                <button onClick={handleSendKitchen} style={{
                  flex:2, padding:"11px",borderRadius:10,border:"none",cursor:"pointer",
                  background:"linear-gradient(135deg,"+T.amber+",#d97706)",
                  color:T.bg,fontWeight:800,fontSize:13,fontFamily:T.font,
                }}>
                  SEND {person} TO KITCHEN
                </button>
              </div>
            )}
          </div>
        )}
        </>)}
      </div>

      {/* ── RIGHT: Menu / My Orders — full viewport, tab-switched ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:T.bg}}>

        {/* Tab bar */}
        <div style={{
          display:"flex",alignItems:"center",
          background:T.surface,borderBottom:"1px solid "+T.border,
          padding:"0 14px",flexShrink:0,
        }}>
          {[["menu","Menu"],["myorders","My Orders"],["held","Held"]].map(([tab,label])=>{
            const readyCount = holdList.filter(h=>h.status==="bumped").length;
            const heldCount  = heldOrders.length;
            const badge = tab==="myorders"?readyCount:tab==="held"?heldCount:0;
            return (
              <button key={tab} onClick={()=>setRightTab(tab)} style={{
                padding:"11px 18px",border:"none",cursor:"pointer",
                fontWeight:700,fontSize:13,background:"transparent",fontFamily:T.font,
                color:rightTab===tab?T.textPrimary:T.textMuted,
                borderBottom:"3px solid "+(rightTab===tab?T.amber:"transparent"),
                transition:"all .12s",position:"relative",
              }}>
                {label}
                {badge>0&&(
                  <span style={{
                    position:"absolute",top:6,right:2,
                    background:tab==="held"?T.amber:T.green,color:"#fff",
                    borderRadius:"50%",width:17,height:17,fontSize:9,fontWeight:800,
                    display:"flex",alignItems:"center",justifyContent:"center",
                  }}>{badge}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── MENU VIEW ── */}
        {rightTab==="menu"&&(
          <>
          <div style={{background:T.surface,borderBottom:"1px solid "+T.border,padding:"10px 14px 0",flexShrink:0}}>
            <input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="Search menu..."
              style={{width:"100%",padding:"8px 14px",border:"1px solid "+T.border,borderRadius:20,fontSize:13,outline:"none",marginBottom:10,boxSizing:"border-box",background:T.card,color:T.textPrimary}}/>
            <div style={{display:"flex",gap:0,overflowX:"auto"}}>
              {cats.map(cat=>(
                <button key={cat.id} onClick={()=>{setCategory(cat.id);setPage(0);}} style={{
                  padding:"8px 14px",border:"none",cursor:"pointer",fontWeight:700,whiteSpace:"nowrap",fontSize:12,background:"transparent",
                  color:category===cat.id?T.textPrimary:T.textMuted,
                  borderBottom:"3px solid "+(category===cat.id?T.amber:"transparent"),
                  transition:"all .12s",fontFamily:T.font,
                }}>{cat.emoji} {cat.label}</button>
              ))}
            </div>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:14}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12}}>
              {pageItems.map(item=>{
                const q=inCart(item.id);
                return (
                  <div key={item.id} onClick={()=>addToCart(item)} style={{
                    background:T.card,border:"1px solid "+(q>0?T.amber:T.border),borderRadius:10,padding:12,
                    cursor:"pointer",textAlign:"center",transition:"border-color .12s",position:"relative",
                  }}>
                    {q>0&&<div style={{position:"absolute",top:6,right:6,background:T.amber,color:T.bg,borderRadius:"50%",width:20,height:20,fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{q}</div>}
                    <div style={{fontSize:30,marginBottom:6}}>{item.emoji||"🍽"}</div>
                    <div style={{fontSize:12,fontWeight:600,color:T.textPrimary,marginBottom:3,lineHeight:1.3}}>{item.name}</div>
                    <div style={{fontSize:12,fontWeight:700,color:T.amber}}>{fmt(item.price)}</div>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",justifyContent:"center",gap:12,marginTop:14,fontSize:12}}>
              <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{padding:"5px 14px",borderRadius:6,border:"1px solid "+T.border,background:T.card,cursor:"pointer",color:T.textMuted}}>← Prev</button>
              <span style={{color:T.textMuted,alignSelf:"center"}}>{page+1} / {Math.ceil(filtered.length/PER_PAGE)||1}</span>
              <button onClick={()=>setPage(p=>p+1)} disabled={(page+1)*PER_PAGE>=filtered.length} style={{padding:"5px 14px",borderRadius:6,border:"1px solid "+T.border,background:T.card,cursor:"pointer",color:T.textMuted}}>Next →</button>
            </div>
          </div>
          </>
        )}

        {/* ── MY ORDERS VIEW ── */}
        {rightTab==="myorders"&&(
          <div style={{flex:1,overflowY:"auto",padding:16}}>
            {holdList.filter(h=>h.status==="bumped").length===0?(
              <div style={{textAlign:"center",padding:"80px 0",color:T.textMuted}}>
                <div style={{fontSize:48,marginBottom:12}}>📋</div>
                <div style={{fontSize:15,fontWeight:600,marginBottom:6}}>No orders ready yet</div>
                <div style={{fontSize:12}}>Orders appear here automatically when kitchen marks them done</div>
              </div>
            ):(
              holdList.filter(h=>h.status==="bumped").map(h=>{
                const hItems=(Array.isArray(h.items)?h.items:(()=>{try{return JSON.parse(h.items||"[]")}catch{return []}})());
                const pMap={},pOrder=[];
                hItems.forEach(i=>{
                  const m=(i.note||"").match(/^\[([^\]]+)\]\s*/);
                  const s=m?m[1]:"P1";
                  if(!pMap[s]){pMap[s]=[];pOrder.push(s);}
                  pMap[s].push({...i,cleanNote:i.note?i.note.replace(/^\[[^\]]+\]\s*/,"").trim():""});
                });
                return (
                  <div key={h.id} style={{
                    background:T.card,border:"1px solid "+T.green,
                    borderTop:"3px solid "+T.green,
                    borderRadius:10,marginBottom:16,overflow:"hidden",
                  }}>
                    {/* Header */}
                    <div style={{background:T.green+"18",padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                          <span style={{padding:"3px 10px",borderRadius:5,fontSize:13,fontWeight:800,background:T.green,color:"#fff"}}>
                            {h.table||"Walk-in"}
                          </span>
                          <span style={{fontSize:12,fontWeight:700,color:T.green}}>✓ Ready</span>
                        </div>
                        <div style={{fontSize:10,color:T.textMuted}}>{h.waiter||user.name} · {h.createdDate}</div>
                      </div>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end"}}>
                        {pOrder.map(s=>(
                          <span key={s} style={{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,border:"1px solid "+T.green+"55",background:T.green+"18",color:T.green}}>{s}</span>
                        ))}
                      </div>
                    </div>
                    {/* Per-person sections */}
                    {pOrder.map((s,si)=>{
                      const pItems=pMap[s];
                      const pSub=pItems.reduce((sum,i)=>sum+i.price*i.qty,0);
                      const pGrand=pSub*(1+TAX+SVC);
                      return (
                        <div key={s} style={{borderTop:"1px solid "+T.border,padding:"10px 16px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                            <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,border:"1px solid "+T.green+"55",background:T.green+"15",color:T.green}}>{s}</span>
                            <div style={{display:"flex",gap:6}}>
                              {/* Add More — opens modal with existing order + mini menu */}
                              <button onClick={()=>setAddMoreTarget({hold:h, person:s, existing:pItems, extraCart:[]})} style={{
                                padding:"6px 12px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:700,
                                border:"1px solid "+T.amber,background:T.amber+"18",color:T.amber,
                                fontFamily:T.font,
                              }}>➕ Add More</button>
                              {/* Receipt — generate and send to cashier */}
                              <button onClick={()=>handleBill({...h,_person:s,items:pItems,total:pGrand})} style={{
                                padding:"6px 14px",borderRadius:6,border:"none",
                                background:"linear-gradient(135deg,"+T.green+",#047857)",
                                color:"#fff",fontWeight:700,fontSize:12,fontFamily:T.font,cursor:"pointer",
                              }}>🧾 Receipt</button>
                            </div>
                          </div>
                          {pItems.map((item,idx)=>(
                            <div key={idx} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"3px 0",borderBottom:idx<pItems.length-1?"1px solid "+T.border+"33":"none"}}>
                              <span style={{color:T.textSecondary}}>{item.qty}× {item.name}{item.cleanNote&&<span style={{color:T.amber,fontStyle:"italic"}}> · {item.cleanNote}</span>}</span>
                              <span style={{fontWeight:600,color:T.textPrimary}}>{fmt(item.price*item.qty)}</span>
                            </div>
                          ))}
                          <div style={{display:"flex",justifyContent:"space-between",marginTop:6,paddingTop:4,borderTop:"1px solid "+T.border+"44"}}>
                            <span style={{fontSize:11,color:T.textMuted}}>Total (incl. tax & service)</span>
                            <span style={{fontSize:13,fontWeight:800,color:T.amber}}>{fmt(pGrand)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── HELD ORDERS VIEW ── */}
        {rightTab==="held"&&(
          <div style={{flex:1,overflowY:"auto",padding:14}}>
            {heldOrders.length===0?(
              <div style={{textAlign:"center",padding:"48px 0",color:T.textMuted}}>
                <div style={{fontSize:40,marginBottom:12,color:T.textFaint}}>-</div>
                <div style={{fontSize:13,fontWeight:600,color:T.textSecondary}}>No held orders</div>
                <div style={{fontSize:11,marginTop:4}}>Tap Hold when taking an order to save it here</div>
              </div>
            ):(
              heldOrders.map(h=>{
                const hItems = Array.isArray(h.items)?h.items:[];
                const hTotal = hItems.reduce((s,i)=>s+(i.price||0)*i.qty,0);
                const hPerson = h._person || (hItems[0]?.note||"").match(/^\[([^\]]+)\]/)?.[1] || "P1";
                return (
                  <div key={h.id} style={{
                    background:T.card,border:"1px solid "+T.amber+"40",
                    borderRadius:8,marginBottom:10,overflow:"hidden",
                  }}>
                    <div style={{
                      background:T.amber+"12",padding:"8px 12px",
                      display:"flex",justifyContent:"space-between",alignItems:"center",
                      borderBottom:"1px solid "+T.amber+"25",
                    }}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{
                          padding:"3px 12px",borderRadius:20,fontSize:12,fontWeight:800,
                          background:T.amber,color:T.bg,
                        }}>{hPerson}</span>
                        <span style={{fontSize:11,color:T.textMuted}}>
                          {h.table||table} · Held
                        </span>
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={async()=>{
                          // Send held order to kitchen
                          setHeldOrders(p=>p.filter(x=>x.id!==h.id));
                          try {
                            const {posApi} = await import("../api/index.js");
                            const saved = await posApi.createHold({
                              table_no: h.table||table,
                              items: hItems,
                              total: hTotal,
                            });
                            setHoldList(p=>[{...h,id:saved.id,status:"pending"},...p]);
                            setHeldOrders(p=>p.filter(x=>x.id!==h.id));
                          } catch(e){ console.error(e); }
                          setModal("kitchen_sent");
                          setTimeout(()=>setModal(null),2000);
                        }} style={{
                          padding:"4px 12px",borderRadius:5,fontSize:11,fontWeight:700,
                          border:"1px solid "+T.amber,background:T.amber+"18",
                          color:T.amber,cursor:"pointer",
                        }}>Send to Kitchen</button>
                        <button onClick={()=>setHoldList(p=>p.filter(x=>x.id!==h.id))} style={{
                          padding:"4px 10px",borderRadius:5,fontSize:11,fontWeight:700,
                          border:"1px solid "+T.red,background:T.red+"18",
                          color:T.red,cursor:"pointer",
                        }}>Delete</button>
                      </div>
                    </div>
                    <div style={{padding:"8px 12px"}}>
                      {hItems.map((item,idx)=>(
                        <div key={idx} style={{
                          display:"flex",justifyContent:"space-between",
                          padding:"4px 0",fontSize:12,
                          borderBottom:idx<hItems.length-1?"1px solid "+T.border:"none",
                        }}>
                          <span style={{color:T.textSecondary}}>{item.qty}× {item.name}</span>
                          <span style={{fontWeight:600,color:T.textPrimary}}>KES {fmt(item.price*item.qty)}</span>
                        </div>
                      ))}
                      <div style={{textAlign:"right",fontSize:12,fontWeight:700,color:T.amber,marginTop:6}}>
                        Total: KES {fmt(hTotal)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>

      {/* ── Cancel Order Confirm Modal ── */}
      {cancelTarget&&(
        <div style={overlay}>
          <div style={{background:T.surface,border:"1px solid "+T.border,borderRadius:14,padding:24,width:320}}>
            <div style={{fontSize:16,fontWeight:800,color:T.red,marginBottom:8}}>Cancel Order?</div>
            <div style={{fontSize:12,color:T.textMuted,marginBottom:6}}>
              This will remove the order from the kitchen display.
            </div>
            {/* Show items being cancelled */}
            <div style={{background:T.card,borderRadius:8,padding:"8px 12px",marginBottom:16}}>
              {(Array.isArray(cancelTarget.items)?cancelTarget.items:(()=>{try{return JSON.parse(cancelTarget.items||"[]")}catch{return []}})()).map((item,i)=>(
                <div key={i} style={{fontSize:11,color:T.textSecondary,padding:"2px 0"}}>
                  {item.qty}× {item.name}
                </div>
              ))}
              <div style={{fontSize:12,fontWeight:700,color:T.amber,marginTop:4,textAlign:"right"}}>
                {fmt(cancelTarget.total)}
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setCancelTarget(null)} style={{...actionBtn(T.card),flex:1}}>
                Keep Order
              </button>
              <button onClick={()=>cancelHold(cancelTarget.id)} style={{
                ...actionBtn(T.red),flex:1,color:"#fff",border:"none",
              }}>
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Note Modal ── */}
      {noteTarget&&(
        <div style={overlay}>
          <div style={{background:T.surface,border:"1px solid "+T.border,borderRadius:14,padding:24,width:300}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>Add Note</div>
            <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="e.g. no onions, extra sauce"
              style={{width:"100%",height:80,borderRadius:10,border:"1px solid "+T.border,padding:10,fontSize:13,resize:"none",outline:"none",boxSizing:"border-box",background:T.card,color:T.textPrimary}}/>
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button onClick={()=>setNoteTarget(null)} style={actionBtn(T.card)}>Cancel</button>
              <button onClick={()=>{setCart(p=>p.map(c=>c.id===noteTarget?{...c,note:noteText}:c));setNoteTarget(null);}} style={{...actionBtn(T.amber),flex:1,color:T.bg}}>Save Note</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Bill Modal ── */}


      {/* ── Add More Modal ── */}
      {addMoreTarget&&(
        <div style={overlay}>
          <div style={{
            background:T.surface,border:"1px solid "+T.border,
            borderRadius:16,width:480,maxHeight:"80vh",
            display:"flex",flexDirection:"column",overflow:"hidden",
          }}>
            {/* Header */}
            <div style={{padding:"14px 18px",borderBottom:"1px solid "+T.border,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <div>
                <div style={{fontSize:14,fontWeight:800,color:T.amber}}>
                  Add More — {addMoreTarget.hold.table} · {addMoreTarget.person}
                </div>
                <div style={{fontSize:10,color:T.textMuted,marginTop:2}}>
                  Tap items below to add. Existing order stays unchanged.
                </div>
              </div>
              <button onClick={()=>setAddMoreTarget(null)} style={{background:"none",border:"none",color:T.textMuted,fontSize:20,cursor:"pointer"}}>×</button>
            </div>

            <div style={{flex:1,overflowY:"auto",padding:"12px 18px"}}>
              {/* Existing order (read-only) */}
              <div style={{fontSize:10,fontWeight:700,color:T.textMuted,marginBottom:6}}>EXISTING ORDER</div>
              {addMoreTarget.existing.map((item,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"3px 0",color:T.textMuted,borderBottom:"1px solid "+T.border+"33"}}>
                  <span>{item.qty}× {item.name}</span>
                  <span>{fmt(item.price*item.qty)}</span>
                </div>
              ))}

              {/* Extra items being added */}
              {addMoreTarget.extraCart.length>0&&(
                <>
                  <div style={{fontSize:10,fontWeight:700,color:T.amber,margin:"10px 0 6px"}}>ADDING NOW</div>
                  {addMoreTarget.extraCart.map((item,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12,padding:"3px 0",borderBottom:"1px solid "+T.border+"33"}}>
                      <span style={{color:T.textPrimary}}>{item.qty}× {item.name}</span>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{color:T.amber,fontWeight:600}}>{fmt(item.price*item.qty)}</span>
                        <button onClick={()=>setAddMoreTarget(prev=>({...prev,extraCart:prev.extraCart.filter((_,idx)=>idx!==i)}))}
                          style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:13,fontWeight:700}}>×</button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Mini menu grid */}
              <div style={{fontSize:10,fontWeight:700,color:T.textMuted,margin:"12px 0 8px"}}>MENU</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {ITEMS.filter(i=>i.active!==false).map(item=>{
                  const inExtra = addMoreTarget.extraCart.find(e=>e.id===item.id);
                  return (
                    <div key={item.id} onClick={()=>setAddMoreTarget(prev=>{
                      const ex = prev.extraCart.find(e=>e.id===item.id);
                      return {...prev, extraCart: ex
                        ? prev.extraCart.map(e=>e.id===item.id?{...e,qty:e.qty+1}:e)
                        : [...prev.extraCart,{...item,qty:1,note:""}]
                      };
                    })} style={{
                      background:T.card,border:"1px solid "+(inExtra?T.amber:T.border),
                      borderRadius:8,padding:"8px 6px",cursor:"pointer",textAlign:"center",
                      position:"relative",
                    }}>
                      {inExtra&&<div style={{position:"absolute",top:4,right:4,background:T.amber,color:T.bg,borderRadius:"50%",width:16,height:16,fontSize:9,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{inExtra.qty}</div>}
                      <div style={{fontSize:20,marginBottom:3}}>{item.emoji||"🍽"}</div>
                      <div style={{fontSize:10,fontWeight:600,color:T.textPrimary,lineHeight:1.2,marginBottom:2}}>{item.name}</div>
                      <div style={{fontSize:10,fontWeight:700,color:T.amber}}>{fmt(item.price)}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer — send button */}
            <div style={{padding:"12px 18px",borderTop:"1px solid "+T.border,flexShrink:0}}>
              {addMoreTarget.extraCart.length===0?(
                <div style={{textAlign:"center",fontSize:12,color:T.textMuted,padding:"4px 0"}}>
                  Tap items above to add to this order
                </div>
              ):(
                <button onClick={async()=>{
                  const extras = addMoreTarget.extraCart;
                  const person = addMoreTarget.person;
                  const hold   = addMoreTarget.hold;
                  const items  = extras.map(item=>({
                    menu_item_id: String(item.id||"0"),
                    name:  item.name,
                    qty:   item.qty,
                    price: item.price,
                    note:  "["+person+"] ",
                  }));
                  const sub   = extras.reduce((s,i)=>s+i.price*i.qty,0);
                  const total = sub*(1+TAX+SVC);
                  setAddMoreTarget(null);
                  setModal("kitchen_sent");
                  setTimeout(()=>setModal(null),2200);
                  try {
                    const { posApi } = await import("../api/index.js");
                    // Tag new items as [EXTRA] so kitchen knows these are additions
                    const taggedItems = items.map(i => ({
                      ...i,
                      note: "["+addMoreTarget.person+"] [EXTRA] " + (i.note||"").replace(/^\[[^\]]+\]\s*/,"").trim(),
                    }));
                    const updated = await posApi.appendHold(String(hold.id), taggedItems);
                    setHoldList(p => p.map(h =>
                      String(h.id) === String(hold.id) ? normalizeHold({...updated, status:"pending"}) : h
                    ));
                  } catch(e){ console.error(e); }
                }} style={{
                  width:"100%",padding:"11px",borderRadius:10,border:"none",cursor:"pointer",
                  background:"linear-gradient(135deg,"+T.amber+",#d97706)",
                  color:T.bg,fontWeight:800,fontSize:13,fontFamily:T.font,
                }}>
                  🍳 Send {addMoreTarget.extraCart.reduce((s,i)=>s+i.qty,0)} item{addMoreTarget.extraCart.reduce((s,i)=>s+i.qty,0)!==1?"s":""} to Kitchen
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {(modal==="kitchen_sent"||modal==="bill_sent")&&(
        <div style={{position:"fixed",bottom:32,left:"50%",transform:"translateX(-50%)",background:modal==="bill_sent"?T.green:T.amber,color:modal==="bill_sent"?"#fff":T.bg,borderRadius:12,padding:"13px 26px",fontSize:14,fontWeight:700,boxShadow:"0 8px 32px rgba(0,0,0,.4)",zIndex:999}}>
          {modal==="kitchen_sent"?"🍳 Order sent to kitchen!":"✓ Invoice sent to cashier!"}
        </div>
      )}
    </div>
  );
}
