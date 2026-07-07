import { useState, useEffect } from "react";
import { classifyExpiry } from "../utils";
import { inventoryApi, shiftsApi } from "../api";
import { useBreakpoint } from "../hooks/useBreakpoint";

const G = "#16a34a", R = "#DC2626", A = "#D97706", B = "#1E3A5F", MUTED = "#6B7280", BORDER = "#E5E7EB";
const fmt = (n) => `KES ${Math.round(n).toLocaleString()}`;

function Section({ title, children, action }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase" }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, color = B, urgent, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: "#fff", borderLeft: `4px solid ${color}`,
      border: `1px solid ${urgent ? color + "60" : BORDER}`,
      borderRadius: 8, padding: "14px 18px", flex: 1, minWidth: 150, cursor: onClick ? "pointer" : "default",
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: urgent ? color : "#111827" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function DashboardView({ sales = [], batches = [], storeIssues = [], wastage = [], setActiveNav, ingredients = [], menuItems = [], holdList = [], overhead = {}, user }) {
  const { mobile } = useBreakpoint();
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);

  const isAdmin = user?.role === "admin";

  // Stock activity log (admin owner view)
  const [log, setLog] = useState(null);
  useEffect(() => {
    if (!isAdmin) return;
    let on = true;
    const pull = () => inventoryApi.dailyLog().then(d => { if (on) setLog(d); }).catch(() => {});
    pull();
    const t = setInterval(pull, 60000);
    return () => { on = false; clearInterval(t); };
  }, [isAdmin]);

  // Shifts for till status (admin owner view)
  const [shifts, setShifts] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  useEffect(() => {
    if (!isAdmin) return;
    let on = true;
    const pull = () => {
      shiftsApi.list().then(d => { if (on) setShifts(d.shifts || []); }).catch(() => {});
      shiftsApi.active().then(s => { if (on) setActiveShift(s || null); }).catch(() => {});
    };
    pull();
    const t = setInterval(pull, 60000);
    return () => { on = false; clearInterval(t); };
  }, [isAdmin]);

  const todayStr = now.toISOString().split("T")[0];
  const todaySales = sales.filter(s => s.date === todayStr);
  const orders = todaySales.length;
  const revenue = todaySales.reduce((s, x) => s + (x.total || 0), 0);
  const cashToday  = todaySales.filter(s => s.payment === "cash").reduce((s, x) => s + (x.total || 0), 0);
  const mpesaToday = todaySales.filter(s => /mpesa|m-pesa/i.test(s.payment || "")).reduce((s, x) => s + (x.total || 0), 0);

  // Alerts (shared)
  const critical = batches.filter(b => classifyExpiry(b).status === "critical");
  const lowStock = ingredients.filter(ing => {
    const total = batches.filter(b => (b.ingredient_id || b.ingredientId) === ing.id && b.status === "active")
      .reduce((s, b) => s + Number(b.remaining), 0);
    return total <= Number(ing.reorder_level || ing.reorderLevel || 0);
  });
  const wastageToday = wastage.filter(w => (w.date || "").startsWith(todayStr));
  const wastageValue = wastageToday.reduce((s, w) => s + (w.value || 0), 0);

  // ── OPERATIONAL (manager) data ──
  const inKitchen   = holdList.filter(h => h.status === "pending");
  const readyToBill = holdList.filter(h => h.status === "bumped");
  const tableMap = {};
  holdList.filter(h => h.status === "pending" || h.status === "bumped").forEach(h => {
    const tbl = h.table_no || h.table || "Walk-in";
    if (!tableMap[tbl]) tableMap[tbl] = { table: tbl, orders: [], earliest: null };
    tableMap[tbl].orders.push(h);
    const t = h.created_at ? new Date(h.created_at) : null;
    if (t && (!tableMap[tbl].earliest || t < tableMap[tbl].earliest)) tableMap[tbl].earliest = t;
  });
  const tables = Object.values(tableMap).sort((a, b) => (a.earliest || 0) - (b.earliest || 0));
  const ageMin = (h) => h.created_at ? Math.floor((now - new Date(h.created_at)) / 60000) : null;
  const ageColor = (min) => min === null ? MUTED : min >= 30 ? R : min >= 15 ? A : G;
  const ageLabel = (min) => min === null ? "—" : `${min}m`;

  const Header = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>{isAdmin ? "Business Overview" : "Operations Overview"}</div>
        <div style={{ fontSize: 12, color: MUTED }}>{now.toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: B, background: "#EFF6FF", padding: "6px 16px", borderRadius: 20 }}>
        {now.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  );

  // ═══════════════════ MANAGER / OPERATIONAL DASHBOARD ═══════════════════
  if (!isAdmin) {
    return (
      <div style={{ flex: 1, overflowY: "auto", background: "#F8FAFC", padding: mobile ? "14px" : "24px 28px" }}>
        {Header}

        <Section title="Today at a Glance">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <StatCard label="Orders Served" value={orders} sub="Completed sales" color={G} />
            <StatCard label="Revenue" value={fmt(revenue)} sub="Cash + M-Pesa" color={B} />
            <StatCard label="In Kitchen" value={inKitchen.length} sub="Awaiting preparation" color={inKitchen.length > 5 ? R : A} urgent={inKitchen.length > 5} />
            <StatCard label="Ready to Bill" value={readyToBill.length} sub="Kitchen done — collect payment" color={readyToBill.length > 0 ? G : MUTED} urgent={readyToBill.length > 0} />
          </div>
        </Section>

        <Section title="Kitchen Load">
          {inKitchen.length === 0 && readyToBill.length === 0 ? (
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "32px", textAlign: "center", color: MUTED, fontSize: 13 }}>
              No active kitchen orders right now
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              {[...inKitchen, ...readyToBill].map(h => {
                const min = ageMin(h);
                const done = h.status === "bumped";
                return (
                  <div key={h.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderLeft: `4px solid ${done ? G : ageColor(min)}`, borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{h.table_no || h.table || "Walk-in"}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: done ? G : ageColor(min) }}>{done ? "READY" : ageLabel(min)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                      {(h.items || []).map(i => `${i.qty}× ${i.name}`).join(", ") || "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section title="Active Tables">
          {tables.length === 0 ? (
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "32px", textAlign: "center", color: MUTED, fontSize: 13 }}>
              No tables currently occupied
            </div>
          ) : (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {tables.map(t => {
                const min = t.earliest ? Math.floor((now - t.earliest) / 60000) : null;
                return (
                  <div key={t.table} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderLeft: `4px solid ${ageColor(min)}`, borderRadius: 8, padding: "12px 16px", minWidth: 150 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{t.table}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{t.orders.length} order{t.orders.length === 1 ? "" : "s"} · {ageLabel(min)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section title="Stock Alerts" action={<span onClick={() => setActiveNav?.("expiry")} style={{ fontSize: 11, color: B, cursor: "pointer", fontWeight: 600 }}>Manage →</span>}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <StatCard label="Expiring Soon" value={critical.length} sub="items need using" color={critical.length ? R : G} urgent={critical.length > 0} onClick={() => setActiveNav?.("expiry")} />
            <StatCard label="Low Stock" value={lowStock.length} sub="ingredients to reorder" color={lowStock.length ? A : G} urgent={lowStock.length > 0} onClick={() => setActiveNav?.("inventory")} />
            <StatCard label="Wastage Today" value={wastageToday.length} sub="write-offs recorded" color={wastageToday.length ? A : G} onClick={() => setActiveNav?.("wastage")} />
          </div>
        </Section>
      </div>
    );
  }

  // ═══════════════════ ADMIN / OWNER DASHBOARD ═══════════════════
  const todaysClosed = shifts.filter(s => s.status === "closed" && (s.closed_at || "").startsWith(todayStr));
  const shiftVar = (sh) => {
    const shSales = sales.filter(x => (x.shift_id || x.shiftId) === sh.id);
    const cashS  = shSales.filter(x => x.payment === "cash").reduce((a, x) => a + (x.total || 0), 0);
    const mpesaS = shSales.filter(x => /mpesa|m-pesa/i.test(x.payment || "")).reduce((a, x) => a + (x.total || 0), 0);
    const cashVar  = (parseFloat(sh.closing_cash) || 0) - ((parseFloat(sh.opening_float) || 0) + cashS);
    const mpesaVar = sh.closing_mpesa != null ? (parseFloat(sh.closing_mpesa) || 0) - mpesaS : 0;
    return { cashVar, mpesaVar };
  };
  const shortShifts = todaysClosed.map(sh => ({ sh, ...shiftVar(sh) })).filter(x => x.cashVar < 0 || x.mpesaVar < 0);
  const totalShort = shortShifts.reduce((a, x) => a + (x.cashVar < 0 ? -x.cashVar : 0) + (x.mpesaVar < 0 ? -x.mpesaVar : 0), 0);

  const sellerMap = {};
  todaySales.forEach(s => (s.items || []).forEach(i => {
    const k = i.name || i.menuId;
    if (!sellerMap[k]) sellerMap[k] = { name: i.name || "Item", qty: 0, revenue: 0 };
    sellerMap[k].qty += i.qty || 0;
    sellerMap[k].revenue += (i.qty || 0) * (i.unit_price || i.price || 0);
  }));
  const topSellers = Object.values(sellerMap).sort((a, b) => b.qty - a.qty).slice(0, 5);

  const usedMap = {};
  (log?.issued || []).forEach(s => {
    const k = s.ingredient;
    if (!usedMap[k]) usedMap[k] = { name: s.ingredient, qty: 0, unit: s.unit };
    usedMap[k].qty += Number(s.qty) || 0;
  });
  const topUsed = Object.values(usedMap).sort((a, b) => b.qty - a.qty).slice(0, 5);

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "#F8FAFC", padding: mobile ? "14px" : "24px 28px" }}>
      {Header}

      <Section title="Today's Money">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
          <div style={{ background: B, color: "#fff", borderRadius: 8, padding: "18px 24px", flex: 2, minWidth: 260 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", opacity: 0.8 }}>Money Taken Today</div>
            <div style={{ fontSize: 38, fontWeight: 800, marginTop: 4 }}>{fmt(revenue)}</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{orders} order{orders === 1 ? "" : "s"}</div>
          </div>
          <StatCard label="Cash" value={fmt(cashToday)} color={G} />
          <StatCard label="M-Pesa" value={fmt(mpesaToday)} color="#2E7D64" />
        </div>
      </Section>

      <Section title="Till Status" action={<span onClick={() => setActiveNav?.("shift")} style={{ fontSize: 11, color: B, cursor: "pointer", fontWeight: 600 }}>View shifts →</span>}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <StatCard label="Open Shift" value={activeShift ? "Running" : "None"} sub={activeShift ? `Opened by ${activeShift.opened_by_name || "staff"}` : "No till open right now"} color={activeShift ? G : MUTED} onClick={() => setActiveNav?.("shift")} />
          {shortShifts.length > 0 ? (
            <StatCard label="Till Shortage Today" value={`− ${fmt(totalShort)}`} sub={`${shortShifts.length} shift${shortShifts.length === 1 ? "" : "s"} came up short`} color={R} urgent onClick={() => setActiveNav?.("shift")} />
          ) : (
            <StatCard label="Till Balance" value={todaysClosed.length ? "Balanced" : "—"} sub={todaysClosed.length ? `${todaysClosed.length} shift${todaysClosed.length === 1 ? "" : "s"} closed today` : "No shifts closed yet"} color={todaysClosed.length ? G : MUTED} />
          )}
        </div>
      </Section>

      <Section title="Needs Attention" action={<span onClick={() => setActiveNav?.("expiry")} style={{ fontSize: 11, color: B, cursor: "pointer", fontWeight: 600 }}>Manage →</span>}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <StatCard label="Expiring / Expired" value={critical.length} sub="items need using soon" color={critical.length ? R : G} urgent={critical.length > 0} onClick={() => setActiveNav?.("expiry")} />
          <StatCard label="Low Stock" value={lowStock.length} sub="ingredients to reorder" color={lowStock.length ? A : G} urgent={lowStock.length > 0} onClick={() => setActiveNav?.("inventory")} />
          <StatCard label="Wastage Today" value={wastageToday.length} sub="write-offs recorded" color={wastageToday.length ? A : G} onClick={() => setActiveNav?.("wastage")} />
        </div>
      </Section>

      <Section title="Top Sellers Today">
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14 }}>
          {topSellers.length === 0 ? <div style={{ fontSize: 12, color: MUTED }}>No sales yet today.</div> :
            topSellers.map((it, i) => (
              <div key={it.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: i < topSellers.length - 1 ? `1px solid #F3F4F6` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: MUTED, width: 16 }}>{i + 1}</span>
                  <span style={{ fontSize: 13, color: "#111827" }}>{it.name}</span>
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: B }}>{it.qty} sold</span>
                  <span style={{ fontSize: 12, color: MUTED, minWidth: 90, textAlign: "right" }}>{fmt(it.revenue)}</span>
                </div>
              </div>
            ))}
        </div>
      </Section>

      <Section title="Moving Fastest In The Store" action={<span onClick={() => setActiveNav?.("inventory")} style={{ fontSize: 11, color: B, cursor: "pointer", fontWeight: 600 }}>Stock →</span>}>
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14 }}>
          {topUsed.length === 0 ? <div style={{ fontSize: 12, color: MUTED }}>Nothing issued from the store yet today. This fills in as staff record stock issues.</div> :
            topUsed.map((it, i) => (
              <div key={it.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: i < topUsed.length - 1 ? `1px solid #F3F4F6` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: MUTED, width: 16 }}>{i + 1}</span>
                  <span style={{ fontSize: 13, color: "#111827" }}>{it.name}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: A }}>{Number(it.qty).toLocaleString()} {it.unit || ""} used</span>
              </div>
            ))}
        </div>
      </Section>

      <Section title="Today's Stock Activity">
        {!log ? (
          <div style={{ fontSize: 12, color: MUTED, padding: "8px 0" }}>Loading today's activity…</div>
        ) : (log.received.length === 0 && log.issued.length === 0 && log.produced.length === 0) ? (
          <div style={{ fontSize: 12, color: MUTED, padding: "8px 0" }}>No stock received, issued, or produced yet today.</div>
        ) : (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 230, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: G, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Received ({log.received.length})</div>
              {log.received.length === 0 ? <div style={{ fontSize: 11, color: MUTED }}>—</div> :
                log.received.map(r => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, padding: "5px 0", borderBottom: `1px solid #F3F4F6` }}>
                    <span style={{ color: "#111827" }}>{r.ingredient}</span>
                    <span style={{ color: G, fontWeight: 600, whiteSpace: "nowrap" }}>+{Number(r.qty).toLocaleString()} {r.unit}</span>
                  </div>
                ))}
            </div>
            <div style={{ flex: 1, minWidth: 230, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: A, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Issued ({log.issued.length})</div>
              {log.issued.length === 0 ? <div style={{ fontSize: 11, color: MUTED }}>—</div> :
                log.issued.map(s => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, padding: "5px 0", borderBottom: `1px solid #F3F4F6` }}>
                    <span style={{ color: "#111827" }}>{s.ingredient}<span style={{ color: MUTED, fontSize: 10 }}> → {s.to_location || "Kitchen"}</span></span>
                    <span style={{ color: A, fontWeight: 600, whiteSpace: "nowrap" }}>−{Number(s.qty).toLocaleString()} {s.unit}</span>
                  </div>
                ))}
            </div>
            <div style={{ flex: 1, minWidth: 230, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: B, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Produced ({log.produced.length})</div>
              {log.produced.length === 0 ? <div style={{ fontSize: 11, color: MUTED }}>—</div> :
                log.produced.map(p => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, padding: "5px 0", borderBottom: `1px solid #F3F4F6` }}>
                    <span style={{ color: "#111827" }}>{p.item}</span>
                    <span style={{ color: B, fontWeight: 600, whiteSpace: "nowrap" }}>{Number(p.qty_produced).toLocaleString()} made</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
