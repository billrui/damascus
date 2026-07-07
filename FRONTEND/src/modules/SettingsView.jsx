import { useState } from "react";
import { C, useToast, ToastContainer } from "./settings/shared";
import BusinessProfile from "./settings/BusinessProfile";
import UsersRoles from "./settings/UsersRoles";
import POSSettings from "./settings/POSSettings";
import InventorySettings from "./settings/InventorySettings";
import { ReceiptSettings, ReportsSettings } from "./settings/ReceiptReportsSettings";
import SystemControls from "./settings/SystemControls";
import AuditLogs from "./settings/AuditLogs";
import OverheadSettings from "./OverheadSettings";

const NAV_ITEMS = [
  { id: "business",  label: "Business Profile",  symbol: "-", roles: ["admin", "manager"] },
  { id: "users",     label: "Users & Roles",      symbol: "-", roles: ["admin", "manager"] },
  { id: "receipt",   label: "Receipt & Printing", symbol: "-", roles: ["admin", "manager"] },
  { id: "system",    label: "System Controls",    symbol: "-", roles: ["admin"] },
  { id: "utilities", label: "Utilities",          symbol: "-", roles: ["admin", "manager"] },
  { id: "overheads", label: "Overheads",          symbol: "-", roles: ["admin"] },
  { id: "audit",     label: "Audit Logs",         symbol: "-", roles: ["admin"] },
];

export default function SettingsView({ user, users, setUsers, ingredients = [] }) {
  const { toasts, toast } = useToast();
  const allowedNav = NAV_ITEMS.filter(n => n.roles.includes(user.role) && (!n.permission || user.role === "admin" || (user.permissions || []).includes(n.permission)));
  const [activeSection, setActiveSection] = useState(allowedNav[0]?.id || "business");

  // Lifted business profile so ReceiptSettings can sync header text automatically
  const [businessProfile, setBusinessProfile] = useState({
    name: "Damascus Hotel",
    tagline: "Where Comfort Meets Excellence",
  });

  const renderSection = () => {
    const props = { toast, currentUser: user };
    switch (activeSection) {
      case "business":    return <BusinessProfile {...props} businessProfile={businessProfile} setBusinessProfile={setBusinessProfile} />;
      case "users":       return <UsersRoles {...props} users={users} setUsers={setUsers} />;
      case "pos":         return <POSSettings {...props} />;
      case "inventory":   return <InventorySettings {...props} ingredients={ingredients} />;
      case "receipt":     return <ReceiptSettings {...props} businessProfile={businessProfile} />;
      case "reports":     return <ReportsSettings {...props} />;
      case "system":      return <SystemControls {...props} />;
      case "audit":       return <AuditLogs {...props} />;
      case "utilities":   return <OverheadSettings mode="utilities" onBack={() => setActiveSection("business")} />;
      case "overheads":   return <OverheadSettings mode="overheads" onBack={() => setActiveSection("business")} />;
      default:            return null;
    }
  };

  const activeItem = NAV_ITEMS.find(n => n.id === activeSection);

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", overflow: "hidden", background: C.bg }}>
      <ToastContainer toasts={toasts} />

      {/* Settings Sidebar */}
      <aside style={{
        width: 260, 
        minWidth: 260, 
        background: C.surface, 
        borderRight: `1px solid ${C.border}`,
        display: "flex", 
        flexDirection: "column", 
        overflow: "hidden",
        boxShadow: "1px 0 0 rgba(0,0,0,0.02)",
      }}>
        {/* Sidebar Header */}
        <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ 
              width: 40, 
              height: 40, 
              borderRadius: 6, 
              background: `linear-gradient(135deg, ${C.sidebar}, ${C.primary})`, 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              fontSize: 16,
              color: "#FFFFFF",
            }}>
              -
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, letterSpacing: "0.3px" }}>
                Administration
              </div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2, letterSpacing: "0.3px" }}>
                System Configuration
              </div>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav style={{ 
          flex: 1, 
          padding: "16px 12px", 
          overflowY: "auto", 
          display: "flex", 
          flexDirection: "column", 
          gap: 4 
        }}>
          {allowedNav.map(item => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                style={{
                  display: "flex", 
                  alignItems: "center", 
                  gap: 12, 
                  padding: "10px 14px",
                  borderRadius: 6, 
                  border: "none", 
                  cursor: "pointer", 
                  textAlign: "left", 
                  width: "100%",
                  background: isActive ? `${C.primary}10` : "transparent",
                  color: isActive ? C.primary : C.textSecondary,
                  fontWeight: isActive ? 600 : 500, 
                  fontSize: 12,
                  transition: "all 0.15s ease",
                  outline: "none",
                  letterSpacing: "0.3px",
                }}
                onMouseEnter={e => { 
                  if (!isActive) e.currentTarget.style.background = C.surfaceAlt; 
                }}
                onMouseLeave={e => { 
                  if (!isActive) e.currentTarget.style.background = "transparent"; 
                }}
              >
                <span style={{ 
                  fontSize: 13, 
                  width: 22, 
                  textAlign: "center",
                  color: isActive ? C.primary : C.textMuted,
                }}>
                  {item.symbol}
                </span>
                {item.label}
                {isActive && (
                  <div style={{ 
                    marginLeft: "auto", 
                    width: 4, 
                    height: 4, 
                    borderRadius: "50%", 
                    background: C.primary 
                  }} />
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main content area */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Breadcrumb/page header */}
        <div style={{
          padding: "0 32px", 
          height: 56, 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between",
          background: C.surface, 
          borderBottom: `1px solid ${C.border}`, 
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.3px" }}>Settings</span>
            <span style={{ fontSize: 11, color: C.textMuted }}>/</span>
            <span style={{ 
              fontSize: 12, 
              fontWeight: 600, 
              color: C.textPrimary,
              letterSpacing: "0.3px",
            }}>
              {activeItem?.symbol} {activeItem?.label}
            </span>
          </div>
          <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: "0.3px" }}>
            Logged in as <strong style={{ color: C.textSecondary }}>{user.name}</strong> - <span style={{ textTransform: "capitalize" }}>{user.role}</span>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: C.bg }}>
          {renderSection()}
          <div style={{ height: 40 }} />
        </div>
      </main>
    </div>
  );
}