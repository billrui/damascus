/**
 * src/context/AppContext.jsx
 *
 * Single source of truth for all data that previously lived as
 * useState(INIT_*) in App.jsx.
 *
 * On login:  fetches users, menuItems, ingredients, batches, sales,
 *            storeIssues, wastage, activeShift from the API.
 * On action: updates server first, then local state on success.
 */
import { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  authApi, usersApi, itemsApi, inventoryApi,
  posApi, shiftsApi, reportsApi, settingsApi,
} from "../api/index.js";
import { classifyExpiry } from "../utils/index.js";
import { ALL_NAV, ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, CAN_CREATE_ROLES } from "../data/constants.js";
import { connectSocket, disconnectSocket, useSocket } from "../hooks/useSocket.js";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }) {
  // -- Auth --------------------------------------------------------------------
  const [user,        setUser]        = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError,   setAuthError]   = useState(null);

  // -- App data ----------------------------------------------------------------
  const [users,       setUsers]       = useState([]);
  const [overhead,    setOverhead]    = useState({});
  // Track deleted user ids so bootstrap/re-fetch never restores them
  const removedUserIds = useState(() => new Set())[0];
  const removedInvIds  = useState(() => new Set())[0];
  const [menuItems,   setMenuItems]   = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [batches,     setBatches]     = useState([]);
  const [recipes,     setRecipes]     = useState({});   // { menuId: [{ingredient_id, qty}] }
  const [sales,       setSales]       = useState([]);
  const [storeIssues, setStoreIssues] = useState([]);
  const [wastage,     setWastage]     = useState([]);
  const [shifts,      setShifts]      = useState([]);
  const [activeShift, setActiveShift] = useState(null);

  // -- UI state -----------------------------------------------------------------
  const [holdList,       setHoldList]       = useState([]);
  const [openInvoices,   setOpenInvoices]   = useState([]);
  const [showHoldModal,  setShowHoldModal]  = useState(false);
  const [hhApplied,      setHhApplied]      = useState(false);
  const [hhDiscount,     setHhDiscount]     = useState(20);
  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [dataReady,      setDataReady]      = useState(false);

  // -- Load users list on mount for the login screen staff picker --------------
  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (token) {
      // Try to restore an existing session silently
      authApi.me()
        .then(async (me) => {
          connectSocket(token);
          setUser(me);
          await bootstrap(me);
        })
        .catch(() => {
          // Access token stale - try a silent refresh using the cookie
          authApi.refresh()
            .then(async ({ access_token, user: me }) => {
              localStorage.setItem("access_token", access_token);
              setUser(me);
              await bootstrap(me);
            })
            .catch(() => {
              // Both failed - clear everything and show login screen
              localStorage.removeItem("access_token");
              // Fetch users list for the login dropdown (public endpoint not needed
              // - just show empty dropdown, user list loads after first login)
            });
        });
    }
    // No token - show login screen immediately, no API calls
    // Users list is loaded during bootstrap() after a successful login
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const bootstrap = useCallback(async (loggedInUser) => {
    const perms = loggedInUser.permissions || [];
    const has = (p) => perms.includes(p);
    try {
      const [
        usersData,
        itemsData,
        ingredientsData,
        batchesData,
        todaySales,
        issuesData,
        wastageData,
        shiftsData,
        activeShiftData,
        holdsData,
        invoicesData,
      ] = await Promise.all([
        has('settings')           ? usersApi.list().catch(() => [])                                        : Promise.resolve([]),
        itemsApi.list().catch(() => []),
        has('inventory_readonly') ? inventoryApi.ingredients().catch(() => [])                             : Promise.resolve([]),
        has('inventory_readonly') ? inventoryApi.batches().catch(() => ({ batches: [] }))   : Promise.resolve({ batches: [] }),
        has('dashboard')          ? posApi.sales({ limit: 200 }).catch(() => ({ sales: [] }))              : Promise.resolve({ sales: [] }),
        has('inventory_readonly') ? inventoryApi.issues({ limit: 200 }).catch(() => ({ issues: [] }))     : Promise.resolve({ issues: [] }),
        has('wastage')            ? inventoryApi.wastage().catch(() => ({ records: [] }))                  : Promise.resolve({ records: [] }),
        has('shift')              ? shiftsApi.list({ limit: 50 }).catch(() => ({ shifts: [] }))            : Promise.resolve({ shifts: [] }),
        has('shift')              ? shiftsApi.active().catch(() => null)                                   : Promise.resolve(null),
        has("pos") || has("shift") ? posApi.holds().catch(() => []) : Promise.resolve([]),
        has("pos") || has("shift") ? posApi.invoices().catch(() => []) : Promise.resolve([]),
      ]);

      // Load overhead settings separately
      settingsApi.get().then(s => setOverhead(s)).catch(() => {});
      setUsers(usersData.filter(u => !removedUserIds.has(String(u.id))));
      setMenuItems(itemsData);
      setIngredients(ingredientsData);
      setBatches(batchesData.batches || []);
      setSales(todaySales.sales || []);
      setStoreIssues(issuesData.issues || []);
      setWastage(wastageData.records || []);
      setShifts(shiftsData.shifts || []);
      setActiveShift(activeShiftData);
      setHoldList(holdsData);
      setOpenInvoices(invoicesData);

      // Build recipes map from items data (each item has .recipe array)
      const recipeMap = {};
      for (const item of itemsData) {
        if (item.recipe?.length) {
          recipeMap[item.id] = item.recipe.map(r => ({
            ingredientId: r.ingredient_id,
            qty:          r.qty,
          }));
        }
      }
      setRecipes(recipeMap);

      setDataReady(true);
    } catch (err) {
      console.error("Bootstrap error:", err);
      setDataReady(true); // still render, just with empty data
    }
  }, []);

  // -- Live socket updates — invoices and holds --------------------------------
  useSocket({
    "invoice:created": (inv) => {
      setOpenInvoices(prev => {
        if (prev.find(i => String(i.id) === String(inv.id))) return prev;
        return [inv, ...prev];
      });
    },
    "invoice:updated": (inv) => {
      setOpenInvoices(prev => prev.map(i => String(i.id) === String(inv.id) ? {...i,...inv} : i));
    },
    "hold:created": (hold) => {
      setHoldList(prev => {
        if (prev.find(h => String(h.id) === String(hold.id))) return prev;
        return [hold, ...prev];
      });
    },
    "hold:updated": (hold) => {
      setHoldList(prev => prev.map(h => String(h.id) === String(hold.id) ? {...h,...hold} : h));
    },
    "hold:deleted": ({ id }) => {
      setHoldList(prev => prev.filter(h => String(h.id) !== String(id)));
    },
  });

  // -- Poll invoices for cashier every 5s as socket fallback ------------------
  useEffect(() => {
    if (!user || user.role !== 'cashier') return;
    const poll = async () => {
      try {
        const fresh = await posApi.invoices();
        if (!Array.isArray(fresh)) return;
        setOpenInvoices(prev => {
          const filtered = fresh.filter(inv => !removedInvIds.has(String(inv.id)));
          const prevMap   = new Map(prev.map(i => [String(i.id), i]));
          return filtered.map(inv => prevMap.get(String(inv.id)) || inv);
        });
      } catch(e) {}
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [user?.id]);

  // -- Login --------------------------------------------------------------------
  const login = useCallback(async (userId, pin, deviceId) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { access_token, user: loggedInUser } = await authApi.login(userId, pin, deviceId);
      localStorage.setItem("access_token", access_token);
      connectSocket(access_token);
      setUser(loggedInUser);
      await bootstrap(loggedInUser);
      return loggedInUser;
    } catch (err) {
      const msg = err.response?.data?.message || "Invalid credentials";
      setAuthError(msg);
      throw err;
    } finally {
      setAuthLoading(false);
    }
  }, [bootstrap]);

  // -- Logout -------------------------------------------------------------------
  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch (_) {}
    disconnectSocket();
    localStorage.removeItem("access_token");
    setUser(null);
    setDataReady(false);
    // Clear all data
    setUsers([]); setMenuItems([]); setIngredients([]);
    setBatches([]); setSales([]); setStoreIssues([]);
    setWastage([]); setShifts([]); setActiveShift(null);
    setHoldList([]); setOpenInvoices([]);
  }, []);

  // -- Derived counts (replaces inline filter in App.jsx) -----------------------
  const expiryAlerts = batches.filter(b => {
    const e = classifyExpiry(b);
    return ["expired", "expiring", "critical"].includes(e.status);
  }).length;

  const lowStockCount = ingredients.filter(ing => {
    const total = batches
      .filter(b => b.ingredient_id === ing.id && b.status === "active")
      .reduce((s, b) => s + Number(b.remaining), 0);
    return total <= Number(ing.reorder_level);
  }).length;

  const allowedNav = ALL_NAV.filter(n => (user?.permissions || []).includes(n.id));

  const setUsersWrapped = useCallback((updater) => {
    setUsers(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setTimeout(() => {
        const prevIds = new Set(prev.map(u => String(u.id)));
        const nextIds = new Set(next.map(u => String(u.id)));
        prevIds.forEach(id => { if (!nextIds.has(id)) removedUserIds.add(id); });
      }, 0);
      return next;
    });
  }, []);

  const setOpenInvoicesWrapped = useCallback((updater) => {
    setOpenInvoices(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setTimeout(() => {
        const prevIds = new Set(prev.map(i => String(i.id)));
        const nextIds = new Set(next.map(i => String(i.id)));
        prevIds.forEach(id => { if (!nextIds.has(id)) removedInvIds.add(id); });
      }, 0);
      return next;
    });
  }, []);

  return (
    <AppContext.Provider value={{
      // Auth
      user, authLoading, authError, login, logout,

      // Data
      users,
      setUsers: setUsersWrapped,
      menuItems, setMenuItems,
      ingredients, setIngredients,
      batches, setBatches,
      recipes, setRecipes,
      sales, setSales,
      storeIssues, setStoreIssues,
      wastage, setWastage,
      shifts, setShifts,
      activeShift, setActiveShift,

      // UI
      holdList, setHoldList,
      openInvoices, setOpenInvoices: setOpenInvoicesWrapped,
      showHoldModal, setShowHoldModal,
      hhApplied, setHhApplied,
      hhDiscount, setHhDiscount,
      sidebarOpen, setSidebarOpen,
      dataReady,

      // Derived
      expiryAlerts,
      lowStockCount,
      allowedNav,

      // Constants (still needed by some modules)
      ALL_NAV,
      ALL_PERMISSIONS,
      DEFAULT_ROLE_PERMISSIONS,
      CAN_CREATE_ROLES,
    }}>
      {children}
    </AppContext.Provider>
  );
}
