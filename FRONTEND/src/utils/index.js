// No mock data imports - INGREDIENTS and RECIPES come from the API via AppContext

export const fmt  = (n) => `KES ${Number(n).toLocaleString()}`;
export const fmtK = (n) => `KES ${(n / 1000).toFixed(0)}K`;

/**
 * Optimistic FEFO stock deduction - keeps local batch state consistent
 * between the API call and a potential sync delay.
 * The server does the authoritative deduction; this just keeps the UI snappy.
 *
 * items:   [{ menuId, qty }]
 * recipes: { menuId: [{ ingredientId, qty }] }  - from AppContext
 */
export function deductStock(items, setBatches, recipes) {
  if (!setBatches || !recipes) return;
  setBatches(prev => {
    let updated = [...prev];
    items.forEach(item => {
      const menuId = item.menuId ?? item.id;
      const recipe = recipes[menuId];
      if (!recipe) return;
      recipe.forEach(({ ingredientId, qty }) => {
        let remaining = qty * item.qty;
        updated
          .map((b, i) => ({ b, i }))
          .filter(({ b }) =>
            (b.ingredient_id || b.ingredientId) === ingredientId &&
            b.status === "active" &&
            b.remaining > 0
          )
          .sort((a, b) => new Date(a.b.expiry || "9999") - new Date(b.b.expiry || "9999"))
          .forEach(({ b, i }) => {
            if (remaining <= 0) return;
            const take = Math.min(remaining, b.remaining);
            updated[i] = { ...updated[i], remaining: updated[i].remaining - take };
            if (updated[i].remaining <= 0) updated[i] = { ...updated[i], status: "depleted" };
            remaining -= take;
          });
      });
    });
    return updated;
  });
}

export function hasPermission(user, permId) {
  if (!user) return false;
  return (user.permissions || []).includes(permId);
}

export function classifyExpiry(batch) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(batch.expiry);
  exp.setHours(0, 0, 0, 0);
  const days = Math.round((exp - now) / 86400000);

  if (days < 0)   return { status: "expired",  days, label: "Expired",       color: "#8B3A3A", bg: "#FEF2F2" };
  if (days === 0) return { status: "expiring", days, label: "Expires Today", color: "#DC2626", bg: "#FEF2F2" };
  if (days <= 3)  return { status: "critical", days, label: `${days}d left`, color: "#B8860B", bg: "#FFF7ED" };
  if (days <= 7)  return { status: "warning",  days, label: `${days}d left`, color: "#EAB308", bg: "#FEFCE8" };
  return               { status: "ok",         days, label: `${days}d left`, color: "#2E7D64", bg: "#ECFDF5" };
}

/**
 * computeVariance - now accepts ingredients as a parameter instead of
 * importing from the deleted mock data file.
 */
export function computeVariance(batches, storeIssues, salesHistory, ingredients, recipes) {
  const usage = {};
  for (const sale of (salesHistory || [])) {
    for (const { menuId, qty } of (sale.items || [])) {
      const recipe = (recipes || {})[menuId] || [];
      for (const { ingredientId, qty: perUnit } of recipe) {
        usage[ingredientId] = (usage[ingredientId] || 0) + perUnit * qty;
      }
    }
  }

  return (ingredients || []).map((ing) => {
    const id        = ing.id;
    const theoQty   = usage[id] || 0;
    const issuedQty = (storeIssues || [])
      .filter(si => (si.ingredient_id || si.ingredientId) === id)
      .reduce((s, si) => s + Number(si.qty), 0);
    const physQty   = (batches || [])
      .filter(b => (b.ingredient_id || b.ingredientId) === id && b.status === "active")
      .reduce((s, b) => s + Number(b.remaining), 0);
    const variance  = issuedQty - theoQty;
    const pct       = issuedQty > 0 ? (variance / issuedQty) * 100 : 0;
    return {
      ...ing,
      theoretical:    Math.round(theoQty * 10) / 10,
      issued:         issuedQty,
      physical:       physQty,
      variance:       Math.round(variance * 10) / 10,
      variancePct:    Math.round(pct * 10) / 10,
      shrinkageValue: Math.round(variance * (ing.cost_per_unit || ing.costPerUnit || 0)),
      flag: variance > 0
        ? (pct > 20 ? "critical" : "warning")
        : variance < -5 ? "under" : "ok",
    };
  }).filter(r => r.theoretical > 0 || r.issued > 0);
}
