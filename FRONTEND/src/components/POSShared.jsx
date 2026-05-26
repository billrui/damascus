/**
 * POSShared.jsx
 * Shared components used across CashierPOS, ManagerPOS, and POSView.
 * Import from here - do NOT duplicate these in individual POS modules.
 */
import { useState } from "react";
import { fmt } from "../utils";
import { T, actionBtn, overlay, modal as modalStyle } from "../posTheme";

// --- Receipt Modal ------------------------------------------------------------
// Single canonical receipt UI shared by CashierPOS and ManagerPOS.
export function ReceiptModal({ invoice, payMethod, tendered, change, onClose }) {
  const total = invoice.finalTotal ?? invoice.total;
  const now   = new Date();
  return (
    <div style={overlay}>
      <div style={{
        background: "#FFFFFF",
        borderRadius: 8,
        width: 360,
        overflow: "hidden",
        boxShadow: "0 20px 40px rgba(0,0,0,0.15)"
      }}>
        {/* Receipt header */}
        <div style={{ background: "#1A1A1A", padding: "20px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#C5A059", letterSpacing: 2.5, marginBottom: 6, fontWeight: 600 }}>
            DAMASCUS HOTEL
          </div>
          <div style={{ fontSize: 9, color: "#7A7A7A", letterSpacing: 0.5 }}>
            Kericho, Kenya - 0793935384
          </div>
        </div>

        <div style={{ padding: "20px 24px", fontFamily: "'Courier New', monospace" }}>
          {/* Invoice meta */}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#7A7A7A", marginBottom: 14, letterSpacing: 0.3 }}>
            <span>{invoice.id}</span>
            <span>{now.toLocaleDateString()} {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 2 }}>
            Table: <strong style={{ color: "#1A1A1A" }}>{invoice.table}</strong> - Waiter: {invoice.waiter}
          </div>
          <div style={{ borderTop: "1px dashed #E5E0D5", margin: "12px 0" }} />

          {/* Items */}
          {invoice.items.map(item => (
            <div key={item.menuId || item.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6, color: "#4A4A4A" }}>
              <span>{item.qty}- {item.name}</span>
              <span>KES {fmt(item.price * item.qty)}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px dashed #E5E0D5", margin: "12px 0" }} />

          {/* Totals */}
          {[
            ["Subtotal", invoice.subtotal],
            invoice.discount ? ["Discount", -invoice.discount] : null,
            ["VAT 16%", invoice.tax],
            ["Service 5%", invoice.service],
          ].filter(Boolean).map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#7A7A7A", marginBottom: 4 }}>
              <span>{l}</span>
              <span style={{ color: v < 0 ? "#8B3A3A" : undefined }}>
                {v < 0 ? "- " : ""}KES {fmt(Math.abs(v))}
              </span>
            </div>
          ))}

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: "#1A1A1A", margin: "12px 0 8px", borderTop: "1px solid #E5E0D5", paddingTop: 10 }}>
            <span>TOTAL</span>
            <span>KES {fmt(total)}</span>
          </div>

          {/* Payment */}
          <div style={{ background: "#F8F8F8", borderRadius: 6, padding: "10px 14px", marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "#7A7A7A", marginBottom: 4 }}>
              Payment: <strong style={{ color: "#C5A059" }}>
                {payMethod === "mpesa" ? "M-Pesa" : payMethod === "card" ? "Card" : "Cash"}
              </strong>
            </div>
            {payMethod === "cash" && tendered > 0 && (
              <>
                <div style={{ fontSize: 10, color: "#7A7A7A" }}>Tendered: <strong>KES {fmt(tendered)}</strong></div>
                <div style={{ fontSize: 10, color: "#2E7D64", fontWeight: 600, marginTop: 2 }}>Change: KES {fmt(change)}</div>
              </>
            )}
          </div>

          <div style={{ textAlign: "center", fontSize: 9, color: "#9CA3AF", marginBottom: 16, letterSpacing: 0.3 }}>
            Thank you for dining with us
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => window.print()} style={{ ...actionBtn("#1A1A1A"), flex: 1, color: "#FFFFFF", fontSize: 11 }}>Print</button>
            <button onClick={onClose} style={{ ...actionBtn(T.amber), flex: 1, color: T.bg, fontSize: 11 }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Customer Directory -------------------------------------------------------
// Single source of truth for customer data used in POS customer-lookup modals.
export const CUSTOMERS = [
  { id: "C001", name: "James Kamau",     phone: "+254 712 345 678", email: "jkamau@email.com",   visits: 24, totalSpend: 68400,  loyalty: "Gold",     lastVisit: "Today"      },
  { id: "C002", name: "Wanjiru Mwangi",  phone: "+254 723 456 789", email: "wanjiru@email.com",  visits: 11, totalSpend: 29750,  loyalty: "Silver",   lastVisit: "Yesterday"  },
  { id: "C003", name: "Peter Njoroge",   phone: "+254 734 567 890", email: "pnjoroge@gmail.com", visits: 6,  totalSpend: 14200,  loyalty: "Bronze",   lastVisit: "3 days ago" },
  { id: "C004", name: "Grace Achieng",   phone: "+254 745 678 901", email: "gachieng@work.ke",   visits: 38, totalSpend: 115500, loyalty: "Platinum", lastVisit: "Today"      },
  { id: "C005", name: "David Omondi",    phone: "+254 756 789 012", email: "domondi@mail.com",   visits: 2,  totalSpend: 4800,   loyalty: "Bronze",   lastVisit: "1 week ago" },
  { id: "C006", name: "Fatuma Hassan",   phone: "+254 767 890 123", email: "fhassan@isp.co.ke",  visits: 16, totalSpend: 44200,  loyalty: "Gold",     lastVisit: "2 days ago" },
  { id: "C007", name: "Samuel Kipkemoi", phone: "+254 778 901 234", email: "skipkemoi@corp.co",  visits: 9,  totalSpend: 23100,  loyalty: "Silver",   lastVisit: "4 days ago" },
  { id: "C008", name: "Aisha Abdullahi", phone: "+254 789 012 345", email: "aisha.a@email.com",  visits: 31, totalSpend: 89600,  loyalty: "Platinum", lastVisit: "Today"      },
];

export const LOYALTY_COLORS = {
  Platinum: { bg: "#EDE9FE", color: "#7C3AED" },
  Gold:     { bg: "#FEF3C7", color: "#B45309" },
  Silver:   { bg: "#F3F4F6", color: "#6B7280" },
  Bronze:   { bg: "#FFF7ED", color: "#C2410C" },
};

// --- Customer Lookup Modal ----------------------------------------------------
// Used by POSView. Pass onSelect(customer) and onClose() callbacks.
export function CustomerModal({ onSelect, onClose }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const filtered = CUSTOMERS.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div style={{ background: "#FFFFFF", borderRadius: 8, width: 520, maxHeight: "82vh", display: "flex", flexDirection: "column", boxShadow: "0 12px 32px rgba(0,0,0,0.15)", overflow: "hidden" }}>
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #F0EDE6" }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#1A1A1A", marginBottom: 12 }}>Find Customer</div>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone..."
            style={{ width: "100%", padding: "9px 12px", border: "1px solid #E5E0D5", borderRadius: 4, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "'Inter', sans-serif" }} />
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#7A7A7A", fontSize: 12 }}>No customers found</div>}
          {filtered.map(c => {
            const lc = LOYALTY_COLORS[c.loyalty] || LOYALTY_COLORS.Bronze;
            const isSelected = selected?.id === c.id;
            return (
              <div key={c.id} onClick={() => setSelected(c)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", cursor: "pointer", borderBottom: "1px solid #F0EDE6", background: isSelected ? "#FFF7ED" : "#FFFFFF", borderLeft: isSelected ? "3px solid #C5A059" : "3px solid transparent", transition: "all 0.15s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: lc.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: lc.color }}>{c.name.charAt(0)}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: "#1A1A1A" }}>{c.name}</div>
                    <div style={{ fontSize: 10, color: "#7A7A7A", marginTop: 2 }}>{c.phone} - Last visit: {c.lastVisit}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ display: "inline-block", padding: "2px 10px", borderRadius: 4, fontSize: 9, fontWeight: 600, background: lc.bg, color: lc.color, marginBottom: 4 }}>{c.loyalty}</div>
                  <div style={{ fontSize: 9, color: "#7A7A7A" }}>{c.visits} visits - KES {c.totalSpend.toLocaleString()}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid #F0EDE6", display: "flex", gap: 12 }}>
          <button onClick={onClose} style={{ ...actionBtn(T.card), flex: 1, fontSize: 11 }}>Cancel</button>
          <button onClick={() => { if (selected) { onSelect(selected); onClose(); } }} disabled={!selected}
            style={{ ...actionBtn(T.amber), flex: 2, fontSize: 11, color: T.bg, opacity: selected ? 1 : 0.5, cursor: selected ? "pointer" : "not-allowed" }}>
            {selected ? `Select ${selected.name.split(" ")[0]}` : "Select Customer"}
          </button>
        </div>
      </div>
    </div>
  );
}
