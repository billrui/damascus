import { useState, useEffect, useRef } from "react";
import { MENU_CATEGORIES, TAX, SVC } from "../data";
import { fmt } from "../utils";
import { T, pillBtn, stepBtn, actionBtn, overlay } from "../posTheme";
import { useSocket } from "../hooks/useSocket.js";
import { useBreakpoint } from "../hooks/useBreakpoint.js";

const TABLES  = ["T01","T02","T03","T04","T05","T06","T07","T08","T09","T10","T11","T12","TAKEAWAY"];
const MAX_PAX = 8;

export default function WaiterPOS({ user, menuItems: propMenuItems, holdList, setHoldList, openInvoices, setOpenInvoices }) {

  // Normalize hold from backend snake_case → camelCase
  const normalizeHold = (h) => ({
    ...h,
    id:          String(h.id),
    table:       h.table ?? h.table_no ?? "TAKEAWAY",
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
    "invoice:paid": (p) => {
      const fromList = (openInvoices || []).find(i => String(i.id) === String(p?.id));
      const tbl = p?.table_no || p?.table || fromList?.table || fromList?.table_no;
      setOpenInvoices(prev => prev.filter(i => String(i.id) !== String(p?.id)));
      // The customer(s) on this paid bill have settled — clear their seats from the table
      if (fromList && tbl) {
        const paidPersons = [...new Set(parseItems(fromList.items)
          .map(it => (it.note||"").match(/^\[([^\]]+)\]/)?.[1])
          .filter(Boolean))];
        if (paidPersons.length) {
          setPersons(prev => {
            const cur = prev[tbl] || [];
            const upd = cur.filter(pid => !paidPersons.includes(pid));
            return { ...prev, [tbl]: upd };
          });
          setCarts(prev => {
            const n = { ...prev };
            paidPersons.forEach(pid => { delete n[key(tbl, pid)]; });
            return n;
          });
        }
      }
      if (!tbl) return;
      setPaidTables(prev => ({ ...prev, [tbl]: true }));
      const ts = Date.now();
      setPaidFlash(prev => [...prev.filter(f => f.table !== tbl), { table: tbl, ts }]);
      setTimeout(() => setPaidFlash(prev => prev.filter(f => f.ts !== ts)), 4500);
    },
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

  const [rightTab,   setRightTab]   = useState("menu");
  const { mobile } = useBreakpoint();
  const [mScreen, setMScreen] = useState("tables");  // mobile nav: tables|order|cart|ready|bills
  const [heldOrders, setHeldOrders] = useState([]);  // local only — never sent to backend
  const [addMoreTarget, setAddMoreTarget] = useState(null); // {hold, person, items}
  const [editHold,   setEditHold]   = useState(null);
  const [noteTarget,   setNoteTarget]   = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null); // hold to cancel
  const [noteText,   setNoteText]   = useState("");

  // ── Manager-override state for Cancel Order ────────────────────────────────────
  // Waiters/cashiers must have a supervisor authorize a cancellation; managers
  // and admins cancel directly. (Once usePermission lands, swap the role check
  // for a can_void_item check.)
  const needsOverride = !["admin", "manager"].includes(user.role);
  const [overridePin,  setOverridePin]  = useState("");
  const [overrideErr,  setOverrideErr]  = useState("");
  const [overrideBusy, setOverrideBusy] = useState(false);

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
    if (tPersons.length === 0) {
      setPersons(p => ({ ...p, [t]: ["P1"] }));   // every table starts with P1
      setPerson("P1");
    } else {
      setPerson(tPersons[0]);
    }
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
    closeCancel();
  };

  // Reset the cancel modal and any override entry
  const closeCancel = () => {
    setCancelTarget(null);
    setOverridePin("");
    setOverrideErr("");
    setOverrideBusy(false);
  };

  // Waiter/cashier path: verify a supervisor PIN, then cancel
  const authorizeAndCancel = async () => {
    if (overrideBusy) return;
    setOverrideErr("");
    setOverrideBusy(true);
    try {
      const { authApi } = await import("../api/index.js");
      await authApi.authorize(overridePin, "cancel_order");
      // authorize throws on a bad PIN (401) — reaching here means approved
      await cancelHold(cancelTarget.id);
    } catch (e) {
      setOverrideErr("Invalid manager PIN");
      setOverrideBusy(false);
    }
  };

  // ── Build Bill (table-level) ───────────────────────────────────────────────────
  // Default flow is SPLIT: persons start unassigned and the waiter groups whoever's
  // paying together. "Whole table" / "Each separately" are secondary shortcuts. The
  // whole table is billed in one session, so no partial-billing state persists.
  const [billTarget,    setBillTarget]    = useState(null);  // { table, persons:[{person,items,subtotal}] }
  const [customSel,     setCustomSel]     = useState([]);    // person ids ticked for the next bill
  const [composedBills, setComposedBills] = useState([]);    // [{ id, personIds, items, subtotal, total }]
  const [billMode,      setBillMode]      = useState("separate"); // separate | together
  const [billBusy,      setBillBusy]      = useState(false);
  const [billErr,       setBillErr]       = useState("");

  // Recovery — recall a billed (but unpaid) table (manager PIN required)
  const [lastBilled,   setLastBilled]   = useState(null);  // { table } — recently sent, for the undo toast
  const [recallTarget, setRecallTarget] = useState(null);  // table currently being recalled (drives PIN modal)
  const [recallPin,    setRecallPin]    = useState("");
  const [recallErr,    setRecallErr]    = useState("");
  const [recallBusy,   setRecallBusy]   = useState(false);
  const undoTimer = useRef(null);

  // Awaiting Payment tab
  const [awaitSearch, setAwaitSearch] = useState("");
  const [paidFlash,   setPaidFlash]   = useState([]);   // [{ table, ts }] transient PAID ✓ rows
  const [paidTables,  setPaidTables]  = useState({});   // { table: true } — a bill was paid this session (blocks recall)

  const parseItems = (raw) => Array.isArray(raw) ? raw
    : (()=>{try{return JSON.parse(raw||"[]")}catch{return []}})();

  const personSort = (a,b) => {
    const na = parseInt(String(a.person).replace(/\D/g,""),10);
    const nb = parseInt(String(b.person).replace(/\D/g,""),10);
    if (isNaN(na)||isNaN(nb)) return String(a.person).localeCompare(String(b.person));
    return na - nb;
  };

  // Aggregate a table's READY (bumped) holds → persons with items, subtotal, and
  // the set of hold ids their items came from (so a bill can be recalled exactly).
  const tablePersonsData = (tbl) => {
    const holds = holdList.filter(h => h.status==="bumped" && (h.table||"TAKEAWAY")===tbl);
    const pMap = {}, pHolds = {}, order = [];
    holds.forEach(h => parseItems(h.items).forEach(i => {
      const m = (i.note||"").match(/^\[([^\]]+)\]/);
      const s = m ? m[1] : "P1";
      if (!pMap[s]) { pMap[s] = []; pHolds[s] = new Set(); order.push(s); }
      pMap[s].push(i);
      pHolds[s].add(h.id);
    }));
    return order.map(s => ({
      person: s,
      items:  pMap[s],
      holdIds: [...pHolds[s]],
      subtotal: pMap[s].reduce((a,i)=>a + i.price*i.qty, 0),
    })).sort(personSort);
  };

  const mkBill = (persons) => {
    const items   = persons.flatMap(p => p.items);
    const holdIds = [...new Set(persons.flatMap(p => p.holdIds || []))];
    const sub     = items.reduce((a,i)=>a + i.price*i.qty, 0);
    return {
      id:        "B" + Date.now() + Math.random().toString(36).slice(2,6),
      personIds: persons.map(p => p.person),
      items, holdIds, subtotal: sub, total: sub*(1+TAX+SVC),
    };
  };

  const openBill = (tbl) => {
    const persons = tablePersonsData(tbl);
    setBillTarget({ table: tbl, persons });
    setCustomSel([]);              // nobody ticked — waiter picks who to bill
    setBillMode("separate");
    setComposedBills([]);
    setBillErr("");
  };

  const closeBill = () => {
    setBillTarget(null); setComposedBills([]); setCustomSel([]); setBillMode("separate");
    setBillBusy(false); setBillErr("");
  };

  // Recompute the bills from who's ticked + whether they pay separately or together
  const recompose = (sel, mode, persons) => {
    const list = persons || (billTarget ? billTarget.persons : []);
    const chosen = list.filter(p => sel.includes(p.person));
    setComposedBills(mode === "together"
      ? (chosen.length ? [mkBill(chosen)] : [])
      : chosen.map(p => mkBill([p])));
  };

  const toggleBillPerson = (pid) => {
    const next = customSel.includes(pid) ? customSel.filter(x => x !== pid) : [...customSel, pid];
    setCustomSel(next);
    recompose(next, billMode);
  };

  const setBillModeAnd = (mode) => { setBillMode(mode); recompose(customSel, mode); };

  const unassigned = billTarget ? billTarget.persons.filter(p => !customSel.includes(p.person)) : [];

  const finishBilling = async () => {
    if (!billTarget || billBusy || composedBills.length===0) return;
    setBillBusy(true); setBillErr("");
    const tbl = billTarget.table;
    const billedHoldIds = new Set(composedBills.flatMap(b => b.holdIds || []));
    const invoiceIds = [];
    try {
      const { posApi } = await import("../api/index.js");
      for (const bill of composedBills) {
        const inv = await posApi.createInvoice({
          table_no: tbl,
          items:    bill.items,
          total:    bill.total,
          notes:    bill.personIds.join("+") + " — " + (tbl==="TAKEAWAY" ? "Takeaway" : "Table " + tbl),
          source_hold_ids: bill.holdIds,
        });
        if (inv?.id) {
          invoiceIds.push(inv.id);
          try { await posApi.printHold(String(inv.id)); }
          catch (e) { console.error("Prebill print failed:", e?.message); }
          setOpenInvoices(p => p.find(x => String(x.id) === String(inv.id))
            ? p
            : [{
                id: inv.id, table: tbl, waiter: user.name,
                items: bill.items, total: bill.total, holdIds: bill.holdIds,
                status: "open", createdAt: new Date().toISOString(),
              }, ...p]);
        }
      }
      // Mark billed ONLY the specific holds that went onto these bills.
      const holds = holdList.filter(h => h.status==="bumped" && (h.table||"TAKEAWAY")===tbl && billedHoldIds.has(h.id));
      for (const h of holds) {
        try { await posApi.updateHold(String(h.id), { status:"billed" }); } catch (_) {}
      }
      const markIds = new Set(holds.map(h => h.id));
      setHoldList(prev => prev.map(h => markIds.has(h.id) ? {...h, status:"billed"} : h));
      // Arm the undo window (recall needs a manager PIN)
      setPaidTables(p => { const n = {...p}; delete n[tbl]; return n; });  // fresh round clears any stale paid flag
      setLastBilled({ table: tbl });
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setLastBilled(null), 15000);
      closeBill();
    } catch (e) {
      console.error("Billing failed:", e?.message);
      setBillErr("Couldn't send bills — try again");
      setBillBusy(false);
    }
  };

  // Recall a single billed-but-unpaid BILL: void that invoice, and return to Ready
  // ONLY the specific kitchen orders that made up this bill — not every round the
  // person has been billed for. A bill shown here is unpaid, so it's always safe.
  const doRecall = async () => {
    if (!recallTarget || recallBusy) return;
    const inv = recallTarget;
    const tbl = inv.table || inv.table_no;
    setRecallErr(""); setRecallBusy(true);
    try {
      const { authApi, posApi } = await import("../api/index.js");
      await authApi.authorize(recallPin, "recall_bill");   // throws on bad PIN
      // The exact orders this bill came from: live (holdIds) or from hold_ref after reload.
      const billHoldIds = (inv.holdIds && inv.holdIds.length)
        ? inv.holdIds.map(String)
        : String(inv.holdId || inv.hold_ref || "").split(",").map(s => s.trim()).filter(Boolean);
      // Void the invoice
      try { await posApi.deleteHold(String(inv.id)); } catch (_) {}
      setOpenInvoices(p => p.filter(i => String(i.id) !== String(inv.id)));
      // Reopen ONLY this bill's holds
      const toReopen = holdList.filter(h =>
        h.status==="billed" && (h.table||"TAKEAWAY")===tbl && billHoldIds.includes(String(h.id)));
      for (const h of toReopen) {
        try { await posApi.updateHold(String(h.id), { status:"bumped" }); } catch (_) {}
      }
      const ids = new Set(toReopen.map(h => h.id));
      setHoldList(prev => prev.map(h => ids.has(h.id) ? {...h, status:"bumped"} : h));
      if (undoTimer.current) clearTimeout(undoTimer.current);
      setLastBilled(null);
      setRecallTarget(null); setRecallPin(""); setRecallBusy(false);
    } catch (e) {
      setRecallErr("Invalid manager PIN");
      setRecallBusy(false);
    }
  };

  // Awaiting Payment — open (unpaid) invoices grouped by table
  const awaitingByTable = (() => {
    const m = {}, order = [];
    (openInvoices||[]).forEach(inv => {
      const t = inv.table || inv.table_no || "TAKEAWAY";
      if (!m[t]) { m[t] = { table: t, invoices: [], total: 0 }; order.push(t); }
      m[t].invoices.push(inv);
      const v = Number(inv.finalTotal ?? inv.total ?? 0);
      m[t].total += Number.isFinite(v) ? v : 0;
    });
    return order.map(t => m[t]);
  })();

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

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{flex:1,display:"flex",flexDirection:mobile?"column":"row",overflow:"hidden",background:T.bg,fontFamily:T.font,color:T.textPrimary}}>

      {!mobile && (<>
      {/* ── LEFT PANEL ── */}
      <div style={{
        width: mobile ? "42%" : "clamp(320px,32vw,460px)",
        flexShrink: 0,
        display:"flex",flexDirection:"column",background:T.surface,
        borderRight:"1px solid "+T.border,
      }}>

        {/* Header */}
        <div style={{padding:"10px 12px",borderBottom:"1px solid "+T.border}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={{fontSize:13,fontWeight:800,color:T.amber}}>WAITER POS</div>
          </div>

          {/* Table grid — numbered tables in an even 4-column grid */}
          <div style={{display:"grid",gridTemplateColumns:mobile?"repeat(3,1fr)":"repeat(4,1fr)",gap:mobile?6:10}}>
            {TABLES.filter(t=>t!=="TAKEAWAY").map(t => {
              const hasPending = holdList.some(h=>h.table===t&&h.status==="pending");
              const hasBumped  = holdList.some(h=>h.table===t&&h.status==="bumped");
              const isActive   = table===t;
              return (
                <button key={t} onClick={()=>switchTable(t)} style={{
                  padding:mobile?"11px 2px":"16px 4px",borderRadius:8,cursor:"pointer",
                  fontSize:mobile?15:20,fontWeight:800,letterSpacing:"0.5px",whiteSpace:"nowrap",
                  border:"1px solid "+(isActive?T.amber:hasBumped?T.green:hasPending?T.amber+"55":T.border),
                  background:isActive?T.amber:hasBumped?T.green+"22":hasPending?T.amber+"15":T.card,
                  color:isActive?T.bg:hasBumped?T.green:hasPending?T.amber:T.textSecondary,
                }}>{t}</button>
              );
            })}
          </div>
          {/* TAKEAWAY — own full-width row */}
          {(() => {
            const t = "TAKEAWAY";
            const hasPending = holdList.some(h=>h.table===t&&h.status==="pending");
            const hasBumped  = holdList.some(h=>h.table===t&&h.status==="bumped");
            const isActive   = table===t;
            return (
              <button onClick={()=>switchTable(t)} style={{
                width:"100%",marginTop:10,padding:"16px 4px",borderRadius:8,cursor:"pointer",
                fontSize:18,fontWeight:800,letterSpacing:"1px",whiteSpace:"nowrap",fontFamily:T.font,
                border:"1px solid "+(isActive?T.amber:hasBumped?T.green:hasPending?T.amber+"55":T.border),
                background:isActive?T.amber:hasBumped?T.green+"22":hasPending?T.amber+"15":T.card,
                color:isActive?T.bg:hasBumped?T.green:hasPending?T.amber:T.textSecondary,
              }}>TAKEAWAY</button>
            );
          })()}
        </div>

        {/* Persons panel */}
        <div style={{flexShrink:0,maxHeight:260,overflowY:"auto",padding:"8px 12px",borderBottom:"1px solid "+T.border}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:10,fontWeight:700,color:T.textSecondary,letterSpacing:0.5}}>
              {table==="TAKEAWAY"?"TAKEAWAY":"TABLE "+table} — {tablePersons.length} PERSON{tablePersons.length!==1?"S":""}
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
            }}>{table==="TAKEAWAY"?"TAKEAWAY":table}</span>
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
      <div style={{flex:1,minHeight:0,display:"flex",flexDirection:"column",overflow:"hidden",background:T.bg}}>

        {/* Tab bar */}
        <div style={{
          display:"flex",alignItems:"center",
          background:T.surface,borderBottom:"1px solid "+T.border,
          padding:"0 14px",flexShrink:0,
        }}>
          {[["menu","Menu"],["myorders","Ready"],["awaiting","Awaiting Payment"],["held","Held"]].map(([tab,label])=>{
            const readyCount = holdList.filter(h=>h.status==="bumped").length;
            const heldCount  = heldOrders.length;
            const awaitCount = awaitingByTable.length;
            const badge = tab==="myorders"?readyCount:tab==="held"?heldCount:tab==="awaiting"?awaitCount:0;
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
                    background:tab==="held"?T.amber:tab==="awaiting"?T.red:T.green,color:"#fff",
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
            <div style={{display:"grid",gridTemplateColumns:`repeat(auto-fill,minmax(${mobile?95:140}px,1fr))`,gap:mobile?8:12}}>
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

        {/* ── READY VIEW (grouped by table) ── */}
        {rightTab==="myorders"&&(()=>{
          const readyHolds = holdList.filter(h=>h.status==="bumped");
          // Group ready holds by table, preserving first-seen order
          const byTable={}, tableOrder=[];
          readyHolds.forEach(h=>{
            const t=h.table||"TAKEAWAY";
            if(!byTable[t]){byTable[t]=[];tableOrder.push(t);}
            byTable[t].push(h);
          });
          return (
          <div style={{flex:1,overflowY:"auto",padding:16}}>
            {readyHolds.length===0?(
              <div style={{textAlign:"center",padding:"80px 0",color:T.textMuted}}>
                <div style={{fontSize:48,marginBottom:12}}>📋</div>
                <div style={{fontSize:15,fontWeight:600,marginBottom:6}}>No orders ready yet</div>
                <div style={{fontSize:12}}>Orders appear here automatically when kitchen marks them done</div>
              </div>
            ):(
              tableOrder.map(t=>{
                const persons=tablePersonsData(t);
                const tableTotal=persons.reduce((a,p)=>a+p.subtotal,0)*(1+TAX+SVC);
                const repHold=byTable[t][0];
                return (
                  <div key={t} style={{
                    background:T.card,border:"1px solid "+T.green,
                    borderTop:"3px solid "+T.green,
                    borderRadius:10,marginBottom:16,overflow:"hidden",
                  }}>
                    {/* Header — table + Bill action */}
                    <div style={{background:T.green+"18",padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                          <span style={{padding:"4px 12px",borderRadius:6,fontSize:15,fontWeight:900,letterSpacing:"0.5px",background:"#ea580c",color:"#fff",boxShadow:"0 1px 3px rgba(0,0,0,0.25)"}}>{t}</span>
                          <span style={{fontSize:12,fontWeight:700,color:T.green}}>✓ Ready</span>
                          <span style={{fontSize:11,color:T.textMuted}}>· {persons.length} person{persons.length!==1?"s":""}</span>
                        </div>
                        <div style={{fontSize:10,color:T.textMuted}}>{repHold.waiter||user.name} · {repHold.createdDate}</div>
                      </div>
                      <button onClick={()=>openBill(t)} style={{
                        padding:"8px 16px",borderRadius:6,border:"none",
                        background:"linear-gradient(135deg,"+T.green+",#047857)",
                        color:"#fff",fontWeight:700,fontSize:13,fontFamily:T.font,cursor:"pointer",
                      }}>🧾 Bill · {fmt(tableTotal)}</button>
                    </div>
                    {/* Per-person sections */}
                    {persons.map(({person:s,items:pItems,subtotal:pSub})=>{
                      const pGrand=pSub*(1+TAX+SVC);
                      return (
                        <div key={s} style={{borderTop:"1px solid "+T.border,padding:"10px 16px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                            <span style={{padding:"4px 14px",borderRadius:20,fontSize:13,fontWeight:900,letterSpacing:"0.5px",border:"none",background:"#2563eb",color:"#fff",boxShadow:"0 1px 3px rgba(0,0,0,0.25)"}}>{s}</span>
                            <button onClick={()=>setAddMoreTarget({hold:repHold, person:s, existing:pItems, extraCart:[]})} style={{
                              padding:"6px 12px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:700,
                              border:"1px solid "+T.amber,background:T.amber+"18",color:T.amber,fontFamily:T.font,
                            }}>➕ Add More</button>
                          </div>
                          {pItems.map((item,idx)=>{
                            const cleanNote=item.note?item.note.replace(/^\[[^\]]+\]\s*/,"").trim():"";
                            return (
                            <div key={idx} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"3px 0",borderBottom:idx<pItems.length-1?"1px solid "+T.border+"33":"none"}}>
                              <span style={{color:T.textSecondary}}>{item.qty}× {item.name}{cleanNote&&<span style={{color:T.amber,fontStyle:"italic"}}> · {cleanNote}</span>}</span>
                              <span style={{fontWeight:600,color:T.textPrimary}}>{fmt(item.price*item.qty)}</span>
                            </div>
                          );})}
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
          );
        })()}

        {/* ── AWAITING PAYMENT VIEW ── */}
        {rightTab==="awaiting"&&(()=>{
          const q = awaitSearch.trim().toLowerCase();
          const rows = awaitingByTable.filter(r => !q || String(r.table).toLowerCase().includes(q));
          return (
          <div style={{flex:1,overflowY:"auto",padding:14}}>
            {/* Search */}
            <input
              value={awaitSearch}
              onChange={e=>setAwaitSearch(e.target.value)}
              placeholder="Search table…"
              style={{width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:8,
                border:"1px solid "+T.border,background:T.card,color:T.textPrimary,
                fontSize:13,fontFamily:T.font,marginBottom:12}}
            />

            {/* Transient PAID ✓ confirmations */}
            {paidFlash.map(f=>(
              <div key={f.ts} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                background:T.green+"22",border:"1px solid "+T.green,borderRadius:8,padding:"10px 14px",marginBottom:8}}>
                <span style={{fontSize:13,fontWeight:800,color:T.green}}>✓ PAID · {f.table}</span>
                <span style={{fontSize:11,color:T.green}}>settled</span>
              </div>
            ))}

            {rows.length===0?(
              <div style={{textAlign:"center",padding:"70px 0",color:T.textMuted}}>
                <div style={{fontSize:44,marginBottom:12}}>💳</div>
                <div style={{fontSize:15,fontWeight:600,marginBottom:6}}>
                  {awaitSearch?"No matching table":"Nothing awaiting payment"}
                </div>
                <div style={{fontSize:12}}>Tables you've billed show here until the cashier settles them</div>
              </div>
            ):(
              rows.map(r=>{
                const partlyPaid = !!paidTables[r.table];
                return (
                  <div key={r.table} style={{
                    background:T.card,border:"1px solid "+T.red,borderTop:"3px solid "+T.red,
                    borderRadius:10,marginBottom:12,overflow:"hidden",
                  }}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,padding:"10px 14px",flexWrap:"wrap"}}>
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                          <span style={{padding:"3px 10px",borderRadius:5,fontSize:13,fontWeight:800,background:T.red,color:"#fff"}}>{r.table}</span>
                          <span style={{fontSize:12,fontWeight:700,color:T.red}}>Awaiting payment</span>
                        </div>
                        <div style={{fontSize:11,color:T.textMuted}}>
                          {r.invoices.length} bill{r.invoices.length!==1?"s":""} · {fmt(r.total)}
                          {partlyPaid&&<span style={{color:T.amber}}> · some paid</span>}
                        </div>
                      </div>
                    </div>
                    {/* Per-bill breakdown — each bill recallable on its own */}
                    {r.invoices.map((inv,i)=>{
                      const ppl = [...new Set((inv.items||[])
                        .map(it => (it.note||"").match(/^\[([^\]]+)\]/)?.[1])
                        .filter(Boolean))];
                      const label = ppl.length ? ppl.join(", ") : `Bill ${i+1}`;
                      return (
                      <div key={inv.id||i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,fontSize:12,color:T.textSecondary,padding:"8px 14px",borderTop:"1px solid "+T.border+"44"}}>
                        <span style={{fontWeight:600,color:T.textPrimary}}>{label}</span>
                        <div style={{display:"flex",alignItems:"center",gap:12}}>
                          <span style={{fontWeight:700}}>{fmt(Number(inv.finalTotal ?? inv.total ?? 0) || 0)}</span>
                          <button onClick={()=>{setRecallPin("");setRecallErr("");setRecallTarget(inv);}} style={{
                            padding:"5px 10px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:T.font,
                            border:"1px solid "+T.amber,background:T.amber+"18",color:T.amber,
                          }}>↩ Recall</button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
          );
        })()}

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
      </>)}

      {/* ══════════════════ MOBILE UI ══════════════════ */}
      {mobile && (() => {
        const C = { green:"#047857", green2:"#059669", red:"#dc2626", blue:"#2563eb", amber:"#d97706" };
        const tableTotal = (t) => holdList.filter(h=>h.status==="bumped"&&(h.table||"TAKEAWAY")===t)
          .reduce((s,h)=>s+(Number(h.total)||0),0);
        const cartSub = cart.reduce((s,i)=>s+i.price*i.qty,0);
        const cartCnt = cart.reduce((s,i)=>s+i.qty,0);

        // group bumped holds by table for Ready
        const readyTables = (() => {
          const m={}, ord=[];
          holdList.filter(h=>h.status==="bumped").forEach(h=>{
            const t=h.table||"TAKEAWAY"; if(!m[t]){m[t]=true;ord.push(t);}
          });
          return ord;
        })();

        const tabBar = (
          <div style={{flexShrink:0,background:T.surface,borderTop:"1px solid "+T.border,display:"flex",padding:"6px 0 8px"}}>
            {[["tables","🍽️","Order"],["ready","✅","Ready"],["held","⏸️","Held"],["bills","🧾","Bills"]].map(([id,ic,lb])=>{
              const on = id==="tables" ? ["tables","order","cart"].includes(mScreen) : mScreen===id;
              const badge = id==="ready" ? readyTables.length : id==="bills" ? awaitingByTable.length : id==="held" ? heldOrders.length : 0;
              return (
                <button key={id} onClick={()=>setMScreen(id==="tables"?"tables":id)} style={{
                  flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"none",border:"none",
                  cursor:"pointer",color:on?C.green:T.textMuted,fontWeight:700,fontSize:10,fontFamily:T.font,position:"relative",
                }}>
                  <span style={{fontSize:19}}>{ic}</span>{lb}
                  {badge>0&&<span style={{position:"absolute",top:-3,right:"50%",marginRight:-22,background:C.red,color:"#fff",fontSize:8,fontWeight:800,borderRadius:8,padding:"1px 5px"}}>{badge}</span>}
                </button>
              );
            })}
          </div>
        );

        return (
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:T.bg,position:"relative"}}>
            <div style={{flex:1,overflowY:"auto"}}>

              {/* ── TABLES ── */}
              {mScreen==="tables" && (
                <div style={{padding:16}}>
                  <div style={{fontSize:18,fontWeight:800,marginBottom:2,color:T.textPrimary}}>Select a table</div>
                  <div style={{fontSize:12,color:T.textMuted,marginBottom:16}}>Tap a table to start or continue an order</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                    {TABLES.filter(t=>t!=="TAKEAWAY").map(t=>{
                      const busy = holdList.some(h=>h.table===t&&(h.status==="bumped"||h.status==="pending"));
                      const active = table===t;
                      return (
                        <button key={t} onClick={()=>{switchTable(t);setMScreen("order");}} style={{
                          background:active?C.amber:busy?"#ecfdf5":T.surface,
                          border:"1.5px solid "+(active?C.amber:busy?C.green:T.border),borderRadius:14,
                          padding:"20px 4px",fontSize:22,fontWeight:800,letterSpacing:"0.5px",fontFamily:T.font,
                          color:active?"#fff":busy?C.green:T.textPrimary,cursor:"pointer",
                        }}>{t}{busy&&<div style={{fontSize:9,marginTop:3}}>●</div>}</button>
                      );
                    })}
                  </div>
                  <button onClick={()=>{switchTable("TAKEAWAY");setMScreen("order");}} style={{
                    marginTop:12,width:"100%",background:T.surface,border:"1.5px dashed "+C.amber,borderRadius:14,
                    padding:18,fontSize:16,fontWeight:800,letterSpacing:"1px",color:C.amber,cursor:"pointer",fontFamily:T.font,
                  }}>TAKEAWAY</button>
                </div>
              )}

              {/* ── ORDER (person tabs + menu list) ── */}
              {mScreen==="order" && (
                <div>
                  <div style={{position:"sticky",top:0,zIndex:5,background:T.surface,borderBottom:"1px solid "+T.border,padding:"10px 12px",display:"flex",alignItems:"center",gap:8}}>
                    <button onClick={()=>setMScreen("tables")} style={{width:38,height:38,borderRadius:10,border:"1px solid "+T.border,background:T.surface,fontSize:20,cursor:"pointer",flexShrink:0,color:T.textPrimary}}>‹</button>
                    <span style={{background:table==="TAKEAWAY"?C.amber:C.red,color:"#fff",fontWeight:800,fontSize:15,padding:"5px 12px",borderRadius:8,flexShrink:0}}>{table}</span>
                    <div style={{display:"flex",gap:6,overflowX:"auto",flex:1}}>
                      {(tablePersons.length?tablePersons:[person]).map(p=>(
                        <button key={p} onClick={()=>setPerson(p)} style={{
                          flexShrink:0,padding:"7px 14px",borderRadius:20,fontWeight:800,fontSize:13,border:"none",cursor:"pointer",
                          background:p===person?C.blue:"#eef0f3",color:p===person?"#fff":"#5a6170",fontFamily:T.font,
                        }}>{p}</button>
                      ))}
                    </div>
                    <button onClick={addPerson} style={{flexShrink:0,width:34,height:34,borderRadius:"50%",border:"1px dashed "+C.blue,background:T.surface,color:C.blue,fontSize:18,fontWeight:700,cursor:"pointer"}}>+</button>
                  </div>
                  <input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="Search menu…" style={{
                    margin:"12px 16px 4px",width:"calc(100% - 32px)",padding:"11px 14px",borderRadius:22,border:"1px solid "+T.border,
                    fontSize:14,background:T.surface,color:T.textPrimary,boxSizing:"border-box",fontFamily:T.font,outline:"none",
                  }}/>
                  <div style={{display:"flex",gap:8,overflowX:"auto",padding:"6px 16px 10px"}}>
                    {cats.map(c=>(
                      <button key={c.id} onClick={()=>{setCategory(c.id);setPage(0);}} style={{
                        flexShrink:0,fontSize:13,fontWeight:700,color:category===c.id?T.textPrimary:T.textMuted,
                        background:"none",border:"none",borderBottom:"2px solid "+(category===c.id?C.amber:"transparent"),
                        padding:"5px 2px",cursor:"pointer",whiteSpace:"nowrap",fontFamily:T.font,
                      }}>{c.label||c.name||c.id}</button>
                    ))}
                  </div>
                  <div style={{padding:"0 12px 120px"}}>
                    {filtered.map(item=>{
                      const q = cart.find(c=>c.id===item.id)?.qty||0;
                      return (
                        <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,background:T.surface,border:"1px solid "+T.border,borderRadius:14,padding:"12px 14px",marginBottom:9}}>
                          <div style={{width:40,height:40,borderRadius:10,background:T.card,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{item.emoji||"🍽"}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:14,fontWeight:700,color:T.textPrimary,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
                            <div style={{fontSize:13,color:C.amber,fontWeight:800}}>KES {fmt(item.price)}</div>
                          </div>
                          {q>0&&<span style={{minWidth:22,textAlign:"center",fontWeight:800,color:C.green,fontSize:15}}>{q}</span>}
                          <button onClick={()=>addToCart(item)} style={{width:38,height:38,borderRadius:11,border:"none",background:C.green,color:"#fff",fontSize:22,fontWeight:700,cursor:"pointer",flexShrink:0}}>+</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── CART / REVIEW ── */}
              {mScreen==="cart" && (
                <div>
                  <div style={{position:"sticky",top:0,zIndex:5,background:T.surface,borderBottom:"1px solid "+T.border,padding:"10px 12px",display:"flex",alignItems:"center",gap:10}}>
                    <button onClick={()=>setMScreen("order")} style={{width:38,height:38,borderRadius:10,border:"1px solid "+T.border,background:T.surface,fontSize:20,cursor:"pointer",color:T.textPrimary}}>‹</button>
                    <span style={{background:C.red,color:"#fff",fontWeight:800,fontSize:15,padding:"5px 12px",borderRadius:8}}>{table}</span>
                    <b style={{fontSize:15,color:T.textPrimary}}>Review · {person}</b>
                  </div>
                  <div style={{padding:16}}>
                    {cart.length===0 ? (
                      <div style={{textAlign:"center",color:T.textMuted,padding:"50px 0"}}>No items yet.<br/>Tap menu items to add them.</div>
                    ) : (<>
                      {cart.map(item=>(
                        <div key={item.id} style={{display:"flex",alignItems:"center",gap:10,background:T.surface,border:"1px solid "+T.border,borderRadius:12,padding:"10px 12px",marginBottom:8}}>
                          <div style={{flex:1,fontSize:14,fontWeight:600,color:T.textPrimary}}>{item.name}</div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <button onClick={()=>updateQty(item.id,-1)} style={{width:30,height:30,borderRadius:8,border:"1px solid "+T.border,background:T.surface,fontSize:16,fontWeight:700,cursor:"pointer",color:T.textPrimary}}>−</button>
                            <b style={{minWidth:18,textAlign:"center",color:T.textPrimary}}>{item.qty}</b>
                            <button onClick={()=>updateQty(item.id,1)} style={{width:30,height:30,borderRadius:8,border:"1px solid "+T.border,background:T.surface,fontSize:16,fontWeight:700,cursor:"pointer",color:T.textPrimary}}>+</button>
                          </div>
                          <div style={{fontSize:13,fontWeight:800,minWidth:62,textAlign:"right",color:T.textPrimary}}>KES {fmt(item.price*item.qty)}</div>
                        </div>
                      ))}
                      <div style={{background:T.surface,border:"1px solid "+T.border,borderRadius:14,padding:14,margin:"14px 0"}}>
                        {[["Subtotal",cartSub],["Tax 16%",cartSub*TAX],["Service 2%",cartSub*SVC]].map(([l,v])=>(
                          <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:T.textMuted,marginBottom:6}}><span>{l}</span><span>KES {fmt(v)}</span></div>
                        ))}
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:17,fontWeight:800,color:T.textPrimary,marginTop:8,paddingTop:10,borderTop:"1px solid "+T.border}}><span>Total</span><span>KES {fmt(cartSub*(1+TAX+SVC))}</span></div>
                      </div>
                      <div style={{display:"flex",gap:10}}>
                        <button onClick={handleHoldOrder} style={{flex:1,padding:14,borderRadius:13,border:"1.5px solid "+T.border,background:T.surface,fontWeight:800,fontSize:14,cursor:"pointer",color:T.textPrimary,fontFamily:T.font}}>Hold</button>
                        <button onClick={()=>{handleSendKitchen();setMScreen("order");}} style={{flex:2,padding:14,borderRadius:13,border:"none",background:"linear-gradient(135deg,"+C.green2+","+C.green+")",color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",fontFamily:T.font}}>Send to Kitchen ›</button>
                      </div>
                    </>)}
                  </div>
                </div>
              )}

              {/* ── READY ── */}
              {mScreen==="ready" && (
                <div style={{padding:14}}>
                  <div style={{fontSize:18,fontWeight:800,marginBottom:12,color:T.textPrimary}}>Ready to bill</div>
                  {readyTables.length===0 && <div style={{textAlign:"center",color:T.textMuted,padding:"50px 0"}}>No ready orders</div>}
                  {readyTables.map(t=>{
                    const tt = tableTotal(t);
                    const ppl = tablePersonsData(t);
                    const repHold = holdList.find(h=>h.status==="bumped"&&(h.table||"TAKEAWAY")===t);
                    return (
                      <div key={t} style={{background:T.surface,border:"1px solid "+C.green,borderRadius:12,marginBottom:14,overflow:"hidden"}}>
                        <div style={{background:C.green+"18",padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={{background:C.green,color:"#fff",fontWeight:800,fontSize:16,padding:"4px 12px",borderRadius:7}}>{t}</span>
                          <button onClick={()=>openBill(t)} style={{padding:"9px 16px",borderRadius:8,border:"none",background:"linear-gradient(135deg,"+C.green2+","+C.green+")",color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:T.font}}>🧾 Bill · {fmt(tt)}</button>
                        </div>
                        {ppl.map(p=>(
                          <div key={p.person} style={{padding:"10px 14px",borderTop:"1px solid "+T.border}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                              <span style={{background:C.blue,color:"#fff",fontWeight:800,fontSize:12,padding:"3px 12px",borderRadius:20}}>{p.person}</span>
                              <div style={{display:"flex",alignItems:"center",gap:10}}>
                                <span style={{fontSize:12,color:T.textMuted}}>KES {fmt(p.subtotal*(1+TAX+SVC))}</span>
                                <button onClick={()=>repHold&&setAddMoreTarget({hold:repHold,person:p.person,existing:p.items,extraCart:[]})} style={{padding:"6px 11px",borderRadius:6,border:"1px solid "+C.amber,background:C.amber+"18",color:C.amber,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:T.font}}>➕ Add More</button>
                              </div>
                            </div>
                            {p.items.map((it,k)=>(
                              <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:T.textSecondary,padding:"1px 0"}}>
                                <span>{it.qty}× {it.name}</span><span>{fmt(it.price*it.qty)}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── HELD ── */}
              {mScreen==="held" && (
                <div style={{padding:14}}>
                  <div style={{fontSize:18,fontWeight:800,marginBottom:12,color:T.textPrimary}}>Held orders</div>
                  {heldOrders.length===0 && <div style={{textAlign:"center",color:T.textMuted,padding:"50px 0"}}>No held orders<br/><span style={{fontSize:12}}>Tap "Hold order" while taking an order to park it here</span></div>}
                  {heldOrders.map(h=>{
                    const hItems = parseItems(h.items);
                    const hTotal = Number(h.total)||hItems.reduce((s,i)=>s+i.price*i.qty,0);
                    const hPerson = h._person || (hItems[0]?.note||"").match(/^\[([^\]]+)\]/)?.[1] || "P1";
                    return (
                      <div key={h.id} style={{background:T.surface,border:"1px solid "+C.amber,borderRadius:12,marginBottom:12,overflow:"hidden"}}>
                        <div style={{padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{background:C.amber,color:"#fff",fontWeight:800,fontSize:13,padding:"3px 11px",borderRadius:20}}>{hPerson}</span>
                            <span style={{fontSize:12,color:T.textMuted}}>{h.table||table} · {hItems.length} item{hItems.length!==1?"s":""} · KES {fmt(hTotal)}</span>
                          </div>
                        </div>
                        <div style={{padding:"0 14px 10px",fontSize:12,color:T.textSecondary}}>
                          {hItems.map((it,k)=><span key={k}>{it.qty}× {it.name}{k<hItems.length-1?", ":""}</span>)}
                        </div>
                        <div style={{display:"flex",gap:8,padding:"10px 14px",borderTop:"1px solid "+T.border}}>
                          <button onClick={async()=>{
                            setHeldOrders(p=>p.filter(x=>x.id!==h.id));
                            try {
                              const {posApi} = await import("../api/index.js");
                              const saved = await posApi.createHold({ table_no:h.table||table, items:hItems, total:hTotal });
                              setHoldList(p=>[{...h,id:saved.id,status:"pending"},...p]);
                            } catch(e){ console.error(e); }
                            setModal("kitchen_sent"); setTimeout(()=>setModal(null),1500);
                          }} style={{flex:2,padding:"11px",borderRadius:10,border:"none",background:"linear-gradient(135deg,"+C.green2+","+C.green+")",color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:T.font}}>Send to Kitchen ›</button>
                          <button onClick={()=>setHeldOrders(p=>p.filter(x=>x.id!==h.id))} style={{flex:1,padding:"11px",borderRadius:10,border:"1px solid "+C.red,background:C.red+"15",color:C.red,fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:T.font}}>Discard</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── BILLS (awaiting payment + recall) ── */}
              {mScreen==="bills" && (
                <div style={{padding:14}}>
                  <div style={{fontSize:18,fontWeight:800,marginBottom:12,color:T.textPrimary}}>Awaiting payment</div>
                  {awaitingByTable.length===0 && <div style={{textAlign:"center",color:T.textMuted,padding:"50px 0"}}>No bills awaiting payment</div>}
                  {awaitingByTable.map(r=>(
                    <div key={r.table} style={{background:T.surface,border:"1px solid "+C.red,borderRadius:12,marginBottom:14,overflow:"hidden"}}>
                      <div style={{padding:"12px 14px"}}>
                        <span style={{background:C.red,color:"#fff",fontWeight:800,fontSize:15,padding:"4px 12px",borderRadius:7}}>{r.table}</span>
                        <span style={{marginLeft:8,fontSize:12,color:T.textMuted}}>{r.invoices.length} bill{r.invoices.length!==1?"s":""} · {fmt(r.total)}</span>
                      </div>
                      {r.invoices.map((inv,i)=>{
                        const items = parseItems(inv.items);
                        const ppl=[...new Set(items
                          .map(it=>(it.note||"").match(/^\[([^\]]+)\]/)?.[1])
                          .filter(p=>p&&p!=="null"&&p!=="undefined"))];
                        const label = ppl.length?ppl.join(", "):`Bill ${i+1}`;
                        return (
                          <div key={inv.id||i} style={{padding:"10px 14px",borderTop:"1px solid "+T.border}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:6}}>
                              <span style={{fontWeight:800,color:T.textPrimary,fontSize:13}}>{label}</span>
                              <div style={{display:"flex",alignItems:"center",gap:10}}>
                                <span style={{fontWeight:800,color:T.textPrimary,fontSize:13}}>{fmt(Number(inv.finalTotal??inv.total??0)||0)}</span>
                                <button onClick={()=>{setRecallPin("");setRecallErr("");setRecallTarget(inv);}} style={{padding:"5px 10px",borderRadius:6,border:"1px solid "+C.amber,background:C.amber+"18",color:C.amber,fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:T.font}}>↩ Recall</button>
                              </div>
                            </div>
                            {items.map((it,k)=>(
                              <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:T.textSecondary,padding:"1px 0"}}>
                                <span>{it.qty}× {it.name}</span>
                                <span>{fmt(it.price*it.qty)}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

            </div>

            {/* pinned cart summary + Hold at the bottom (order screen with items) */}
            {mScreen==="order" && cartCnt>0 && (
              <div style={{position:"absolute",left:12,right:12,bottom:62,display:"flex",flexDirection:"column",gap:8}}>
                <button onClick={()=>setMScreen("cart")} style={{
                  background:C.green,color:"#fff",borderRadius:16,
                  padding:"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",
                  border:"none",boxShadow:"0 8px 22px rgba(4,120,87,.4)",fontFamily:T.font,
                }}>
                  <span style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{background:"#fff",color:C.green,width:26,height:26,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14}}>{cartCnt}</span>
                    <b style={{fontSize:15}}>View {person}'s order</b>
                  </span>
                  <span style={{fontWeight:800,fontSize:14}}>KES {fmt(cartSub*(1+TAX+SVC))} ›</span>
                </button>
                <button onClick={handleHoldOrder} style={{
                  width:"100%",background:T.surface,color:T.textPrimary,borderRadius:16,padding:"13px 18px",
                  border:"1.5px solid "+T.border,fontWeight:800,fontSize:14,cursor:"pointer",fontFamily:T.font,
                  boxShadow:"0 4px 14px rgba(0,0,0,.10)",
                }}>Hold order</button>
              </div>
            )}

            {tabBar}
          </div>
        );
      })()}

      {/* ── Build Bill Modal (split-default) ── */}
      {billTarget&&(
        <div style={overlay}>
          <div style={{background:T.surface,border:"1px solid "+T.border,borderRadius:14,padding:22,width:420,maxWidth:"92vw",maxHeight:"88vh",display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div style={{fontSize:16,fontWeight:800,color:T.textPrimary}}>Bill {billTarget.table}</div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:12,color:T.textMuted}}>{billTarget.persons.length} person{billTarget.persons.length!==1?"s":""}</span>
                <button onClick={closeBill} aria-label="Close" style={{
                  border:"none",background:"none",color:T.textMuted,cursor:"pointer",
                  fontSize:22,lineHeight:1,padding:"0 2px",fontFamily:T.font,
                }}>×</button>
              </div>
            </div>
            <div style={{fontSize:11,color:T.textMuted,marginBottom:14}}>Tick who to bill now. Anyone unticked stays open in Ready.</div>

            {/* Who to bill */}
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
              {billTarget.persons.map(p=>{
                const on=customSel.includes(p.person);
                return (
                  <button key={p.person} onClick={()=>toggleBillPerson(p.person)} style={{
                    display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"10px 12px",borderRadius:8,cursor:"pointer",fontFamily:T.font,
                    border:"1px solid "+(on?T.green:T.border),background:on?T.green+"15":T.card,
                  }}>
                    <span style={{fontSize:13,fontWeight:700,color:on?T.green:T.textMuted}}>{on?"☑":"☐"} {p.person}</span>
                    <span style={{fontSize:12,fontWeight:700,color:T.textSecondary}}>{fmt(p.subtotal*(1+TAX+SVC))}</span>
                  </button>
                );
              })}
            </div>

            {/* How the ticked people pay — only matters when 2+ are ticked */}
            {customSel.length>=2 && (
              <div style={{display:"flex",gap:8,marginBottom:14}}>
                <button onClick={()=>setBillModeAnd("separate")} style={{
                  flex:1,padding:"9px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:T.font,
                  border:"1px solid "+(billMode==="separate"?T.amber:T.border),
                  background:billMode==="separate"?T.amber+"18":"transparent",color:billMode==="separate"?T.amber:T.textSecondary,
                }}>Separate bills</button>
                <button onClick={()=>setBillModeAnd("together")} style={{
                  flex:1,padding:"9px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:T.font,
                  border:"1px solid "+(billMode==="together"?T.amber:T.border),
                  background:billMode==="together"?T.amber+"18":"transparent",color:billMode==="together"?T.amber:T.textSecondary,
                }}>One bill together</button>
              </div>
            )}

            {/* Preview */}
            <div style={{flex:1,overflowY:"auto",marginBottom:14,borderTop:"1px solid "+T.border,paddingTop:12}}>
              <div style={{fontSize:11,fontWeight:700,color:T.textSecondary,marginBottom:8}}>
                {composedBills.length===0?"Nothing selected":composedBills.length+" bill"+(composedBills.length!==1?"s":"")+" to send"}
              </div>
              {composedBills.map((b)=>(
                <div key={b.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:T.card,border:"1px solid "+T.border,borderRadius:8,padding:"10px 12px",marginBottom:6}}>
                  <div style={{fontSize:12,fontWeight:700,color:T.textPrimary}}>{b.personIds.join(" + ")}{b.personIds.length>1?" (together)":""}</div>
                  <span style={{fontSize:13,fontWeight:800,color:T.amber}}>{fmt(b.total)}</span>
                </div>
              ))}
              {unassigned.length>0 && composedBills.length>0 && (
                <div style={{fontSize:11,color:T.textMuted,marginTop:8}}>{unassigned.map(p=>p.person).join(", ")} stays open in Ready</div>
              )}
            </div>

            {billErr&&<div style={{fontSize:11,color:T.red,marginBottom:10}}>{billErr}</div>}

            {/* Actions */}
            <div style={{display:"flex",gap:8}}>
              <button onClick={closeBill} style={{...actionBtn(T.card),flex:1}}>Close</button>
              <button onClick={finishBilling}
                disabled={billBusy||composedBills.length===0}
                style={{
                  ...actionBtn(T.green),flex:2,color:"#fff",border:"none",
                  opacity:(billBusy||composedBills.length===0)?0.5:1,
                  cursor:(billBusy||composedBills.length===0)?"not-allowed":"pointer",
                }}>
                {billBusy?"Sending…":composedBills.length===1?"Print & Send 1 bill":"Print & Send "+composedBills.length+" bills"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Undo toast (after a bill is sent) ── */}
      {lastBilled&&!recallTarget&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:9000,
          background:T.surface,border:"1px solid "+T.border,borderRadius:10,padding:"10px 14px",
          display:"flex",alignItems:"center",gap:14,boxShadow:"0 6px 24px rgba(0,0,0,0.35)"}}>
          <span style={{fontSize:13,color:T.textPrimary,fontWeight:600}}>✓ Bill sent · {lastBilled.table}</span>
          <button onClick={()=>{setRightTab("awaiting");setLastBilled(null);}} style={{
            padding:"6px 12px",borderRadius:6,border:"1px solid "+T.amber,background:T.amber+"18",
            color:T.amber,fontWeight:700,fontSize:12,fontFamily:T.font,cursor:"pointer",
          }}>↩ Recall</button>
        </div>
      )}

      {/* ── Recall confirm (manager PIN) ── */}
      {recallTarget&&(()=>{
        const ppl = [...new Set((recallTarget.items||[])
          .map(it => (it.note||"").match(/^\[([^\]]+)\]/)?.[1]).filter(Boolean))];
        const who = ppl.length ? ppl.join(", ") : "bill";
        const where = recallTarget.table || recallTarget.table_no || "";
        return (
        <div style={overlay}>
          <div style={{background:T.surface,border:"1px solid "+T.border,borderRadius:14,padding:22,width:340,maxWidth:"92vw"}}>
            <div style={{fontSize:16,fontWeight:800,color:T.textPrimary,marginBottom:4}}>Recall {who} · {where}</div>
            <div style={{fontSize:11,color:T.textMuted,marginBottom:16}}>
              This pulls just this bill back from the cashier and returns {who}'s order to Ready. Other bills on the table are untouched. Manager authorization required.
            </div>
            <input
              type="password" inputMode="numeric" autoFocus value={recallPin}
              maxLength={4}
              onChange={e=>{setRecallPin(e.target.value.replace(/\D/g,"").slice(0,4));setRecallErr("");}}
              onKeyDown={e=>{if(e.key==="Enter"&&recallPin)doRecall();}}
              placeholder="Enter 4-digit manager PIN"
              style={{width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:8,
                border:"1px solid "+(recallErr?T.red:T.border),background:T.card,
                color:T.textPrimary,fontSize:14,letterSpacing:2,textAlign:"center",marginBottom:recallErr?6:16}}
            />
            {recallErr&&<div style={{fontSize:11,color:T.red,marginBottom:14}}>{recallErr}</div>}
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setRecallTarget(null);setRecallPin("");setRecallErr("");}} style={{...actionBtn(T.card),flex:1}}>Keep it</button>
              <button onClick={doRecall} disabled={!recallPin||recallBusy} style={{
                ...actionBtn(T.amber),flex:1,color:T.bg,border:"none",
                opacity:(!recallPin||recallBusy)?0.5:1,cursor:(!recallPin||recallBusy)?"not-allowed":"pointer",
              }}>{recallBusy?"Checking…":"Authorize & Recall"}</button>
            </div>
          </div>
        </div>
        );
      })()}

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

            {/* Manager override — required for waiters/cashiers */}
            {needsOverride&&(
              <div style={{marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:700,color:T.textSecondary,marginBottom:6}}>
                  Manager authorization required
                </div>
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  value={overridePin}
                  onChange={e=>{setOverridePin(e.target.value);setOverrideErr("");}}
                  onKeyDown={e=>{if(e.key==="Enter"&&overridePin)authorizeAndCancel();}}
                  placeholder="Enter manager PIN"
                  style={{
                    width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:8,
                    border:"1px solid "+(overrideErr?T.red:T.border),background:T.card,
                    color:T.textPrimary,fontSize:14,letterSpacing:2,textAlign:"center",
                  }}
                />
                {overrideErr&&(
                  <div style={{fontSize:11,color:T.red,marginTop:6}}>{overrideErr}</div>
                )}
              </div>
            )}

            <div style={{display:"flex",gap:8}}>
              <button onClick={closeCancel} style={{...actionBtn(T.card),flex:1}}>
                Keep Order
              </button>
              {needsOverride?(
                <button onClick={authorizeAndCancel}
                  disabled={!overridePin||overrideBusy}
                  style={{
                    ...actionBtn(T.red),flex:1,color:"#fff",border:"none",
                    opacity:(!overridePin||overrideBusy)?0.5:1,
                    cursor:(!overridePin||overrideBusy)?"not-allowed":"pointer",
                  }}>
                  {overrideBusy?"Checking…":"Authorize & Cancel"}
                </button>
              ):(
                <button onClick={()=>cancelHold(cancelTarget.id)} style={{
                  ...actionBtn(T.red),flex:1,color:"#fff",border:"none",
                }}>
                  Yes, Cancel
                </button>
              )}
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
