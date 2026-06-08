import React from "react";
import { T } from "../posTheme";

// --- SVG Icons ----------------------------------------------------------------
const Icon = React.memo(({ name, size = 18, color = "currentColor" }) => {
  const icons = {
    dashboard:   <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    pos:         <><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></>,
    kds:         <><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>,
    open_invoices: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>,
    open_orders: <><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></>,
    production: <><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></>,
    shift:       <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    reports:     <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    settings:    <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></>,
    inventory:   <><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>,
    receive:     <><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0018 9h-1.26A8 8 0 103 16.29"/></>,
    issue:       <><polyline points="16 7 12 3 8 7"/><line x1="12" y1="3" x2="12" y2="15"/><path d="M20.88 18.09A5 5 0 0018 9h-1.26A8 8 0 103 16.29"/></>,
    expiry:      <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
    variance:    <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    wastage:     <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></>,
    items:       <><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>,
    "items:new": <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></>,
    "items:list":<><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>,
    "items:stock":<><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    "inventory_readonly":<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    logout:      <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    hold:        <><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></>,
    invoice:     <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>,
    user:        <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    menu:        <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>,
    close:       <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }} aria-hidden="true">
      {icons[name] || icons.dashboard}
    </svg>
  );
});
Icon.displayName = "Icon";

// --- Theme & Constants --------------------------------------------------------
const SIDEBAR_W = 260;
const DUR = 220; // transition ms

const C = {
  primary: "#059669",
  primaryDark: "#047857",
  primaryBg: "rgba(5,150,105,0.08)",
  secondary: "#3b82f6",
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
  text: "#1f2937",
  textSec: "#6b7280",
  textMuted: "#9ca3af",
  bg: "#ffffff",
  surface: "#f9fafb",
  border: "#e5e7eb",
  hover: "#f3f4f6",
};

const ROLE_STYLE = {
  admin:      { color: C.primary,    bg: C.primaryBg },
  manager:    { color: C.secondary,  bg: "rgba(59,130,246,0.08)" },
  cashier:    { color: C.success,    bg: "rgba(34,197,94,0.08)" },
  storekeeper:{ color: "#e07b39",    bg: "rgba(224,123,57,0.08)" },
  waiter:     { color: "#d45b8a",    bg: "rgba(212,91,138,0.08)" },
  kitchen:    { color: C.warning,    bg: "rgba(245,158,11,0.08)" },
};

const PAGE_TITLES = {
  dashboard:"Dashboard", pos:"Point of Sale", kds:"Kitchen Display", open_invoices:"Open Invoices", open_orders:"Open Orders", production:"Production",
  shift:"Shift Management", reports:"Analytics & Reports", settings:"System Settings",
  inventory:"Inventory", inventory_readonly:"Stock Viewer", receive:"Receive Stock",
  issue:"Issue Stock", expiry:"Expiry Control", variance:"Variance Report",
  wastage:"Wastage Log", items:"Menu Items",
};

const NAV_GROUPS = [
  { label:"Operations",     ids:["dashboard","pos","kds","open_invoices","open_orders","production","shift"] },
  { label:"Menu & Stock",   ids:["items","inventory","inventory_readonly","expiry","variance","wastage"] },
  { label:"Reports & Admin",ids:["reports","settings"] },
];

// Menu Items collapsible sub-links
const ITEMS_SUB = [
  { id:"items:new",  label:"New Item",  icon:"items:new"  },
  { id:"items:list", label:"Item List", icon:"items:list" },
];

// Ingredients collapsible sub-links
const INGREDIENTS_SUB = [
  { id:"inventory:list",    label:"Ingredient List", icon:"inventory" },
  { id:"inventory:receive", label:"Receive / Issue", icon:"receive"   },
];

