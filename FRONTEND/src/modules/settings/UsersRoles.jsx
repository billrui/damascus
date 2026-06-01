import { useState } from "react";
import { C, Card, CardHeader, CardBody, Input, Select, Btn, Badge, Modal, ConfirmModal, Toggle, SectionTitle } from "./shared";
import { DEFAULT_ROLE_PERMISSIONS, CAN_CREATE_ROLES } from "../../data";

// --- SHARED ROLE CONSTANTS ----------------------------------------------------
const ROLES = ["admin", "manager", "cashier", "storekeeper", "waiter"];
const ROLE_COLORS = { admin: "red", manager: "blue", cashier: "green", storekeeper: "yellow", waiter: "gray" };
const ROLE_SYMBOLS = { admin: "-", manager: "-", cashier: "-", storekeeper: "-", waiter: "-" };

// --- PERMISSIONS DATA ---------------------------------------------------------
const PERMISSION_GROUPS = [
  {
    group: "Sales & POS",
    perms: [
      { id: "can_delete_sale",   label: "Delete completed sale",    hint: "Remove finalized invoices from records" },
      { id: "can_give_discount", label: "Apply discounts",            hint: "Override price with discount percentage" },
      { id: "can_edit_price",    label: "Edit item price",            hint: "Change item price at point of sale" },
      { id: "can_split_bill",    label: "Split bills",               hint: "Divide one order into multiple payments" },
      { id: "can_void_item",     label: "Void order items",           hint: "Remove items from active orders" },
      { id: "can_hold_order",    label: "Place orders on hold",       hint: "Park an order and return to it later" },
    ],
  },
  {
    group: "Inventory",
    perms: [
      { id: "can_adjust_stock",  label: "Manual stock adjustment",  hint: "Change stock levels without a delivery" },
      { id: "can_receive_stock", label: "Receive new stock",         hint: "Log incoming stock deliveries" },
      { id: "can_issue_stock",   label: "Issue stock to kitchen",    hint: "Transfer stock from store to kitchen" },
      { id: "can_write_off",     label: "Write off expired/wasted",  hint: "Record wastage and expired items" },
      { id: "can_add_item",      label: "Create new menu items",     hint: "Add new products to the system" },
      { id: "can_edit_item",     label: "Edit menu items",           hint: "Modify existing product details or prices" },
    ],
  },
  {
    group: "Reports & Finance",
    perms: [
      { id: "can_view_reports",   label: "View financial reports", hint: "Access daily, weekly, monthly reports" },
      { id: "can_export_reports", label: "Export reports",         hint: "Download reports as PDF or Excel" },
      { id: "can_view_cost",      label: "View item costs",        hint: "See purchase costs alongside selling prices" },
      { id: "can_view_variance",  label: "View stock variance",    hint: "Access variance and reconciliation reports" },
    ],
  },
  {
    group: "System & Admin",
    perms: [
      { id: "can_manage_users",    label: "Manage user accounts",   hint: "Create, edit, disable user accounts" },
      { id: "can_view_audit",      label: "View audit logs",        hint: "See all system activity and actions" },
      { id: "can_backup",          label: "Backup system data",     hint: "Export and backup the database" },
      { id: "can_change_settings", label: "Change system settings", hint: "Modify business profile and POS config" },
    ],
  },
];

const DEFAULT_MATRIX = {
  admin:       Object.fromEntries(PERMISSION_GROUPS.flatMap(g => g.perms).map(p => [p.id, true])),
  manager:     { can_delete_sale:false, can_give_discount:true, can_edit_price:false, can_split_bill:true, can_void_item:true, can_hold_order:true, can_adjust_stock:true, can_receive_stock:true, can_issue_stock:true, can_write_off:true, can_add_item:true, can_edit_item:true, can_view_reports:true, can_export_reports:true, can_view_cost:true, can_view_variance:true, can_manage_users:false, can_view_audit:true, can_backup:false, can_change_settings:false },
  cashier:     { can_delete_sale:false, can_give_discount:false, can_edit_price:false, can_split_bill:true, can_void_item:false, can_hold_order:true, can_adjust_stock:false, can_receive_stock:false, can_issue_stock:false, can_write_off:false, can_add_item:false, can_edit_item:false, can_view_reports:false, can_export_reports:false, can_view_cost:false, can_view_variance:false, can_manage_users:false, can_view_audit:false, can_backup:false, can_change_settings:false },
  storekeeper: { can_delete_sale:false, can_give_discount:false, can_edit_price:false, can_split_bill:false, can_void_item:false, can_hold_order:false, can_adjust_stock:true, can_receive_stock:true, can_issue_stock:true, can_write_off:true, can_add_item:true, can_edit_item:true, can_view_reports:false, can_export_reports:false, can_view_cost:true, can_view_variance:true, can_manage_users:false, can_view_audit:false, can_backup:false, can_change_settings:false },
  waiter:      { can_delete_sale:false, can_give_discount:false, can_edit_price:false, can_split_bill:false, can_void_item:false, can_hold_order:true, can_adjust_stock:false, can_receive_stock:false, can_issue_stock:false, can_write_off:false, can_add_item:false, can_edit_item:false, can_view_reports:false, can_export_reports:false, can_view_cost:false, can_view_variance:false, can_manage_users:false, can_view_audit:false, can_backup:false, can_change_settings:false },
};

