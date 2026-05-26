import { useState, useEffect } from "react";
import { MENU_CATEGORIES, TAX, SVC } from "../data";
import { d } from "../data";
import { fmt, deductStock } from "../utils";
import { Btn } from "../components/UI";
import { CustomerModal } from "../components/POSShared";

const ITEMS_PER_PAGE = 6;

export default function POSView({ 
  sales, setSales, batches, setBatches, user, holdList = [], setHoldList, 
  menuItems: propMenuItems, recipes, ingredients, openInvoices, setOpenInvoices,
  hhApplied, setHhApplied,
  hhDiscount, setHhDiscount,
}) {
  const isWaiter = user?.role === "waiter";
  const [cart, setCart] = useState([]);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState("cash");
  
  const [hhSchedule, setHhSchedule] = useState([
    { day: "Sunday", from: "08:00", to: "21:30", active: false },
    { day: "Monday", from: "08:00", to: "21:30", active: false },
    { day: "Tuesday", from: "08:00", to: "21:30", active: false },
    { day: "Wednesday", from: "08:00", to: "21:30", active: false },
    { day: "Thursday", from: "08:00", to: "12:26", active: false },
    { day: "Friday", from: "02:00", to: "04:30", active: false },
    { day: "Saturday", from: "08:00", to: "21:30", active: false },
  ]);
  const [hhCategory, setHhCategory] = useState("beverages");
  const [hhProduct, setHhProduct] = useState("all");
  const [hhDiscountType, setHhDiscountType] = useState("fixed");
  
  const [showHhPanel, setShowHhPanel] = useState(false);
  const [noteItemId, setNoteItemId] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [orderTimer, setOrderTimer] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [payDone, setPayDone] = useState(false);
  const [tableName, setTableName] = useState("WALK-IN -****-");
  const [page, setPage] = useState(0);
  const [showCustModal, setShowCustModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [tendered, setTendered] = useState("");

  useEffect(() => {
    const t = setInterval(() => setOrderTimer((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const ITEMS_SOURCE = propMenuItems || [];

  const getItemStock = (menuId) => {
    if (!recipes || !ingredients || !batches) return null;
    const recipe = recipes[menuId];
    if (!recipe || recipe.length === 0) return null;
    const portions = recipe.map(({ ingredientId, qty }) => {
      const available = batches
        .filter(b => b.ingredientId === ingredientId && b.status === "active")
        .reduce((s, b) => s + b.remaining, 0);
      return qty > 0 ? Math.floor(available / qty) : Infinity;
    });
    return Math.min(...portions);
  };
  
  const filtered = ITEMS_SOURCE.filter((item) => {
    const matchCat = category === "all" ? true : category === "bestseller" ? item.bestseller : item.category === category;
    return matchCat && item.name.toLowerCase().includes(search.toLowerCase());
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const pageItems = filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  const addToCart = (item) => setCart((p) => { 
    const ex = p.find((c) => c.id === item.id); 
    return ex ? p.map((c) => c.id === item.id ? { ...c, qty: c.qty + 1 } : c) : [...p, { ...item, qty: 1, note: "" }]; 
  });
  const updateQty = (id, delta) => setCart((p) => p.map((c) => c.id === id ? { ...c, qty: Math.max(0, c.qty + delta) } : c).filter((c) => c.qty > 0));
  const removeItem = (id) => setCart((p) => p.filter((c) => c.id !== id));
  const cartQty = (id) => cart.find((c) => c.id === id)?.qty || 0;

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const hhEligibleSubtotal = hhApplied ? cart
    .filter(c => hhProduct === "all" ? c.category === hhCategory : c.id === hhProduct)
    .reduce((s, c) => s + c.price * c.qty, 0) : 0;
  const discount = hhApplied
    ? (hhDiscountType === "percent" ? hhEligibleSubtotal * (hhDiscount / 100) : Math.min(hhDiscount, hhEligibleSubtotal))
    : 0;
  const taxable = subtotal - discount;
  const tax = taxable * TAX;
  const service = taxable * SVC;
  const grandTotal = taxable + tax + service;
  const totalQty = cart.reduce((s, c) => s + c.qty, 0);


  const handlePay = () => {
    setShowPayModal(false);
    setTendered("");
    setShowModal(true);
    setTimeout(() => {
      const newSale = {
        id: `INV-${String(Date.now()).slice(-6)}`,
        date: d(0),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        customer: tableName,
        table: null,
        items: cart.map((c) => ({ menuId: c.id, qty: c.qty })),
        total: Math.round(grandTotal),
        payment: payment,
        cashier: user?.name || "Staff",
      };
      setSales((p) => [...p, newSale]);
      deductStock(cart, setBatches, recipes);
      setPayDone(true);
    }, 1200);
  };

  const handleSendOrder = () => {
    setShowModal(true);
    setTimeout(() => {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const dateStr = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const holdEntry = {
        id: `HOLD-${Date.now()}`,
        createdBy: user?.name || "Waiter",
        total: grandTotal,
        customerName: tableName === "WALK-IN -****-" ? "WALK-IN" : tableName,
        createdDate: dateStr,
        items: cart.map((c) => ({ menuId: c.id, name: c.name, qty: c.qty, price: c.price })),
      };
      setHoldList((p) => [holdEntry, ...p]);
      setPayDone(true);
    }, 900);
  };

  const handleNewOrder = () => { 
    setShowModal(false); 
    setPayDone(false); 
    setCart([]); 
    setHhApplied(false); 
    setOrderTimer(0); 
  };

  const activeCats = MENU_CATEGORIES.filter((cat) => {
    if (cat.id === "all") return true;
    if (cat.id === "bestseller") return ITEMS_SOURCE.some((m) => m.bestseller);
    return ITEMS_SOURCE.some((m) => m.category === cat.id);
  });

  const TEAL = "#C5A059";
  const PURPLE = "#2C3E50";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#F5F2EB" }}>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT PANEL */}
        <div style={{ 
          flex: "0 0 48%", 
          display: "flex", 
          flexDirection: "column", 
          background: "#FFFFFF", 
          borderRight: "1px solid #E5E0D5", 
          overflow: "hidden" 
        }}>

          {/* Row 1: Table + Add customer */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px 8px", borderBottom: "1px solid #F0EDE6" }}>
            <select 
              value={tableName} 
              onChange={(e) => setTableName(e.target.value)}
              style={{ 
                flex: 1, 
                padding: "8px 12px", 
                border: "1px solid #E5E0D5", 
                borderRadius: 4, 
                fontSize: 12, 
                background: "#FFFFFF", 
                color: "#4A4A4A", 
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
              }}>
              {["WALK-IN -****-","Table T01","Table T02","Table T03","Table T04","Table T05","Table T06","Table T07","Table T08","Table T09","Table T10","Table T11","Table T12"].map((t) => <option key={t}>{t}</option>)}
            </select>
            <button 
              onClick={() => setShowCustModal(true)} 
              title="Add Customer"
              style={{ 
                width: 36, 
                height: 36, 
                border: "1px solid #E5E0D5", 
                borderRadius: 4, 
                background: "#FFFFFF", 
                cursor: "pointer", 
                fontSize: 14, 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                flexShrink: 0,
                color: "#C5A059",
              }}>
              -
            </button>
          </div>

          {/* Row 2: Date + Search */}
          <div style={{ display: "flex", gap: 8, padding: "8px 14px", borderBottom: "1px solid #F0EDE6" }}>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 8, 
              border: "1px solid #E5E0D5", 
              borderRadius: 4, 
              padding: "6px 10px", 
              flex: "0 0 44%", 
              background: "#FFFFFF" 
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <input 
                type="date" 
                defaultValue={new Date().toISOString().split("T")[0]}
                style={{ 
                  border: "none", 
                  outline: "none", 
                  fontSize: 11, 
                  color: "#4A4A4A", 
                  background: "transparent", 
                  width: "100%",
                  fontFamily: "'Inter', sans-serif",
                }} />
            </div>
            <div style={{ 
              flex: 1, 
              display: "flex", 
              alignItems: "center", 
              gap: 8, 
              border: "1px solid #E5E0D5", 
              borderRadius: 4, 
              padding: "6px 10px", 
              background: "#FFFFFF" 
            }}>
              <span style={{ fontSize: 11, color: "#7A7A7A", fontFamily: "monospace" }}>-</span>
              <input 
                value={search} 
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                placeholder="Search by name or code..."
                style={{ 
                  border: "none", 
                  outline: "none", 
                  fontSize: 11, 
                  flex: 1, 
                  background: "transparent", 
                  color: "#4A4A4A",
                  fontFamily: "'Inter', sans-serif",
                }} />
            </div>
          </div>

          {/* Cart table header */}
          <div style={{
            display: "grid", 
            gridTemplateColumns: "2.4fr 1fr 1.2fr 0.7fr 1.2fr 0.65fr 28px",
            background: "#C5A059", 
            color: "#FFFFFF", 
            fontSize: 10, 
            fontWeight: 600,
            padding: "10px 10px", 
            gap: 4, 
            alignItems: "center", 
            flexShrink: 0,
            letterSpacing: "0.5px",
          }}>
            <div>Item</div>
            <div style={{ textAlign: "center" }}>Qty</div>
            <div style={{ textAlign: "right" }}>Price</div>
            <div style={{ textAlign: "center" }}>Type</div>
            <div style={{ textAlign: "right" }}>Subtotal</div>
            <div style={{ textAlign: "right" }}>Tax</div>
            <button 
              onClick={() => setCart([])}
              style={{ 
                background: "#8B3A3A", 
                border: "none", 
                borderRadius: 4, 
                color: "#FFFFFF", 
                width: 22, 
                height: 22, 
                cursor: "pointer", 
                fontSize: 11, 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                fontWeight: 600 
              }}>
              -
            </button>
          </div>

          {/* Cart rows */}
          <div style={{ flex: 1, overflowY: "auto", background: "#FFFFFF" }}>
            {cart.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#7A7A7A" }}>
                <div style={{ 
                  width: 56, 
                  height: 56, 
                  borderRadius: "50%", 
                  background: "rgba(197, 160, 89, 0.1)", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  margin: "0 auto 12px" 
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C5A059" strokeWidth="1.5">
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <path d="M16 10a4 4 0 01-8 0"/>
                  </svg>
                </div>
                <div style={{ fontSize: 12, marginTop: 8, fontWeight: 500 }}>No items selected</div>
                <div style={{ fontSize: 10, marginTop: 2 }}>Tap items from the menu to add</div>
              </div>
            )}
            {cart.map((item, i) => {
              const rowTax = item.price * item.qty * TAX;
              const rowSub = item.price * item.qty;
              return (
                <div key={item.id} style={{
                  display: "grid", 
                  gridTemplateColumns: "2.4fr 1fr 1.2fr 0.7fr 1.2fr 0.65fr 28px",
                  padding: "8px 10px", 
                  gap: 4, 
                  alignItems: "center",
                  borderBottom: "1px solid #F0EDE6",
                  background: i % 2 === 0 ? "#FFFFFF" : "#F8F8F8",
                  fontSize: 11,
                }}>
                  <div style={{ fontWeight: 500, color: "#1A1A1A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <button 
                      onClick={() => updateQty(item.id, -1)} 
                      style={{ 
                        width: 20, 
                        height: 20, 
                        border: "1px solid #E5E0D5", 
                        borderRadius: 3, 
                        background: "#FFFFFF", 
                        cursor: "pointer", 
                        fontSize: 10, 
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}>
                      -
                    </button>
                    <span style={{ fontWeight: 600, color: "#4A4A4A", minWidth: 16, textAlign: "center" }}>{item.qty}</span>
                    <button 
                      onClick={() => updateQty(item.id, 1)} 
                      style={{ 
                        width: 20, 
                        height: 20, 
                        border: "none", 
                        borderRadius: 3, 
                        background: "#C5A059", 
                        cursor: "pointer", 
                        fontSize: 10, 
                        fontWeight: 700, 
                        color: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}>
                      +
                    </button>
                  </div>
                  <div style={{ textAlign: "right", color: "#4A4A4A" }}>{fmt(item.price)}</div>
                  <div style={{ textAlign: "center", color: "#7A7A7A", fontSize: 10 }}>Std</div>
                  <div style={{ textAlign: "right", fontWeight: 600, color: "#1A1A1A" }}>{fmt(rowSub)}</div>
                  <div style={{ textAlign: "right", color: "#7A7A7A" }}>{fmt(rowTax)}</div>
                  <button 
                    onClick={() => removeItem(item.id)} 
                    style={{ 
                      background: "none", 
                      border: "none", 
                      cursor: "pointer", 
                      color: "#8B3A3A", 
                      fontSize: 12, 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center" 
                    }}>
                    -
                  </button>
                </div>
              );
            })}
          </div>

          {/* BOTTOM TOTALS BAR - continued in next message */}
          <div style={{ borderTop: "1px solid #E5E0D5", background: "#F8F8F8", flexShrink: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", padding: "10px 14px", gap: 6, borderBottom: "1px solid #E5E0D5" }}>
              {[
                ["Total Items", totalQty, false],
                ["Subtotal", subtotal, true],
                [hhApplied ? "Happy Hour" : "Discount", discount, true],
                ["Grand Total", grandTotal, true],
              ].map(([label, val, isCurr]) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: "#7A7A7A", marginBottom: 2, letterSpacing: 0.5 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {isCurr
                      ? <><span style={{ fontSize: 8, color: "#7A7A7A" }}>KES </span><span style={{ color: label.includes("Discount") && discount > 0 ? "#2E7D64" : "#C5A059" }}>{val.toFixed(2)}</span></>
                      : <span style={{ color: "#4A4A4A" }}>{val}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Happy Hour Toggle Bar - shortened for brevity */}
            <div style={{ borderBottom: "1px solid #E5E0D5", background: showHhPanel ? "#FFFBEB" : "#F8F8F8" }}>
              <button
                onClick={() => setShowHhPanel(v => !v)}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "none", border: "none", cursor: "pointer" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 600, color: showHhPanel ? "#B8860B" : "#4A4A4A" }}>
                  <span>-</span> Happy Hour
                  {hhApplied && <span style={{ background: "#2E7D64", color: "#FFFFFF", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 4 }}>Active</span>}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: "#7A7A7A" }}>{showHhPanel ? "-" : "-"}</span>
                  {showHhPanel && (
                    <span onClick={e => { e.stopPropagation(); setShowHhPanel(false); }} style={{ fontSize: 12, color: "#7A7A7A", fontWeight: 600, lineHeight: 1, padding: "0 2px", cursor: "pointer" }}>-</span>
                  )}
                </span>
              </button>
            </div>

            {/* Action buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, padding: "12px 14px" }}>
              <button onClick={() => isWaiter ? handleSendOrder() : setShowPayModal(true)} disabled={cart.length === 0} style={{ padding: "10px 4px", borderRadius: 4, border: "none", cursor: cart.length === 0 ? "not-allowed" : "pointer", background: cart.length === 0 ? "#D1D5DB" : "#2E7D64", color: "#FFFFFF", fontWeight: 600, fontSize: 11, letterSpacing: 0.5, opacity: cart.length === 0 ? 0.5 : 1 }}>
                {isWaiter ? "Send Order" : "Payment"}
              </button>
              <button style={{ padding: "10px 4px", borderRadius: 4, border: "none", cursor: "pointer", background: "#B8860B", color: "#FFFFFF", fontWeight: 600, fontSize: 11, letterSpacing: 0.5 }}>Hold Order</button>
              <button onClick={() => setShowCustModal(true)} style={{ padding: "10px 4px", borderRadius: 4, border: "none", cursor: "pointer", background: "#C5A059", color: "#FFFFFF", fontWeight: 600, fontSize: 11, letterSpacing: 0.5 }}>Customer</button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#F5F2EB" }}>
          <div style={{ display: "flex", gap: 0, overflowX: "auto", background: "#E8EAED", borderBottom: "1px solid #E5E0D5", flexShrink: 0, padding: "10px 10px 0" }}>
            {activeCats.map((cat) => (
              <button key={cat.id} onClick={() => { setCategory(cat.id); setPage(0); }} style={{
                padding: "10px 20px", border: "none", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap", fontSize: 11,
                background: category === cat.id ? "#FFFFFF" : "#D0D3D8",
                color: category === cat.id ? "#1A1A1A" : "#555",
                borderTop: category === cat.id ? "2px solid #C5A059" : "2px solid transparent",
                borderRight: "1px solid #C9CDD4",
                borderLeft: "1px solid #C9CDD4",
                borderBottom: category === cat.id ? "none" : "1px solid #E5E0D5",
                transition: "all 0.12s",
                marginBottom: category === cat.id ? -1 : 0,
                fontFamily: "'Inter', sans-serif",
                letterSpacing: "0.5px",
              }}>
                {cat.label.toUpperCase()}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            <div style={{ flex: 1, padding: "14px", overflowY: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {pageItems.map((item) => {
                  const qty = cartQty(item.id);
                  const inCart = qty > 0;
                  const liveStock = getItemStock(item.id);
                  const stockColor = liveStock === null ? "#7A7A7A" : liveStock === 0 ? "#8B3A3A" : liveStock <= 3 ? "#B8860B" : "#2E7D64";
                  return (
                    <div key={item.id} onClick={() => addToCart(item)} style={{
                      borderRadius: 6, overflow: "hidden", cursor: "pointer",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                      border: `1px solid ${inCart ? TEAL : "transparent"}`,
                      transition: "all 0.15s",
                      background: "#FFFFFF",
                    }}>
                      <div style={{ background: "#F8F8F8", padding: "4px 10px", fontSize: 9, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #F0EDE6" }}>
                        <span style={{ color: stockColor, fontWeight: 600 }}>{liveStock === null ? "-" : liveStock === 0 ? "Out of Stock" : `Stock: ${liveStock}`}</span>
                        <span style={{ color: "#4A4A4A", fontWeight: 500 }}>KES {item.price}</span>
                      </div>
                      <div style={{ height: 95, background: inCart ? TEAL : PURPLE, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, position: "relative", transition: "background 0.2s" }}>
                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "2px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{item.emoji}</div>
                        <div style={{ color: "#FFFFFF", fontWeight: 600, fontSize: 10, textAlign: "center", padding: "0 6px", lineHeight: 1.2, letterSpacing: "0.3px" }}>{item.name.toUpperCase()}</div>
                        {inCart && <div style={{ position: "absolute", top: 6, right: 6, background: "#C5A059", color: "#FFFFFF", borderRadius: "50%", width: 20, height: 20, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{qty}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ width: 46, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "12px 5px", background: "#E0E2E6", borderLeft: "1px solid #C9CDD4" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} style={{ width: 36, height: 36, border: "1px solid #C9CDD4", borderRadius: 4, background: "#FFFFFF", cursor: page === 0 ? "not-allowed" : "pointer", fontSize: 14, color: page === 0 ? "#C9CDD4" : "#C5A059", display: "flex", alignItems: "center", justifyContent: "center", opacity: page === 0 ? 0.4 : 1 }}>-</button>
                <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{ width: 36, height: 36, border: "1px solid #C9CDD4", borderRadius: 4, background: "#FFFFFF", cursor: page >= totalPages - 1 ? "not-allowed" : "pointer", fontSize: 14, color: page >= totalPages - 1 ? "#C9CDD4" : "#C5A059", display: "flex", alignItems: "center", justifyContent: "center", opacity: page >= totalPages - 1 ? 0.4 : 1 }}>-</button>
              </div>
              <button onClick={() => { setCategory("all"); setSearch(""); setPage(0); }} style={{ width: 36, height: 36, border: "none", borderRadius: 4, background: "#2E7D64", cursor: "pointer", fontSize: 16, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>-</button>
            </div>
          </div>
        </div>
      </div>

      {/* NOTE MODAL */}
      {noteItemId !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "#FFFFFF", borderRadius: 8, padding: 24, width: 320, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Item Note</div>
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Special instructions..." style={{ width: "100%", height: 80, borderRadius: 4, border: "1px solid #E5E0D5", padding: 10, fontSize: 12, resize: "none", outline: "none", boxSizing: "border-box", fontFamily: "'Inter', sans-serif" }} />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <Btn variant="secondary" onClick={() => setNoteItemId(null)} style={{ flex: 1, fontSize: 11 }}>Cancel</Btn>
              <Btn onClick={() => { setCart((p) => p.map((c) => c.id === noteItemId ? { ...c, note: noteText } : c)); setNoteItemId(null); }} style={{ flex: 1, fontSize: 11 }}>Save</Btn>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT METHOD MODAL */}
      {showPayModal && (() => {
        const tenderedNum = parseFloat(tendered) || 0;
        const changeDue = tenderedNum - grandTotal;
        const quickAmounts = [
          Math.ceil(grandTotal / 100) * 100,
          Math.ceil(grandTotal / 500) * 500,
          Math.ceil(grandTotal / 1000) * 1000,
        ].filter((v, i, a) => a.indexOf(v) === i && v >= grandTotal).slice(0, 3);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90 }}>
            <div style={{ background: "#FFFFFF", borderRadius: 8, padding: 28, width: 400, boxShadow: "0 16px 32px rgba(0,0,0,0.15)" }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: "#1A1A1A", marginBottom: 4 }}>Payment</div>
              <div style={{ fontSize: 12, color: "#7A7A7A", marginBottom: 18 }}>Grand Total: <strong style={{ color: "#C5A059", fontSize: 14 }}>{fmt(grandTotal)}</strong></div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                {[["cash","Cash"],["card","Card"],["mpesa","M-Pesa"],["gift","Gift Card"]].map(([k, l]) => (
                  <button key={k} onClick={() => { setPayment(k); setTendered(""); }} style={{ padding: "10px 8px", borderRadius: 4, border: `1px solid ${payment === k ? "#C5A059" : "#E5E0D5"}`, background: payment === k ? "#FEF9F0" : "#FFFFFF", color: payment === k ? "#C5A059" : "#7A7A7A", fontWeight: 600, fontSize: 11, cursor: "pointer", transition: "all 0.15s" }}>{l}</button>
                ))}
              </div>

              {payment === "cash" && (
                <div style={{ background: "#F0FDF4", border: "1px solid #D1FAE5", borderRadius: 6, padding: "14px 16px", marginBottom: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#166534", marginBottom: 10, letterSpacing: 0.5 }}>Cash Calculator</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    {quickAmounts.map(amt => (<button key={amt} onClick={() => setTendered(String(amt))} style={{ flex: 1, padding: "6px 4px", borderRadius: 4, border: `1px solid ${tendered === String(amt) ? "#2E7D64" : "#D1FAE5"}`, background: tendered === String(amt) ? "#2E7D64" : "#FFFFFF", color: tendered === String(amt) ? "#FFFFFF" : "#166534", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>KES {amt.toLocaleString()}</button>))}
                    <button onClick={() => setTendered(String(Math.round(grandTotal)))} style={{ flex: 1, padding: "6px 4px", borderRadius: 4, border: "1px solid #D1FAE5", background: "#FFFFFF", color: "#166534", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>Exact</button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: "#166534", fontWeight: 600, whiteSpace: "nowrap" }}>Amount Tendered</label>
                    <input type="number" min={0} value={tendered} onChange={e => setTendered(e.target.value)} placeholder={`- ${Math.round(grandTotal)}`} style={{ flex: 1, padding: "8px 10px", border: "1px solid #86EFAC", borderRadius: 4, fontSize: 13, fontWeight: 600, outline: "none", textAlign: "right", fontFamily: "'Inter', monospace" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: changeDue >= 0 ? "#DCFCE7" : "#FEF2F2", borderRadius: 4, padding: "10px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: changeDue >= 0 ? "#166534" : "#8B3A3A" }}>Change Due</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: changeDue >= 0 ? "#2E7D64" : "#8B3A3A" }}>{tenderedNum > 0 ? (changeDue >= 0 ? fmt(changeDue) : "Short") : "-"}</span>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <Btn variant="secondary" onClick={() => { setShowPayModal(false); setTendered(""); }} style={{ flex: 1, fontSize: 11 }}>Cancel</Btn>
                <button onClick={handlePay} disabled={payment === "cash" && tenderedNum > 0 && changeDue < 0} style={{ flex: 2, padding: "11px", borderRadius: 4, border: "none", cursor: payment === "cash" && tenderedNum > 0 && changeDue < 0 ? "not-allowed" : "pointer", background: payment === "cash" && tenderedNum > 0 && changeDue < 0 ? "#D1D5DB" : "#2E7D64", color: "#FFFFFF", fontWeight: 600, fontSize: 12, letterSpacing: "0.5px" }}>Confirm Payment</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PROCESSING / SUCCESS MODAL */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#FFFFFF", borderRadius: 8, padding: "32px 28px", width: 320, textAlign: "center", boxShadow: "0 16px 32px rgba(0,0,0,0.15)" }}>
            {!payDone ? (
              <>
                <div style={{ fontSize: 36, marginBottom: 12, color: "#C5A059" }}>-</div>
                <div style={{ fontWeight: 600, fontSize: 15, color: "#1A1A1A" }}>{isWaiter ? "Sending Order..." : "Processing Payment..."}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 44, marginBottom: 8, color: "#2E7D64" }}>-</div>
                <div style={{ fontWeight: 700, fontSize: 17, color: "#2E7D64", marginBottom: 6 }}>{isWaiter ? "Order Sent to Kitchen" : "Payment Successful"}</div>
                <div style={{ fontSize: 11, color: "#7A7A7A", marginBottom: 4 }}>{fmt(grandTotal)} - {tableName}</div>
                {isWaiter && <div style={{ fontSize: 10, color: "#7A7A7A", background: "#FEF9F0", borderRadius: 4, padding: "6px 12px", marginBottom: 12 }}>Payment will be collected at the counter</div>}
                {!isWaiter && <div style={{ fontSize: 11, color: "#7A7A7A", marginBottom: 12 }}>{payment === "mpesa" ? "M-Pesa" : payment.charAt(0).toUpperCase() + payment.slice(1)}</div>}
                <Btn onClick={handleNewOrder} style={{ width: "100%", borderRadius: 4, padding: 12, fontSize: 12 }}>New Order</Btn>
              </>
            )}
          </div>
        </div>
      )}

      {/* CUSTOMER MODAL */}
      {showCustModal && (
        <CustomerModal
          onSelect={(c) => setTableName(c.name)}
          onClose={() => setShowCustModal(false)}
        />
      )}
    </div>
  );
}