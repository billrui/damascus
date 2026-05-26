import { useState, useEffect } from "react";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from "recharts";
import { fmt, fmtK, classifyExpiry } from "../utils";
import { Card, Badge, Btn, SectionHeader } from "../components/UI";

function useBreakpoint() {
  const get = () => ({ mobile: window.innerWidth < 640, tablet: window.innerWidth >= 640 && window.innerWidth < 1024 });
  const [bp, setBp] = useState(get);
  useEffect(() => {
    const h = () => setBp(get());
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return bp;
}

// --- Luxury Hotel Theme -----------------------------------------------------
const LUXURY_THEME = {
  primary: "#C5A059",      // Refined gold/brass
  primaryLight: "#D4B87A",
  primaryDark: "#A0823A",
  primaryBg: "rgba(197, 160, 89, 0.08)",
  secondary: "#2C3E50",     // Deep navy
  success: "#2E7D64",       // Deep teal
  warning: "#B8860B",       // Dark goldenrod
  error: "#8B3A3A",         // Muted burgundy
  textPrimary: "#1A1A1A",
  textSecondary: "#4A4A4A",
  textMuted: "#7A7A7A",
  bg: "#FFFFFF",
  surface: "#F8F8F8",
  border: "#E5E0D5",
  hover: "#F0EDE6",
  accentLine: "#C5A059",
};

const FONTS = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Cormorant+Garamond:wght@400;500;600&display=swap";
const RESTAURANT = { label: "DAMASCUS HOTEL", accentColor: LUXURY_THEME.primary };

// --- Card Skeleton ---------------------------------------------------------
function CardSkeleton() {
  return (
    <div style={{
      background: LUXURY_THEME.bg,
      borderRadius: 8,
      padding: 20,
      border: `1px solid ${LUXURY_THEME.border}`,
      display: "flex",
      alignItems: "center",
      gap: 12
    }}>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 8,
        background: LUXURY_THEME.surface,
        animation: "skeletonPulse 1.4s ease-in-out infinite",
        flexShrink: 0
      }}/>
      <div style={{ flex: 1 }}>
        <div style={{
          height: 10,
          width: "60%",
          background: LUXURY_THEME.surface,
          borderRadius: 4,
          animation: "skeletonPulse 1.4s ease-in-out infinite",
          marginBottom: 8
        }}/>
        <div style={{
          height: 24,
          width: "40%",
          background: LUXURY_THEME.surface,
          borderRadius: 4,
          animation: "skeletonPulse 1.4s ease-in-out infinite"
        }}/>
      </div>
    </div>
  );
}

function ChartSkeleton({ height = 200 }) {
  return (
    <div style={{
      height,
      background: `linear-gradient(180deg, ${LUXURY_THEME.surface} 0%, ${LUXURY_THEME.border} 100%)`,
      borderRadius: 8,
      animation: "skeletonPulse 1.4s ease-in-out infinite"
    }}/>
  );
}

// --- Quick Action Button --------------------------------------------------
function QuickActionBtn({ icon, label, sub, color, bg, onClick }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={() => { setPressed(true); setTimeout(() => setPressed(false), 600); onClick?.(); }}
      style={{
        flex: 1,
        padding: "16px 20px",
        borderRadius: 6,
        border: "none",
        background: pressed ? color : bg,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "'Inter', sans-serif",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: pressed ? "scale(0.98)" : "scale(1)",
        boxShadow: pressed ? `0 2px 8px ${color}30` : "none",
      }}
      onMouseEnter={e => { if (!pressed) e.currentTarget.style.transform = "scale(1.01)"; }}
      onMouseLeave={e => { if (!pressed) e.currentTarget.style.transform = "scale(1)"; }}
    >
      <div style={{
        fontSize: 20,
        marginBottom: 8,
        fontWeight: 400,
        fontFamily: "'Cormorant Garamond', serif",
      }}>
        {icon}
      </div>
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        color: pressed ? "#fff" : LUXURY_THEME.textPrimary,
        transition: "color 0.2s",
        letterSpacing: "0.3px",
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 10,
        color: pressed ? "rgba(255,255,255,0.7)" : LUXURY_THEME.textMuted,
        marginTop: 4,
        transition: "color 0.2s",
      }}>
        {sub}
      </div>
    </button>
  );
}