// --- USER ROW -----------------------------------------------------------------
function UserRow({ user, currentUser, onEdit, onToggle, onReset, onDelete }) {
  const canManage = currentUser.role === "admin" || (currentUser.role === "manager" && ["cashier", "waiter"].includes(user.role));
  const isSelf = user.id === currentUser.id;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
      borderBottom: `1px solid ${C.border}`, transition: "background 0.15s ease",
    }}
      onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <div style={{ width: 40, height: 40, borderRadius: 6, background: user.active ? `linear-gradient(135deg, ${C.accent}, ${C.accent}80)` : C.borderMid, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, color: "#FFFFFF" }}>
{user.avatar && user.avatar.startsWith("data:") ? (
            <img src={user.avatar} alt={user.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }} />
          ) : (
            <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
              {user.name?.charAt(0).toUpperCase()}
            </span>
          )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, letterSpacing: "0.3px" }}>{user.name}</span>
          {isSelf && <Badge label="Current" color="blue" />}
          {!user.active && <Badge label="Disabled" color="red" />}
        </div>
        <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>
          Created {user.createdAt || "on setup"}{user.createdBy ? ` by ${user.createdBy}` : ""}
        </div>
      </div>
      <Badge label={`${ROLE_SYMBOLS[user.role]} ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}`} color={ROLE_COLORS[user.role] || "gray"} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {isSelf && (
          <Btn variant="secondary" size="sm" onClick={() => onReset(user)}>Change my PIN</Btn>
        )}
        {canManage && !isSelf && (
          <>
            <Btn variant="secondary" size="sm" onClick={() => onEdit(user)}>Edit</Btn>
            <Btn variant="secondary" size="sm" onClick={() => onReset(user)}>Reset PIN</Btn>
            <Btn variant={user.active ? "secondary" : "success"} size="sm" onClick={() => onToggle(user)}>
              {user.active ? "Disable" : "Enable"}
            </Btn>
            <Btn variant="danger" size="sm" onClick={() => onDelete(user)}>Delete</Btn>
          </>
        )}
      </div>
    </div>
  );
}

