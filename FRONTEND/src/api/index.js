/**
 * src/api/index.js
 *
 * All API calls in one place. Every function returns the data payload directly.
 * Components never import axios - they only call these functions.
 */
import api from "./client.js";

// -- Auth ---------------------------------------------------------------------

export const authApi = {
  login:   (user_id, pin, device_id) =>
    api.post("/auth/login",   { user_id, pin, device_id }).then(r => r.data),
  refresh: ()                        =>
    api.post("/auth/refresh", {}).then(r => r.data),
  logout:  ()                        =>
    api.post("/auth/logout",  {}).then(r => r.data),
  me:      ()                        =>
    api.get("/auth/me").then(r => r.data.user),
  authorize: (pin, action)           =>
    api.post("/auth/authorize", { pin, action }).then(r => r.data),
};

// -- Users ---------------------------------------------------------------------

export const usersApi = {
  list:   ()           => api.get("/users").then(r => r.data.users),
  updateRolePermissions: (role, permissions) => api.post(`/users/role-permissions`, { role, permissions }).then(r => r.data),
  get:    (id)         => api.get(`/users/${id}`).then(r => r.data.user),
  create: (data)       => api.post("/users", data).then(r => r.data.user),
  update: (id, data)   => api.patch(`/users/${id}`, data).then(r => r.data.user),
  remove: (id)         => api.delete(`/users/${id}`).then(r => r.data),
};

// -- Menu Items ----------------------------------------------------------------

export const settingsApi = {
  get:    ()      => api.get('/settings').then(r => r.data.settings),
  update: (data)  => api.patch('/settings', data).then(r => r.data.settings),
};

export const itemsApi = {
  list:       (params = {}) => api.get("/items",              { params }).then(r => r.data.items),
  categories: ()             => api.get("/items/categories").then(r => r.data.categories),
  get:        (id)           => api.get(`/items/${id}`).then(r => r.data.item),
  create:     (data)         => api.post("/items", data).then(r => r.data.item),
  update:     (id, data)     => api.patch(`/items/${id}`, data).then(r => r.data.item),
  remove:     (id)           => api.delete(`/items/${id}`).then(r => r.data),
  setRecipe:      (id, recipe)     => api.put(`/items/${id}/recipe`, { recipe }).then(r => r.data.recipe),
  produce:        (id, qty, notes) => api.post(`/items/${id}/produce`, { qty, notes }).then(r => r.data),
  stockAvailable: ()               => api.get('/items/stock/available').then(r => r.data.items),
  productionLog:  (id)             => api.get(`/items/${id}/production-log`).then(r => r.data.log),
};

// -- Inventory -----------------------------------------------------------------

export const inventoryApi = {
  // Ingredients
  ingredients:  (params = {}) => api.get("/inventory/ingredients", { params }).then(r => r.data.ingredients),
  addIngredient:   (data)         => api.post("/inventory/ingredients", data).then(r => r.data.ingredient),
  updateIngredient:(id, data)     => api.patch(`/inventory/ingredients/${id}`, data).then(r => r.data.ingredient),
  deleteIngredient:(id)           => api.delete(`/inventory/ingredients/${id}`).then(r => r.data),

  // Batches
  batches:      (params = {}) => api.get("/inventory/batches",    { params }).then(r => r.data),
  receiveBatch: (data)         => api.post("/inventory/batches",   data).then(r => r.data.batch),
  adjustBatch:  (id, data)     => api.patch(`/inventory/batches/${id}`, data).then(r => r.data.batch),

  // Expiry & low stock
  expiry:       (days = 7)    => api.get("/inventory/expiry",     { params: { days } }).then(r => r.data),
  lowStock:     ()             => api.get("/inventory/low-stock").then(r => r.data.alerts),

  // Issues
  issues:       (params = {}) => api.get("/inventory/issues",     { params }).then(r => r.data),
  recordIssue:  (data)         => api.post("/inventory/issues",    data).then(r => r.data.issue),

  // Wastage
  wastage:      (params = {}) => api.get("/inventory/wastage",    { params }).then(r => r.data),
  recordWastage:(data)         => api.post("/inventory/wastage",   data).then(r => r.data.record),

  // Variance
  variance:     (params = {}) => api.get("/inventory/variance",   { params }).then(r => r.data),

  // Suppliers
  suppliers:    ()             => api.get("/inventory/suppliers").then(r => r.data.suppliers),
};

