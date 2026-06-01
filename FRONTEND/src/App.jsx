import { useState, useEffect } from "react";
import { useApp }    from "./context/AppContext.jsx";
import { ALL_NAV }   from "./data/constants.js";

import LoginScreen   from "./components/LoginScreen.jsx";
import { Sidebar, Topbar } from "./components/Layout.jsx";

import DashboardView  from "./modules/DashboardView.jsx";
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
        <KitchenDisplay holdList={holdList} setHoldList={setHoldList} />
      </div>
    );
  }

  const renderView = () => {
    switch (activeNav) {
      case "dashboard":
        return <DashboardView
          sales={sales} batches={batches} storeIssues={storeIssues}
          wastage={wastage} setActiveNav={setActiveNav}
          ingredients={ingredients} menuItems={menuItems}
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
        if (user.role === "admin" || user.role === "manager")
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
        return <KitchenDisplay holdList={holdList} setHoldList={setHoldList} />;

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

      case "inventory_readonly":
        return <InventoryReadOnlyView batches={batches} />;

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
      <Sidebar
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        user={user}
        allowedNav={allowedNav}
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
