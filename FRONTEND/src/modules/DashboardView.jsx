import { useState, useEffect } from "react";
import { classifyExpiry } from "../utils";

const G = "#16a34a", R = "#DC2626", A = "#D97706", B = "#1E3A5F", MUTED = "#6B7280", BORDER = "#E5E7EB";

function StatCard({ label, value, sub, color = B, urgent }) {
  return (
    <div style={{
      background: "#fff", borderLeft: `4px solid ${color}`,
      border: `1px solid ${urgent ? color + "60" : BORDER}`,
      borderRadius: 8, padding: "14px 18px", flex: 1, minWidth: 150,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: urgent ? color : "#111827" }}>{value}</div>
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

export default function DashboardView({ sales = [], batches = [], storeIssues = [], wastage = [], setActiveNav, ingredients = [], menuItems = [], holdList = [], overhead = {}, user }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);

  const todayStr = now.toISOString().split("T")[0];
  const todaySales = sales.filter(s => s.date === todayStr);
  const orders = todaySales.length;
  const revenue = todaySales.reduce((s, x) => s + x.total, 0);

  // Daily overhead calculation
  const fixedKeys = ["rent","electricity","water","wifi","other"];
  const consumableKeys = ["gas","firewood","charcoal"];
  const fixedDaily = fixedKeys.reduce((s, k) => s + (parseFloat(overhead[`overhead_fixed_${k}`]) || 0) / 30, 0);
  const consumableDaily = consumableKeys.reduce((s, k) => {
    const cost = parseFloat(overhead[`overhead_${k}_cost`]) || 0;
    const days = parseFloat(overhead[`overhead_${k}_days`]) || 1;
    return s + cost / days;
  }, 0);
  const staffSalaries = (() => { try { return JSON.parse(overhead.staff_salaries || "[]"); } catch { return []; } })();
  const staffDaily = staffSalaries.reduce((s, e) => s + (parseFloat(e.salary) || 0), 0) / 30;
  const totalOverhead = fixedDaily + consumableDaily + staffDaily;
  const netProfit = revenue - totalOverhead;

  // Kitchen load
  const inKitchen  = holdList.filter(h => h.status === "pending");
  const readyToBill = holdList.filter(h => h.status === "bumped");

  // Table status — group pending+bumped holds by table
  const tableMap = {};
  holdList.filter(h => h.status === "pending" || h.status === "bumped").forEach(h => {
    const tbl = h.table_no || h.table || "Walk-in";
    if (!tableMap[tbl]) tableMap[tbl] = { table: tbl, orders: [], earliest: null };
    tableMap[tbl].orders.push(h);
    const t = h.created_at ? new Date(h.created_at) : null;
    if (t && (!tableMap[tbl].earliest || t < tableMap[tbl].earliest)) tableMap[tbl].earliest = t;
  });
  const tables = Object.values(tableMap).sort((a, b) => (a.earliest || 0) - (b.earliest || 0));

  // Alerts
  const critical = batches.filter(b => classifyExpiry(b).status === "critical");
  const lowStock  = ingredients.filter(ing => {
    const total = batches.filter(b => (b.ingredient_id || b.ingredientId) === ing.id && b.status === "active")
      .reduce((s, b) => s + Number(b.remaining), 0);
    return total <= Number(ing.reorder_level || ing.reorderLevel || 0);
  });
  const wastageToday = wastage.filter(w => (w.date || "").startsWith(todayStr));
  const wastageValue = wastageToday.reduce((s, w) => s + (w.value || 0), 0);

  const ageMin = (h) => h.created_at ? Math.floor((now - new Date(h.created_at)) / 60000) : null;
  const ageColor = (min) => min === null ? MUTED : min >= 30 ? R : min >= 15 ? A : G;
  const ageLabel = (min) => min === null ? "—" : `${min}m`;

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "#F8FAFC", padding: "24px 28px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>Operations Overview</div>
          <div style={{ fontSize: 12, color: MUTED }}>
            {now.toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: B, background: "#EFF6FF", padding: "6px 16px", borderRadius: 20 }}>
          {now.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      {/* Live Stats */}
      <Section title="Today at a Glance">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <StatCard label="Orders Served" value={orders} sub="Completed sales" color={G} />
          <StatCard label="Revenue" value={`KES ${revenue.toLocaleString()}`} sub="All methods" color={B} />
          <StatCard label="In Kitchen" value={inKitchen.length} sub="Awaiting preparation" color={inKitchen.length > 5 ? R : A} urgent={inKitchen.length > 5} />
          <StatCard label="Ready to Bill" value={readyToBill.length} sub="Kitchen done — collect payment" color={readyToBill.length > 0 ? G : MUTED} urgent={readyToBill.length > 0} />
        </div>
      </Section>

      {/* Kitchen Load */}
      <Section title="Kitchen Load">
        {inKitchen.length === 0 && readyToBill.length === 0 ? (
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "32px", textAlign: "center", color: MUTED, fontSize: 13 }}>
            No active kitchen orders right now
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Pending */}
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ background: A + "15", borderBottom: `1px solid ${A}30`, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: A }}>⏳ IN KITCHEN ({inKitchen.length})</span>
              </div>
              {inKitchen.length === 0 ? (
                <div style={{ padding: "20px 14px", color: MUTED, fontSize: 12, textAlign: "center" }}>All clear</div>
              ) : inKitchen.map(h => {
                const age = ageMin(h);
                const col = ageColor(age);
                return (
                  <div key={h.id} style={{ padding: "10px 14px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{h.table_no || h.table || "Walk-in"}</div>
                      <div style={{ fontSize: 11, color: MUTED }}>{h.waiter || h.waiter_name || "Waiter"}</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: col, background: col + "15", padding: "3px 10px", borderRadius: 20 }}>
                      {ageLabel(age)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Ready */}
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ background: G + "15", borderBottom: `1px solid ${G}30`, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: G }}>✅ READY TO BILL ({readyToBill.length})</span>
              </div>
              {readyToBill.length === 0 ? (
                <div style={{ padding: "20px 14px", color: MUTED, fontSize: 12, textAlign: "center" }}>None ready yet</div>
              ) : readyToBill.map(h => {
                const age = ageMin(h);
                const col = ageColor(age);
                return (
                  <div key={h.id} style={{ padding: "10px 14px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{h.table_no || h.table || "Walk-in"}</div>
                      <div style={{ fontSize: 11, color: MUTED }}>{h.waiter || h.waiter_name || "Waiter"}</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: col, background: col + "15", padding: "3px 10px", borderRadius: 20 }}>
                      {ageLabel(age)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Section>

      {/* Table Status */}
      <Section title="Active Tables">
        {tables.length === 0 ? (
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "32px", textAlign: "center", color: MUTED, fontSize: 13 }}>
            No active tables right now
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
            {tables.map(({ table, orders: tOrders, earliest }) => {
              const age = earliest ? Math.floor((now - earliest) / 60000) : null;
              const col = ageColor(age);
              const hasLate = age !== null && age >= 30;
              return (
                <div key={table} style={{
                  background: "#fff", border: `2px solid ${col}`, borderRadius: 8,
                  padding: "14px 16px", position: "relative",
                }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 2 }}>{table}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>
                    {tOrders.length} order{tOrders.length > 1 ? "s" : ""} · {tOrders.map(o => o.waiter || o.waiter_name || "?").filter((v, i, a) => a.indexOf(v) === i).join(", ")}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: col, background: col + "15", padding: "2px 8px", borderRadius: 20 }}>
                      {ageLabel(age)}
                    </span>
                    {hasLate && <span style={{ fontSize: 10, color: R, fontWeight: 700 }}>⚠ Check table</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Net Profit - admin and permitted users only */}
      {(user?.role === "admin" || (user?.permissions || []).includes("can_view_overhead")) && (
        <div style={{ display:"flex", gap:12, marginBottom:20, flexWrap:"wrap" }}>
          <div style={{ background:"#fff", borderLeft:`4px solid ${B}`, border:`1px solid ${BORDER}`, borderRadius:8, padding:"14px 18px", flex:1, minWidth:150 }}>
            <div style={{ fontSize:11, fontWeight:600, color:MUTED, letterSpacing:1, textTransform:"uppercase", marginBottom:4 }}>Daily Overhead</div>
            <div style={{ fontSize:22, fontWeight:800, color:"#111827" }}>KES {totalOverhead.toFixed(0)}</div>
            <div style={{ fontSize:11, color:MUTED, marginTop:2 }}>Fixed + consumables + staff</div>
          </div>
          <div style={{ background:"#fff", borderLeft:`4px solid ${netProfit >= 0 ? G : R}`, border:`1px solid ${netProfit >= 0 ? G : R}`, borderRadius:8, padding:"14px 18px", flex:1, minWidth:150 }}>
            <div style={{ fontSize:11, fontWeight:600, color:MUTED, letterSpacing:1, textTransform:"uppercase", marginBottom:4 }}>Net Profit Today</div>
            <div style={{ fontSize:22, fontWeight:800, color:netProfit >= 0 ? G : R }}>KES {Math.abs(netProfit).toFixed(0)}</div>
            <div style={{ fontSize:11, color:MUTED, marginTop:2 }}>{netProfit >= 0 ? "After overhead deduction" : "⚠ Running at a loss"}</div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {(critical.length > 0 || lowStock.length > 0 || wastageValue > 0) && (
        <Section title="Stock Alerts">
          {critical.length > 0 && (
            <div onClick={() => setActiveNav("expiry")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 7, background: "#fff", border: `1px solid ${R}40`, borderLeft: `4px solid ${R}`, cursor: "pointer", marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>🚨</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{critical.length} item{critical.length > 1 ? "s" : ""} expired or expiring today</div>
                <div style={{ fontSize: 11, color: MUTED }}>Immediate action required</div>
              </div>
              <span style={{ fontSize: 12, color: R, fontWeight: 700 }}>View →</span>
            </div>
          )}
          {lowStock.length > 0 && (
            <div onClick={() => setActiveNav("inventory")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 7, background: "#fff", border: `1px solid ${A}40`, borderLeft: `4px solid ${A}`, cursor: "pointer", marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>📦</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{lowStock.length} ingredient{lowStock.length > 1 ? "s" : ""} below reorder level</div>
                <div style={{ fontSize: 11, color: MUTED }}>{lowStock.slice(0, 3).map(i => i.name).join(", ")}</div>
              </div>
              <span style={{ fontSize: 12, color: A, fontWeight: 700 }}>View →</span>
            </div>
          )}
          {wastageValue > 0 && (
            <div onClick={() => setActiveNav("wastage")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 7, background: "#fff", border: `1px solid ${R}40`, borderLeft: `4px solid ${R}`, cursor: "pointer" }}>
              <span style={{ fontSize: 20 }}>🗑</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>KES {wastageValue.toLocaleString()} in wastage today</div>
                <div style={{ fontSize: 11, color: MUTED }}>{wastageToday.length} entries recorded</div>
              </div>
              <span style={{ fontSize: 12, color: R, fontWeight: 700 }}>View →</span>
            </div>
          )}
        </Section>
      )}

    </div>
  );
}
