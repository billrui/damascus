/**
 * src/data/constants.js
 *
 * Static configuration that belongs in the frontend:
 *  - permission definitions
 *  - role-permission defaults (used by UsersRoles form UI)
 *  - nav structure
 *  - tax/service charge rates
 *  - menu categories list
 *
 * NO seed records. No INIT_*, no hardcoded users/batches/sales/items.
 * All actual data comes from the API.
 */

// --- Date helper (used by POS and stock modules for relative dates) ------------
export const d = (offset = 0) => {
  const dt = new Date();
  dt.setDate(dt.getDate() + offset);
  return dt.toISOString().split("T")[0];
};

// --- Permissions catalogue ----------------------------------------------------
// One consistent format. These are the permissions the backend actually enforces.
export const ALL_PERMISSIONS = [
  { id: "dashboard",          label: "Dashboard",          group: "General",   description: "View summary KPIs and charts" },
  { id: "pos",                label: "POS Terminal",        group: "General",   description: "Process sales and take orders" },
  { id: "shift",              label: "Shift Management",    group: "General",   description: "Open/close shifts, Z-report, petty cash" },
  { id: "inventory",          label: "Ingredients",         group: "Inventory", description: "Manage ingredients, receive and issue stock" },
  { id: "inventory_readonly", label: "Stock Viewer",        group: "Inventory", description: "View current stock levels and batches" },
  { id: "expiry",             label: "Expiry Control",      group: "Inventory", description: "Monitor near-expiry and expired stock" },
  { id: "wastage",            label: "Wastage Log",         group: "Inventory", description: "Record wastage and spoilage" },
  { id: "variance",           label: "Variance Report",     group: "Reports",   description: "View daily stock/production variance" },
  { id: "reports",            label: "Reports & Analytics", group: "Reports",   description: "View the daily report and export" },
  { id: "items",              label: "Menu Items",          group: "Admin",     description: "Create and edit menu items" },
  { id: "settings",           label: "System Settings",     group: "Admin",     description: "Configure system-wide settings" },
  { id: "kds",                label: "Kitchen Display",     group: "Kitchen",   description: "Kitchen order display screen" },
];

// --- Default permissions per role ---------------------------------------------
// MUST stay identical to backend DEFAULT_PERMISSIONS (routes/users.js).
// Backend is the source of truth; this mirror is only for the create-user form.
export const DEFAULT_ROLE_PERMISSIONS = {
  admin:       ["dashboard","shift","inventory","inventory_readonly","items","settings","wastage","variance","reports","expiry"],
  manager:     ["dashboard","pos","shift","inventory","inventory_readonly","items","settings","wastage","variance","reports","expiry","kds"],
  cashier:     ["dashboard","pos","shift","inventory","inventory_readonly","expiry","wastage"],
  storekeeper: ["dashboard","inventory","inventory_readonly","expiry","wastage","items"],
  waiter:      ["pos"],
  kitchen:     ["kds"],
};

// --- Role creation hierarchy --------------------------------------------------
export const CAN_CREATE_ROLES = {
  admin:   ["manager","cashier","storekeeper","waiter","kitchen"],
  manager: ["cashier","waiter","kitchen"],
};

export const ROLE_PERMISSIONS = DEFAULT_ROLE_PERMISSIONS;

// --- Navigation ---------------------------------------------------------------
export const ALL_NAV = [
  { id: "dashboard",          label: "Dashboard",        emoji: "-",  roles: ["admin","manager","cashier","storekeeper"] },
  { id: "pos",                label: "New Sale",          emoji: "-",  roles: ["admin","manager","cashier","waiter"] },
  { id: "kds",                label: "Kitchen Display",   emoji: "-",  roles: ["admin","manager","kitchen"] },
  { id: "open_invoices",      label: "Open Invoices",    emoji: "-",  roles: ["admin","manager"] },
  { id: "open_orders",        label: "Open Orders",      emoji: "-",  roles: ["admin","manager"] },
  { id: "production",         label: "Production",       emoji: "-",  roles: ["admin","manager"] },
  { id: "shift",              label: "Shift & Cash",      emoji: "-",  roles: ["admin","manager","cashier"] },
  { id: "items",              label: "Menu Items",        emoji: "--",  roles: ["admin","manager"] },
  { id: "inventory",          label: "Ingredients",       emoji: "-",  roles: ["admin","manager","storekeeper","cashier"] },
  { id: "inventory:list",     label: "Ingredient List",   emoji: "-",  roles: ["admin","manager","storekeeper"] },
  { id: "inventory:receive",  label: "Receive / Issue",   emoji: "-",  roles: ["admin","manager","storekeeper"] },
  { id: "inventory_readonly", label: "Stock Viewer",      emoji: "-",  roles: ["admin","manager","cashier","storekeeper"] },
  { id: "expiry",             label: "Expiry Control",    emoji: "-",  roles: ["admin","manager","storekeeper"] },
  { id: "variance",           label: "Variance",          emoji: "-",  roles: ["admin","manager"] },
  { id: "wastage",            label: "Wastage Log",       emoji: "-",  roles: ["admin","manager","storekeeper"] },
  { id: "reports",            label: "Reports",           emoji: "-",  roles: ["admin","manager"] },
  { id: "settings",           label: "Settings",          emoji: "--",  roles: ["admin","manager"] },
];

// --- Tax & service charge rates -----------------------------------------------
export const TAX = 0.16;    // 16% VAT (Kenya)
export const SVC = 0.05;    // 5% service charge

// --- Menu categories (static display list - actual categories come from API) --
export const MENU_CATEGORIES = [
  { id: "all",        label: "All",       emoji: "-" },
  { id: "bestseller", label: "Popular",   emoji: "-" },
  { id: "beverages",  label: "Beverages", emoji: "-" },
  { id: "starters",   label: "Starters",  emoji: "-" },
  { id: "mains",      label: "Mains",     emoji: "-" },
  { id: "pasta",      label: "Pasta",     emoji: "-" },
  { id: "desserts",   label: "Desserts",  emoji: "-" },
];
