import { useState } from "react";
import { C, Card, CardHeader, CardBody, FormRow, Input, Select, Toggle, Btn, Badge, SectionTitle } from "./shared";

export default function POSSettings({ toast }) {
  const [settings, setSettings] = useState({
    tableManagement: true,
    splitBill: true,
    autoSendKitchen: true,
    kitchenDisplaySystem: false,
    holdOrders: true,
    requireTableForDineIn: true,
    orderNumberPrefix: "INV",
    nextOrderNumber: "000189",
    discountLimits: { admin: 100, manager: 30, cashier: 10, waiter: 0 },
    paymentMethods: { cash: true, mpesa: true, card: true, bank: false, credit: false },
    mpesaTill: "522522",
    mpesaPaybill: "400200",
    defaultPayment: "cash",
    receiptAutoOpen: true,
    showItemCost: false,
    allowNegativeStock: false,
    requirePinForDiscount: true,
    requirePinForVoid: true,
  });

  const [dirty, setDirty] = useState(false);
  const set = (key, val) => { setSettings(f => ({ ...f, [key]: val })); setDirty(true); };
  const setNested = (parent, key, val) => { setSettings(f => ({ ...f, [parent]: { ...f[parent], [key]: val } })); setDirty(true); };

  const handleSave = () => { setDirty(false); toast("POS settings saved successfully", "success"); };

  const ROLES = ["admin", "manager", "cashier", "waiter"];
  const ROLE_EMOJIS = { admin: "-", manager: "---", cashier: "-", waiter: "--" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.textPrimary, margin: 0 }}>POS Settings</h2>
          <p style={{ fontSize: 13, color: C.textSecondary, marginTop: 4 }}>Point of sale behaviour, payments, and order management</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {dirty && <Badge label="Unsaved Changes" color="yellow" />}
          <Btn variant="primary" onClick={handleSave} icon="-">Save Settings</Btn>
        </div>
      </div>

      {/* Table & Order Management */}
      <Card>
        <CardHeader title="Order Management" subtitle="How orders flow through the system" />
        <CardBody>
          <FormRow label="Table Management" hint="Enable table selection when creating orders">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Toggle checked={settings.tableManagement} onChange={v => set("tableManagement", v)} />
              <span style={{ fontSize: 13, color: C.textSecondary }}>{settings.tableManagement ? "Enabled" : "Disabled"}</span>
            </div>
          </FormRow>
          {settings.tableManagement && (
            <FormRow label="Require Table for Dine-in" hint="Force table selection before placing dine-in orders">
              <Toggle checked={settings.requireTableForDineIn} onChange={v => set("requireTableForDineIn", v)} />
            </FormRow>
          )}
          <FormRow label="Split Bill" hint="Allow splitting one order into multiple receipts">
            <Toggle checked={settings.splitBill} onChange={v => set("splitBill", v)} />
          </FormRow>
          <FormRow label="Hold Orders" hint="Allow staff to park orders and return later">
            <Toggle checked={settings.holdOrders} onChange={v => set("holdOrders", v)} />
          </FormRow>
          <FormRow label="Auto-send to Kitchen" hint="Automatically send orders to kitchen display on confirmation">
            <Toggle checked={settings.autoSendKitchen} onChange={v => set("autoSendKitchen", v)} />
          </FormRow>
          <FormRow label="Kitchen Display System (KDS)" hint="Use digital kitchen display instead of printed tickets">
            <Toggle checked={settings.kitchenDisplaySystem} onChange={v => set("kitchenDisplaySystem", v)} />
          </FormRow>

          <FormRow label="Order Number Prefix" hint="Prefix for generated invoice numbers">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Input value={settings.orderNumberPrefix} onChange={e => set("orderNumberPrefix", e.target.value)} style={{ width: 100 }} placeholder="INV" />
              <span style={{ fontSize: 12, color: C.textMuted }}>Next: <strong style={{ color: C.textPrimary }}>{settings.orderNumberPrefix}-{settings.nextOrderNumber}</strong></span>
            </div>
          </FormRow>
        </CardBody>
      </Card>

      {/* Discount Limits */}
      <Card>
        <CardHeader title="Discount Limits by Role" subtitle="Maximum discount % each role can apply. Set to 0% to block discounts entirely for a role." />
        <CardBody>
          {ROLES.map(role => (
            <FormRow key={role} label={`${ROLE_EMOJIS[role]} ${role.charAt(0).toUpperCase() + role.slice(1)}`}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  type="range" min={0} max={100}
                  value={settings.discountLimits[role] || 0}
                  onChange={e => setNested("discountLimits", role, parseInt(e.target.value))}
                  disabled={role === "admin"}
                  style={{ width: 160, accentColor: C.accent }}
                />
                <div style={{
                  minWidth: 56, padding: "4px 10px", borderRadius: 8, textAlign: "center",
                  background: settings.discountLimits[role] === 0 ? C.redLight : settings.discountLimits[role] >= 50 ? C.yellowLight : C.greenLight,
                  color: settings.discountLimits[role] === 0 ? C.red : settings.discountLimits[role] >= 50 ? C.yellow : C.green,
                  fontSize: 13, fontWeight: 700,
                }}>
                  {role === "admin" ? "100%" : `${settings.discountLimits[role]}%`}
                </div>
                {settings.discountLimits[role] === 0 && role !== "admin" && (
                  <span style={{ fontSize: 12, color: C.textMuted }}>No discounts allowed</span>
                )}
              </div>
            </FormRow>
          ))}
          <FormRow label="Require PIN for Discount" hint="Staff must enter a manager PIN to apply discounts">
            <Toggle checked={settings.requirePinForDiscount} onChange={v => set("requirePinForDiscount", v)} />
          </FormRow>
          <FormRow label="Require PIN for Void" hint="Staff must confirm with PIN when voiding an item">
            <Toggle checked={settings.requirePinForVoid} onChange={v => set("requirePinForVoid", v)} />
          </FormRow>
        </CardBody>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader title="Payment Methods" subtitle="Enable or disable payment options at checkout" />
        <CardBody>
          {[
            { id: "cash",   label: "Cash",           emoji: "-", hint: "Physical cash payments" },
            { id: "mpesa",  label: "M-Pesa",          emoji: "-", hint: "Safaricom mobile money (most common in Kenya)" },
            { id: "card",   label: "Card / POS",      emoji: "-", hint: "Visa, Mastercard via card reader" },
            { id: "bank",   label: "Bank Transfer",   emoji: "-", hint: "Direct bank transfer (RTGS/EFT)" },
            { id: "credit", label: "House Credit",    emoji: "-", hint: "Post-pay for known guests/accounts" },
          ].map(pm => (
            <FormRow key={pm.id} label={`${pm.emoji} ${pm.label}`} hint={pm.hint}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Toggle checked={settings.paymentMethods[pm.id]} onChange={v => setNested("paymentMethods", pm.id, v)} />
                <span style={{ fontSize: 12, color: settings.paymentMethods[pm.id] ? C.green : C.textMuted, fontWeight: 600 }}>
                  {settings.paymentMethods[pm.id] ? "Active" : "Hidden"}
                </span>
              </div>
            </FormRow>
          ))}

          {settings.paymentMethods.mpesa && (
            <>
              <FormRow label="M-Pesa Till Number" hint="Buy Goods Till for M-Pesa payments">
                <Input value={settings.mpesaTill} onChange={e => set("mpesaTill", e.target.value)} placeholder="e.g. 522522" style={{ maxWidth: 200 }} />
              </FormRow>
              <FormRow label="M-Pesa Paybill" hint="Paybill number (if applicable)">
                <Input value={settings.mpesaPaybill} onChange={e => set("mpesaPaybill", e.target.value)} placeholder="e.g. 400200" style={{ maxWidth: 200 }} />
              </FormRow>
            </>
          )}

          <FormRow label="Default Payment Method" hint="Pre-selected payment type at checkout">
            <Select value={settings.defaultPayment} onChange={e => set("defaultPayment", e.target.value)} style={{ maxWidth: 220 }} options={
              Object.entries(settings.paymentMethods).filter(([, enabled]) => enabled).map(([id]) => ({
                value: id, label: { cash: "- Cash", mpesa: "- M-Pesa", card: "- Card", bank: "- Bank Transfer", credit: "- House Credit" }[id]
              }))
            } />
          </FormRow>
        </CardBody>
      </Card>

      {/* Display Options */}
      <Card>
        <CardHeader title="Display & Visibility" />
        <CardBody>
          <FormRow label="Show Item Costs" hint="Controlled per-role in Users & Roles - Permissions (can_view_cost)">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: C.blue, background: C.blueLight, padding: "4px 10px", borderRadius: 6, fontWeight: 600 }}>
                - Set in Users & Roles - Permissions
              </span>
            </div>
          </FormRow>
          <FormRow label="Auto-open Receipt" hint="Automatically show receipt preview after each sale">
            <Toggle checked={settings.receiptAutoOpen} onChange={v => set("receiptAutoOpen", v)} />
          </FormRow>
          <FormRow label="Allow Negative Stock" hint="Allow sales even when stock is at zero">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Toggle checked={settings.allowNegativeStock} onChange={v => set("allowNegativeStock", v)} />
              {settings.allowNegativeStock && <Badge label="- Use with caution" color="yellow" />}
            </div>
          </FormRow>
        </CardBody>
      </Card>
    </div>
  );
}