// --- KPI Card -------------------------------------------------------------
function KPICard({ c, index, onNavigate }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80 + index * 60);
    return () => clearTimeout(t);
  }, [index]);

  return (
    <div
      onClick={() => c.nav && onNavigate(c.nav)}
      style={{
        background: LUXURY_THEME.bg,
        borderRadius: 8,
        padding: 20,
        border: `1px solid ${LUXURY_THEME.border}`,
        display: "flex",
        alignItems: "center",
        gap: 14,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(10px)",
        transition: "opacity 0.35s ease, transform 0.35s ease",
        cursor: c.nav ? "pointer" : "default",
      }}
      onMouseEnter={e => {
        if (c.nav) {
          e.currentTarget.style.borderColor = LUXURY_THEME.primary;
          e.currentTarget.style.boxShadow = `0 2px 8px ${LUXURY_THEME.primary}15`;
        }
      }}
      onMouseLeave={e => {
        if (c.nav) {
          e.currentTarget.style.borderColor = LUXURY_THEME.border;
          e.currentTarget.style.boxShadow = "none";
        }
      }}
    >
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 8,
        background: c.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 20,
        fontWeight: 500,
        fontFamily: "'Cormorant Garamond', serif",
        flexShrink: 0,
      }}>
        {c.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 10,
          fontWeight: 600,
          color: LUXURY_THEME.textMuted,
          letterSpacing: 1.2,
          marginBottom: 4,
          textTransform: "uppercase",
        }}>
          {c.label}
        </div>
        <div style={{
          fontSize: (c.label === "WASTAGE VALUE" || c.label === "TOTAL SALES") ? 18 : 26,
          fontWeight: 600,
          color: c.alert ? LUXURY_THEME.error : LUXURY_THEME.textPrimary,
          lineHeight: 1.2,
          fontFamily: "'Inter', monospace",
        }}>
          {c.value}
        </div>
        {c.change && (
          <div style={{ fontSize: 10, color: LUXURY_THEME.success, marginTop: 4 }}>
            {c.change}
          </div>
        )}
        {c.link && (
          <div style={{
            fontSize: 10,
            color: LUXURY_THEME.primary,
            marginTop: 4,
            fontWeight: 500,
            textDecoration: "none",
          }}>
            {c.link}
          </div>
        )}
      </div>
      {c.alert && (
        <div style={{
          marginLeft: "auto",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: LUXURY_THEME.error,
          animation: "alertPulse 1.5s ease-in-out infinite",
        }}/>
      )}
    </div>
  );
}

