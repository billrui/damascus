import { useState, useEffect } from "react";
import { d } from "../data";
import { classifyExpiry, computeVariance } from "../utils";
import { inventoryApi } from "../api";
import { Card, Badge, Btn, Select, Input, SectionHeader, ExpiryBadge, FlagBadge } from "../components/UI";
import { useBreakpoint } from "../hooks/useBreakpoint";

// --- LUXURY HOTEL THEME CONSTANTS ---------------------------------------------
const LUXURY_THEME = {
  primary: "#C5A059",
  primaryLight: "#D4B87A",
  primaryDark: "#A0823A",
  error: "#8B3A3A",
  errorDark: "#5C1E1E",
  warning: "#B8860B",
  warningDark: "#8B6508",
  success: "#2E7D64",
  successLight: "#ECFDF5",
  info: "#3B82F6",
  infoLight: "#EFF6FF",
  under: "#C5A059",
  underLight: "#FEF9F0",
  textPrimary: "#1A1A1A",
  textSecondary: "#4A4A4A",
  textMuted: "#7A7A7A",
  border: "#E5E0D5",
  bg: "#FFFFFF",
  surface: "#F8F8F8",
};

// Custom variance badge with enhanced colors - DIFFERENT COLORS FOR EACH TYPE
function VarianceStatusBadge({ variance, variancePct, shrinkageValue }) {
  if (variance === null || variance === undefined) {
    return <Badge color={LUXURY_THEME.textMuted} bg="#F3F4F6">No Data</Badge>;
  }
  
  if (variance === 0) {
    return <Badge color={LUXURY_THEME.success} bg={LUXURY_THEME.successLight}>Balanced</Badge>;
  }
  
  if (variance > 0) {
    if (variancePct > 20) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Badge color="#DC2626" bg="#FEE2E2">Used way too much</Badge>
          {shrinkageValue > 0 && (
            <span style={{ fontSize: 9, color: "#DC2626", fontWeight: 600 }}>
              Loss: KES {shrinkageValue.toLocaleString()}
            </span>
          )}
        </div>
      );
    } else if (variancePct > 10) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Badge color="#F97316" bg="#FFF7ED">Used too much</Badge>
          {shrinkageValue > 0 && (
            <span style={{ fontSize: 9, color: "#F97316", fontWeight: 600 }}>
              Loss: KES {shrinkageValue.toLocaleString()}
            </span>
          )}
        </div>
      );
    } else {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Badge color="#F59E0B" bg="#FEF3C7">Slightly over</Badge>
          <span style={{ fontSize: 9, color: "#F59E0B", fontWeight: 500 }}>
            Loss: KES {shrinkageValue.toLocaleString()}
          </span>
        </div>
      );
    }
  }
  
  if (variance < 0) {
    const absVariance = Math.abs(variance);
    if (absVariance > 10) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Badge color="#8B5CF6" bg="#EDE9FE">Used much less</Badge>
          <span style={{ fontSize: 9, color: "#8B5CF6", fontWeight: 500 }}>
            Short by {absVariance}
          </span>
        </div>
      );
    } else {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Badge color="#06B6D4" bg="#CFFAFE">Used a bit less</Badge>
          <span style={{ fontSize: 9, color: "#06B6D4", fontWeight: 500 }}>
            Short by {absVariance}
          </span>
        </div>
      );
    }
  }
  
  return <FlagBadge flag={variance > 0 ? "warning" : variance < 0 ? "under" : "ok"} />;
}

// Enhanced variance cell with color coding - DIFFERENT COLORS FOR EACH TYPE
function VarianceCell({ variance, variancePct, shrinkageValue }) {
  if (variance === null || isNaN(variance)) {
    return <span style={{ color: LUXURY_THEME.textMuted }}>-</span>;
  }
  
  const isPos = variance > 0;
  const isZero = variance === 0;
  const isCritical = isPos && variancePct > 20;
  const isWarning = isPos && variancePct > 10 && variancePct <= 20;
  const isMinor = isPos && variancePct <= 10;
  const isUnderCritical = !isPos && !isZero && Math.abs(variance) > 10;
  const isUnderMinor = !isPos && !isZero && Math.abs(variance) <= 10;
  
  let bgColor = LUXURY_THEME.bg;
  let textColor = LUXURY_THEME.textSecondary;
  let borderColor = "transparent";
  let icon = "";
  
  if (isZero) {
    bgColor = "#D1FAE5";
    textColor = "#059669";
    borderColor = "#10B981";
    icon = "-";
  } else if (isCritical) {
    bgColor = "#FEE2E2";
    textColor = "#DC2626";
    borderColor = "#EF4444";
    icon = "-";
  } else if (isWarning) {
    bgColor = "#FFF7ED";
    textColor = "#F97316";
    borderColor = "#F97316";
    icon = "!";
  } else if (isMinor && isPos) {
    bgColor = "#FEF3C7";
    textColor = "#F59E0B";
    borderColor = "#F59E0B";
    icon = "-";
  } else if (isUnderCritical) {
    bgColor = "#EDE9FE";
    textColor = "#8B5CF6";
    borderColor = "#8B5CF6";
    icon = "-";
  } else if (isUnderMinor) {
    bgColor = "#CFFAFE";
    textColor = "#06B6D4";
    borderColor = "#06B6D4";
    icon = "-";
  }
  
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{
        background: bgColor,
        color: textColor,
        fontWeight: 700,
        fontSize: 12,
        padding: "4px 10px",
        borderRadius: 4,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "'Inter', monospace",
        width: "fit-content",
        border: `1px solid ${borderColor}`,
      }}>
        <span style={{ fontSize: 11 }}>{icon}</span>
        {isPos ? `+${variance.toFixed(2)}` : variance.toFixed(2)}
        <span style={{ fontSize: 10, opacity: 0.7 }}>({variancePct.toFixed(1)}%)</span>
      </div>
      {!isZero && (
        <div style={{ fontSize: 10, fontWeight: 500, color: textColor }}>
          {isPos ? `Loss: KES ${Math.abs(shrinkageValue).toLocaleString()}` : `Shortfall: ${Math.abs(variance).toFixed(2)} units`}
        </div>
      )}
      {isCritical && (
        <div style={{ fontSize: 9, color: "#DC2626", marginTop: 2, fontWeight: 600 }}>
          Immediate investigation required
        </div>
      )}
      {isUnderCritical && (
        <div style={{ fontSize: 9, color: "#8B5CF6", marginTop: 2, fontWeight: 600 }}>
          Stock count verification required
        </div>
      )}
    </div>
  );
}

