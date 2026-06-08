import { itemsApi } from "./api/index.js";
import { useState, useEffect } from "react";
import { useApp }    from "./context/AppContext.jsx";
import { ALL_NAV }   from "./data/constants.js";

import LoginScreen   from "./components/LoginScreen.jsx";
import { Sidebar, Topbar, SidebarOverlay } from "./components/Layout.jsx";

import DashboardView      from "./modules/DashboardView.jsx";
import ProductionScreen   from "./modules/ProductionScreen.jsx";
import CashierDashboard from "./modules/CashierDashboard.jsx";
import POSView        from "./modules/POSView.jsx";
import WaiterPOS      from "./modules/WaiterPOS.jsx";
import CashierPOS     from "./modules/CashierPOS.jsx";
import ManagerPOS     from "./modules/ManagerPOS.jsx";
import KitchenDisplay from "./modules/KitchenDisplay.jsx";
import { InventoryView, InventoryReadOnlyView, ReceiveStockView, IssueStockView } from "./modules/StockModules.jsx";
import { ExpiryView, VarianceView, WastageView } from "./modules/AlertModules.jsx";
import { ReportsView, PlaceholderView } from "./modules/ReportModules.jsx";
import { ShiftView }  from "./modules/ShiftModules.jsx";
import ItemsView      from "./modules/ItemsView.jsx";
import SettingsView   from "./modules/SettingsView.jsx";

