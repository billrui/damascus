import { useState } from "react";
import { C, Card, CardHeader, CardBody, Toggle, Btn, Badge, SectionTitle } from "./shared";

const ROLES = ["admin", "manager", "cashier", "storekeeper", "waiter"];
const ROLE_SYMBOLS = { admin: "-", manager: "-", cashier: "-", storekeeper: "-", waiter: "-" };
const ROLE_COLORS = { admin: C.red, manager: C.blue, cashier: C.green, storekeeper: C.yellow, waiter: C.textMuted };

const PERMISSION_GROUPS = [
  {
    group: "Sales & POS",
    symbol: "-",
    perms: [
      { id: "can_delete_sale",    label: "Delete completed sale",     hint: "Remove finalized invoices from records" },
      { id: "can_give_discount",  label: "Apply discounts",           hint: "Override price with discount percentage" },
      { id: "can_edit_price",     label: "Edit item price",           hint: "Change item price at point of sale" },
      { id: "can_split_bill",     label: "Split bills",               hint: "Divide one order into multiple payments" },
      { id: "can_void_item",      label: "Void order items",          hint: "Remove items from active orders" },
      { id: "can_hold_order",     label: "Place orders on hold",      hint: "Park an order and return to it later" },
    ],
  },
  {
    group: "Inventory",
    symbol: "-",
    perms: [
      { id: "can_adjust_stock",     label: "Manual stock adjustment",    hint: "Change stock levels without a delivery" },
      { id: "can_receive_stock",    label: "Receive new stock",          hint: "Log incoming stock deliveries" },
      { id: "can_issue_stock",      label: "Issue stock to kitchen",     hint: "Transfer stock from store to kitchen" },
      { id: "can_write_off",        label: "Write off expired/wasted",   hint: "Record wastage and expired items" },
      { id: "can_add_item",         label: "Create new menu items",      hint: "Add new products to the system" },
      { id: "can_edit_item",        label: "Edit menu items",            hint: "Modify existing product details or prices" },
    ],
  },
  {
    group: "Reports & Finance",
    symbol: "-",
    perms: [
      { id: "can_view_reports",    label: "View financial reports",  hint: "Access daily, weekly, monthly reports" },
      { id: "can_export_reports",  label: "Export reports",          hint: "Download reports as PDF or Excel" },
      { id: "can_view_cost",       label: "View item costs",         hint: "See purchase costs alongside selling prices" },
      { id: "can_view_variance",   label: "View stock variance",     hint: "Access variance and reconciliation reports" },
    ],
  },
  {
    group: "System & Admin",
    symbol: "--",
    perms: [
      { id: "can_manage_users",   label: "Manage user accounts",    hint: "Create, edit, disable user accounts" },
      { id: "can_view_audit",     label: "View audit logs",         hint: "See all system activity and actions" },
      { id: "can_backup",         label: "Backup system data",      hint: "Export and backup the database" },
      { id: "can_change_settings",label: "Change system settings",  hint: "Modify business profile and POS config" },
    ],
  },
];

// Default matrix - which roles have which permissions
const DEFAULT_MATRIX = {
  admin:       Object.fromEntries(PERMISSION_GROUPS.flatMap(g => g.perms).map(p => [p.id, true])),
  manager:     { can_delete_sale:false, can_give_discount:true, can_edit_price:false, can_split_bill:true, can_void_item:true, can_hold_order:true, can_adjust_stock:true, can_receive_stock:true, can_issue_stock:true, can_write_off:true, can_add_item:true, can_edit_item:true, can_view_reports:true, can_export_reports:true, can_view_cost:true, can_view_variance:true, can_manage_users:false, can_view_audit:true, can_backup:false, can_change_settings:false },
  cashier:     { can_delete_sale:false, can_give_discount:false, can_edit_price:false, can_split_bill:true, can_void_item:false, can_hold_order:true, can_adjust_stock:false, can_receive_stock:false, can_issue_stock:false, can_write_off:false, can_add_item:false, can_edit_item:false, can_view_reports:false, can_export_reports:false, can_view_cost:false, can_view_variance:false, can_manage_users:false, can_view_audit:false, can_backup:false, can_change_settings:false },
  storekeeper: { can_delete_sale:false, can_give_discount:false, can_edit_price:false, can_split_bill:false, can_void_item:false, can_hold_order:false, can_adjust_stock:true, can_receive_stock:true, can_issue_stock:true, can_write_off:true, can_add_item:true, can_edit_item:true, can_view_reports:false, can_export_reports:false, can_view_cost:true, can_view_variance:true, can_manage_users:false, can_view_audit:false, can_backup:false, can_change_settings:false },
  waiter:      { can_delete_sale:false, can_give_discount:false, can_edit_price:false, can_split_bill:false, can_void_item:false, can_hold_order:true, can_adjust_stock:false, can_receive_stock:false, can_issue_stock:false, can_write_off:false, can_add_item:false, can_edit_item:false, can_view_reports:false, can_export_reports:false, can_view_cost:false, can_view_variance:false, can_manage_users:false, can_view_audit:false, can_backup:false, can_change_settings:false },
};