// --- Main DashboardView ---------------------------------------------------
export default function DashboardView({ sales, batches, storeIssues, wastage, setActiveNav, ingredients = [], menuItems = [] }) {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("today");
  const { mobile, tablet } = useBreakpoint();

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  // Filter sales by date range
  const filteredSales = (() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    if (dateRange === "today") return sales.filter(s => s.date === todayStr);
    if (dateRange === "week") {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return sales.filter(s => new Date(s.date) >= weekAgo);
    }
    if (dateRange === "month") {
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return sales.filter(s => new Date(s.date) >= monthAgo);
    }
    return sales;
  })();

  // KPI computations
  const todaySales = filteredSales.reduce((s, x) => s + x.total, 0);
  const totalOrders = filteredSales.length;
  const expiryAlerts = batches.map(b => classifyExpiry(b)).filter(e => e.status !== "ok").length;
  const lowStock = ingredients.filter(ing => {
    const total = batches
      .filter(b => (b.ingredient_id || b.ingredientId) === ing.id && b.status === "active")
      .reduce((s, b) => s + Number(b.remaining), 0);
    return total <= Number(ing.reorder_level || ing.reorderLevel || 0);
  }).length;
  const totalWastage = wastage.reduce((s, w) => s + (w.value || 0), 0);

  const payBreakdown = [
    { name: "Cash",   value: filteredSales.filter(s => s.payment === "cash").reduce((a, s) => a + s.total, 0),  color: LUXURY_THEME.warning },
    { name: "Card",   value: filteredSales.filter(s => s.payment === "card").reduce((a, s) => a + s.total, 0),  color: LUXURY_THEME.secondary },
    { name: "M-Pesa", value: filteredSales.filter(s => s.payment === "mpesa").reduce((a, s) => a + s.total, 0), color: LUXURY_THEME.success },
  ].filter(p => p.value > 0);

  const hourlyData = (() => {
    const hrs = {};
    for (const s of filteredSales) {
      const h = parseInt((s.time || s.sale_time || "0:00").split(":")[0]);
      const label = `${h}:00`;
      hrs[label] = (hrs[label] || 0) + s.total;
    }
    return Object.entries(hrs).map(([h, v]) => ({ hour: h, sales: v }));
  })();

  const topMenuItems = (() => {
    const counts = {};
    for (const s of filteredSales) {
      for (const item of (s.items || [])) {
        const id = item.menuId || item.menu_item_id;
        counts[id] = (counts[id] || 0) + (item.qty || 1);
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, qty]) => ({ ...(menuItems.find(m => m.id === id) || { id, name: id }), qty }))
      .filter(Boolean);
  })();

  const rangeLabel = dateRange === "today" ? "Today" : dateRange === "week" ? "Last 7 days" : dateRange === "month" ? "Last 30 days" : "All time";

  const kpis = [
    { label: "TOTAL SALES", value: fmt(todaySales), change: rangeLabel, icon: "-", bg: "#ECFDF5", nav: "pos" },
    { label: "TRANSACTIONS", value: totalOrders, change: `${totalOrders} orders`, icon: "#", bg: "#EFF6FF" },
    { label: "EXPIRY ALERTS", value: expiryAlerts, link: "Review", nav: "expiry", icon: "!", bg: "#FEF2F2", alert: expiryAlerts > 0 },
    { label: "LOW STOCK", value: lowStock, link: "Review", nav: "inventory", icon: "-", bg: "#FFF7ED", alert: lowStock > 0 },
    { label: "WASTAGE VALUE", value: fmt(totalWastage), link: "Review", nav: "wastage", icon: "-", bg: "#FDF4FF" },
  ];

  return (
    <div style={{
      flex: 1,
      overflowY: "auto",
      padding: mobile ? "16px 14px" : tablet ? "20px 20px" : 32,
      background: "#F5F2EB",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <link rel="stylesheet" href={FONTS} />
      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes alertPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        ::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        ::-webkit-scrollbar-track {
          background: #E5E0D5;
          border-radius: 2px;
        }
        ::-webkit-scrollbar-thumb {
          background: #C5A059;
          border-radius: 2px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #A0823A;
        }
      `}</style>

      {/* Header Section */}
      <div style={{
        display: "flex",
        alignItems: mobile ? "flex-start" : "flex-end",
        justifyContent: "space-between",
        marginBottom: mobile ? 20 : 32,
        flexWrap: "wrap",
        gap: 12,
        animation: "fadeInUp 0.5s ease",
        borderBottom: `1px solid ${LUXURY_THEME.border}`,
        paddingBottom: mobile ? 14 : 20,
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: mobile ? 18 : 24,
            fontWeight: 500,
            color: LUXURY_THEME.textPrimary,
            letterSpacing: "0.5px",
            fontFamily: "'Cormorant Garamond', serif",
          }}>
            Executive Dashboard
          </h1>
          <p style={{
            margin: "6px 0 0",
            fontSize: 11,
            color: LUXURY_THEME.textMuted,
            letterSpacing: "0.3px",
          }}>
            {RESTAURANT.label} - {new Date().toLocaleDateString("en-KE", { weekday: mobile ? "short" : "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* Date range filter */}
          <div style={{
            display: "flex",
            background: LUXURY_THEME.bg,
            borderRadius: 4,
            border: `1px solid ${LUXURY_THEME.border}`,
            overflow: "hidden",
          }}>
            {[
              ["today", "Today"],
              ["week", "Week"],
              ["month", "Month"],
              ["all", "All"]
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setDateRange(key)}
                style={{
                  padding: mobile ? "5px 10px" : "6px 16px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 500,
                  background: dateRange === key ? LUXURY_THEME.primary : "transparent",
                  color: dateRange === key ? "#fff" : LUXURY_THEME.textSecondary,
                  transition: "all 0.2s ease",
                  letterSpacing: "0.3px",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {!mobile && <Btn onClick={() => setActiveNav("pos")}>+ New Transaction</Btn>}
        </div>
      </div>

      {/* KPI Row */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(2,1fr)" : tablet ? "repeat(3,1fr)" : "repeat(5, 1fr)", gap: mobile ? 10 : 16, marginBottom: mobile ? 20 : 32 }}>
          {[1, 2, 3, 4, 5].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(2,1fr)" : tablet ? "repeat(3,1fr)" : "repeat(5, 1fr)", gap: mobile ? 10 : 16, marginBottom: mobile ? 20 : 32 }}>
          {kpis.map((c, i) => <KPICard key={c.label} c={c} index={i} onNavigate={setActiveNav} />)}
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ marginBottom: mobile ? 20 : 32 }}>
        <div style={{
          fontSize: 10,
          fontWeight: 600,
          color: LUXURY_THEME.textMuted,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          marginBottom: 12,
        }}>
          Operations
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(2,1fr)" : tablet ? "repeat(3,1fr)" : "repeat(5,1fr)", gap: mobile ? 8 : 12 }}>
          <QuickActionBtn
            icon="IN"
            label="Receive Stock"
            sub="Log incoming deliveries"
            color={LUXURY_THEME.primary}
            bg={`${LUXURY_THEME.primary}10`}
            onClick={() => setActiveNav("receive")}
          />
          <QuickActionBtn
            icon="OUT"
            label="Issue Stock"
            sub="Kitchen & bar requisitions"
            color={LUXURY_THEME.warning}
            bg={`${LUXURY_THEME.warning}10`}
            onClick={() => setActiveNav("issue")}
          />
          <QuickActionBtn
            icon="-"
            label="Stock Audit"
            sub="Physical count & variance"
            color={LUXURY_THEME.success}
            bg={`${LUXURY_THEME.success}10`}
            onClick={() => setActiveNav("inventory")}
          />
          <QuickActionBtn
            icon="-"
            label="Reports"
            sub="Sales & analytics"
            color={LUXURY_THEME.secondary}
            bg={`${LUXURY_THEME.secondary}10`}
            onClick={() => setActiveNav("reports")}
          />
          <QuickActionBtn
            icon="!"
            label="Expiry Alerts"
            sub={`${expiryAlerts} items requiring attention`}
            color={LUXURY_THEME.error}
            bg={`${LUXURY_THEME.error}10`}
            onClick={() => setActiveNav("expiry")}
          />
        </div>
      </div>

      {/* Charts Row */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : tablet ? "1fr" : "1fr 360px", gap: 20, marginBottom: mobile ? 20 : 32 }}>
          <Card><ChartSkeleton height={260} /></Card>
          {!mobile && <Card><ChartSkeleton height={260} /></Card>}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : tablet ? "1fr" : "1fr 360px", gap: 20, marginBottom: mobile ? 20 : 32 }}>
          <Card>
            <SectionHeader title="Revenue Stream" sub="Hourly transaction volume" />
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={hourlyData}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={LUXURY_THEME.primary} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={LUXURY_THEME.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 2" stroke={LUXURY_THEME.border} vertical={false} />
                <XAxis 
                  dataKey="hour" 
                  tick={{ fontSize: 10, fill: LUXURY_THEME.textMuted }} 
                  axisLine={false} 
                  tickLine={false} 
                />
                <YAxis 
                  tickFormatter={fmtK} 
                  tick={{ fontSize: 9, fill: LUXURY_THEME.textMuted }} 
                  axisLine={false} 
                  tickLine={false} 
                  width={45} 
                />
                <Tooltip
                  formatter={v => [fmt(v), "Revenue"]}
                  contentStyle={{
                    borderRadius: 4,
                    border: `1px solid ${LUXURY_THEME.border}`,
                    fontSize: 11,
                    fontFamily: "'Inter', sans-serif",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke={LUXURY_THEME.primary}
                  strokeWidth={1.5}
                  fill="url(#salesGradient)"
                  dot={{ r: 2, fill: LUXURY_THEME.primary, strokeWidth: 1 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <SectionHeader title="Payment Distribution" sub="Method breakdown" />
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={payBreakdown}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  innerRadius={50}
                  paddingAngle={2}
                >
                  {payBreakdown.map((entry, index) => (
                    <Cell key={index} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip formatter={v => [fmt(v)]} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
              {payBreakdown.map(p => (
                <div key={p.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, background: p.color }} />
                    <span style={{ fontSize: 11, color: LUXURY_THEME.textSecondary }}>{p.name}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: LUXURY_THEME.textPrimary }}>
                    {fmt(p.value)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Bottom Row */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 20 }}>
          <Card><ChartSkeleton height={240} /></Card>
          {!mobile && <Card><ChartSkeleton height={240} /></Card>}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 20 }}>
          {/* Top Selling Items */}
          <Card>
            <SectionHeader title="Top Performers" sub="Highest volume items" />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {topMenuItems.length === 0 ? (
                <div style={{ textAlign: "center", padding: 48, color: LUXURY_THEME.textMuted, fontSize: 12 }}>
                  No sales data available
                </div>
              ) : (
                topMenuItems.map((item, idx) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      animation: `slideIn 0.3s ease ${idx * 0.07}s forwards`,
                      opacity: 0,
                    }}
                  >
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 4,
                      background: `${LUXURY_THEME.warning}12`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      fontWeight: 500,
                      fontFamily: "'Cormorant Garamond', serif",
                      flexShrink: 0,
                      color: LUXURY_THEME.warning,
                    }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: LUXURY_THEME.textPrimary }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: 10, color: LUXURY_THEME.textMuted, marginTop: 2 }}>
                        {item.qty} units - {fmt(item.price * item.qty)} volume
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: LUXURY_THEME.textPrimary }}>
                        {fmt(item.price)}
                      </div>
                      <div style={{ fontSize: 9, color: LUXURY_THEME.success }}>
                        {Math.round(((item.price - item.cost) / item.price) * 100)}% margin
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <SectionHeader
              title="Recent Activity"
              sub="Latest transactions"
              action={
                <span
                  style={{ fontSize: 10, color: LUXURY_THEME.primary, cursor: "pointer", fontWeight: 500, letterSpacing: "0.3px" }}
                  onClick={() => setActiveNav("reports")}
                >
                  View All -
                </span>
              }
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {filteredSales.slice(-5).reverse().map((s, i) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 0",
                    borderBottom: i < 4 ? `1px solid ${LUXURY_THEME.border}` : "none",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: LUXURY_THEME.textPrimary }}>
                      {s.id}
                    </div>
                    <div style={{ fontSize: 10, color: LUXURY_THEME.textMuted, marginTop: 2 }}>
                      {s.customer} - {s.time}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: LUXURY_THEME.textPrimary }}>
                      {fmt(s.total)}
                    </div>
                    <Badge
                      color={s.payment === "cash" ? LUXURY_THEME.success : s.payment === "mpesa" ? LUXURY_THEME.primary : LUXURY_THEME.secondary}
                      bg={s.payment === "cash" ? `${LUXURY_THEME.success}12` : s.payment === "mpesa" ? `${LUXURY_THEME.primary}12` : `${LUXURY_THEME.secondary}12`}
                    >
                      {s.payment === "mpesa" ? "M-Pesa" : s.payment.charAt(0).toUpperCase() + s.payment.slice(1)}
                    </Badge>
                  </div>
                </div>
              ))}
              {filteredSales.length === 0 && (
                <div style={{ textAlign: "center", padding: 48, color: LUXURY_THEME.textMuted, fontSize: 12 }}>
                  No transactions recorded
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}