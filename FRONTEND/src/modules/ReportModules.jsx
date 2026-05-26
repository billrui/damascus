import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ALL_PERMISSIONS, d } from "../data";
import { fmt } from "../utils";
import { Card, Badge, SectionHeader } from "../components/UI";

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
  const totalRevenue = sales.reduce((s, x) => s + x.total, 0);
  const totalOrders  = sales.length;

  const profitData = menuItems
    .filter((m) => sales.some((s) => (s.items || []).some((i) => (i.menuId || i.menu_item_id) === m.id)))
    .map((m) => {
      const qty    = sales.reduce((s, sale) => s + (sale.items || []).filter((i) => (i.menuId || i.menu_item_id) === m.id).reduce((a, i) => a + i.qty, 0), 0);
      const rev    = qty * m.price;
      const cogs   = qty * m.cost;
      const profit = rev - cogs;
      const margin = rev > 0 ? Math.round((profit / rev) * 100) : 0;
      return { ...m, qty, rev, cogs, profit, margin };
    })
    .sort((a, b) => b.profit - a.profit);

  const totalProfit    = profitData.reduce((s, p) => s + p.profit, 0);
  const overallMargin  = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;
  const totalWastageVal = wastage.reduce((s, w) => s + w.value, 0);

  const kpis = { revenue: totalRevenue, profit: totalProfit, margin: overallMargin, wastage: totalWastageVal };

  const summaryKpis = [
    { label: "GROSS REVENUE",  value: fmt(totalRevenue),   color: "#1A1A1A" },
    { label: "GROSS PROFIT",   value: fmt(totalProfit),    color: "#2E7D64" },
    { label: "OVERALL MARGIN", value: `${overallMargin}%`, color: "#C5A059" },
    { label: "WASTAGE LOSS",   value: fmt(totalWastageVal), color: "#8B3A3A" },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 28, background: "#F5F2EB" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between",
          marginBottom: 4,
        }}>
          <h1 style={{ 
            fontSize: 20, 
            fontWeight: 600, 
            color: "#1A1A1A",
            margin: 0,
            letterSpacing: "0.5px",
            fontFamily: "'Cormorant Garamond', serif",
          }}>
            Financial Analytics
          </h1>
          <div style={{ fontSize: 11, color: "#7A7A7A" }}>
            {new Date().toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>
        <div style={{ 
          width: 40, 
          height: 2, 
          background: "#C5A059", 
          marginTop: 6 
        }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        {summaryKpis.map((c) => (
          <Card key={c.label} style={{ padding: 18, borderTop: `3px solid ${c.color}` }}>
            <div style={{ 
              fontSize: 10, 
              fontWeight: 600, 
              color: "#7A7A7A", 
              letterSpacing: 1, 
              marginBottom: 6,
              textTransform: "uppercase",
            }}>
              {c.label}
            </div>
            <div style={{ 
              fontSize: 20, 
              fontWeight: 700, 
              color: c.color,
              fontFamily: "'Inter', monospace",
            }}>
              {c.value}
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card>
          <SectionHeader title="Profit by Menu Item" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={profitData.slice(0, 8)} margin={{ top: 0, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE6" vertical={false} />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 10, fill: "#7A7A7A" }} 
                angle={-30} 
                textAnchor="end" 
                axisLine={false} 
                tickLine={false} 
              />
              <YAxis 
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} 
                tick={{ fontSize: 10, fill: "#7A7A7A" }} 
                axisLine={false} 
                tickLine={false} 
                width={45} 
              />
              <Tooltip 
                formatter={(v) => [fmt(v), "Profit"]} 
                contentStyle={{ 
                  borderRadius: 6, 
                  border: "1px solid #E5E0D5", 
                  fontSize: 11,
                  fontFamily: "'Inter', sans-serif",
                }} 
              />
              <Bar dataKey="profit" fill="#C5A059" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "space-between", 
            marginBottom: 16 
          }}>
            <SectionHeader title="Item Profitability" />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => exportCSV(profitData, kpis)}
                title="Download CSV"
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 6, 
                  padding: "5px 12px", 
                  borderRadius: 4, 
                  border: "1px solid #E5E0D5", 
                  background: "#FFFFFF", 
                  fontSize: 10, 
                  fontWeight: 600, 
                  color: "#4A4A4A", 
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "#F8F8F8";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "#FFFFFF";
                }}
              >
                - CSV
              </button>
              <button
                onClick={() => exportPDF(profitData, kpis)}
                title="Print / Save PDF"
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 6, 
                  padding: "5px 12px", 
                  borderRadius: 4, 
                  border: "none", 
                  background: "#1A1A1A", 
                  fontSize: 10, 
                  fontWeight: 600, 
                  color: "#C5A059", 
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "#2C3E50";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "#1A1A1A";
                }}
              >
                PDF
              </button>
            </div>
          </div>
          <div style={{ overflowY: "auto", maxHeight: 280 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8F8F8" }}>
                  {["Item", "Qty", "Revenue", "COGS", "Profit", "Margin"].map((h) => (
                    <th key={h} style={{ 
                      padding: "10px 12px", 
                      textAlign: "left", 
                      fontSize: 10, 
                      fontWeight: 600, 
                      color: "#7A7A7A", 
                      borderBottom: "1px solid #E5E0D5",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profitData.map((p, i) => (
                  <tr key={p.id} style={{ 
                    borderBottom: i < profitData.length - 1 ? "1px solid #F0EDE6" : "none",
                    background: i % 2 === 0 ? "#FFFFFF" : "#F8F8F8",
                  }}>
                    <td style={{ 
                      padding: "8px 12px", 
                      fontSize: 11, 
                      fontWeight: 500, 
                      color: "#1A1A1A" 
                    }}>
                      {p.emoji} {p.name}
                    </td>
                    <td style={{ 
                      padding: "8px 12px", 
                      fontSize: 11, 
                      color: "#7A7A7A" 
                    }}>
                      -{p.qty}
                    </td>
                    <td style={{ 
                      padding: "8px 12px", 
                      fontSize: 11, 
                      color: "#4A4A4A" 
                    }}>
                      KES {p.rev.toLocaleString()}
                    </td>
                    <td style={{ 
                      padding: "8px 12px", 
                      fontSize: 11, 
                      color: "#4A4A4A" 
                    }}>
                      KES {p.cogs.toLocaleString()}
                    </td>
                    <td style={{ 
                      padding: "8px 12px", 
                      fontSize: 11, 
                      fontWeight: 600, 
                      color: "#2E7D64" 
                    }}>
                      KES {p.profit.toLocaleString()}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <Badge
                        color={p.margin >= 50 ? "#2E7D64" : p.margin >= 30 ? "#B8860B" : "#8B3A3A"}
                        bg={p.margin >= 50 ? "#ECFDF5" : p.margin >= 30 ? "#FFFBEB" : "#FEF2F2"}
                      >
                        {p.margin}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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