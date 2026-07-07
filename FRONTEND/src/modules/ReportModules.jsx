import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ALL_PERMISSIONS, d } from "../data";
import { fmt } from "../utils";
import { Card, Badge, SectionHeader } from "../components/UI";
import { useBreakpoint } from "../hooks/useBreakpoint";

// Wrap wide tables so they scroll horizontally on small screens instead of overflowing
function TableScroll({ children, min = 560 }) {
  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ minWidth: min }}>{children}</div>
    </div>
  );
}

// --- EXPORT HELPERS -----------------------------------------------------------
function exportCSV(profitData, kpis) {
  const rows = [
    ["Item Profitability Report", "", "", "", "", ""],
    [`Generated: ${new Date().toLocaleString("en-KE")}`, "", "", "", "", ""],
    ["", "", "", "", "", ""],
    ["Item", "Qty Sold", "Revenue (KES)", "COGS (KES)", "Profit (KES)", "Margin %"],
    ...profitData.map((p) => [p.name, p.qty, p.rev, p.cogs, p.profit, `${p.margin}%`]),
    ["", "", "", "", "", ""],
    ["SUMMARY", "", "", "", "", ""],
    ["Gross Revenue", kpis.revenue, "", "", "", ""],
    ["Gross Profit",  kpis.profit,  "", "", "", ""],
    ["Overall Margin", `${kpis.margin}%`, "", "", "", ""],
    ["Wastage Loss",  kpis.wastage, "", "", "", ""],
  ];
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `profitability-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(profitData, kpis) {
  const html = `
<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>Profitability Report</title>
<style>
  body { font-family: 'Inter', Arial, sans-serif; padding: 32px; color: #1A1A1A; background: #FFFFFF; }
  h1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; color: #C5A059; }
  .sub { font-size: 11px; color: #7A7A7A; margin-bottom: 24px; border-bottom: 1px solid #E5E0D5; padding-bottom: 12px; }
  .kpis { display: flex; gap: 16px; margin-bottom: 28px; }
  .kpi { border: 1px solid #E5E0D5; border-radius: 6px; padding: 12px 18px; flex: 1; border-top: 3px solid #C5A059; }
  .kpi-label { font-size: 9px; font-weight: 600; color: #7A7A7A; letter-spacing: 1px; text-transform: uppercase; }
  .kpi-val { font-size: 20px; font-weight: 700; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #F8F8F8; padding: 10px 12px; text-align: left; font-size: 10px; font-weight: 600; color: #7A7A7A; border-bottom: 2px solid #E5E0D5; }
  td { padding: 8px 12px; border-bottom: 1px solid #F0EDE6; }
  .profit { color: #2E7D64; font-weight: 700; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 600; }
  @media print { body { padding: 16px; } }
</style>
</head><body>
<h1>Damascus Hotel - Profitability Report</h1>
<div class="sub">Generated ${new Date().toLocaleString("en-KE")} - Trading Summary</div>
<div class="kpis">
  <div class="kpi"><div class="kpi-label">Gross Revenue</div><div class="kpi-val">KES ${Number(kpis.revenue).toLocaleString()}</div></div>
  <div class="kpi"><div class="kpi-label">Gross Profit</div><div class="kpi-val" style="color:#2E7D64">KES ${Number(kpis.profit).toLocaleString()}</div></div>
  <div class="kpi"><div class="kpi-label">Overall Margin</div><div class="kpi-val" style="color:#C5A059">${kpis.margin}%</div></div>
  <div class="kpi"><div class="kpi-label">Wastage Loss</div><div class="kpi-val" style="color:#8B3A3A">KES ${Number(kpis.wastage).toLocaleString()}</div></div>
</div>
<table>
  <thead><tr><th>Item</th><th>Qty Sold</th><th>Revenue</th><th>COGS</th><th>Profit</th><th>Margin</th></tr></thead>
  <tbody>
    ${profitData.map((p) => `
    <tr>
      <td><strong>${p.emoji} ${p.name}</strong></td>
      <td>-${p.qty}</td>
      <td>KES ${p.rev.toLocaleString()}</td>
      <td>KES ${p.cogs.toLocaleString()}</td>
      <td class="profit">KES ${p.profit.toLocaleString()}</td>
      <td><span class="badge" style="background:${p.margin>=50?"#ECFDF5":p.margin>=30?"#FFFBEB":"#FEF2F2"};color:${p.margin>=50?"#2E7D64":p.margin>=30?"#B8860B":"#8B3A3A"}">${p.margin}%</span></td>
    </tr>`).join("")}
  </tbody>
</table>
<script>window.onload=()=>{window.print();}<\/script>
</body></html>`;
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
}

// --- REPORTS VIEW -------------------------------------------------------------
export function ReportsView({ sales, batches, wastage, menuItems = [] }) {
  const { mobile } = useBreakpoint();
  const ymd = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const today = ymd(new Date());
  const [date, setDate] = useState(today);
  const shiftDay = (o) => { const d = new Date(date + "T00:00:00"); d.setDate(d.getDate() + o); setDate(ymd(d)); };
  const niceDate = new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const ctrlBtn = { padding: "8px 12px", borderRadius: 6, border: "1px solid #E5E0D5", background: "#FFF", cursor: "pointer", fontSize: 14, fontWeight: 700 };

  const dayOf  = (s) => (s.date || s.sale_date || (s.created_at || "").slice(0,10) || "").toString().slice(0,10);
  const daySales = (sales || []).filter((s) => dayOf(s) === date);
  const wDayOf = (w) => (w.date || w.wastage_date || "").toString().slice(0,10);
  const dayWastage = (wastage || []).filter((w) => wDayOf(w) === date);

  const revenue     = daySales.reduce((s, x) => s + (parseFloat(x.total) || 0), 0);
  const orders      = daySales.length;
  const itemsSold   = daySales.reduce((s, x) => s + (x.items || []).reduce((a, i) => a + (i.qty || 1), 0), 0);
  const wastageLoss = dayWastage.reduce((s, w) => s + (parseFloat(w.value) || 0), 0);

  const topItems = (() => {
    const counts = {};
    for (const s of daySales) {
      const hour = (s.sale_time || s.time || "00:00").split(":")[0];
      for (const item of (s.items || [])) {
        const name = item.name || item.menu_item_name || "Unknown";
        if (!counts[name]) counts[name] = { qty: 0, revenue: 0, hours: {} };
        counts[name].qty += item.qty || 1;
        counts[name].revenue += (item.price || 0) * (item.qty || 1);
        counts[name].hours[hour] = (counts[name].hours[hour] || 0) + (item.qty || 1);
      }
    }
    return Object.entries(counts).sort((a, b) => b[1].qty - a[1].qty).slice(0, 15).map(([name, d]) => {
      const peakHour = Object.entries(d.hours).sort((a,b) => b[1]-a[1])[0];
      return { name, qty: d.qty, revenue: d.revenue, peakHour: peakHour ? `${peakHour[0]}:00` : "—" };
    });
  })();

  const exportCSV = () => {
    const rows = [
      ["Damascus Hotel - Daily Report", niceDate],
      [],
      ["Money taken (KES)", Math.round(revenue)],
      ["Orders", orders],
      ["Items sold", itemsSold],
      ["Wastage loss (KES)", Math.round(wastageLoss)],
      [],
      ["Top selling items"],
      ["#", "Item", "Sold", "Revenue (KES)", "Peak time"],
      ...topItems.map((it, i) => [i+1, it.name, it.qty, Math.round(it.revenue), it.peakHour]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c ?? "")}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `daily-report-${date}.csv`;
    a.click();
  };

  const kpis = [
    { label: "MONEY TAKEN",  value: fmt(revenue),      color: "#1A1A1A" },
    { label: "ORDERS",       value: String(orders),    color: "#1E3A5F" },
    { label: "ITEMS SOLD",   value: String(itemsSold), color: "#16a34a" },
    { label: "WASTAGE LOSS", value: fmt(wastageLoss),  color: "#8B3A3A" },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: mobile ? 14 : 28, background: "#F5F2EB" }}>
      <SectionHeader title="Daily Report" sub="What you took, what sold, and what you lost - for one day" />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
        <button onClick={() => shiftDay(-1)} style={ctrlBtn}>←</button>
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #E5E0D5", fontSize: 13 }} />
        <button onClick={() => shiftDay(1)} disabled={date >= today} style={{ ...ctrlBtn, background: date >= today ? "#F3F4F6" : "#FFF", cursor: date >= today ? "default" : "pointer" }}>→</button>
        <button onClick={() => setDate(today)} style={{ padding: "8px 14px", borderRadius: 6, border: "none", background: date === today ? "#1E3A5F" : "#E5E0D5", color: date === today ? "#FFF" : "#6B7280", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Today</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A", marginLeft: 4 }}>{niceDate}</span>
        <button onClick={exportCSV} style={{ marginLeft: "auto", padding: "8px 16px", borderRadius: 6, border: "1px solid #1E3A5F", background: "#FFF", color: "#1E3A5F", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Export CSV</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: mobile ? 10 : 16, marginBottom: 24 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: "#FFF", border: "1px solid #E5E0D5", borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", letterSpacing: 1, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color, fontFamily: "'Inter', monospace" }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#FFF", border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "#111827", borderBottom: "1px solid #E5E7EB" }}>Top selling items - {niceDate}</div>
        {topItems.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>No sales recorded on this day.</div>
        ) : (
          <TableScroll min={560}>
            <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 60px 110px 110px 120px", padding: "10px 16px", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
              {["#","Item","Sold","Revenue","Peak Time",""].map((h,i) => (
                <div key={i} style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase" }}>{h}</div>
              ))}
            </div>
            {topItems.map((item, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "32px 1fr 60px 110px 110px 120px", padding: "11px 16px", borderBottom: i < topItems.length-1 ? "1px solid #E5E7EB" : "none", alignItems: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF" }}>{i+1}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{item.name}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#16a34a" }}>{item.qty}x</div>
                <div style={{ fontSize: 13, color: "#111827" }}>KES {Math.round(item.revenue).toLocaleString()}</div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>🕐 {item.peakHour}</div>
                <div style={{ width: "100%", height: 6, borderRadius: 3, background: "#F3F4F6" }}>
                  <div style={{ width: `${Math.round((item.qty/topItems[0].qty)*100)}%`, height: "100%", background: "#16a34a", borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </TableScroll>
        )}
      </div>
    </div>
  );
}

// --- ROLE COLORS --------------------------------------------------------------
const ROLE_COLORS = {
  admin:       { bg: "#C5A059", light: "#FEF9F0", text: "#C5A059" },
  manager:     { bg: "#2C3E50", light: "#F0F4F8", text: "#2C3E50" },
  cashier:     { bg: "#2E7D64", light: "#ECFDF5", text: "#2E7D64" },
  storekeeper: { bg: "#B8860B", light: "#FFFBEB", text: "#B8860B" },
  waiter:      { bg: "#8B3A3A", light: "#FEF2F2", text: "#8B3A3A" },
};

const ROLE_AVATARS = {
  admin: "-", manager: "-", cashier: "-", storekeeper: "-", waiter: "-",
};

const PERM_GROUPS = ["General", "Inventory", "Reports", "Admin"];

// --- PERMISSION CHECKLIST -----------------------------------------------------
function PermissionChecklist({ permissions, onChange, disabledPerms = [], readOnly = false }) {
  return (
    <div>
      {PERM_GROUPS.map(group => {
        const perms = ALL_PERMISSIONS.filter(p => p.group === group);
        return (
          <div key={group} style={{ marginBottom: 18 }}>
            <div style={{ 
              fontSize: 10, 
              fontWeight: 600, 
              color: "#C5A059", 
              letterSpacing: 1, 
              textTransform: "uppercase", 
              marginBottom: 8,
              borderBottom: "1px solid #E5E0D5",
              paddingBottom: 4,
            }}>
              {group}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {perms.map(p => {
                const checked = permissions.includes(p.id);
                const disabled = readOnly || disabledPerms.includes(p.id);
                return (
                  <label key={p.id} style={{
                    display: "flex", 
                    alignItems: "flex-start", 
                    gap: 10, 
                    cursor: disabled ? "default" : "pointer",
                    padding: "8px 12px", 
                    borderRadius: 4,
                    background: checked ? "#ECFDF5" : "#F8F8F8",
                    border: `1px solid ${checked ? "#D1FAE5" : "#E5E0D5"}`,
                    opacity: disabled ? 0.55 : 1,
                    transition: "all 0.15s ease",
                  }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => !disabled && onChange(p.id)}
                      style={{ 
                        marginTop: 2, 
                        accentColor: "#2E7D64", 
                        width: 14, 
                        height: 14,
                        cursor: disabled ? "default" : "pointer",
                      }}
                    />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#1A1A1A" }}>{p.label}</div>
                      <div style={{ fontSize: 10, color: "#7A7A7A", marginTop: 2 }}>{p.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- PLACEHOLDER VIEW ---------------------------------------------------------
export function PlaceholderView({ label }) {
  return (
    <div style={{ 
      flex: 1, 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      background: "#F5F2EB", 
      flexDirection: "column", 
      gap: 16 
    }}>
      <div style={{ 
        fontSize: 48, 
        opacity: 0.3,
        color: "#C5A059",
        fontFamily: "'Cormorant Garamond', serif",
      }}>
        -
      </div>
      <div style={{ 
        fontWeight: 600, 
        fontSize: 16, 
        color: "#7A7A7A",
        letterSpacing: "0.5px",
      }}>
        {label}
      </div>
      <div style={{ 
        fontSize: 12, 
        color: "#9CA3AF" 
      }}>
        Under development
      </div>
    </div>
  );
}