// --- Responsive hook ----------------------------------------------------------
function useBreakpoint() {
  const get = () => ({
    mobile: window.innerWidth < 768,
    tablet: window.innerWidth >= 768 && window.innerWidth < 1024,
  });
  const [bp, setBp] = React.useState(get);
  React.useEffect(() => {
    const handler = () => setBp(get());
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return bp;
}

// --- NavItem ------------------------------------------------------------------
const NavItem = React.memo(({ icon, label, isActive, onClick, right, badge }) => (
  <button onClick={onClick} style={{
    display:"flex", alignItems:"center", justifyContent:"space-between",
    width:"100%", padding:"10px 20px", cursor:"pointer",
    fontSize:13, fontWeight: isActive ? 600 : 500,
    transition:`all ${DUR}ms ease`, fontFamily: T.font,
    color: isActive ? C.primary : C.textSec,
    background: isActive ? C.primaryBg : "transparent",
    borderLeft:`3px solid ${isActive ? C.primary : "transparent"}`,
    borderRight:"none", borderTop:"none", borderBottom:"none", outline:"none",
  }}
    onMouseEnter={e=>{ if(!isActive){ e.currentTarget.style.background=C.hover; e.currentTarget.style.color=C.text; } }}
    onMouseLeave={e=>{ if(!isActive){ e.currentTarget.style.background="transparent"; e.currentTarget.style.color=C.textSec; } }}
  >
    <div style={{display:"flex",alignItems:"center",gap:12}}>{icon}<span>{label}</span></div>
    <div style={{display:"flex",alignItems:"center",gap:8}}>{badge}{right}</div>
  </button>
));

const CountBadge = React.memo(({ count, color }) => {
  if (!count) return null;
  return <span style={{ background:color, color:"#fff", fontSize:10, fontWeight:700, minWidth:18, height:18, borderRadius:9, display:"inline-flex", alignItems:"center", justifyContent:"center", padding:"0 5px" }}>{count>99?"99+":count}</span>;
});

// --- Sub-link (shared by collapsible sections) -------------------------------
const SubLink = React.memo(({ id, label, icon, active, onClick }) => (
  <button onClick={onClick} style={{
    display:"flex", alignItems:"center", gap:10, width:"100%",
    padding:"8px 20px 8px 48px", cursor:"pointer", fontSize:12,
    fontFamily:T.font, color:active?C.primary:C.textSec, fontWeight:active?600:400,
    background:active?C.primaryBg:"transparent",
    borderLeft:`2px solid ${active?C.primary:"transparent"}`,
    borderRight:"none", borderTop:"none", borderBottom:"none", outline:"none",
    transition:`all ${DUR}ms ease`,
  }}
    onMouseEnter={e=>{if(!active)e.currentTarget.style.background=C.hover;}}
    onMouseLeave={e=>{if(!active)e.currentTarget.style.background="transparent";}}
  >
    <Icon name={icon} size={12} color={active?C.primary:C.textMuted}/>
    <span>{label}</span>
  </button>
));

// --- Sidebar inner content ----------------------------------------------------
const SidebarContent = React.memo(function SidebarContent({ activeNav, setActiveNav, user, onLogout, expiryAlertCount=0, lowStockCount=0, allowedNav=[], onNavClick }) {
  const itemsActive = activeNav==="items" || activeNav.startsWith("items:");
  const invActive   = activeNav==="inventory" || activeNav.startsWith("inventory:");
  const [itemsOpen, setItemsOpen] = React.useState(itemsActive);
  const [invOpen,   setInvOpen]   = React.useState(invActive);
  const roleMeta = ROLE_STYLE[user?.role] || ROLE_STYLE.cashier;
  const navById = React.useMemo(() => new Map(allowedNav.map(n=>[n.id,n])), [allowedNav]);

  React.useEffect(() => { if(itemsActive) setItemsOpen(true); }, [itemsActive]);
  React.useEffect(() => { if(invActive)   setInvOpen(true);   }, [invActive]);

  const go = (id) => { setActiveNav(id); onNavClick?.(); };

  return (
    <>
      {/* Logo */}
      <div style={{ padding:"20px", borderBottom:`1px solid ${C.border}`, background:"linear-gradient(135deg,#fff 0%,#f9fafb 100%)", flexShrink:0 }}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{ width:38,height:38,borderRadius:10,flexShrink:0, background:`linear-gradient(135deg,${C.primary},${C.success})`, display:"flex",alignItems:"center",justifyContent:"center", boxShadow:"0 4px 6px rgba(5,150,105,0.2)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#fff" strokeWidth="1.5" fill="none"/>
              <path d="M2 17L12 22L22 17" stroke="#fff" strokeWidth="1.5" fill="none"/>
              <path d="M2 12L12 17L22 12" stroke="#fff" strokeWidth="1.5" fill="none"/>
            </svg>
          </div>
          <div>
            <div style={{ color:C.text, fontWeight:800, fontSize:13, letterSpacing:1.2, lineHeight:1.3, fontFamily:T.font }}>DAMASCUS HOTEL</div>
            <div style={{ color:C.primary, fontSize:9, fontWeight:700, letterSpacing:1.2, marginTop:3, textTransform:"uppercase" }}>POS &amp; Inventory System</div>
          </div>
        </div>
      </div>

      {/* Profile card */}
      <div style={{ margin:"14px 14px 0", background:roleMeta.bg, borderRadius:12, padding:"10px 12px", display:"flex", alignItems:"center", gap:10, border:`1px solid ${roleMeta.color}20`, flexShrink:0 }}>
        <div style={{ width:36,height:36,borderRadius:9,flexShrink:0, background:`linear-gradient(135deg,${roleMeta.color}40,${roleMeta.color}20)`, display:"flex",alignItems:"center",justifyContent:"center" }}>
          <Icon name="user" size={16} color={roleMeta.color} />
        </div>
        <div style={{minWidth:0,flex:1}}>
          <div style={{ color:C.text, fontSize:13, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontFamily:T.font }}>{user.name}</div>
          <div style={{ color:roleMeta.color, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginTop:1 }}>{user.role}</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{flex:1,overflowY:"auto",padding:"8px 0"}} aria-label="Main navigation">
        {NAV_GROUPS.map(group => {
          const items = group.ids.map(id=>navById.get(id)).filter(Boolean);
          if(!items.length) return null;
          return (
            <div key={group.label}>
              <div style={{ padding:"12px 20px 6px", fontSize:10, fontWeight:700, color:C.textMuted, textTransform:"uppercase", letterSpacing:1.5, fontFamily:T.font }}>
                {group.label}
              </div>
              {items.map(item => {
                const alertBadge = item.id==="expiry"?expiryAlertCount:item.id==="inventory"?lowStockCount:0;
                const isActive   = item.id==="items"?itemsActive:item.id==="inventory"?invActive:activeNav===item.id;

                // -- Menu Items collapsible ---------------------------------
                if(item.id==="items") return (
                  <div key="items">
                    <NavItem
                      icon={<Icon name="items" size={16} color={isActive?C.primary:C.textMuted}/>}
                      label="Menu Items" isActive={isActive}
                      onClick={() => { setItemsOpen(p=>!p); if(!itemsActive) go("items:new"); }}
                      right={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2.5" strokeLinecap="round" style={{transition:`transform ${DUR}ms ease`,transform:itemsOpen?"rotate(180deg)":"rotate(0deg)"}}><polyline points="6 9 12 15 18 9"/></svg>}
                    />
                    <div style={{overflow:"hidden",maxHeight:itemsOpen?200:0,transition:`max-height ${DUR}ms cubic-bezier(0.4,0,0.2,1)`}}>
                      {ITEMS_SUB.map(sub => {
                        const sa = activeNav===sub.id;
                        return (
                          <SubLink key={sub.id} id={sub.id} label={sub.label} icon={sub.id} active={sa} onClick={()=>go(sub.id)} />
                        );
                      })}
                    </div>
                  </div>
                );

                // -- Ingredients collapsible -------------------------------
                if(item.id==="inventory") return (
                  <div key="inventory">
                    <NavItem
                      icon={<Icon name="inventory" size={16} color={isActive?C.primary:C.textMuted}/>}
                      label="Ingredients" isActive={isActive}
                      badge={lowStockCount>0&&<CountBadge count={lowStockCount} color={C.error}/>}
                      onClick={() => { setInvOpen(p=>!p); if(!invActive) go("inventory:list"); }}
                      right={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2.5" strokeLinecap="round" style={{transition:`transform ${DUR}ms ease`,transform:invOpen?"rotate(180deg)":"rotate(0deg)"}}><polyline points="6 9 12 15 18 9"/></svg>}
                    />
                    <div style={{overflow:"hidden",maxHeight:invOpen?200:0,transition:`max-height ${DUR}ms cubic-bezier(0.4,0,0.2,1)`}}>
                      {INGREDIENTS_SUB.map(sub => {
                        const sa = activeNav===sub.id;
                        return (
                          <SubLink key={sub.id} id={sub.id} label={sub.label} icon={sub.icon} active={sa} onClick={()=>go(sub.id)} />
                        );
                      })}
                    </div>
                  </div>
                );

                // -- Regular nav item --------------------------------------
                return (
                  <NavItem key={item.id}
                    icon={<Icon name={item.id} size={16} color={isActive?C.primary:C.textMuted}/>}
                    label={item.label} isActive={isActive}
                    onClick={()=>go(item.id)}
                    badge={alertBadge>0&&<CountBadge count={alertBadge} color={C.error}/>}
                  />
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Logout */}
      <button onClick={onLogout} style={{
        padding:"14px 20px",borderTop:`1px solid ${C.border}`,color:C.textSec,
        fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:12,
        fontFamily:T.font,transition:"all 0.2s ease",background:"transparent",
        borderLeft:"none",borderRight:"none",borderBottom:"none",fontWeight:500,width:"100%",flexShrink:0,
      }}
        onMouseEnter={e=>{e.currentTarget.style.color=C.error;e.currentTarget.style.background="rgba(239,68,68,0.05)";}}
        onMouseLeave={e=>{e.currentTarget.style.color=C.textSec;e.currentTarget.style.background="transparent";}}
      >
        <Icon name="logout" size={16} color="currentColor"/>
        <span>Sign Out</span>
      </button>
    </>
  );
});

// --- SIDEBAR ------------------------------------------------------------------
export const Sidebar = React.memo(function Sidebar({ activeNav, setActiveNav, user, onLogout, expiryAlertCount=0, lowStockCount=0, allowedNav=[], mobileOpen=false, onMobileClose }) {
  const { mobile, tablet } = useBreakpoint();
  const isOverlay = mobile || tablet;

  if (!user || user.role === "kitchen") return null;

  if (isOverlay) {
    return (
      <>
        {/* Backdrop */}
        <div onClick={onMobileClose} aria-hidden="true" style={{
          position:"fixed",inset:0,background:"rgba(0,0,0,0.48)",
          zIndex:199,backdropFilter:"blur(2px)",
          opacity:mobileOpen?1:0,pointerEvents:mobileOpen?"auto":"none",
          transition:`opacity ${DUR}ms ease`,
        }}/>

        {/* Slide-in drawer */}
        <aside style={{
          position:"fixed",top:0,left:0,bottom:0,width:SIDEBAR_W,
          background:C.bg,display:"flex",flexDirection:"column",
          zIndex:200,borderRight:`1px solid ${C.border}`,
          boxShadow:mobileOpen?"6px 0 32px rgba(0,0,0,0.18)":"none",
          transform:mobileOpen?"translateX(0)":`translateX(-${SIDEBAR_W+12}px)`,
          transition:`transform ${DUR}ms cubic-bezier(0.4,0,0.2,1)`,
          willChange:"transform",
        }} aria-label="Navigation sidebar">
          {/* X close */}
          <button onClick={onMobileClose} aria-label="Close menu" style={{
            position:"absolute",top:14,right:12,zIndex:1,
            width:30,height:30,borderRadius:8,border:`1px solid ${C.border}`,
            background:C.surface,color:C.textMuted,cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",
          }}>
            <Icon name="close" size={14} color="currentColor"/>
          </button>

          <SidebarContent
            activeNav={activeNav} setActiveNav={setActiveNav}
            user={user} onLogout={onLogout}
            expiryAlertCount={expiryAlertCount} lowStockCount={lowStockCount}
            allowedNav={allowedNav} onNavClick={onMobileClose}
          />
        </aside>
      </>
    );
  }

  // Desktop: static
  return (
    <aside style={{
      width:SIDEBAR_W,minWidth:SIDEBAR_W,background:C.bg,
      display:"flex",flexDirection:"column",height:"100vh",
      position:"sticky",top:0,zIndex:10,
      borderRight:`1px solid ${C.border}`,boxShadow:"1px 0 0 rgba(0,0,0,0.05)",
    }}>
      <SidebarContent
        activeNav={activeNav} setActiveNav={setActiveNav}
        user={user} onLogout={onLogout}
        expiryAlertCount={expiryAlertCount} lowStockCount={lowStockCount}
        allowedNav={allowedNav}
      />
    </aside>
  );
});

// --- TOPBAR -------------------------------------------------------------------
// Mobile sidebar overlay
export function SidebarOverlay({ show, onClose }) {
  if (!show) return null;
  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.5)",
      zIndex:199, display:"block",
    }} />
  );
}

export const Topbar = React.memo(function Topbar({ user, activeNav, setActiveNav, onLogout, holdList=[], setHoldList, showHoldModal, setShowHoldModal, openInvoices=[], onMenuToggle, mobileMenuOpen, setMobileMenuOpen }) {
  const { mobile, tablet } = useBreakpoint();
  const showHamburger = mobile || tablet;

  const pendingHolds = holdList.filter(h=>h.status==="pending");
  const myHolds = pendingHolds.filter(h=>h.waiter===user?.name);
  const openInvCount = openInvoices.filter(i=>i.status==="open").length;
  const roleMeta = ROLE_STYLE[user?.role] || ROLE_STYLE.cashier;
  const pageTitle = PAGE_TITLES[activeNav] || PAGE_TITLES[activeNav?.split(":")[0]] || activeNav;

  if (!user || user.role==="kitchen") return null;

  return (
    <>
      <header style={{
        background:C.bg,
        height: mobile ? 52 : 56,
        padding: mobile ? "0 12px" : "0 24px",
        flexShrink:0,display:"flex",alignItems:"center",
        justifyContent:"space-between",
        borderBottom:`1px solid ${C.border}`,
        boxShadow:"0 1px 0 rgba(0,0,0,0.02)",gap:10,
      }}>
        {/* Left */}
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:1}}>
          {showHamburger && (
            <button onClick={onMenuToggle} aria-label="Open navigation menu" style={{
              width:36,height:36,borderRadius:9,flexShrink:0,
              border:`1.5px solid ${C.border}`,background:C.surface,
              color:C.text,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
              transition:"all 0.18s ease",
            }}
              onMouseEnter={e=>{e.currentTarget.style.background=C.primaryBg;e.currentTarget.style.borderColor=C.primary;e.currentTarget.style.color=C.primary;}}
              onMouseLeave={e=>{e.currentTarget.style.background=C.surface;e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.text;}}
            >
              <Icon name="menu" size={18} color="currentColor"/>
            </button>
          )}
          <h1 style={{ fontSize:mobile?15:18, fontWeight:700, color:C.text, fontFamily:T.font, margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {pageTitle}
          </h1>
        </div>

        {/* Right */}
        <div style={{display:"flex",alignItems:"center",gap:mobile?6:10,flexShrink:0}}>

          {!mobile && activeNav==="pos" && user?.role==="cashier" && openInvCount>0 && (
            <Chip label="Open Invoices" count={openInvCount} color={C.secondary} icon="invoice"/>
          )}
          {activeNav==="pos" && (user?.role==="admin"||user?.role==="manager") && (
            <Chip label={mobile?"":"Hold List"} count={pendingHolds.length} color={C.warning} icon="hold" onClick={()=>setShowHoldModal?.(true)}/>
          )}

          {/* User chip */}
          <div style={{
            display:"flex",alignItems:"center",gap:mobile?6:10,
            padding:mobile?"4px 8px 4px 6px":"4px 12px 4px 8px",
            background:roleMeta.bg,borderRadius:10,border:`1px solid ${roleMeta.color}20`,
          }}>
            <div style={{ width:mobile?28:32,height:mobile?28:32,borderRadius:8,flexShrink:0,
              background:`linear-gradient(135deg,${roleMeta.color}40,${roleMeta.color}20)`,
              display:"flex",alignItems:"center",justifyContent:"center" }}>
              <Icon name="user" size={mobile?12:14} color={roleMeta.color}/>
            </div>
            {!mobile && (
              <div>
                <div style={{fontSize:12,fontWeight:600,color:C.text,lineHeight:1.3,fontFamily:T.font}}>{user?.name?.split(" ")[0]}</div>
                <div style={{fontSize:9,color:roleMeta.color,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8}}>{user?.role}</div>
              </div>
            )}
          </div>

          {/* Logout */}
          <button onClick={onLogout} aria-label="Sign out" style={{
            width:mobile?32:36,height:mobile?32:36,borderRadius:8,
            border:`1px solid ${C.border}`,background:C.bg,color:C.textMuted,
            cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
            transition:"all 0.2s ease",flexShrink:0,
          }}
            onMouseEnter={e=>{e.currentTarget.style.color=C.error;e.currentTarget.style.borderColor=C.error;e.currentTarget.style.background=`${C.error}10`;}}
            onMouseLeave={e=>{e.currentTarget.style.color=C.textMuted;e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.bg;}}
          >
            <Icon name="logout" size={15} color="currentColor"/>
          </button>
        </div>
      </header>

      {showHoldModal && activeNav==="pos" && (
        <HoldListModal holdList={holdList} setHoldList={setHoldList} onClose={()=>setShowHoldModal(false)}/>
      )}
    </>
  );
});

// --- Chip helper --------------------------------------------------------------
const Chip = React.memo(({ label, count, color, icon, onClick }) => (
  <button onClick={onClick} style={{
    display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:8,
    background:`${color}10`,border:`1px solid ${color}30`,color,fontSize:11,
    fontWeight:600,fontFamily:T.font,cursor:"pointer",whiteSpace:"nowrap",transition:"all 0.2s ease",
  }}>
    {icon && <Icon name={icon} size={13} color={color}/>}
    {label && <span>{label}</span>}
    {count>0 && <CountBadge count={count} color={color}/>}
  </button>
));

// --- HoldList Modal -----------------------------------------------------------
const HoldListModal = React.memo(({ holdList, setHoldList, onClose }) => {
  const { mobile } = useBreakpoint();
  return (
    <div onClick={onClose} style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,
      animation:"fadeIn 0.2s ease",padding:mobile?12:0,
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:C.bg,borderRadius:16,
        width:mobile?"100%":900,maxWidth:"100%",maxHeight:mobile?"90vh":"85vh",
        display:"flex",flexDirection:"column",
        boxShadow:"0 24px 48px rgba(0,0,0,0.3)",overflow:"hidden",
      }}>
        <div style={{ padding:mobile?"16px":"20px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${C.border}`,background:C.surface }}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <Icon name="hold" size={20} color={C.warning}/>
            <h2 style={{fontSize:16,fontWeight:700,color:C.text,margin:0,fontFamily:T.font}}>Hold Orders</h2>
            {holdList.length>0 && <span style={{background:C.primaryBg,color:C.primary,fontSize:11,fontWeight:700,borderRadius:6,padding:"2px 10px",fontFamily:T.font}}>{holdList.length} order{holdList.length!==1?"s":""}</span>}
          </div>
          <button onClick={onClose} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:C.bg,color:C.textMuted,cursor:"pointer",fontSize:18,fontWeight:700}}>-</button>
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontFamily:T.font}}>
            <thead>
              <tr style={{background:C.surface,borderBottom:`1px solid ${C.border}`,position:"sticky",top:0}}>
                {(mobile?["Table","Items","Total",""] : ["Table","Waiter","Items","Total","Time","Status",""]).map(h=>(
                  <th key={h} style={{padding:mobile?"10px 12px":"12px 16px",textAlign:"left",fontWeight:700,color:C.textMuted,fontSize:11,textTransform:"uppercase",letterSpacing:1}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {holdList.length===0 ? (
                <tr><td colSpan="7" style={{padding:"60px 0",textAlign:"center"}}>
                  <Icon name="hold" size={32} color={C.textMuted}/>
                  <div style={{fontWeight:600,color:C.textSec,marginTop:12,fontSize:14}}>No orders on hold</div>
                  <div style={{fontSize:12,color:C.textMuted,marginTop:4}}>Orders from waiters will appear here</div>
                </td></tr>
              ) : holdList.map((hold,i) => {
                const sc = {pending:C.warning,billed:C.secondary,bumped:C.success}[hold.status]||C.textMuted;
                return (
                  <tr key={hold.id} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?C.bg:C.hover}}>
                    <td style={{padding:mobile?"10px 12px":"12px 16px",fontWeight:700,color:C.primary}}>{hold.table}</td>
                    {!mobile && <td style={{padding:"12px 16px",color:C.textSec}}>{hold.createdBy}</td>}
                    <td style={{padding:mobile?"10px 12px":"12px 16px",color:C.textMuted,maxWidth:mobile?110:250,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{hold.items?.map(i=>`${i.qty}- ${i.name}`).join(", ")}</td>
                    <td style={{padding:mobile?"10px 12px":"12px 16px",fontWeight:700,color:C.text}}>KES {hold.total?.toLocaleString()}</td>
                    {!mobile && <td style={{padding:"12px 16px",color:C.textMuted,fontSize:12}}>{hold.createdDate}</td>}
                    {!mobile && <td style={{padding:"12px 16px"}}><span style={{background:`${sc}20`,color:sc,fontSize:10,fontWeight:700,borderRadius:4,padding:"3px 10px",textTransform:"uppercase"}}>{hold.status}</span></td>}
                    <td style={{padding:mobile?"10px 12px":"12px 16px"}}>
                      <button onClick={()=>setHoldList?.(prev=>prev.filter(h=>h.id!==hold.id))} style={{padding:"4px 10px",background:`${C.error}15`,color:C.error,border:`1px solid ${C.error}30`,borderRadius:6,cursor:"pointer",fontSize:11,fontFamily:T.font,fontWeight:600}}>Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{padding:"16px 24px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"flex-end",background:C.surface}}>
          <button onClick={onClose} style={{padding:"8px 20px",background:C.primary,color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:13,fontFamily:T.font}}>Close</button>
        </div>
      </div>
    </div>
  );
});

// --- Global styles ------------------------------------------------------------
const _s = document.createElement("style");
_s.textContent = `
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  nav::-webkit-scrollbar{width:4px}
  nav::-webkit-scrollbar-track{background:#f1f1f1;border-radius:4px}
  nav::-webkit-scrollbar-thumb{background:#c1c1c1;border-radius:4px}
  nav::-webkit-scrollbar-thumb:hover{background:#a8a8a8}
  button,[role=button]{cursor:pointer}
`;
document.head.appendChild(_s);
