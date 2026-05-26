import { useState } from "react";
import { C, Card, CardHeader, CardBody, FormRow, Input, Select, Toggle, Btn, Badge, SectionTitle } from "./shared";

export default function InventorySettings({ toast, ingredients = [] }) {
  const [settings, setSettings] = useState({
    autoDeductStock: true,
    expiryTracking: true,
    lowStockAlerts: true,
    globalLowStockThreshold: 20,
    expiryWarningDays: 3,
    expirycriticalDays: 1,
    allowAdjustment: true,
    requireAdjustmentReason: true,
    adjustmentRoles: ["admin", "manager", "storekeeper"],
    reorderAlertEmail: "store@damascushotel.co.ke",
    sendReorderAlert: true,
    fifoEnforced: true,
    unitCostMethod: "weighted_avg",
    locationTracking: true,
    locations: ["Cold Room", "Dry Store", "Kitchen", "Bar", "Walk-in Freezer"],
  });

  const [newLocation, setNewLocation] = useState("");
  const [dirty, setDirty] = useState(false);
  const [showPerItem, setShowPerItem] = useState(false);
  const [itemThresholds, setItemThresholds] = useState(
    Object.fromEntries(ingredients.slice(0, 10).map(i => [i.id, { low: i.reorder_level || i.reorderLevel || 0, reorder: Math.round(i.reorder_level || i.reorderLevel || 0 * 1.5) }]))
  );

  const set = (key, val) => { setSettings(f => ({ ...f, [key]: val })); setDirty(true); };
  const handleSave = () => { setDirty(false); toast("Inventory settings saved", "success"); };

  const addLocation = () => {
    if (!newLocation.trim()) return;
    set("locations", [...settings.locations, newLocation.trim()]);
    setNewLocation("");
  };

  const removeLocation = loc => set("locations", settings.locations.filter(l => l !== loc));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: C.textPrimary, margin: 0, letterSpacing: "0.5px" }}>Inventory Settings</h2>
          <p style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>Stock management, alerts, and tracking configuration</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {dirty && <Badge label="Unsaved Changes" color="yellow" />}
          <Btn variant="primary" onClick={handleSave}>Save Settings</Btn>
        </div>
      </div>

      {/* Stock Deduction */}
      <Card>
        <CardHeader title="Stock Deduction" subtitle="How stock is reduced when sales are made" />
        <CardBody>
          <FormRow label="Auto Stock Deduction" hint="Automatically reduce ingredient stock when a menu item is sold">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Toggle checked={settings.autoDeductStock} onChange={v => set("autoDeductStock", v)} />
              <span style={{ fontSize: 12, color: settings.autoDeductStock ? C.green : C.textMuted, fontWeight: 600 }}>
                {settings.autoDeductStock ? "Automatic" : "Manual only"}
              </span>
            </div>
          </FormRow>
          <FormRow label="FIFO Enforcement" hint="First In First Out - oldest batches consumed first">
            <Toggle checked={settings.fifoEnforced} onChange={v => set("fifoEnforced", v)} />
          </FormRow>
          <FormRow label="Unit Cost Method" hint="How to calculate the cost of stock used">
            <Select value={settings.unitCostMethod} onChange={e => set("unitCostMethod", e.target.value)} style={{ maxWidth: 280 }} options={[
              { value: "weighted_avg", label: "Weighted Average Cost" },
              { value: "fifo",         label: "FIFO (First In, First Out)" },
              { value: "last_cost",    label: "Last Purchase Cost" },
            ]} />
          </FormRow>
        </CardBody>
      </Card>

      {/* Alerts */}
      <Card>
        <CardHeader title="Stock Alerts" subtitle="Low stock and expiry warning configuration" />
        <CardBody>
          <FormRow label="Low Stock Alerts" hint="Show warnings when items drop below threshold">
            <Toggle checked={settings.lowStockAlerts} onChange={v => set("lowStockAlerts", v)} />
          </FormRow>
          {settings.lowStockAlerts && (
            <FormRow label="Global Low Stock Threshold" hint="Alert when stock falls below this % of reorder level">
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <input type="range" min={5} max={50} value={settings.globalLowStockThreshold}
                  onChange={e => set("globalLowStockThreshold", parseInt(e.target.value))}
                  style={{ width: 160, accentColor: C.accent }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: C.accent, minWidth: 36 }}>{settings.globalLowStockThreshold}%</span>
              </div>
            </FormRow>
          )}
          <FormRow label="Expiry Tracking" hint="Track and alert on expiring batches">
            <Toggle checked={settings.expiryTracking} onChange={v => set("expiryTracking", v)} />
          </FormRow>
          {settings.expiryTracking && (
            <>
              <FormRow label="Expiry Warning Window" hint="Days before expiry to show warning">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Input value={settings.expiryWarningDays} onChange={e => set("expiryWarningDays", parseInt(e.target.value))} type="number" style={{ width: 80 }} />
                  <span style={{ fontSize: 12, color: C.textSecondary }}>days</span>
                </div>
              </FormRow>
              <FormRow label="Critical Expiry Window" hint="Days before expiry to show critical alert">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Input value={settings.expirycriticalDays} onChange={e => set("expirycriticalDays", parseInt(e.target.value))} type="number" style={{ width: 80 }} />
                  <span style={{ fontSize: 12, color: C.textSecondary }}>days</span>
                </div>
              </FormRow>
            </>
          )}
          <FormRow label="Reorder Alert Email" hint="Send low-stock summary to this email">
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <Toggle checked={settings.sendReorderAlert} onChange={v => set("sendReorderAlert", v)} />
              {settings.sendReorderAlert && (
                <Input value={settings.reorderAlertEmail} onChange={e => set("reorderAlertEmail", e.target.value)} placeholder="store@hotel.co.ke" style={{ maxWidth: 280 }} />
              )}
            </div>
          </FormRow>
        </CardBody>
      </Card>

      {/* Stock Adjustment */}
      <Card>
        <CardHeader title="Manual Adjustments" subtitle="Who can adjust stock and how" />
        <CardBody>
          <FormRow label="Allow Manual Adjustment" hint="Permit stock quantities to be corrected manually">
            <Toggle checked={settings.allowAdjustment} onChange={v => set("allowAdjustment", v)} />
          </FormRow>
          {settings.allowAdjustment && (
            <FormRow label="Require Reason" hint="Staff must enter a reason for every manual adjustment">
              <Toggle checked={settings.requireAdjustmentReason} onChange={v => set("requireAdjustmentReason", v)} />
            </FormRow>
          )}
        </CardBody>
      </Card>

      {/* Locations */}
      <Card>
        <CardHeader title="Storage Locations" subtitle="Physical locations where stock is stored" />
        <CardBody>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
            {settings.locations.map(loc => (
              <div key={loc} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 14px", background: C.surfaceAlt, borderRadius: 4, border: `1px solid ${C.border}`, fontSize: 12 }}>
                <span style={{ fontWeight: 500, color: C.textPrimary }}>{loc}</span>
                <button onClick={() => removeLocation(loc)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 14, lineHeight: 1, paddingLeft: 6, transition: "color 0.15s ease" }}
                  onMouseEnter={e => e.currentTarget.style.color = C.red}
                  onMouseLeave={e => e.currentTarget.style.color = C.textMuted}>
                  -
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Input value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="Add new location..." style={{ maxWidth: 280 }}
              onKeyDown={e => e.key === "Enter" && addLocation()} />
            <Btn variant="secondary" onClick={addLocation}>Add Location</Btn>
          </div>
        </CardBody>
      </Card>

      {/* Per-item thresholds */}
      <Card>
        <CardHeader
          title="Per-Item Reorder Levels"
          subtitle="Fine-tune alert levels for individual ingredients"
          action={<Btn variant="ghost" size="sm" onClick={() => setShowPerItem(v => !v)}>{showPerItem ? "Hide" : "Show"}</Btn>}
        />
        {showPerItem && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.surfaceAlt }}>
                  <th style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: "0.5px" }}>Ingredient</th>
                  <th style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: "0.5px" }}>Unit</th>
                  <th style={{ padding: "10px 20px", textAlign: "center", fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: "0.5px" }}>Low Stock Alert</th>
                  <th style={{ padding: "10px 20px", textAlign: "center", fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: "0.5px" }}>Reorder Level</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.slice(0, 10).map(ing => (
                  <tr key={ing.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "10px 20px", fontSize: 12, fontWeight: 500, color: C.textPrimary }}>{ing.name}</td>
                    <td style={{ padding: "10px 20px", fontSize: 11, color: C.textMuted }}>{ing.unit}</td>
                    <td style={{ padding: "10px 20px", textAlign: "center" }}>
                      <Input value={itemThresholds[ing.id]?.low || ing.reorderLevel} onChange={e => setItemThresholds(t => ({ ...t, [ing.id]: { ...t[ing.id], low: parseInt(e.target.value) } }))} type="number" style={{ width: 100, textAlign: "center" }} />
                    </td>
                    <td style={{ padding: "10px 20px", textAlign: "center" }}>
                      <Input value={itemThresholds[ing.id]?.reorder || Math.round(ing.reorderLevel * 1.5)} onChange={e => setItemThresholds(t => ({ ...t, [ing.id]: { ...t[ing.id], reorder: parseInt(e.target.value) } }))} type="number" style={{ width: 100, textAlign: "center" }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.border}` }}>
              <Btn variant="secondary" size="sm" onClick={() => toast("Item thresholds saved", "success")}>Save Item Levels</Btn>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}