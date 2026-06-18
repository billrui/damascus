import { useState } from "react";
import { d } from "../data";
import { classifyExpiry, computeVariance } from "../utils";
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
          <Badge color="#DC2626" bg="#FEE2E2">Critical Over-Issue</Badge>
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
          <Badge color="#F97316" bg="#FFF7ED">Warning Over-Issue</Badge>
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
          <Badge color="#F59E0B" bg="#FEF3C7">Minor Over-Issue</Badge>
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
          <Badge color="#8B5CF6" bg="#EDE9FE">Critical Under-Issue</Badge>
          <span style={{ fontSize: 9, color: "#8B5CF6", fontWeight: 500 }}>
            Shortfall: {absVariance} units
          </span>
        </div>
      );
    } else {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Badge color="#06B6D4" bg="#CFFAFE">Minor Under-Issue</Badge>
          <span style={{ fontSize: 9, color: "#06B6D4", fontWeight: 500 }}>
            Shortfall: {absVariance} units
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
  const [filterStatus, setFilterStatus] = useState("all");

  const enriched = batches
    .map((b) => {
      const ing = ingredients.find((i) => i.id === (b.ingredient_id || b.ingredientId));
      const exp = classifyExpiry(b);
      const lossValue = b.remaining * b.costPerUnit;
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
      const lossValue = Math.round(batch.remaining * (batch.costPerUnit || 0));
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
    { label: "EXPIRED", value: batches.filter((b) => classifyExpiry(b).status === "expired").length, color: "#DC2626", bg: "#FEE2E2" },
    { label: "EXPIRING TODAY", value: batches.filter((b) => classifyExpiry(b).status === "expiring").length, color: "#EA580C", bg: "#FFF7ED" },
    { label: "CRITICAL (-3 DAYS)", value: batches.filter((b) => classifyExpiry(b).status === "critical").length, color: "#F97316", bg: "#FFF7ED" },
    { label: "WARNING (-7 DAYS)", value: batches.filter((b) => classifyExpiry(b).status === "warning").length, color: "#F59E0B", bg: "#FEF3C7" },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: mobile ? 14 : 32, background: "#F5F2EB" }}>
      <SectionHeader title="Expiry Control" sub="First Expired, First Out (FEFO) monitoring" />
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
            <div style={{ fontWeight: 600, fontSize: 13, color: "#DC2626", marginBottom: 2 }}>At-Risk Inventory Value: KES {totalAtRisk.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: LUXURY_THEME.textSecondary }}>Stock approaching or past expiry requires immediate action</div>
          </div>
        </div>
      )}

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", display: "flex", gap: 10, background: LUXURY_THEME.surface, borderBottom: `1px solid ${LUXURY_THEME.border}` }}>
          {[["all", "All Batches"], ["alerts", "Alerts Only"], ["expired", "Expired"], ["active", "Active"]].map(([k, l]) => (
            <button key={k} onClick={() => setFilterStatus(k)} style={{ padding: "5px 14px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, background: filterStatus === k ? LUXURY_THEME.primary : "transparent", color: filterStatus === k ? "#FFFFFF" : LUXURY_THEME.textSecondary, transition: "all 0.2s ease", letterSpacing: "0.3px" }}>{l}</button>
          ))}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
            <thead>
              <tr style={{ background: "#F3F4F6", borderBottom: `1px solid ${LUXURY_THEME.border}` }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 600, color: LUXURY_THEME.textMuted }}>Batch Ref</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 600, color: LUXURY_THEME.textMuted }}>Ingredient</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 600, color: LUXURY_THEME.textMuted }}>Remaining</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 600, color: LUXURY_THEME.textMuted }}>Expiry Date</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 600, color: LUXURY_THEME.textMuted }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 600, color: LUXURY_THEME.textMuted }}>Location</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 600, color: LUXURY_THEME.textMuted }}>At-Risk Value</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 600, color: LUXURY_THEME.textMuted }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {enriched.map((b, i) => {
                let rowBg = "#FFFFFF";
                let expiryColor = "";
                if (b.status === "expired") { rowBg = "#FEE2E2"; expiryColor = "#DC2626"; }
                else if (b.status === "expiring") { rowBg = "#FFF7ED"; expiryColor = "#EA580C"; }
                else if (b.status === "critical") { rowBg = "#FFF7ED"; expiryColor = "#F97316"; }
                else if (b.status === "warning") { rowBg = "#FEF3C7"; expiryColor = "#F59E0B"; }
                
                return (
                  <tr key={b.id} style={{ borderBottom: i < enriched.length - 1 ? `1px solid ${LUXURY_THEME.border}` : "none", background: rowBg }}>
                    <td style={{ padding: "12px 16px", fontWeight: 500, fontSize: 12, color: LUXURY_THEME.primary }}>{b.batchNo}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12, fontWeight: 500, color: LUXURY_THEME.textPrimary }}>{b.ingredientName}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: LUXURY_THEME.textSecondary }}>{b.remaining} {b.unit}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: expiryColor || LUXURY_THEME.textSecondary, fontWeight: expiryColor ? 600 : 400 }}>{b.expiry}</td>
                    <td style={{ padding: "12px 16px" }}><Badge color={b.color} bg={b.bg}>{b.label}</Badge></td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: LUXURY_THEME.textMuted }}>{b.location}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: 12, color: b.status !== "ok" ? "#DC2626" : LUXURY_THEME.textSecondary }}>KES {b.lossValue.toLocaleString()}</td>
                    <td style={{ padding: "12px 16px" }}>
                      {b.status === "expired" ? <Badge color="#6B7280" bg="#F3F4F6">Written Off</Badge>
                        : b.days <= 3 ? <button onClick={() => writeOff(b.id)} style={{ padding: "4px 12px", borderRadius: 4, border: `1px solid #DC2626`, background: "#FFFFFF", color: "#DC2626", fontSize: 10, fontWeight: 500, cursor: "pointer" }}>Write Off</button>
                        : <Badge color="#10B981" bg="#D1FAE5">Compliant</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// --- VARIANCE VIEW WITH DIFFERENT COLORS --------------------------------------
export function VarianceView({ batches, storeIssues, sales, ingredients = [], recipes = {} }) {
  const { mobile } = useBreakpoint();
  const [filterFlag, setFilterFlag] = useState("all");
  const data = computeVariance(batches, storeIssues, sales, ingredients, recipes).filter((r) => filterFlag === "all" || r.flag === filterFlag);
  
  const totalShrinkage = data.filter((r) => r.flag === "critical" || r.flag === "warning").reduce((s, r) => s + r.shrinkageValue, 0);
  const totalUnderIssued = data.filter((r) => r.flag === "under").reduce((s, r) => s + Math.abs(r.variance), 0);
  
  const summaryCards = [
    { label: "Critical Variances", value: data.filter((r) => r.flag === "critical").length, color: "#DC2626", bg: "#FEE2E2" },
    { label: "Warnings", value: data.filter((r) => r.flag === "warning").length, color: "#F97316", bg: "#FFF7ED" },
    { label: "Under-Issued", value: data.filter((r) => r.flag === "under").length, color: "#8B5CF6", bg: "#EDE9FE" },
    { label: "Shrinkage Value", value: `KES ${totalShrinkage.toLocaleString()}`, color: totalShrinkage > 0 ? "#DC2626" : "#10B981", bg: totalShrinkage > 0 ? "#FEE2E2" : "#D1FAE5" },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: mobile ? 14 : 32, background: "#F5F2EB" }}>
      <SectionHeader title="Variance & Reconciliation" sub="Theoretical vs Issued vs Physical comparison" />

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: mobile ? 10 : 16, marginBottom: 24 }}>
        {summaryCards.map((c) => (
          <Card key={c.label} style={{ padding: 16, borderLeft: `4px solid ${c.color}`, background: c.bg }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: LUXURY_THEME.textMuted, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>{c.label}</div>
            <div style={{ fontSize: typeof c.value === "string" ? 14 : 28, fontWeight: 700, color: c.color, fontFamily: "'Inter', monospace" }}>{c.value}</div>
          </Card>
        ))}
      </div>

      <div style={{ background: "linear-gradient(135deg, #1A1A1A 0%, #2C3E50 100%)", borderRadius: 8, padding: "20px 24px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: LUXURY_THEME.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#FFFFFF" }}>i</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: LUXURY_THEME.primary, letterSpacing: "0.5px" }}>Variance Formula & Interpretation</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>How to read and understand this report</div>
          </div>
        </div>
        
        <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 6, padding: "16px 20px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: LUXURY_THEME.primary, textAlign: "center", marginBottom: 12 }}>Variance = Issued - Theoretical</div>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(2, 1fr)", gap: 16 }}>
          <div style={{ background: "rgba(220, 38, 38, 0.1)", borderRadius: 6, padding: "12px 16px", borderLeft: `3px solid #DC2626` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ fontSize: 16, color: "#DC2626" }}>-</span><span style={{ fontWeight: 700, color: "#DC2626", fontSize: 12 }}>Positive Variance (Over-Issuance)</span></div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>
              <strong style={{ color: "#DC2626" }}>Red = Critical (&gt;20%)</strong> - Immediate investigation required<br/>
              <strong style={{ color: "#F97316" }}>Orange = Warning (10-20%)</strong> - Monitor closely<br/>
              <strong style={{ color: "#F59E0B" }}>Yellow = Minor (&lt;10%)</strong> - Review practices
            </div>
          </div>
          <div style={{ background: "rgba(139, 92, 246, 0.1)", borderRadius: 6, padding: "12px 16px", borderLeft: `3px solid #8B5CF6` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ fontSize: 16, color: "#8B5CF6" }}>-</span><span style={{ fontWeight: 700, color: "#8B5CF6", fontSize: 12 }}>Negative Variance (Under-Issuance)</span></div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>
              <strong style={{ color: "#8B5CF6" }}>Purple = Critical (&gt;10 units)</strong> - Stock count verification required<br/>
              <strong style={{ color: "#06B6D4" }}>Cyan = Minor (-10 units)</strong> - Review records
            </div>
          </div>
        </div>
        
        <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap", padding: "10px", background: "rgba(255,255,255,0.05)", borderRadius: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 12, height: 12, borderRadius: 3, background: "#DC2626" }} /><span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>Critical Over</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 12, height: 12, borderRadius: 3, background: "#F97316" }} /><span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>Warning Over</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 12, height: 12, borderRadius: 3, background: "#F59E0B" }} /><span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>Minor Over</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 12, height: 12, borderRadius: 3, background: "#8B5CF6" }} /><span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>Critical Under</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 12, height: 12, borderRadius: 3, background: "#06B6D4" }} /><span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>Minor Under</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 12, height: 12, borderRadius: 3, background: "#10B981" }} /><span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>Balanced</span></div>
        </div>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", display: "flex", gap: 10, background: LUXURY_THEME.surface, borderBottom: `1px solid ${LUXURY_THEME.border}` }}>
          {[["all", "All", "#6B7280"], ["critical", "Critical", "#DC2626"], ["warning", "Warning", "#F97316"], ["under", "Under-Issued", "#8B5CF6"], ["ok", "Compliant", "#10B981"]].map(([k, l, color]) => (
            <button key={k} onClick={() => setFilterFlag(k)} style={{ padding: "5px 14px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, background: filterFlag === k ? color : "transparent", color: filterFlag === k ? "#FFFFFF" : LUXURY_THEME.textSecondary, transition: "all 0.2s ease" }}>{l}</button>
          ))}
        </div>
        
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
            <thead>
              <tr style={{ background: "#F3F4F6" }}>
                <th style={{ padding: "12px 14px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "#6B7280" }}>Ingredient</th>
                <th style={{ padding: "12px 14px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "#6B7280" }}>Unit</th>
                <th style={{ padding: "12px 14px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "#6B7280" }}>Theoretical</th>
                <th style={{ padding: "12px 14px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "#6B7280" }}>Issued</th>
                <th style={{ padding: "12px 14px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "#6B7280" }}>Physical</th>
                <th style={{ padding: "12px 14px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "#6B7280" }}>Variance</th>
                <th style={{ padding: "12px 14px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "#6B7280" }}>Variance %</th>
                <th style={{ padding: "12px 14px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "#6B7280" }}>Shrinkage (KES)</th>
                <th style={{ padding: "12px 14px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "#6B7280" }}>Status</th>
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
    </div>
  );
}

// --- WASTAGE VIEW -------------------------------------------------------------
export function WastageView({ wastage, setWastage, batches, user, ingredients = [] }) {
  const { mobile } = useBreakpoint();
  const [form, setForm] = useState({ ingredientId: "I01", batchId: "", qty: "", reason: "expired" });
  const [saved, setSaved] = useState(false);

  const availBatches = batches.filter((b) => b.ingredientId === form.ingredientId && b.remaining > 0);
  const ing = ingredients.find((i) => i.id === form.ingredientId);
  const selBatch = batches.find((b) => b.id === form.batchId);
  const estLoss = selBatch && form.qty ? (Number(form.qty) * selBatch.costPerUnit).toFixed(2) : 0;

  const handleLog = () => {
    if (!form.qty || !form.batchId) return;
    const w = { id: `WST-${String(Date.now()).slice(-4)}`, date: d(0), ...form, qty: Number(form.qty), value: Number(estLoss), recordedBy: user.name };
    setWastage((p) => [...p, w]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setForm((f) => ({ ...f, qty: "", batchId: "" }));
  };

  const totalWastageValue = wastage.reduce((s, w) => s + w.value, 0);

  const reasonColors = {
    expired: { color: "#DC2626", bg: "#FEE2E2" },
    spoilage: { color: "#F97316", bg: "#FFF7ED" },
    spillage: { color: "#F59E0B", bg: "#FEF3C7" },
    trimming: { color: "#8B5CF6", bg: "#EDE9FE" },
    overcooked: { color: "#06B6D4", bg: "#CFFAFE" },
    complimentary: { color: "#10B981", bg: "#D1FAE5" },
    other: { color: "#6B7280", bg: "#F3F4F6" },
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: mobile ? 14 : 32, background: "#F5F2EB" }}>
      <SectionHeader title="Wastage Register" sub="Record spoilage, expired stock, and manual write-offs" />
      
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "360px 1fr", gap: mobile ? 16 : 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card>
            <div style={{ fontWeight: 600, fontSize: 13, color: LUXURY_THEME.textPrimary, marginBottom: 18 }}>Record Wastage</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Select label="Ingredient" value={form.ingredientId} onChange={(e) => setForm((f) => ({ ...f, ingredientId: e.target.value, batchId: "" }))}>
                {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </Select>
              <Select label="Batch Reference" value={form.batchId} onChange={(e) => setForm((f) => ({ ...f, batchId: e.target.value }))}>
                <option value="">- Select batch -</option>
                {availBatches.map((b) => (<option key={b.id} value={b.id}>{b.batchNo} - {b.remaining} {ing?.unit} remaining - exp {b.expiry}</option>))}
              </Select>
              <Input label={`Quantity (${ing?.unit || "units"})`} type="number" value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} />
              <Select label="Reason" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}>
                {["expired", "spoilage", "spillage", "trimming", "overcooked", "complimentary", "other"].map((r) => (<option key={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>))}
              </Select>
              {estLoss > 0 && (
                <div style={{ background: "#FEE2E2", border: `1px solid #DC2626`, borderRadius: 6, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "#DC2626", fontWeight: 600 }}>Estimated Loss: KES {Number(estLoss).toLocaleString()}</div>
                </div>
              )}
              <Btn onClick={handleLog} variant="danger" style={{ width: "100%", padding: 11, borderRadius: 6, fontWeight: 600 }}>{saved ? "Recorded" : "Record Wastage"}</Btn>
            </div>
          </Card>
          <Card style={{ padding: 18, background: "#FEE2E2", border: `1px solid #DC2626` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" }}>Total Liability</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: "#DC2626", fontFamily: "'Inter', monospace" }}>KES {totalWastageValue.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: LUXURY_THEME.textMuted, marginTop: 6 }}>{wastage.length} recorded incidents</div>
          </Card>
        </div>

        <Card style={{ overflow: "hidden" }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: LUXURY_THEME.textPrimary, marginBottom: 18 }}>Wastage History</div>
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
                {[...wastage].reverse().map((w, i) => {
                  const ingItem = ingredients.find((x) => x.id === (w.ingredient_id || w.ingredientId));
                  const batch = batches.find((b) => b.id === w.batchId);
                  const reasonColor = reasonColors[w.reason] || reasonColors.other;
                  const isEven = i % 2 === 0;
                  return (
                    <tr key={w.id} style={{ borderBottom: i < wastage.length - 1 ? `1px solid ${LUXURY_THEME.border}` : "none", background: isEven ? "#FFFFFF" : "#F8F8F8" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 500, fontSize: 11, color: LUXURY_THEME.primary }}>{w.id}</td>
                      <td style={{ padding: "10px 12px", fontSize: 11, color: LUXURY_THEME.textMuted }}>{w.date}</td>
                      <td style={{ padding: "10px 12px", fontSize: 11, fontWeight: 500, color: LUXURY_THEME.textPrimary }}>{ingItem?.name}</td>
                      <td style={{ padding: "10px 12px", fontSize: 10, color: LUXURY_THEME.textMuted }}>{batch?.batchNo || "-"}</td>
                      <td style={{ padding: "10px 12px", fontSize: 11, color: LUXURY_THEME.textSecondary }}>{w.qty} {ingItem?.unit}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <Badge color={reasonColor.color} bg={reasonColor.bg}>{w.reason}</Badge>
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 600, fontSize: 11, color: "#DC2626" }}>KES {w.value.toLocaleString()}</td>
                      <td style={{ padding: "10px 12px", fontSize: 11, color: LUXURY_THEME.textMuted }}>{w.recordedBy}</td>
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