// --- STAFF TAB ----------------------------------------------------------------
function StaffTab({ users, setUsers, currentUser, toast }) {
  const [addModal, setAddModal]     = useState(false);
  const [editUser, setEditUser]     = useState(null);
  const [resetUser, setResetUser]   = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [search, setSearch]         = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [newPin, setNewPin]         = useState("");
  const [formData, setFormData]     = useState({ name: "", role: "cashier", pin: "", avatar: "", imagePreview: "" });
  const [formError, setFormError]   = useState("");
  const [saving, setSaving]         = useState(false);

  const availableRoles = CAN_CREATE_ROLES[currentUser.role] || [];
  const canCreateUsers = availableRoles.length > 0;

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase());
    const matchRole   = filterRole === "all" || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const AVATARS = ["-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-"];

  const openAdd = () => {
    setFormData({ name: "", role: availableRoles[0] || "cashier", pin: "", avatar: "", imagePreview: "" });
    setFormError("");
    setAddModal(true);
  };

  const openEdit = user => {
    setFormData({ name: user.name, role: user.role, pin: "", avatar: user.avatar || "", imagePreview: user.avatar || "" });
    setFormError("");
    setEditUser(user);
  };

  const handleAddUser = async () => {
    if (!formData.name.trim())                    { setFormError("Name is required"); return; }
    if (!formData.pin || formData.pin.length < 4) { setFormError("PIN must be at least 4 digits"); return; }
    setSaving(true);
    try {
      const { usersApi } = await import("../../api/index.js");
      const created = await usersApi.create({
        name: formData.name.trim(), role: formData.role,
        pin: formData.pin, avatar: formData.avatar,
        permissions: [...(DEFAULT_ROLE_PERMISSIONS[formData.role] || [])],
      });
      setUsers(prev => [...prev, created]);
      setAddModal(false);
      toast(`User "${created.name}" created successfully`, "success");
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  const handleEditUser = async () => {
    if (!formData.name.trim()) { setFormError("Name is required"); return; }
    setSaving(true);
    try {
      const { usersApi } = await import("../../api/index.js");
      const updates = { name: formData.name, role: formData.role, avatar: formData.avatar };
      if (formData.pin) updates.pin = formData.pin;
      const updated = await usersApi.update(editUser.id, updates);
      setUsers(prev => prev.map(u => u.id === editUser.id ? updated : u));
      setEditUser(null);
      toast("User updated successfully", "success");
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async user => {
    try {
      const { usersApi } = await import("../../api/index.js");
      await usersApi.update(user.id, { active: !user.active });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, active: !u.active } : u));
      toast(`${user.name} ${user.active ? "disabled" : "enabled"}`, "success");
    } catch (err) {
      toast("Failed to update user", "error");
    }
  };

  const handleDelete = async user => {
    try {
      const { usersApi } = await import("../../api/index.js");
      await usersApi.remove(user.id);
      setUsers(prev => prev.filter(u => u.id !== user.id));
      toast(`${user.name} removed`, "success");
    } catch (err) {
      toast("Failed to remove user", "error");
    }
  };

  const handleResetPin = async () => {
    if (!newPin || newPin.length < 4) return;
    try {
      const { usersApi } = await import("../../api/index.js");
      await usersApi.update(resetUser.id, { pin: newPin });
      setResetUser(null);
      setNewPin("");
      toast("PIN reset successfully", "success");
    } catch (err) {
      toast("Failed to reset PIN", "error");
    }
  };

  const userFormFields = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {formError && (
        <div style={{ background: C.redLight, color: C.red, padding: "8px 12px", borderRadius: 4, fontSize: 12, fontWeight: 500 }}>
          {formError}
        </div>
      )}
      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: 6, letterSpacing: "0.5px" }}>Full Name *</label>
        <Input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Jane Achieng" autoFocus />
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: 6, letterSpacing: "0.5px" }}>Role *</label>
        <Select value={formData.role} onChange={e => setFormData(f => ({ ...f, role: e.target.value }))}
          options={availableRoles.map(r => ({ value: r, label: `${ROLE_SYMBOLS[r]} ${r.charAt(0).toUpperCase() + r.slice(1)}` }))} />
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: 6, letterSpacing: "0.5px" }}>
          {editUser ? "New PIN (leave blank to keep current)" : "PIN (4+ digits) *"}
        </label>
        <Input
          value={formData.pin}
          onChange={e => {
            const val = e.target.value.replace(/\D/g, "").slice(0, 4);
            setFormData(f => ({ ...f, pin: val }));
          }}
          type="password"
          placeholder="4 digits"
          maxLength={4}
          inputMode="numeric"
        />
        <div style={{ fontSize: 10, color: formData.pin.length === 4 ? C.green : C.textMuted, marginTop: 4 }}>
          {formData.pin.length}/4 digits{formData.pin.length === 4 ? " — ready" : ""}
        </div>
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: 8, letterSpacing: "0.5px" }}>Staff Photo</label>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Preview */}
          <div style={{
            width: 72, height: 72, borderRadius: 8, overflow: "hidden", flexShrink: 0,
            border: `2px solid ${formData.imagePreview ? C.accent : C.border}`,
            background: C.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {formData.imagePreview ? (
              <img src={formData.imagePreview} alt="preview"
                style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            )}
          </div>
          {/* Upload controls */}
          <div style={{ flex: 1 }}>
            <label style={{
              display: "inline-block", padding: "8px 16px", borderRadius: 6, cursor: "pointer",
              background: C.accent, color: "#fff", fontSize: 12, fontWeight: 600,
              border: "none", marginBottom: 6,
            }}>
              Upload Photo
              <input type="file" accept="image/*" style={{ display: "none" }}
                onChange={e => {
                  const file = e.target.files[0];
                  if (!file) return;
                  // Compress to max 200x200 before storing
                  const reader = new FileReader();
                  reader.onload = ev => {
                    const img = new Image();
                    img.onload = () => {
                      const canvas = document.createElement("canvas");
                      const size = Math.min(img.width, img.height);
                      canvas.width = 200; canvas.height = 200;
                      const ctx = canvas.getContext("2d");
                      const sx = (img.width  - size) / 2;
                      const sy = (img.height - size) / 2;
                      ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);
                      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
                      setFormData(f => ({ ...f, avatar: dataUrl, imagePreview: dataUrl }));
                    };
                    img.src = ev.target.result;
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            {formData.imagePreview && (
              <button type="button" onClick={() => setFormData(f => ({ ...f, avatar: "", imagePreview: "" }))}
                style={{ display: "block", fontSize: 11, color: C.red, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Remove photo
              </button>
            )}
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>JPG or PNG, square preferred</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Role summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 24 }}>
        {ROLES.map(role => {
          const count = users.filter(u => u.role === role).length;
          return (
            <div key={role} style={{ background: C.surface, borderRadius: 6, padding: "14px 16px", border: `1px solid ${C.border}`, textAlign: "center" }}>
              <div style={{ fontSize: 18, marginBottom: 4, color: C.accent }}>{ROLE_SYMBOLS[role]}</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: C.textPrimary }}>{count}</div>
              <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>{role}</div>
            </div>
          );
        })}
      </div>

      <Card>
        {/* Filters + Add */}
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff name..." style={{ maxWidth: 260 }} />
          <Select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={{ maxWidth: 180 }} options={[
            { value: "all", label: "All Roles" },
            ...ROLES.map(r => ({ value: r, label: `${ROLE_SYMBOLS[r]} ${r.charAt(0).toUpperCase() + r.slice(1)}` })),
          ]} />
          <div style={{ marginLeft: "auto" }}>
            {canCreateUsers && <Btn variant="primary" onClick={openAdd}>Add Staff</Btn>}
          </div>
        </div>

        {/* User list */}
        {filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: C.textMuted }}>
            <div style={{ fontSize: 28, marginBottom: 8, color: C.accent, opacity: 0.5 }}>-</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>No users found</div>
          </div>
        ) : (
          filtered.map(u => (
            <UserRow key={u.id} user={u} currentUser={currentUser}
              onEdit={openEdit} onToggle={handleToggle}
              onReset={u => { setResetUser(u); setNewPin(""); }}
              onDelete={u => setDeleteUser(u)}
            />
          ))
        )}
      </Card>

      {/* Add User Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add New Staff Member">
        {userFormFields}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <Btn variant="secondary" onClick={() => setAddModal(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={handleAddUser}>Create User</Btn>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Edit: ${editUser?.name}`}>
        {userFormFields}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <Btn variant="secondary" onClick={() => setEditUser(null)}>Cancel</Btn>
          <Btn variant="primary" onClick={handleEditUser}>Save Changes</Btn>
        </div>
      </Modal>

      {/* Reset PIN Modal */}
      <Modal open={!!resetUser} onClose={() => setResetUser(null)} title={resetUser?.id === currentUser.id ? "Change My PIN" : `Reset PIN: ${resetUser?.name}`} width={380}>
        <p style={{ fontSize: 12, color: C.textSecondary, marginBottom: 14 }}>
          {resetUser?.id === currentUser.id ? "Enter your new PIN below." : "Enter a new PIN for this staff member."}
        </p>
        <Input
          value={newPin}
          onChange={e => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          type="password"
          placeholder="4 digits"
          maxLength={4}
          inputMode="numeric"
        />
        <div style={{ fontSize: 10, color: newPin.length === 4 ? C.green : C.textMuted, marginTop: 4 }}>
          {newPin.length}/4 digits
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <Btn variant="secondary" onClick={() => setResetUser(null)}>Cancel</Btn>
          <Btn variant="primary" onClick={handleResetPin} disabled={newPin.length < 4}>Reset PIN</Btn>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!deleteUser} onClose={() => setDeleteUser(null)}
        onConfirm={() => handleDelete(deleteUser)}
        title="Remove Staff Member"
        message={`Are you sure you want to remove ${deleteUser?.name}? This action cannot be undone.`}
        confirmLabel="Remove User" danger
      />
    </>
  );
}