// -- POS -----------------------------------------------------------------------

export const posApi = {
  // Sales
  createSale:  (data)        => api.post("/pos/sales",          data).then(r => r.data.sale),
  sales:       (params = {}) => api.get("/pos/sales",           { params }).then(r => r.data),
  getSale:     (id)          => api.get(`/pos/sales/${id}`).then(r => r.data.sale),
  voidSale:    (id, reason)  => api.post(`/pos/sales/${id}/void`, { reason }).then(r => r.data),

  // Receipts
  receiptUrl:  (id)          => `${api.defaults.baseURL}/pos/receipts/${id}`,
  escposUrl:   (id)          => `${api.defaults.baseURL}/pos/receipts/${id}/escpos`,
  // Fetch the receipt PDF through the authenticated client (carries the JWT),
  // then open it as a local blob — avoids the 401 you get from a raw window.open
  // to the backend, and never navigates the browser to the API port.
  openReceipt: async (id) => {
    const res = await api.get(`/pos/receipts/${id}`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  },

  // Hold orders
  holds:       (params = {}) => api.get("/pos/holds",           { params }).then(r => r.data.holds),
  createHold:  (data)        => api.post("/pos/holds",          data).then(r => r.data.hold),
  updateHold:  (id, data)    => api.patch(`/pos/holds/${id}`,   data).then(r => r.data.hold),
  appendHold:  (id, items)   => api.patch(`/pos/holds/${id}/items`, { items }).then(r => r.data.hold),
  printHold:   (id, person)  => api.post(`/pos/holds/${id}/print`, { person, token: localStorage.getItem('access_token') }).then(r => r.data),
  deleteHold:  (id)          => api.delete(`/pos/holds/${id}`).then(r => r.data),

  // Open invoices (waiter - cashier)
  invoices:      (params = {}) => api.get("/pos/invoices",       { params }).then(r => r.data.invoices),
  createInvoice: (data)        => api.post("/pos/invoices",      data).then(r => r.data.invoice),
};

// -- Shifts --------------------------------------------------------------------

export const shiftsApi = {
  list:        (params = {}) => api.get("/shifts",              { params }).then(r => r.data),
  active:      ()             => api.get("/shifts/active").then(r => r.data.shift),
  get:         (id)           => api.get(`/shifts/${id}`).then(r => r.data),
  open:        (data)         => api.post("/shifts/open",       data).then(r => r.data.shift),
  close:       (id, data)     => api.post(`/shifts/${id}/close`, data).then(r => r.data),
};

// -- Reports -------------------------------------------------------------------

export const reportsApi = {
  kpis:       (params = {}) => api.get("/reports/kpis",       { params }).then(r => r.data),
  hourly:     (date)         => api.get("/reports/hourly",     { params: { date } }).then(r => r.data),
  topItems:   (params = {}) => api.get("/reports/top-items",  { params }).then(r => r.data),
  payments:   (params = {}) => api.get("/reports/payments",   { params }).then(r => r.data),
  analytics:  (params = {}) => api.get("/reports/analytics",  { params }).then(r => r.data),
  auditLog:   (params = {}) => api.get("/reports/audit-log",  { params }).then(r => r.data),
};

// -- Offline sync --------------------------------------------------------------

export const productionApi = {
  // Groups
  getGroups:    ()           => api.get('/production/groups').then(r => r.data),
  createGroup:  (data)       => api.post('/production/groups', data).then(r => r.data),
  updateGroup:  (id, data)   => api.put(`/production/groups/${id}`, data).then(r => r.data),
  deleteGroup:  (id)         => api.delete(`/production/groups/${id}`).then(r => r.data),
  // Batches
  getBatches:   (params)     => api.get('/production/batches', { params }).then(r => r.data),
  createBatch:  (data)       => api.post('/production/batches', data).then(r => r.data),
  closeBatch:   (id, data)   => api.post(`/production/batches/${id}/close`, data).then(r => r.data),
  // Live tracker
  getLive:      ()           => api.get('/production/live').then(r => r.data),
  // Sale deduction
  saleDeduct:   (items)      => api.post('/production/sale-deduct', { items }).then(r => r.data),
};

export const syncApi = {
  flush:  (data) => api.post("/sync", data).then(r => r.data),
  status: (device_id) => api.get("/sync/status", { params: { device_id } }).then(r => r.data),
};