export default function Permissions({ currentUser, toast }) {
  const [matrix, setMatrix] = useState(DEFAULT_MATRIX);
  const [dirty, setDirty] = useState(false);
  const isAdmin = currentUser.role === "admin";

  const toggle = (role, permId) => {
    if (!isAdmin || role === "admin") return; // Admin always has all, can't edit
    setMatrix(m => ({ ...m, [role]: { ...m[role], [permId]: !m[role][permId] } }));
    setDirty(true);
  };

  const handleSave = () => { setDirty(false); toast("Permissions matrix saved", "success"); };
  const handleReset = () => { setMatrix(DEFAULT_MATRIX); setDirty(false); toast("Permissions reset to defaults", "success"); };

  const countGranted = role => Object.values(matrix[role]).filter(Boolean).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: C.textPrimary, margin: 0, letterSpacing: "0.5px" }}>Role Permissions</h2>
          <p style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>Control what each role can and cannot do</p>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: 12 }}>
            {dirty && <Btn variant="secondary" onClick={handleReset}>Reset Defaults</Btn>}
            <Btn variant="primary" onClick={handleSave} disabled={!dirty}>Save Permissions</Btn>
          </div>
        )}
      </div>

      {!isAdmin && (
        <div style={{ background: `${C.yellow}15`, border: `1px solid ${C.yellow}40`, borderRadius: 6, padding: "12px 18px", fontSize: 12, color: C.yellow, fontWeight: 500 }}>
          Only administrators can modify role permissions.
        </div>
      )}

      {/* Role summary row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        {ROLES.map(role => (
          <div key={role} style={{ background: C.surface, borderRadius: 6, padding: "14px 16px", border: `1px solid ${C.border}`, textAlign: "center" }}>
            <div style={{ fontSize: 20, color: ROLE_COLORS[role], letterSpacing: "0.5px" }}>{ROLE_SYMBOLS[role]}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, textTransform: "capitalize", marginTop: 4 }}>{role}</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{countGranted(role)} permissions</div>
          </div>
        ))}
      </div>

      {/* Permission matrix */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, background: C.surface, borderRadius: 6, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          {/* Header */}
          <thead>
            <tr style={{ background: C.sidebar }}>
              <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: 1, width: "40%", borderBottom: `1px solid rgba(255,255,255,0.1)` }}>
                PERMISSION
              </th>
              {ROLES.map(role => (
                <th key={role} style={{ padding: "14px 10px", textAlign: "center", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.8)", borderBottom: `1px solid rgba(255,255,255,0.1)` }}>
                  <div style={{ textTransform: "capitalize", marginTop: 2 }}>{role}</div>
                </th>
              ))}
            </tr>
          </thead>

          {PERMISSION_GROUPS.map((group, gi) => (
            <tbody key={group.group}>
              {/* Group header */}
              <tr style={{ background: C.surfaceAlt }}>
                <td colSpan={ROLES.length + 1} style={{ padding: "10px 20px", fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.2, borderTop: gi > 0 ? `1px solid ${C.border}` : "none" }}>
                  {group.group}
                </td>
              <tr>

              {/* Permission rows */}
              {group.perms.map((perm, pi) => (
                <tr key={perm.id} style={{ borderBottom: `1px solid ${C.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ padding: "12px 20px" }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: C.textPrimary }}>{perm.label}</div>
                    <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{perm.hint}</div>
                  </td>
                  {ROLES.map(role => {
                    const granted = matrix[role][perm.id];
                    const isLocked = role === "admin" || !isAdmin;
                    return (
                      <td key={role} style={{ textAlign: "center", padding: "12px 10px" }}>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          {isLocked && role === "admin" ? (
                            <div style={{ fontSize: 14, color: C.green, fontWeight: 600 }} title="Always granted">-</div>
                          ) : (
                            <Toggle checked={granted} onChange={() => toggle(role, perm.id)} disabled={isLocked} size="sm" />
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <div style={{ fontSize: 11, color: C.textMuted, textAlign: "center", padding: "8px 0" }}>
        Administrator role always has full access and cannot be restricted
      </div>
    </div>
  );
}