// --- EXPIRY CONTROL VIEW ------------------------------------------------------
export function ExpiryView({ batches, setBatches, wastage, setWastage, user, ingredients = [] }) {
  const { mobile } = useBreakpoint();
  // Show expiry as a clean local date (e.g. 11/5/2026), not a raw ISO timestamp
  const fmtExpiry = (d) => {
    if (!d) return "—";
    const dt = new Date(d);
    return isNaN(dt) ? "—" : `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
  };
  const [filterStatus, setFilterStatus] = useState("all");
  const [clearing, setClearing] = useState(false);
  const isBoss = user?.role === "admin" || user?.role === "manager";

  const expiredWithStock = batches.filter((b) => classifyExpiry(b).status === "expired" && (parseFloat(b.remaining) || 0) > 0);

  const clearAllExpired = async () => {
    if (!expiredWithStock.length) return;
    if (!window.confirm(`Clear ${expiredWithStock.length} expired batch${expiredWithStock.length !== 1 ? "es" : ""} from stock?\n\nThis quietly removes them (no loss is recorded). For real spoilage you want to record as a loss, use each card's "Throw away & record loss" button instead.`)) return;
    setClearing(true);
    const done = [];
    for (const b of expiredWithStock) {
      try {
        await inventoryApi.adjustBatch(b.id, { remaining: 0, status: "written_off", notes: "Bulk clear - expired" });
        done.push(b.id);
      } catch (e) { console.error("Clear failed for", b.id, e?.message); }
    }
    setBatches((p) => p.map((b) => done.includes(b.id) ? { ...b, remaining: 0, status: "written_off" } : b));
    setClearing(false);
  };

  const enriched = batches
    .map((b) => {
      const ing = ingredients.find((i) => i.id === (b.ingredient_id || b.ingredientId));
      const exp = classifyExpiry(b);
      const cost = parseFloat(ing?.costPerUnit ?? ing?.cost_per_unit) || 0;
      const lossValue = (parseFloat(b.remaining) || 0) * cost;
      return { ...b, ingredientName: ing?.name, unit: ing?.unit, ...exp, lossValue: Math.round(lossValue) };
    })
    .filter((b) => {
      if (filterStatus === "all") return true;
      if (filterStatus === "alerts") return !["ok", "consumed"].includes(b.status) && b.days !== undefined;
      return b.status === filterStatus;
    })
    .sort((a, b) => a.days - b.days);

  const totalAtRisk = enriched.filter((b) => ["expired", "expiring", "critical", "warning"].includes(b.status)).reduce((s, b) => s + b.lossValue, 0);

  const writeOff = (batchId) => {
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) return;
    const ing = ingredients.find((i) => i.id === (batch.ingredient_id || batch.ingredientId));
    setBatches((p) => p.map((b) => b.id === batchId ? { ...b, status: "expired" } : b));
    if (setWastage) {
      const cost = parseFloat(ing?.costPerUnit ?? ing?.cost_per_unit) || 0;
      const lossValue = Math.round((parseFloat(batch.remaining) || 0) * cost);
      const autoEntry = {
        id: `WST-WO-${String(Date.now()).slice(-5)}`,
        date: new Date().toISOString().split("T")[0],
        ingredientId: batch.ingredientId,
        ingredient: ing?.name || "Unknown",
        unit: ing?.unit || "",
        qty: batch.remaining,
        value: lossValue,
        reason: "write-off",
        batchRef: batch.batchNo,
        notes: `Auto-created from Expiry write-off - batch ${batch.batchNo}`,
        recordedBy: user?.name || "System",
      };
      setWastage((p) => [autoEntry, ...p]);
    }
  };

  const expiryCounters = [
    { label: "Expired", value: batches.filter((b) => classifyExpiry(b).status === "expired").length, color: "#DC2626", bg: "#FEE2E2" },
    { label: "Expires today", value: batches.filter((b) => classifyExpiry(b).status === "expiring").length, color: "#EA580C", bg: "#FFF7ED" },
    { label: "Use within 3 days", value: batches.filter((b) => classifyExpiry(b).status === "critical").length, color: "#F97316", bg: "#FFF7ED" },
    { label: "Use within a week", value: batches.filter((b) => classifyExpiry(b).status === "warning").length, color: "#F59E0B", bg: "#FEF3C7" },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: mobile ? 14 : 32, background: "#F5F2EB" }}>
      <SectionHeader title="Expiry Control" sub="Use up or clear out stock before it goes off" />
      <div style={{ background:"#FFFFFF", border:`1px solid ${LUXURY_THEME.border}`, borderRadius:8, padding:"14px 18px", marginBottom:20, fontSize:13, color:LUXURY_THEME.textSecondary, lineHeight:1.6 }}>
        This lists ingredients that are close to their expiry date or already past it — oldest first — so you can use them up quickly or write them off before they're wasted.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: mobile ? 10 : 16, marginBottom: 24 }}>
        {expiryCounters.map((c) => (
          <Card key={c.label} style={{ padding: 16, borderLeft: `4px solid ${c.color}`, background: c.bg }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: LUXURY_THEME.textMuted, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: c.color, fontFamily: "'Inter', monospace" }}>{c.value}</div>
          </Card>
        ))}
      </div>

      {totalAtRisk > 0 && (
        <div style={{ background: "#FEF2F2", border: `1px solid #DC2626`, borderRadius: 6, padding: "14px 18px", marginBottom: 24, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 32, height: 32, borderRadius: 4, background: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#FFFFFF", fontSize: 16 }}>!</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#DC2626", marginBottom: 2 }}>KES {totalAtRisk.toLocaleString()} of stock could be wasted</div>
            <div style={{ fontSize: 11, color: LUXURY_THEME.textSecondary }}>These items are near or past expiry — use them or write them off soon</div>
          </div>
        </div>
      )}

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", display: "flex", gap: 10, alignItems: "center", background: LUXURY_THEME.surface, borderBottom: `1px solid ${LUXURY_THEME.border}` }}>
          {[["all", "All"], ["alerts", "Needs attention"], ["expired", "Expired"], ["active", "Still good"]].map(([k, l]) => (
            <button key={k} onClick={() => setFilterStatus(k)} style={{ padding: "5px 14px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, background: filterStatus === k ? LUXURY_THEME.primary : "transparent", color: filterStatus === k ? "#FFFFFF" : LUXURY_THEME.textSecondary, transition: "all 0.2s ease", letterSpacing: "0.3px" }}>{l}</button>
          ))}
          {isBoss && expiredWithStock.length > 0 && (
            <button onClick={clearAllExpired} disabled={clearing} title="Removes expired batches without recording a loss — for clearing test data" style={{ marginLeft: "auto", padding: "5px 14px", borderRadius: 4, border: "1px solid #DC2626", cursor: clearing ? "wait" : "pointer", fontSize: 11, fontWeight: 700, background: "transparent", color: "#DC2626", opacity: clearing ? 0.6 : 1 }}>
              {clearing ? "Clearing…" : `Clear ${expiredWithStock.length} (test data, no loss)`}
            </button>
          )}
        </div>
        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {enriched.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", color: LUXURY_THEME.textMuted, fontSize:13 }}>
              No batches to show{filterStatus!=="all" ? " for this filter" : ""}.
            </div>
          ) : enriched.map((b) => {
            const meta = ({
              expired:  { bar:"#DC2626", bg:"#FEF2F2", label:"Expired" },
              expiring: { bar:"#EA580C", bg:"#FFF7ED", label:"Expires today" },
              critical: { bar:"#F97316", bg:"#FFF7ED", label:"Use very soon" },
              warning:  { bar:"#F59E0B", bg:"#FEF3C7", label:"Use this week" },
              ok:       { bar:"#10B981", bg:"#F0FDF4", label:"Fine for now" },
            })[b.status] || { bar:"#6B7280", bg:"#F9FAFB", label:(b.status||"\u2014") };
            const ad = Math.abs(b.days);
            const daysText = b.status === "expired" ? `Expired ${ad} day${ad!==1?"s":""} ago`
              : b.days === 0 ? "Expires today"
              : b.days > 0 ? `${b.days} day${b.days!==1?"s":""} left`
              : "";
            return (
              <div key={b.id} style={{ background: meta.bg, borderLeft:`4px solid ${meta.bar}`, borderRadius:8, padding:"14px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, marginBottom:6, flexWrap:"wrap" }}>
                  <span style={{ fontSize:14, fontWeight:700, color:"#111827" }}>{b.ingredientName || "Unknown"}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:"#FFF", background:meta.bar, padding:"3px 10px", borderRadius:20 }}>{meta.label}</span>
                </div>
                <div style={{ fontSize:12.5, color:"#374151", lineHeight:1.6 }}>
                  <strong>{(parseFloat(b.remaining)||0).toLocaleString()} {b.unit}</strong> left · Expiry {fmtExpiry(b.expiryDate ?? b.expiry_date)}{daysText ? ` · ${daysText}` : ""}.
                  {b.lossValue > 0 && <span style={{ color:"#DC2626", fontWeight:700 }}> Value at risk: KES {b.lossValue.toLocaleString()}.</span>}
                </div>
                {["expired","expiring","critical"].includes(b.status) && (
                  <div style={{ marginTop:10, fontSize:11, color:"#B45309", fontWeight:600 }}>
                    → Sent to the Waste Log for the manager to write off.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// --- VARIANCE VIEW WITH DIFFERENT COLORS --------------------------------------
export function VarianceView({ ingredients = [] }) {
  const { mobile } = useBreakpoint();
  const [filterFlag, setFilterFlag] = useState("all");
  const ymd = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const today = ymd(new Date());
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState("dish"); // "dish" = produced vs sold, "ingredient" = recipes
  const [rows, setRows] = useState(null);
  const [dish, setDish] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let on = true;
    setLoading(true); setErr("");
    if (mode === "ingredient") {
      inventoryApi.variance({ from: date, to: date })
        .then((res) => { if (!on) return;
          setRows((res.variance || []).map((r) => ({ ...r, variancePct: r.variance_pct, shrinkageValue: r.shrinkage_value }))); })
        .catch((e) => { if (on) setErr(e?.response?.data?.error || "Could not load variance"); })
        .finally(() => { if (on) setLoading(false); });
    } else {
      inventoryApi.varianceProduction({ date })
        .then((res) => { if (on) setDish(res.items || []); })
        .catch((e) => { if (on) setErr(e?.response?.data?.error || "Could not load variance"); })
        .finally(() => { if (on) setLoading(false); });
    }
    return () => { on = false; };
  }, [date, mode]);

  const data = (rows || []).filter((r) => filterFlag === "all" || r.flag === filterFlag);

  const totalShrinkage = data.filter((r) => r.flag === "critical" || r.flag === "warning").reduce((s, r) => s + r.shrinkageValue, 0);
  const totalUnderIssued = data.filter((r) => r.flag === "under").reduce((s, r) => s + Math.abs(r.variance), 0);

  const shiftDay = (offset) => { const dt = new Date(date + "T00:00:00"); dt.setDate(dt.getDate() + offset); setDate(ymd(dt)); };
  const niceDate = new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  const summaryCards = [
    { label: "Critical Variances", value: data.filter((r) => r.flag === "critical").length, color: "#DC2626", bg: "#FEE2E2" },
    { label: "Warnings", value: data.filter((r) => r.flag === "warning").length, color: "#F97316", bg: "#FFF7ED" },
    { label: "Under-Issued", value: data.filter((r) => r.flag === "under").length, color: "#8B5CF6", bg: "#EDE9FE" },
    { label: "Shrinkage Value", value: `KES ${totalShrinkage.toLocaleString()}`, color: totalShrinkage > 0 ? "#DC2626" : "#10B981", bg: totalShrinkage > 0 ? "#FEE2E2" : "#D1FAE5" },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: mobile ? 14 : 32, background: "#F5F2EB" }}>
      <SectionHeader title="Daily Variance" sub={mode === "dish" ? "Produced vs sold, for one day" : "Should-have-used vs issued, for one day"} />

      {/* Date controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <button onClick={() => shiftDay(-1)} style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${LUXURY_THEME.border}`, background: "#FFF", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>←</button>
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${LUXURY_THEME.border}`, fontSize: 13 }} />
        <button onClick={() => shiftDay(1)} disabled={date >= today} style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${LUXURY_THEME.border}`, background: date >= today ? "#F3F4F6" : "#FFF", cursor: date >= today ? "default" : "pointer", fontSize: 14, fontWeight: 700 }}>→</button>
        <button onClick={() => setDate(today)} style={{ padding: "8px 14px", borderRadius: 6, border: "none", background: date === today ? LUXURY_THEME.primary : "#E5E0D5", color: date === today ? "#FFF" : "#6B7280", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Today</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: LUXURY_THEME.textPrimary, marginLeft: 4 }}>{niceDate}</span>
        {loading && <span style={{ fontSize: 12, color: LUXURY_THEME.textMuted }}>Loading…</span>}
      </div>

      {err && <div style={{ padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, fontSize: 12, color: "#8B3A3A", marginBottom: 16 }}>{err}</div>}

      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <button onClick={() => setMode("dish")} style={{ padding: "8px 14px", borderRadius: 6, border: "none", background: mode === "dish" ? LUXURY_THEME.primary : "#E5E0D5", color: mode === "dish" ? "#FFF" : "#6B7280", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>By dish (produced vs sold)</button>
        <button onClick={() => setMode("ingredient")} style={{ padding: "8px 14px", borderRadius: 6, border: "none", background: mode === "ingredient" ? LUXURY_THEME.primary : "#E5E0D5", color: mode === "ingredient" ? "#FFF" : "#6B7280", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>By ingredient (recipes)</button>
      </div>

      {mode === "dish" && (
        <div>
          <div style={{ background: "#FFF", border: `1px solid ${LUXURY_THEME.border}`, borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: LUXURY_THEME.textPrimary, marginBottom: 6 }}>What this shows</div>
            <div style={{ fontSize: 13, color: LUXURY_THEME.textSecondary, lineHeight: 1.6 }}>
              For each dish: how many you <strong style={{ color: "#059669" }}>produced</strong> (kitchen log) versus how many you <strong style={{ color: "#B45309" }}>sold</strong> today. A leftover means you cooked more than you sold; "sold, not logged" means a sale happened without production being recorded. No recipes needed.
            </div>
          </div>
          {!loading && dish && dish.length === 0 && (
            <div style={{ padding: "16px 18px", background: "#FFF", border: `1px solid ${LUXURY_THEME.border}`, borderRadius: 8, fontSize: 13, color: LUXURY_THEME.textMuted }}>
              Nothing produced or sold on {niceDate} yet.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(dish || []).map((it) => {
              const meta = ({
                unsold:   { bar: "#DC2626", bg: "#FEF2F2", label: "Cooked, none sold" },
                over:     { bar: "#F97316", bg: "#FFF7ED", label: "Leftover" },
                unlogged: { bar: "#8B5CF6", bg: "#F5F3FF", label: "Sold, not logged" },
                ok:       { bar: "#10B981", bg: "#F0FDF4", label: "Balanced" },
              })[it.flag] || { bar: "#6B7280", bg: "#F9FAFB", label: "\u2014" };
              const ad = Math.abs(it.diff);
              const line = it.diff > 0 ? `${ad} not sold (leftover).` : it.diff < 0 ? `${ad} sold without being logged in production.` : `Everything you cooked sold.`;
              return (
                <div key={it.id} style={{ background: meta.bg, borderLeft: `4px solid ${meta.bar}`, borderRadius: 8, padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{it.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#FFF", background: meta.bar, padding: "3px 10px", borderRadius: 20 }}>{meta.label}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.6 }}>
                    Produced <strong style={{ color: "#059669" }}>{it.produced}</strong>, Sold <strong style={{ color: "#B45309" }}>{it.sold}</strong>. {line}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mode === "ingredient" && (<>
      {!loading && rows && data.length === 0 && (
        <div style={{ padding: "16px 18px", background: "#FFF", border: `1px solid ${LUXURY_THEME.border}`, borderRadius: 8, fontSize: 13, color: LUXURY_THEME.textMuted, marginBottom: 24 }}>
          No sales or issues recorded for {niceDate}. Variance needs a day with both sales and stock issues to compare.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: mobile ? 10 : 16, marginBottom: 24 }}>
        {summaryCards.map((c) => (
          <Card key={c.label} style={{ padding: 16, borderLeft: `4px solid ${c.color}`, background: c.bg }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: LUXURY_THEME.textMuted, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>{c.label}</div>
            <div style={{ fontSize: typeof c.value === "string" ? 14 : 28, fontWeight: 700, color: c.color, fontFamily: "'Inter', monospace" }}>{c.value}</div>
          </Card>
        ))}
      </div>

      <div style={{ background: "#FFFFFF", border: `1px solid ${LUXURY_THEME.border}`, borderRadius: 8, padding: "18px 22px", marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: LUXURY_THEME.textPrimary, marginBottom: 6 }}>What this page tells you</div>
        <div style={{ fontSize: 13, color: LUXURY_THEME.textSecondary, lineHeight: 1.6, marginBottom: 16 }}>
          It compares two numbers for each ingredient on the chosen day:
          <span style={{ color: "#059669", fontWeight: 700 }}> what you should have used</span> (worked out from what you sold and your recipes)
          versus <span style={{ color: "#B45309", fontWeight: 700 }}> what actually left the store</span>.
          If they don't match, the gap may be waste, over-serving, or stock going missing.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3, 1fr)", gap: 12 }}>
          <div style={{ background: "#FEF2F2", borderRadius: 6, padding: "12px 14px", borderLeft: "3px solid #DC2626" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#DC2626", marginBottom: 3 }}>Used too much</div>
            <div style={{ fontSize: 11, color: LUXURY_THEME.textSecondary, lineHeight: 1.5 }}>More left the store than sales account for. Big gaps = check portioning, waste, or theft.</div>
          </div>
          <div style={{ background: "#EDE9FE", borderRadius: 6, padding: "12px 14px", borderLeft: "3px solid #8B5CF6" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#8B5CF6", marginBottom: 3 }}>Used less</div>
            <div style={{ fontSize: 11, color: LUXURY_THEME.textSecondary, lineHeight: 1.5 }}>Less left the store than sales suggest. Often means an issue wasn't recorded, or recipes need a tweak.</div>
          </div>
          <div style={{ background: "#D1FAE5", borderRadius: 6, padding: "12px 14px", borderLeft: "3px solid #10B981" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#059669", marginBottom: 3 }}>Balanced</div>
            <div style={{ fontSize: 11, color: LUXURY_THEME.textSecondary, lineHeight: 1.5 }}>What you used matches what you sold. This is what you want to see.</div>
          </div>
        </div>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", display: "flex", gap: 10, background: LUXURY_THEME.surface, borderBottom: `1px solid ${LUXURY_THEME.border}` }}>
          {[["all", "All", "#6B7280"], ["critical", "Used too much", "#DC2626"], ["warning", "Slightly over", "#F97316"], ["under", "Used less", "#8B5CF6"], ["ok", "Balanced", "#10B981"]].map(([k, l, color]) => (
            <button key={k} onClick={() => setFilterFlag(k)} style={{ padding: "5px 14px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, background: filterFlag === k ? color : "transparent", color: filterFlag === k ? "#FFFFFF" : LUXURY_THEME.textSecondary, transition: "all 0.2s ease" }}>{l}</button>
          ))}
        </div>
        
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
            <thead>
              <tr style={{ background: "#F3F4F6" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#374151" }}>Ingredient</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#374151" }}>Unit</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#059669" }}>Should've used<div style={{ fontSize: 9, fontWeight: 400, color: "#6B7280" }}>from sales</div></th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#B45309" }}>Actually took out<div style={{ fontSize: 9, fontWeight: 400, color: "#6B7280" }}>from store</div></th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#374151" }}>In store now<div style={{ fontSize: 9, fontWeight: 400, color: "#6B7280" }}>remaining</div></th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#374151" }}>Difference</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#374151" }}>Gap %</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#374151" }}>Money lost<div style={{ fontSize: 9, fontWeight: 400, color: "#6B7280" }}>KES</div></th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#374151" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => {
                const isCritical = r.flag === "critical";
                const isWarning = r.flag === "warning";
                const isUnder = r.flag === "under";
                const isOk = r.flag === "ok";
                
                let rowBg = "#FFFFFF";
                let borderLeft = "3px solid transparent";
                
                if (isCritical) { rowBg = "#FEE2E2"; borderLeft = `3px solid #DC2626`; }
                else if (isWarning) { rowBg = "#FFF7ED"; borderLeft = `3px solid #F97316`; }
                else if (isUnder) { rowBg = "#EDE9FE"; borderLeft = `3px solid #8B5CF6`; }
                else if (isOk) { rowBg = "#D1FAE5"; borderLeft = `3px solid #10B981`; }
                
                return (
                  <tr key={r.id} style={{ borderBottom: i < data.length - 1 ? `1px solid ${LUXURY_THEME.border}` : "none", background: rowBg, borderLeft }}>
                    <td style={{ padding: "12px 14px", fontWeight: 500, fontSize: 12, color: LUXURY_THEME.textPrimary }}>{r.name}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: LUXURY_THEME.textMuted }}>{r.unit}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#059669", fontWeight: 600 }}>{r.theoretical}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 500, color: LUXURY_THEME.textSecondary }}>{r.issued}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: LUXURY_THEME.textSecondary }}>{r.physical}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <VarianceCell variance={r.variance} variancePct={r.variancePct} shrinkageValue={r.shrinkageValue} />
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "inline-block", background: r.variancePct > 20 ? "#FEE2E2" : r.variancePct > 10 ? "#FFF7ED" : r.variancePct > 0 ? "#FEF3C7" : "#F3F4F6", color: r.variancePct > 20 ? "#DC2626" : r.variancePct > 10 ? "#F97316" : r.variancePct > 0 ? "#F59E0B" : "#6B7280", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{r.variancePct}%</div>
                    </td>
                    <td style={{ padding: "12px 14px", fontWeight: 600, fontSize: 11, color: r.shrinkageValue > 0 ? "#DC2626" : "#059669" }}>{r.shrinkageValue > 0 ? `KES ${r.shrinkageValue.toLocaleString()}` : "-"}</td>
                    <td style={{ padding: "12px 14px" }}><VarianceStatusBadge variance={r.variance} variancePct={r.variancePct} shrinkageValue={r.shrinkageValue} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      
      {data.length > 0 && (
        <div style={{ marginTop: 24, padding: 20, background: "#F8F8F8", borderRadius: 6, border: `1px solid ${LUXURY_THEME.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: LUXURY_THEME.textPrimary, marginBottom: 12 }}>Executive Summary</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <div><div style={{ fontSize: 10, color: "#6B7280" }}>Total Shrinkage</div><div style={{ fontSize: 20, fontWeight: 700, color: "#DC2626" }}>KES {totalShrinkage.toLocaleString()}</div></div>
            <div><div style={{ fontSize: 10, color: "#6B7280" }}>Total Under-Issued</div><div style={{ fontSize: 20, fontWeight: 700, color: "#8B5CF6" }}>{totalUnderIssued.toFixed(2)} units</div></div>
            <div><div style={{ fontSize: 10, color: "#6B7280" }}>Items with Issues</div><div style={{ fontSize: 20, fontWeight: 700, color: "#F97316" }}>{data.filter(r => r.flag !== "ok").length} / {data.length}</div></div>
            <div><div style={{ fontSize: 10, color: "#6B7280" }}>Compliance Rate</div><div style={{ fontSize: 20, fontWeight: 700, color: "#10B981" }}>{((data.filter(r => r.flag === "ok").length / data.length) * 100).toFixed(1)}%</div></div>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}

// --- WASTAGE VIEW -------------------------------------------------------------
export function WastageView({ wastage, setWastage, batches, setBatches, user, ingredients = [], menuItems = [] }) {
  const { mobile } = useBreakpoint();
  const [form, setForm] = useState({ wasteType: "ingredient", ingredientId: "I01", menuItemId: "", batchId: "", qty: "", reason: "spoilage" });
  const [saved, setSaved] = useState(false);
  const [recording, setRecording] = useState(null); // batch id being recorded

  const isBoss = user?.role === "admin" || user?.role === "manager";

  // ── Daily scope (history + total are per-day; expired pickup stays live) ──
  const ymd = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const today = ymd(new Date());
  const [wDate, setWDate] = useState(today);
  const shiftWDay = (off) => { const d = new Date(wDate + "T00:00:00"); d.setDate(d.getDate() + off); setWDate(ymd(d)); };
  const niceWDate = new Date(wDate + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const wDayOf = (w) => (w.date || w.wastage_date || "").toString().slice(0, 10);
  const dayWastage = wastage.filter((w) => wDayOf(w) === wDate);

  // Auto-picked-up expired stock still holding quantity — awaiting the boss's write-off
  const expiredPending = batches
    .map((b) => {
      const ing = ingredients.find((i) => i.id === (b.ingredientId || b.ingredient_id));
      const exp = classifyExpiry(b);
      const cost = parseFloat(ing?.costPerUnit ?? ing?.cost_per_unit) || 0;
      const qty = parseFloat(b.remaining) || 0;
      return { ...b, _status: exp.status, ingredientName: ing?.name, unit: ing?.unit, qty, value: Math.round(qty * cost) };
    })
    .filter((b) => b._status === "expired" && b.qty > 0)
    .sort((a, b) => b.value - a.value);

  const recordExpired = async (b) => {
    setRecording(b.id);
    try {
      const rec = await inventoryApi.recordWastage({
        ingredient_id: b.ingredientId || b.ingredient_id,
        batch_id: b.id,
        qty: b.qty,
        reason: "expired",
        notes: `Expired batch ${b.batchNo || b.batch_no || b.id} - recorded by ${user?.name || "manager"}`,
      });
      // recordWastage depletes the batch server-side; reflect locally
      setBatches?.((p) => p.map((x) => x.id === b.id ? { ...x, remaining: 0, status: "depleted" } : x));
      setWastage?.((p) => [{
        id: rec?.id || `WST-EXP-${String(Date.now()).slice(-5)}`,
        date: new Date().toISOString().split("T")[0],
        ingredientId: b.ingredientId || b.ingredient_id,
        ingredient: b.ingredientName || "Unknown",
        unit: b.unit || "", qty: b.qty, value: b.value,
        reason: "expired", batchRef: b.batchNo || b.batch_no,
        notes: "Auto-flagged expired stock", recordedBy: user?.name || "Manager",
      }, ...p]);
    } catch (e) {
      console.error("Record expired failed:", e?.message);
      alert("Couldn't record this write-off: " + (e?.response?.data?.error || e?.message || "server error"));
    } finally {
      setRecording(null);
    }
  };

  const availBatches = batches
    .filter((b) => (b.ingredient_id || b.ingredientId) === form.ingredientId && (parseFloat(b.remaining) || 0) > 0)
    .sort((a, b) => new Date(a.expiry || a.expiryDate || "2999-01-01") - new Date(b.expiry || b.expiryDate || "2999-01-01"));
  const ing = ingredients.find((i) => i.id === form.ingredientId);
  const selDish = menuItems.find((m) => m.id === form.menuItemId);
  const isMenu = form.wasteType === "menu";
  const selBatch = batches.find((b) => b.id === form.batchId);
  const selCost = parseFloat(selBatch?.cost_per_unit ?? selBatch?.costPerUnit) || parseFloat(ing?.cost_per_unit ?? ing?.costPerUnit) || 0;
  const estLoss = (!isMenu && form.qty) ? (Number(form.qty) * selCost).toFixed(2) : 0;

  const [logErr, setLogErr] = useState("");
  const [logging, setLogging] = useState(false);
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();
  const ingMatches  = ingredients.filter((i) => (i.name || "").toLowerCase().includes(q));
  const dishMatches = menuItems.filter((m) => (m.name || "").toLowerCase().includes(q));
  const setType = (t) => { setSearch(""); setForm((f) => ({ ...f, wasteType: t, batchId: "" })); };

  // Make sure the selected ingredient is a real one (default "I01" may not exist)
  useEffect(() => {
    if (!isMenu && ingredients.length && !ingredients.some((i) => i.id === form.ingredientId)) {
      setForm((f) => ({ ...f, ingredientId: ingredients[0].id, batchId: "" }));
    }
  }, [ingredients, isMenu]);

  // When the item dropdown changes, split into ingredient vs menu-item
  const onPickTarget = (val) => {
    if (val.startsWith("menu:")) {
      setForm((f) => ({ ...f, wasteType: "menu", menuItemId: val.slice(5), batchId: "" }));
    } else {
      setForm((f) => ({ ...f, wasteType: "ingredient", ingredientId: val.slice(4), menuItemId: "", batchId: "" }));
    }
  };

  const handleLog = async () => {
    setLogErr("");
    if (!form.qty || Number(form.qty) <= 0) { setLogErr("Enter how much was wasted."); return; }

    if (isMenu) {
      // Wasting a finished dish — log dish + quantity, no money value
      if (!form.menuItemId) { setLogErr("Choose a dish."); return; }
      setLogging(true);
      try {
        const rec = await inventoryApi.recordWastage({
          menu_item_id: form.menuItemId,
          qty: Number(form.qty),
          reason: form.reason,
          notes: `Dish wasted — recorded by ${user?.name || "manager"}`,
        });
        setWastage((p) => [{
          id: rec?.id || `WST-${String(Date.now()).slice(-4)}`,
          date: new Date().toISOString().slice(0, 10),
          menu_item_id: form.menuItemId, ingredient: selDish?.name, unit: "pcs",
          qty: Number(form.qty), value: 0, reason: form.reason,
          recordedBy: user?.name,
        }, ...p]);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        setForm((f) => ({ ...f, qty: "" }));
      } catch (e) {
        setLogErr(e?.response?.data?.error || e?.message || "Couldn't record — try again.");
      } finally {
        setLogging(false);
      }
      return;
    }

    // Ingredient (raw stock) path
    if (!form.batchId) { setLogErr("Choose the batch it came from."); return; }
    const remaining = parseFloat(selBatch?.remaining) || 0;
    if (Number(form.qty) > remaining) { setLogErr(`Only ${remaining} ${ing?.unit || ""} left in that batch.`); return; }
    setLogging(true);
    try {
      const rec = await inventoryApi.recordWastage({
        ingredient_id: form.ingredientId,
        batch_id: form.batchId,
        qty: Number(form.qty),
        reason: form.reason,
        notes: `Recorded by ${user?.name || "manager"}`,
      });
      setBatches?.((p) => p.map((b) => b.id === form.batchId ? { ...b, remaining: Math.max(0, (parseFloat(b.remaining) || 0) - Number(form.qty)) } : b));
      setWastage((p) => [{
        id: rec?.id || `WST-${String(Date.now()).slice(-4)}`,
        date: new Date().toISOString().slice(0, 10),
        ingredient_id: form.ingredientId, ingredient: ing?.name, unit: ing?.unit,
        batch_no: selBatch?.batchNo || selBatch?.batch_no,
        qty: Number(form.qty), value: Number(estLoss), reason: form.reason,
        recordedBy: user?.name,
      }, ...p]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setForm((f) => ({ ...f, qty: "", batchId: "" }));
    } catch (e) {
      setLogErr(e?.response?.data?.error || e?.message || "Couldn't record — try again.");
    } finally {
      setLogging(false);
    }
  };

  const totalWastageValue = dayWastage.reduce((s, w) => s + (parseFloat(w.value) || 0), 0);

  const reasonColors = {
    expired: { color: "#DC2626", bg: "#FEE2E2" },
    spoilage: { color: "#F97316", bg: "#FFF7ED" },
    breakage: { color: "#F59E0B", bg: "#FEF3C7" },
    overcooked: { color: "#06B6D4", bg: "#CFFAFE" },
    returned: { color: "#8B5CF6", bg: "#EDE9FE" },
    staff_meal: { color: "#10B981", bg: "#D1FAE5" },
    other: { color: "#6B7280", bg: "#F3F4F6" },
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: mobile ? 14 : 32, background: "#F5F2EB" }}>
      <SectionHeader title="Wastage Register" sub="Record spoilage, expired stock, and manual write-offs" />

      {/* Daily date picker — history + total are for this day */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <button onClick={() => shiftWDay(-1)} style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${LUXURY_THEME.border}`, background: "#FFF", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>←</button>
        <input type="date" value={wDate} max={today} onChange={(e) => setWDate(e.target.value)} style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${LUXURY_THEME.border}`, fontSize: 13 }} />
        <button onClick={() => shiftWDay(1)} disabled={wDate >= today} style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${LUXURY_THEME.border}`, background: wDate >= today ? "#F3F4F6" : "#FFF", cursor: wDate >= today ? "default" : "pointer", fontSize: 14, fontWeight: 700 }}>→</button>
        <button onClick={() => setWDate(today)} style={{ padding: "8px 14px", borderRadius: 6, border: "none", background: wDate === today ? LUXURY_THEME.primary : "#E5E0D5", color: wDate === today ? "#FFF" : "#6B7280", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Today</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: LUXURY_THEME.textPrimary, marginLeft: 4 }}>{niceWDate}</span>
      </div>

      {/* Auto-picked-up expired stock — awaiting the boss's write-off */}
      {expiredPending.length > 0 && (
        <div style={{ background:"#FFFFFF", border:`1px solid #DC262640`, borderLeft:"4px solid #DC2626", borderRadius:8, padding:"16px 18px", marginBottom:24 }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#DC2626", marginBottom:4 }}>Expired stock awaiting write-off ({expiredPending.length})</div>
          <div style={{ fontSize:12, color:LUXURY_THEME.textSecondary, marginBottom:14, lineHeight:1.5 }}>
            These batches have passed their expiry date and still show stock. They were picked up automatically.
            {isBoss ? " Review each and record it as a loss." : " Only a manager or admin can record these — please notify them."}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {expiredPending.map((b) => (
              <div key={b.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, background:"#FEF2F2", borderRadius:8, padding:"10px 14px", flexWrap:"wrap" }}>
                <div style={{ fontSize:12.5, color:"#374151" }}>
                  <strong style={{ color:"#111827" }}>{b.ingredientName || "Unknown"}</strong> — {b.qty.toLocaleString()} {b.unit} · batch {b.batchNo || b.batch_no || "—"}
                  {b.value > 0 && <span style={{ color:"#DC2626", fontWeight:700 }}> · KES {b.value.toLocaleString()}</span>}
                </div>
                {isBoss ? (
                  <button onClick={() => recordExpired(b)} disabled={recording === b.id} style={{ padding:"6px 14px", borderRadius:6, border:"none", background:"#DC2626", color:"#FFF", fontSize:11, fontWeight:700, cursor:recording===b.id?"wait":"pointer", opacity:recording===b.id?0.6:1 }}>
                    {recording === b.id ? "Recording…" : "Record write-off"}
                  </button>
                ) : (
                  <span style={{ fontSize:10.5, color:LUXURY_THEME.textMuted, fontStyle:"italic" }}>Awaiting manager</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "360px 1fr", gap: mobile ? 16 : 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {isBoss ? (
          <Card>
            <div style={{ fontWeight: 600, fontSize: 13, color: LUXURY_THEME.textPrimary, marginBottom: 18 }}>Record Wastage</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Type toggle + search */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: LUXURY_THEME.textSecondary, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>What was wasted</label>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  {[["ingredient", "Ingredient"], ["menu", "Dish"]].map(([t, l]) => (
                    <button key={t} onClick={() => setType(t)} style={{ flex: 1, padding: "8px", borderRadius: 6, border: `1px solid ${form.wasteType === t ? LUXURY_THEME.primary : LUXURY_THEME.border}`, cursor: "pointer", fontSize: 12, fontWeight: 700, background: form.wasteType === t ? LUXURY_THEME.primary : "#FFF", color: form.wasteType === t ? "#FFF" : LUXURY_THEME.textSecondary }}>{l}</button>
                  ))}
                </div>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isMenu ? "Search a dish…" : "Search an ingredient…"} style={{ width: "100%", padding: "8px 11px", borderRadius: 6, border: `1px solid ${LUXURY_THEME.border}`, fontSize: 12.5, boxSizing: "border-box", marginBottom: 8, outline: "none" }} />
                <Select value={isMenu ? form.menuItemId : form.ingredientId} onChange={(e) => isMenu ? setForm((f) => ({ ...f, menuItemId: e.target.value })) : setForm((f) => ({ ...f, ingredientId: e.target.value, batchId: "" }))}>
                  {(isMenu ? dishMatches : ingMatches).length === 0
                    ? <option value="">{(isMenu ? menuItems.length : ingredients.length) === 0 ? `None loaded (${isMenu ? "dishes" : "ingredients"}: ${isMenu ? menuItems.length : ingredients.length})` : `No match for "${search}"`}</option>
                    : (isMenu ? dishMatches : ingMatches).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </Select>
              </div>
              {!isMenu && (
                <Select label="Batch Reference" value={form.batchId} onChange={(e) => setForm((f) => ({ ...f, batchId: e.target.value }))}>
                  <option value="">- Select batch -</option>
                  {availBatches.map((b) => (<option key={b.id} value={b.id}>{b.batchNo} - {b.remaining} {ing?.unit} remaining - exp {b.expiry}</option>))}
                </Select>
              )}
              <Input label={`Quantity (${isMenu ? "plates / units" : (ing?.unit || "units")})`} type="number" value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} />
              <Select label="Reason" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}>
                {[
                  ["spoilage", "Spoilage (went bad)"],
                  ["breakage", "Spillage / breakage"],
                  ["overcooked", "Overcooked / burnt"],
                  ["returned", "Returned by customer"],
                  ["staff_meal", "Staff meal"],
                ].map(([val, label]) => (<option key={val} value={val}>{label}</option>))}
              </Select>
              {isMenu ? (
                <div style={{ background: "#EFF6FF", border: `1px solid #BFDBFE`, borderRadius: 6, padding: "10px 14px", fontSize: 11.5, color: "#1E40AF" }}>
                  Dishes are logged by quantity only — no money value — and removed from prepared stock on hand.
                </div>
              ) : estLoss > 0 && (
                <div style={{ background: "#FEE2E2", border: `1px solid #DC2626`, borderRadius: 6, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "#DC2626", fontWeight: 600 }}>Estimated Loss: KES {Number(estLoss).toLocaleString()}</div>
                </div>
              )}
              {logErr && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#8B3A3A" }}>{logErr}</div>
              )}
              <Btn onClick={handleLog} variant="danger" disabled={logging} style={{ width: "100%", padding: 11, borderRadius: 6, fontWeight: 600, opacity: logging ? 0.6 : 1 }}>{logging ? "Recording…" : saved ? "Recorded ✓" : "Record Wastage"}</Btn>
            </div>
          </Card>
          ) : (
          <Card>
            <div style={{ fontWeight: 600, fontSize: 13, color: LUXURY_THEME.textPrimary, marginBottom: 8 }}>Record Wastage</div>
            <div style={{ fontSize: 12.5, color: LUXURY_THEME.textSecondary, lineHeight: 1.6 }}>
              Only a manager or admin can record wastage. If something was spilled, spoiled, trimmed, or thrown out, please tell your manager so it can be logged correctly.
            </div>
          </Card>
          )}
          <Card style={{ padding: 18, background: "#FEE2E2", border: `1px solid #DC2626` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" }}>Total Liability</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: "#DC2626", fontFamily: "'Inter', monospace" }}>KES {totalWastageValue.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: LUXURY_THEME.textMuted, marginTop: 6 }}>{dayWastage.length} recorded {dayWastage.length === 1 ? "incident" : "incidents"} · {niceWDate}</div>
          </Card>
        </div>

        <Card style={{ overflow: "hidden" }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: LUXURY_THEME.textPrimary, marginBottom: 18 }}>Wastage History — {niceWDate}</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
              <thead>
                <tr style={{ background: "#F3F4F6" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "#6B7280" }}>Ref</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "#6B7280" }}>Date</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "#6B7280" }}>Ingredient</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "#6B7280" }}>Batch</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "#6B7280" }}>Qty</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "#6B7280" }}>Reason</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "#6B7280" }}>Loss Value</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "#6B7280" }}>Recorded By</th>
                </tr>
              </thead>
              <tbody>
                {dayWastage.length === 0 && (
                  <tr><td colSpan="8" style={{ padding: "34px 12px", textAlign: "center", fontSize: 12.5, color: LUXURY_THEME.textMuted }}>No wastage recorded on {niceWDate}.</td></tr>
                )}
                {[...dayWastage].map((w, i) => {
                  const ingItem = ingredients.find((x) => x.id === (w.ingredient_id || w.ingredientId));
                  const batch = batches.find((b) => b.id === (w.batch_id || w.batchId));
                  const reasonColor = reasonColors[w.reason] || reasonColors.other;
                  const isEven = i % 2 === 0;
                  const ingName = w.ingredient_name || w.ingredient || ingItem?.name || "—";
                  const unit = w.unit || ingItem?.unit || "";
                  const dateStr = (w.date || w.wastage_date || "").toString().slice(0, 10);
                  const by = w.recordedBy || w.recorded_by_name || "—";
                  return (
                    <tr key={w.id} style={{ borderBottom: i < dayWastage.length - 1 ? `1px solid ${LUXURY_THEME.border}` : "none", background: isEven ? "#FFFFFF" : "#F8F8F8" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 500, fontSize: 11, color: LUXURY_THEME.primary }}>{w.id}</td>
                      <td style={{ padding: "10px 12px", fontSize: 11, color: LUXURY_THEME.textMuted }}>{dateStr}</td>
                      <td style={{ padding: "10px 12px", fontSize: 11, fontWeight: 500, color: LUXURY_THEME.textPrimary }}>{ingName}</td>
                      <td style={{ padding: "10px 12px", fontSize: 10, color: LUXURY_THEME.textMuted }}>{w.batch_no || w.batchRef || batch?.batchNo || "-"}</td>
                      <td style={{ padding: "10px 12px", fontSize: 11, color: LUXURY_THEME.textSecondary }}>{Number(w.qty)} {unit}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <Badge color={reasonColor.color} bg={reasonColor.bg}>{w.reason}</Badge>
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 600, fontSize: 11, color: "#DC2626" }}>KES {(parseFloat(w.value) || 0).toLocaleString()}</td>
                      <td style={{ padding: "10px 12px", fontSize: 11, color: LUXURY_THEME.textMuted }}>{by}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}