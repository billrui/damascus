/**
 * stockService.js
 *
 * Handles all inventory operations:
 *  - FEFO (First Expired, First Out) stock deduction inside a DB transaction
 *  - Low-stock detection after each deduction
 *  - Batch receiving
 *  - Store issue recording
 *  - Wastage recording
 *
 * All write operations must be called with a pg transaction client so they
 * can be rolled back atomically if the parent operation (e.g. sale) fails.
 */

import { db } from '../config/db.js';

// ─── FEFO stock deduction ─────────────────────────────────────────────────────
/**
 * Deducts stock from batches using FEFO ordering.
 * Must be called inside a transaction (pass the pg client).
 *
 * @param {object} client   - pg transaction client
 * @param {Array}  items    - [{ menu_item_id, qty }] from the sale
 * @returns {Array}         - list of low-stock alerts { ingredient_id, name, remaining, reorder_level }
 */
export async function deductStockFEFO(client, items) {
  // 1. Fetch all recipes for the menu items in this sale in one query
  const menuIds = [...new Set(items.map(i => i.menu_item_id))];

  const { rows: recipeRows } = await client.query(
    `SELECT r.menu_item_id, r.ingredient_id, r.qty, i.name, i.reorder_level
     FROM recipes r
     JOIN ingredients i ON i.id = r.ingredient_id
     WHERE r.menu_item_id = ANY($1)`,
    [menuIds]
  );

  if (recipeRows.length === 0) return [];   // items with no recipe (beverages etc.)

  // Build map: menuItemId → [{ ingredient_id, qty_per_unit, name, reorder_level }]
  const recipeMap = {};
  for (const row of recipeRows) {
    if (!recipeMap[row.menu_item_id]) recipeMap[row.menu_item_id] = [];
    recipeMap[row.menu_item_id].push(row);
  }

  // Collect all unique ingredient IDs needed
  const ingredientIds = [...new Set(recipeRows.map(r => r.ingredient_id))];

  // 2. Lock and fetch all active batches for these ingredients (FEFO order)
  //    FOR UPDATE locks the rows so concurrent sales can't double-deduct
  const { rows: batchRows } = await client.query(
    `SELECT id, ingredient_id, remaining, status
     FROM batches
     WHERE ingredient_id = ANY($1)
       AND status = 'active'
       AND remaining > 0
     ORDER BY ingredient_id, expiry ASC NULLS LAST
     FOR UPDATE`,
    [ingredientIds]
  );

  // Build mutable map: ingredient_id → [batch, ...]  (already FEFO sorted)
  const batchMap = {};
  for (const b of batchRows) {
    if (!batchMap[b.ingredient_id]) batchMap[b.ingredient_id] = [];
    batchMap[b.ingredient_id].push({ ...b });
  }

  // 3. Walk through each sale item and deduct
  const updatedBatches = [];   // { id, new_remaining, new_status }

  for (const saleItem of items) {
    const recipe = recipeMap[saleItem.menu_item_id];
    if (!recipe) continue;

    for (const { ingredient_id, qty: qtyPerUnit } of recipe) {
      let toDeduct = qtyPerUnit * saleItem.qty;
      const batches = batchMap[ingredient_id] || [];

      for (const batch of batches) {
        if (toDeduct <= 0) break;

        const take         = Math.min(toDeduct, batch.remaining);
        batch.remaining   -= take;
        toDeduct          -= take;

        updatedBatches.push({
          id:          batch.id,
          remaining:   batch.remaining,
          status:      batch.remaining <= 0 ? 'depleted' : 'active',
        });
      }
      // If toDeduct > 0 here: stockout — we allow the sale but log it
      // (hotel reality: you don't refuse a guest because the DB says 0g lettuce)
    }
  }

  // 4. Apply all batch updates in bulk
  if (updatedBatches.length > 0) {
    // Use unnest for efficient bulk update instead of N separate queries
    const ids       = updatedBatches.map(b => b.id);
    const remaining = updatedBatches.map(b => b.remaining);
    const statuses  = updatedBatches.map(b => b.status);

    await client.query(
      `UPDATE batches AS b
       SET remaining = v.remaining::numeric,
           status    = v.status,
           updated_at = now()
       FROM (
         SELECT unnest($1::text[])    AS id,
                unnest($2::numeric[]) AS remaining,
                unnest($3::text[])    AS status
       ) AS v
       WHERE b.id = v.id`,
      [ids, remaining, statuses]
    );
  }

  // 5. Check for low-stock after deduction
  const lowStockAlerts = await checkLowStock(client, ingredientIds);
  return lowStockAlerts;
}

// ─── Low-stock check ──────────────────────────────────────────────────────────
/**
 * Returns ingredients where total remaining stock ≤ reorder_level.
 */
export async function checkLowStock(client, ingredientIds = null) {
  const filter = ingredientIds
    ? 'AND i.id = ANY($1)'
    : '';

  const params = ingredientIds ? [ingredientIds] : [];

  const { rows } = await (client || db).query(
    `SELECT
       i.id          AS ingredient_id,
       i.name,
       i.unit,
       i.reorder_level,
       COALESCE(SUM(b.remaining), 0) AS total_remaining
     FROM ingredients i
     LEFT JOIN batches b
       ON b.ingredient_id = i.id AND b.status = 'active'
     WHERE i.active = true ${filter}
     GROUP BY i.id, i.name, i.unit, i.reorder_level
     HAVING COALESCE(SUM(b.remaining), 0) <= i.reorder_level`,
    params
  );

  return rows;
}

// ─── Generate sequential reference numbers ────────────────────────────────────
export async function nextInvoiceId(client) {
  const { rows } = await client.query(`SELECT nextval('invoice_seq') AS n`);
  return `INV-${String(rows[0].n).padStart(6, '0')}`;
}

export async function nextHoldRef(client) {
  const { rows } = await client.query(`SELECT nextval('hold_seq') AS n`);
  return `HOLD-${String(rows[0].n).padStart(5, '0')}`;
}

export async function nextShiftRef(client) {
  const { rows } = await client.query(`SELECT nextval('shift_seq') AS n`);
  return `SH-${String(rows[0].n).padStart(5, '0')}`;
}

export async function nextIssueRef(client) {
  const { rows } = await client.query(`SELECT nextval('issue_seq') AS n`);
  return `SI-${String(rows[0].n).padStart(6, '0')}`;
}

export async function nextWastageRef(client) {
  const { rows } = await client.query(`SELECT nextval('wastage_seq') AS n`);
  return `W-${String(rows[0].n).padStart(6, '0')}`;
}