// --- PERMISSIONS TAB ----------------------------------------------------------
function PermissionsTab({ currentUser, toast }) {
  const [matrix, setMatrix] = useState(DEFAULT_MATRIX);
  const [dirty, setDirty]   = useState(false);
  const isAdmin = currentUser.role === "admin";

  const toggle = (role, permId) => {
    if (!isAdmin || role === "admin") return;
    setMatrix(m => ({ ...m, [role]: { ...m[role], [permId]: !m[role][permId] } }));
    setDirty(true);
  };

  const handleSave  = () => { setDirty(false); toast("Permissions matrix saved", "success"); };
  const handleReset = () => { setMatrix(DEFAULT_MATRIX); setDirty(false); toast("Permissions reset to defaults", "success"); };
  const countGranted = role => Object.values(matrix[role]).filter(Boolean).length;

  return (
    <>
      {!isAdmin && (
        <div style={{ background: C.yellowLight, border: `1px solid ${C.yellow}`, borderRadius: 6, padding: "10px 16px", fontSize: 12, color: C.yellow, fontWeight: 500, marginBottom: 20 }}>
          Only administrators can modify role permissions.
        </div>
      )}

      {/* Role summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 24 }}>
        {ROLES.map(role => (
          <div key={role} style={{ background: C.surface, borderRadius: 6, padding: "14px 16px", border: `1px solid ${C.border}`, textAlign: "center" }}>
            <div style={{ fontSize: 18, color: C.accent }}>{ROLE_SYMBOLS[role]}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, textTransform: "capitalize", marginTop: 4 }}>{role}</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{countGranted(role)} permissions</div>
          </div>
        ))}
      </div>

      {/* Save / Reset */}
      {isAdmin && dirty && (
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginBottom: 20 }}>
          <Btn variant="secondary" onClick={handleReset}>Reset Defaults</Btn>
          <Btn variant="primary" onClick={handleSave}>Save Permissions</Btn>
        </div>
      )}

      {/* Matrix table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, background: C.surface, borderRadius: 6, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <thead>
            <tr style={{ background: C.sidebar }}>
              <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: 1, width: "40%", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                PERMISSION
              </th>
              {ROLES.map(role => (
                <th key={role} style={{ padding: "14px 10px", textAlign: "center", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.8)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  <div style={{ textTransform: "capitalize", fontSize: 10 }}>{role}</div>
                </th>
              ))}
            </tr>
          </thead>
          {PERMISSION_GROUPS.map((group, gi) => (
            <tbody key={group.group}>
              <tr style={{ background: C.surfaceAlt }}>
                <td colSpan={ROLES.length + 1} style={{ padding: "10px 20px", fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.2, borderTop: gi > 0 ? `1px solid ${C.border}` : "none" }}>
                  {group.group}
                </td>
              </tr>
              {group.perms.map(perm => (
                <tr key={perm.id} style={{ borderBottom: `1px solid ${C.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ padding: "12px 20px" }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: C.textPrimary, letterSpacing: "0.3px" }}>{perm.label}</div>
                    <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{perm.hint}</div>
                  </td>
                  {ROLES.map(role => {
                    const granted  = matrix[role][perm.id];
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
      <div style={{ fontSize: 11, color: C.textMuted, textAlign: "center", marginTop: 14 }}>
        Administrator role always has full access and cannot be restricted
      </div>
    </>
  );
}

// --- MAIN EXPORT --------------------------------------------------------------
export default function UsersRoles({ users, setUsers, currentUser, toast }) {
  const [activeTab, setActiveTab] = useState("staff");

  const TABS = [
    { id: "staff",       label: "Staff Accounts" },
    { id: "permissions", label: "Role Permissions" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: C.textPrimary, margin: 0, letterSpacing: "0.5px" }}>Users & Roles</h2>
          <p style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>
            {users.length} staff accounts - {users.filter(u => u.active).length} active
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, background: C.surfaceAlt, padding: 4, borderRadius: 6, border: `1px solid ${C.border}`, alignSelf: "flex-start" }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "8px 18px",
              borderRadius: 4, border: "none", cursor: "pointer",
              background: isActive ? C.surface : "transparent",
              color: isActive ? C.textPrimary : C.textSecondary,
              fontWeight: isActive ? 600 : 500, fontSize: 12,
              boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
              transition: "all 0.15s ease",
              letterSpacing: "0.3px",
            }}>
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "staff" && (
        <StaffTab users={users} setUsers={setUsers} currentUser={currentUser} toast={toast} />
      )}
      {activeTab === "permissions" && (
        <PermissionsTab currentUser={currentUser} toast={toast} />
      )}
    </div>
  );
}