export default function RoyalPalmApp() {
  const {
    user, login, logout,
    users, setUsers,
    overhead,
    menuItems, setMenuItems,
    ingredients, setIngredients,
    batches, setBatches,
    recipes, setRecipes,
    sales, setSales,
    storeIssues, setStoreIssues,
    wastage, setWastage,
    shifts, setShifts,
    activeShift, setActiveShift,
    holdList, setHoldList,
    openInvoices, setOpenInvoices,
    showHoldModal, setShowHoldModal,
    hhApplied, setHhApplied,
    hhDiscount, setHhDiscount,
    sidebarOpen, setSidebarOpen,
    expiryAlerts, lowStockCount,
    allowedNav,
  } = useApp();

  const [activeNav, setActiveNav] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Listen for navigate events from child components
  useEffect(() => {
    const handler = (e) => setActiveNav(e.detail);
    window.addEventListener("navigate", handler);
    return () => window.removeEventListener("navigate", handler);
  }, []);

  // Listen for shift opened directly from CashierPOS
  useEffect(() => {
    const handler = (e) => setActiveShift(e.detail);
    const reloadHandler = async () => {
      try {
        const { shiftsApi } = await import("./api/index.js");
        const existing = await shiftsApi.active();
        if (existing) setActiveShift({ ...existing, _dbId: existing.id });
      } catch(_) {}
    };
    window.addEventListener("shift:opened", handler);
    window.addEventListener("shift:reload", reloadHandler);
    return () => {
      window.removeEventListener("shift:opened", handler);
      window.removeEventListener("shift:reload", reloadHandler);
    };
  }, []);

  // Force logout when access token expires and refresh fails
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, [logout]);

  // Reset nav to dashboard-equivalent on login
  useEffect(() => {
    if (!user) return;
    const perms = user.permissions || [];
    if (perms.includes("dashboard"))          setActiveNav("dashboard");
    else if (perms.includes("kds"))           setActiveNav("kds");
    else if (perms.includes("pos"))           setActiveNav("pos");
    else if (perms.includes("inventory_readonly")) setActiveNav("inventory_readonly");
    else                                      setActiveNav(perms[0] || "pos");
  }, [user?.id]);

  if (!user) {
    return <LoginScreen onLogin={login} />;
  }

  // Kitchen: full-screen KDS only
  if (user.role === "kitchen") {
    return (
      <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#0A0E1A" }}>
        <KitchenDisplay holdList={holdList} setHoldList={setHoldList} user={user} onLogout={logout} />
      </div>
    );
  }

  const renderView = () => {
    switch (activeNav) {
      case "dashboard":
        if (user.role === "cashier")
          return <CashierDashboard
            sales={sales} activeShift={activeShift}
            openInvoices={openInvoices} setActiveNav={setActiveNav} user={user} overhead={overhead} />;
        return <DashboardView
          sales={sales} batches={batches} storeIssues={storeIssues}
          wastage={wastage} setActiveNav={setActiveNav}
          ingredients={ingredients} menuItems={menuItems}
          holdList={holdList}
          overhead={overhead}
          user={user}
        />;

      case "pos":
        if (user.role === "waiter")
          return <WaiterPOS user={user} menuItems={menuItems} holdList={holdList}
            setHoldList={setHoldList} openInvoices={openInvoices} setOpenInvoices={setOpenInvoices} />;
        if (user.role === "cashier")
          return <CashierPOS user={user} sales={sales} setSales={setSales}
            batches={batches} setBatches={setBatches} openInvoices={openInvoices}
            setOpenInvoices={setOpenInvoices} recipes={recipes} ingredients={ingredients}
            holdList={holdList} setHoldList={setHoldList} activeShift={activeShift} />;
        if (user.role === "manager")
          return <WaiterPOS user={user} menuItems={menuItems} holdList={holdList}
            setHoldList={setHoldList} openInvoices={openInvoices} setOpenInvoices={setOpenInvoices} />;
        if (user.role === "admin")
          return <ManagerPOS user={user} menuItems={menuItems} holdList={holdList}
            setHoldList={setHoldList} openInvoices={openInvoices} setOpenInvoices={setOpenInvoices}
            sales={sales} setSales={setSales} batches={batches} setBatches={setBatches}
            recipes={recipes} ingredients={ingredients}
            hhApplied={hhApplied} setHhApplied={setHhApplied}
            hhDiscount={hhDiscount} setHhDiscount={setHhDiscount} />;
        return <POSView sales={sales} setSales={setSales} batches={batches}
          setBatches={setBatches} user={user} holdList={holdList} setHoldList={setHoldList}
          menuItems={menuItems} recipes={recipes} ingredients={ingredients}
          openInvoices={openInvoices} setOpenInvoices={setOpenInvoices}
          hhApplied={hhApplied} setHhApplied={setHhApplied}
          hhDiscount={hhDiscount} setHhDiscount={setHhDiscount} />;

      case "shift":
        return <ShiftView sales={sales} user={user} shifts={shifts} setShifts={setShifts}
          activeShift={activeShift} setActiveShift={setActiveShift} menuItems={menuItems} />;

      case "kds":
        return <KitchenDisplay holdList={holdList} setHoldList={setHoldList} user={user} onLogout={logout} />;
      case "production":
        return <ProductionScreen onBack={() => setActiveNav("dashboard")} />;
      case "open_orders":
        return (
          <div style={{ flex:1, overflowY:"auto", padding:24, background:"#F8FAFC" }}>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:20, fontWeight:700, color:"#111827" }}>Open Orders</div>
              <div style={{ fontSize:12, color:"#6B7280", marginTop:2 }}>All pending waiter orders not yet sent to cashier</div>
            </div>
            {holdList.filter(h=>h.status==="pending").length === 0 ? (
              <div style={{ textAlign:"center", padding:"80px 0", color:"#9CA3AF" }}>
                <div style={{ fontSize:48, marginBottom:12 }}>📋</div>
                <div style={{ fontSize:15, fontWeight:600 }}>No open orders</div>
                <div style={{ fontSize:12, marginTop:4 }}>All waiter orders have been processed</div>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16 }}>
                {holdList.filter(h=>h.status==="pending").map(h=>{
                  const items = Array.isArray(h.items)?h.items:(()=>{try{return JSON.parse(h.items||"[]")}catch{return []}})();
                  const total = items.reduce((s,i)=>s+(i.price||0)*i.qty,0);
                  const createdAt = h.created_at ? new Date(h.created_at) : null;
                  const ageMin = createdAt ? Math.floor((Date.now()-createdAt.getTime())/60000) : null;
                  const isLate = ageMin !== null && ageMin >= 30;
                  const isWarn = ageMin !== null && ageMin >= 15 && ageMin < 30;
                  const borderColor = isLate ? "#DC2626" : isWarn ? "#D97706" : "#16a34a";
                  const bgColor = isLate ? "#FEF2F2" : isWarn ? "#FFFBEB" : "#F0FDF4";
                  return (
                    <div key={h.id} style={{ background:"#fff", border:`2px solid ${borderColor}`, borderRadius:10, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
                      <div style={{ background:bgColor, padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <div>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ padding:"3px 12px", borderRadius:20, fontSize:13, fontWeight:800, background:borderColor, color:"#fff" }}>
                              {h.table || h.table_no || "Walk-in"}
                            </span>
                            {isLate && <span style={{ fontSize:11, fontWeight:700, color:"#DC2626" }}>⚠ {ageMin}m — May have left!</span>}
                            {isWarn && !isLate && <span style={{ fontSize:11, fontWeight:700, color:"#D97706" }}>⏱ {ageMin}m — Getting late</span>}
                            {!isLate && !isWarn && ageMin !== null && <span style={{ fontSize:11, color:"#16a34a" }}>{ageMin}m ago</span>}
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3 }}>
                            <span style={{ fontSize:12, fontWeight:700, color:"#1E3A5F", background:"#DBEAFE", padding:"2px 8px", borderRadius:20 }}>👤 {h.waiter || h.waiter_name || "Unknown Waiter"}</span>
                            <span style={{ fontSize:11, color:"#6B7280" }}>{h.createdDate || (createdAt ? createdAt.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : "—")}</span>
                          </div>
                        </div>
                        <div style={{ fontSize:15, fontWeight:700, color:"#111827" }}>KES {total.toLocaleString()}</div>
                      </div>
                      <div style={{ padding:"10px 14px" }}>
                        {items.slice(0,4).map((item,i)=>(
                          <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"3px 0", borderBottom: i<Math.min(items.length,4)-1?"1px solid #F3F4F6":"none" }}>
                            <span style={{ color:"#374151" }}>{item.qty}× {item.name}</span>
                            <span style={{ fontWeight:600 }}>KES {((item.price||0)*item.qty).toLocaleString()}</span>
                          </div>
                        ))}
                        {items.length > 4 && <div style={{ fontSize:11, color:"#9CA3AF", marginTop:4 }}>+{items.length-4} more items</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      case "open_invoices":
        return <CashierPOS user={user} sales={sales} setSales={setSales}
          batches={batches} setBatches={setBatches} openInvoices={openInvoices}
          setOpenInvoices={setOpenInvoices} recipes={recipes} ingredients={ingredients}
          holdList={holdList} setHoldList={setHoldList} activeShift={activeShift} />;

      case "inventory":
      case "inventory:list":
      case "inventory:receive":
        return <InventoryView
          subView={activeNav.startsWith("inventory:") ? activeNav.split(":")[1] : "list"}
          batches={batches} setBatches={setBatches}
          ingredients={ingredients} setIngredients={setIngredients}
          storeIssues={storeIssues} setStoreIssues={setStoreIssues}
          user={user}
        />;

      case "receive":
        return <InventoryView
          subView="receive"
          batches={batches} setBatches={setBatches}
          ingredients={ingredients} setIngredients={setIngredients}
          storeIssues={storeIssues} setStoreIssues={setStoreIssues}
          user={user}
        />;

      case "inventory_readonly":
        return <InventoryReadOnlyView batches={batches} ingredients={ingredients} />;

      case "expiry":
        return <ExpiryView batches={batches} setBatches={setBatches}
          wastage={wastage} setWastage={setWastage}
          user={user} ingredients={ingredients} />;

      case "variance":
        return <VarianceView batches={batches} storeIssues={storeIssues}
          sales={sales} ingredients={ingredients} recipes={recipes} />;

      case "wastage":
        return <WastageView wastage={wastage} setWastage={setWastage}
          batches={batches} user={user} ingredients={ingredients} />;

      case "reports":
        return <ReportsView sales={sales} batches={batches}
          wastage={wastage} menuItems={menuItems} />;

      case "items:new":
      case "items:list":
      case "items:stock":
      case "items":
        return <ItemsView
          subView={activeNav.includes(":") ? activeNav.split(":")[1] : "new"}
          batches={batches} setBatches={setBatches} user={user}
          menuItems={menuItems} setMenuItems={setMenuItems}
          ingredients={ingredients} setIngredients={setIngredients}
          recipes={recipes} setRecipes={setRecipes}
          onNavigate={setActiveNav}
        />;

      case "settings":
        return <SettingsView user={user} users={users} setUsers={setUsers}
          ingredients={ingredients} />;

      default:
        return <PlaceholderView label={ALL_NAV.find(n => n.id === activeNav)?.label || activeNav} />;
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#0A0E1A" }}>
      <SidebarOverlay show={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <Sidebar
        activeNav={activeNav}
        setActiveNav={e => { setActiveNav(e); setMobileMenuOpen(false); }}
        user={user}
        allowedNav={allowedNav}
        mobileOpen={mobileMenuOpen}
        onLogout={logout}
        expiryAlertCount={expiryAlerts}
        lowStockCount={lowStockCount}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <Topbar
          user={user}
          alerts={expiryAlerts}
          activeNav={activeNav}
          setActiveNav={setActiveNav}
          onLogout={logout}
          holdList={holdList}
          setHoldList={setHoldList}
          showHoldModal={showHoldModal}
          setShowHoldModal={setShowHoldModal}
          openInvoices={openInvoices}
          onMenuToggle={() => setSidebarOpen(prev => !prev)}
        />
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {renderView()}
        </div>
      </div>
    </div>
  );
}
