import { useState, useEffect } from "react";

const G = "#16a34a", R = "#DC2626", A = "#D97706", B = "#1E3A5F", MUTED = "#6B7280", BORDER = "#E5E7EB";

function KpiCard({ label, value, sub, color }) {
  return (
    <div style={{ background: "#fff", borderLeft: `4px solid ${color}`, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "16px 20px", flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#111827" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${BORDER}` }}>{title}</div>
      {children}
    </div>
  );
}

export default function CashierDashboard({ sales = [], activeShift, openInvoices = [], setActiveNav, user }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);

  const todayStr = now.toISOString().split("T")[0];
  const todaySales = sales.filter(s => s.date === todayStr);

  const cash  = todaySales.filter(s => s.payment === "cash").reduce((a, s) => a + s.total, 0);
  const mpesa = todaySales.filter(s => s.payment === "mpesa").reduce((a, s) => a + s.total, 0);
  const total = cash + mpesa;

  const openCount = openInvoices.filter(i => i.status === "open").length;

  const shiftDuration = (() => {
    if (!activeShift?.opened_at && !activeShift?.openedAt) return null;
    const opened = new Date(activeShift.opened_at || activeShift.openedAt);
    const mins = Math.floor((now - opened) / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  })();

  const recent = [...todaySales]
    .sort((a, b) => new Date(b.created_at || b.sale_time || 0) - new Date(a.created_at || a.sale_time || 0))
    .slice(0, 8);

  const topItems = (() => {
    const counts = {};
    for (const s of todaySales) {
      for (const item of (s.items || [])) {
        const name = item.name || item.menu_item_name || "Unknown";
        if (!counts[name]) counts[name] = { qty: 0, revenue: 0 };
        counts[name].qty += item.qty || 1;
        counts[name].revenue += (item.price || 0) * (item.qty || 1);
      }
    }
    return Object.entries(counts).sort((a, b) => b[1].qty - a[1].qty).slice(0, 8);
  })();

  const payColor = { cash: G, mpesa: A, card: B, "m-pesa": A };

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "#F8FAFC", padding: "24px 28px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>Cashier Terminal</div>
          <div style={{ fontSize: 12, color: MUTED }}>{user?.name} · {now.toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: B }}>{now.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</div>
          {shiftDuration && <div style={{ fontSize: 11, color: MUTED }}>Shift open {shiftDuration}</div>}
        </div>
      </div>

      {/* Shift Status */}
      {activeShift ? (
        <div style={{ background: G + "10", border: `1px solid ${G}40`, borderRadius: 8, padding: "12px 18px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: G, boxShadow: `0 0 0 3px ${G}30` }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Shift #{activeShift.id || activeShift.shift_number} — Active</div>
              <div style={{ fontSize: 11, color: MUTED }}>Float: KES {Number(activeShift.opening_float || activeShift.float || 0).toLocaleString()} · Opened {shiftDuration} ago</div>
            </div>
          </div>
          <div onClick={() => setActiveNav("shift")} style={{ fontSize: 12, fontWeight: 700, color: G, cursor: "pointer" }}>View Shift →</div>
        </div>
      ) : (
        <div style={{ background: R + "10", border: `1px solid ${R}40`, borderRadius: 8, padding: "12px 18px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: R }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: R }}>No active shift — Open a shift to start collecting payments</div>
          </div>
          <div onClick={() => setActiveNav("shift")} style={{ fontSize: 12, fontWeight: 700, color: R, cursor: "pointer" }}>Open Shift →</div>
        </div>
      )}

      {/* Collections */}
      <Section title="Today's Collections">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <KpiCard label="Total Collected" value={`KES ${total.toLocaleString()}`} sub={`${todaySales.length} transactions`} color={B} />
          <KpiCard label="Cash" value={`KES ${cash.toLocaleString()}`} sub={`${todaySales.filter(s => s.payment === "cash").length} payments`} color={G} />
          <KpiCard label="M-Pesa" value={`KES ${mpesa.toLocaleString()}`} sub={`${todaySales.filter(s => s.payment === "mpesa").length} payments`} color={A} />
        </div>
      </Section>

      {/* Open Invoices Alert */}
      {openCount > 0 && (
        <Section title="Pending">
          <div onClick={() => setActiveNav("pos")} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: "#fff", border: `1px solid ${A}50`, borderLeft: `4px solid ${A}`, borderRadius: 8, cursor: "pointer" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: A, minWidth: 40 }}>{openCount}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Open Invoice{openCount > 1 ? "s" : ""} Awaiting Payment</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Customers waiting to pay — tap to process</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: A }}>Process →</div>
          </div>
        </Section>
      )}

      {/* Top Selling Items */}
      <Section title="Top Selling Items Today">
        {topItems.length === 0 ? (
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "24px", textAlign: "center", color: MUTED, fontSize: 13 }}>No sales recorded yet</div>
        ) : (
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
            {topItems.map(([name, d], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: i < topItems.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, width: 20 }}>{i + 1}</div>
                <div style={{ flex: 1, fontSize: 13, color: "#111827", fontWeight: 500 }}>{name}</div>
                <div style={{ width: 100, height: 6, borderRadius: 3, background: "#F3F4F6" }}>
                  <div style={{ width: `${Math.round((d.qty / topItems[0][1].qty) * 100)}%`, height: "100%", background: G, borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: G, minWidth: 40, textAlign: "right" }}>{d.qty}x</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", minWidth: 90, textAlign: "right" }}>KES {d.revenue.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Recent Transactions */}
      <Section title="Recent Transactions">
        {recent.length === 0 ? (
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "32px", textAlign: "center", color: MUTED, fontSize: 13 }}>No transactions yet today</div>
        ) : (
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
            {recent.map((s, i) => {
              const pColor = payColor[s.payment?.toLowerCase()] || MUTED;
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 16px", borderBottom: i < recent.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: pColor, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{s.customer || s.table_no || "Walk-in"}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>{s.sale_time || s.time || "—"} · {s.payment?.toUpperCase()}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>KES {Number(s.total).toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

    </div>
  );
}
