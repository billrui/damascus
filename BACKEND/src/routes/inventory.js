/**
 * routes/inventory.js
 *
 * GET    /api/inventory/batches          — all batches (filterable)
 * POST   /api/inventory/batches          — receive new stock
 * PATCH  /api/inventory/batches/:id      — manual adjustment
 * GET    /api/inventory/expiry           — batches expiring within N days
 * GET    /api/inventory/low-stock        — ingredients below reorder level
 *
 * POST   /api/inventory/issues           — issue stock to kitchen/bar
 * GET    /api/inventory/issues           — list all issues
 *
 * POST   /api/inventory/wastage          — record wastage
 * GET    /api/inventory/wastage          — list wastage records
 *
 * GET    /api/inventory/variance         — variance report
 * GET    /api/inventory/ingredients      — list ingredients
 * POST   /api/inventory/ingredients      — create ingredient
 */

import { Router } from 'express';
import { z }      from 'zod';
import { db }     from '../config/db.js';
import { verifyJWT, requirePermission } from '../middleware/auth.js';
import { validate, validateQuery, paginationSchema } from '../middleware/validate.js';
import { nextIssueRef, nextWastageRef, checkLowStock } from '../services/stockService.js';
import { emitLowStock, emitExpiryAlert } from '../realtime/socketServer.js';

const router = Router();
router.use(verifyJWT);

// ─── Schemas ──────────────────────────────────────────────────────────────────

const receiveBatchSchema = z.object({
  ingredient_id: z.string().min(1),
  batch_no:      z.string().max(50).optional(),
  qty:           z.coerce.number().positive(),
  expiry:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  supplier_id:   z.string().optional(),
  location:      z.string().max(100).optional(),
  cost_per_unit: z.coerce.number().min(0).optional(),
  container_size:z.coerce.number().positive().optional(),
  notes:         z.string().max(500).optional(),
});

const adjustBatchSchema = z.object({
  remaining:  z.coerce.number().min(0),
  status:     z.enum(['active','depleted','expired','written_off']).optional(),
  notes:      z.string().max(500).optional(),
  reason:     z.string().max(200).optional(),
});

const issueSchema = z.object({
  ingredient_id:  z.string().min(1),
  batch_id:       z.string().optional(),
  qty:            z.coerce.number().positive(),
  from_location:  z.string().max(100).optional(),
  to_location:    z.string().max(100).default('Kitchen'),
  container_size: z.coerce.number().positive().optional(),
  notes:          z.string().max(500).optional(),
});

const produceSchema = z.object({
  menu_item_id: z.string().min(1),
  batches:      z.coerce.number().positive(),
  notes:        z.string().max(500).optional(),
});

const wastageSchema = z.object({
  ingredient_id: z.string().min(1).optional(),
  menu_item_id:  z.string().min(1).optional(),
  batch_id:      z.string().optional(),
  qty:           z.coerce.number().positive(),
  reason:        z.enum(['expired','spoilage','trimming','breakage','theft','other','overcooked','returned','staff_meal']),
  notes:         z.string().max(500).optional(),
});

const ingredientSchema = z.object({
  id:            z.string().min(2).max(20).toUpperCase(),
  name:          z.string().min(2).max(150).trim(),
  unit:          z.string().max(20).optional(),
  category:      z.string().max(50).optional(),
  reorder_level: z.coerce.number().min(0).optional(),
  cost_per_unit: z.coerce.number().min(0).optional(),
  issued_whole:  z.coerce.boolean().optional(),
});

// ══════════════════════════════════════════════════════════════════════════════
// BATCHES
// ══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/inventory/batches ───────────────────────────────────────────────
router.get('/batches', requirePermission('inventory_readonly'), validateQuery(paginationSchema.extend({
  ingredient_id: z.string().optional(),
  status:        z.string().optional(),
  location:      z.string().optional(),
})), async (req, res, next) => {
  try {
    const { page, limit, ingredient_id, status, location } = req.query;
    const offset = (page - 1) * limit;

    const conditions = [];
    const params     = [];
    let   idx        = 1;

    if (ingredient_id) { conditions.push(`b.ingredient_id = $${idx++}`); params.push(ingredient_id); }
    if (status)        { conditions.push(`b.status = $${idx++}`);        params.push(status); }
    if (location)      { conditions.push(`b.location ILIKE $${idx++}`);  params.push(`%${location}%`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await db.query(
      `SELECT
         b.*,
         i.name AS ingredient_name, i.unit, i.reorder_level,
         s.name AS supplier_name,
         u.name AS received_by_name
       FROM batches b
       JOIN ingredients i ON i.id = b.ingredient_id
       LEFT JOIN suppliers s ON s.id = b.supplier_id
       LEFT JOIN users u     ON u.id = b.received_by
       ${where}
       ORDER BY b.expiry ASC NULLS LAST, b.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    );

    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) FROM batches b ${where}`, params
    );

    res.json({ batches: rows, total: parseInt(countRows[0].count), page, limit });
  } catch (err) { next(err); }
});

// ─── POST /api/inventory/batches — receive stock ──────────────────────────────
router.post('/batches', requirePermission('inventory'), validate(receiveBatchSchema), async (req, res, next) => {
  try {
    const { ingredient_id, batch_no, qty, expiry, supplier_id, location, cost_per_unit, container_size, notes } = req.body;

    // Auto-generate batch ID using timestamp to avoid collisions
    const newId = 'B' + Date.now().toString().slice(-8);

    const { rows } = await db.query(
      `INSERT INTO batches
         (id, ingredient_id, batch_no, qty, remaining, expiry, supplier_id,
          location, received_date, cost_per_unit, container_size, received_by, notes, status)
       VALUES ($1,$2,$3,$4,$4,$5,$6,$7,CURRENT_DATE,$8,$9,$10,$11,'active')
       RETURNING *`,
      [newId, ingredient_id, batch_no || null, qty,
       expiry || null, supplier_id || null, location || 'Main Store',
       cost_per_unit || null, container_size || null, req.user.sub, notes || null]
    );

    await db.query(
      `INSERT INTO audit_log (user_id, action, entity, entity_id, payload, ip_address)
       VALUES ($1,'RECEIVE_STOCK','batches',$2,$3,$4)`,
      [req.user.sub, newId, JSON.stringify({ ingredient_id, qty }), req.ip]
    );

    res.status(201).json({ batch: rows[0] });
  } catch (err) { next(err); }
});

// ─── PATCH /api/inventory/batches/:id — manual adjustment ────────────────────
router.patch('/batches/:id', requirePermission('inventory'), validate(adjustBatchSchema), async (req, res, next) => {
  try {
    const { remaining, status, notes } = req.body;

    const { rows } = await db.query(
      `UPDATE batches
       SET remaining = $1,
           status    = COALESCE($2, CASE WHEN $1 <= 0 THEN 'depleted' ELSE status END),
           notes     = COALESCE($3, notes),
           updated_at = now()
       WHERE id = $4
       RETURNING *`,
      [remaining, status || null, notes || null, req.params.id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Batch not found' });

    await db.query(
      `INSERT INTO audit_log (user_id, action, entity, entity_id, payload, ip_address)
       VALUES ($1,'ADJUST_BATCH','batches',$2,$3,$4)`,
      [req.user.sub, req.params.id, JSON.stringify(req.body), req.ip]
    );

    res.json({ batch: rows[0] });
  } catch (err) { next(err); }
});

// ─── GET /api/inventory/expiry ────────────────────────────────────────────────
router.get('/expiry', requirePermission('expiry'), async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 7;

    const { rows } = await db.query(
      `SELECT
         b.*,
         i.name AS ingredient_name, i.unit,
         s.name AS supplier_name,
         (b.expiry - CURRENT_DATE) AS days_left
       FROM batches b
       JOIN ingredients i ON i.id = b.ingredient_id
       LEFT JOIN suppliers s ON s.id = b.supplier_id
       WHERE b.status = 'active'
         AND b.expiry IS NOT NULL
         AND b.expiry <= CURRENT_DATE + $1
       ORDER BY b.expiry ASC`,
      [days]
    );

    // Emit realtime alert if critical items found
    const critical = rows.filter(r => r.days_left <= 1);
    if (critical.length > 0) {
      emitExpiryAlert(critical.map(r => ({
        batch_id:        r.id,
        ingredient_name: r.ingredient_name,
        days_left:       r.days_left,
        remaining:       r.remaining,
        unit:            r.unit,
      })));
    }

    res.json({ batches: rows, critical_count: critical.length });
  } catch (err) { next(err); }
});

// ─── GET /api/inventory/low-stock ────────────────────────────────────────────
router.get('/low-stock', requirePermission('inventory_readonly'), async (req, res, next) => {
  try {
    const alerts = await checkLowStock(null);
    res.json({ alerts });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// STORE ISSUES
// ══════════════════════════════════════════════════════════════════════════════

// ─── POST /api/inventory/issues ───────────────────────────────────────────────
router.post('/issues', requirePermission('inventory'), validate(issueSchema), async (req, res, next) => {
  try {
    const { ingredient_id, batch_id, qty, from_location, to_location, container_size, notes } = req.body;

    const issue = await db.transaction(async (client) => {
      const issue_ref = await nextIssueRef(client);

      // FEFO deduction (earliest expiry first). When a container_size is given, draw
      // ONLY from batches of that bottle size — so issuing a 5 L bottle never eats
      // into the 1 L stack. Otherwise draw across all active batches.
      const { rows: batchRows } = await client.query(
        `SELECT id, remaining FROM batches
          WHERE ingredient_id = $1 AND status = 'active' AND remaining > 0
            AND ($2::numeric IS NULL OR container_size = $2::numeric)
          ORDER BY expiry ASC NULLS LAST, created_at ASC
          FOR UPDATE`,
        [ingredient_id, container_size || null]
      );
      const totalAvail = batchRows.reduce((s, b) => s + Number(b.remaining), 0);
      if (totalAvail < qty) {
        throw Object.assign(new Error(`Insufficient stock (available: ${totalAvail})`), { status: 422 });
      }

      let needed = qty;
      let recordBatchId = batch_id || null;
      for (const b of batchRows) {
        if (needed <= 0) break;
        const take = Math.min(Number(b.remaining), needed);
        await client.query(
          `UPDATE batches
              SET remaining  = remaining - $1,
                  status     = CASE WHEN remaining - $1 <= 0 THEN 'depleted' ELSE status END,
                  updated_at = now()
            WHERE id = $2`,
          [take, b.id]
        );
        if (!recordBatchId) recordBatchId = b.id;
        needed -= take;
      }

      // Compute value
      const { rows: ingRows } = await client.query(
        `SELECT cost_per_unit FROM ingredients WHERE id = $1`, [ingredient_id]
      );
      const value = (ingRows[0]?.cost_per_unit || 0) * qty;

      const { rows } = await client.query(
        `INSERT INTO store_issues
           (issue_ref, issue_date, from_location, to_location, ingredient_id, batch_id, qty, issued_by)
         VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [issue_ref, from_location || 'Main Store', to_location,
         ingredient_id, recordBatchId, qty, req.user.sub]
      );

      return { ...rows[0], value };
    });

    res.status(201).json({ issue });
  } catch (err) { next(err); }
});

// ─── POST /api/inventory/produce ──────────────────────────────────────────────
// "Produce N batches of <menu item>": deducts that item's recipe ingredients
// (recipe qty × batches) from store via FEFO. Each ingredient is recorded as a
// kitchen issue, so it shows in Recent Issues and feeds day-end variance.
router.post('/produce', requirePermission('inventory'), validate(produceSchema), async (req, res, next) => {
  try {
    const { menu_item_id, batches } = req.body;

    const result = await db.transaction(async (client) => {
      // Fetch the item + its recipe
      const { rows: itemRows } = await client.query(
        `SELECT m.name, COALESCE(m.batch_size, 1) AS batch_size,
                COALESCE(json_agg(json_build_object('ingredient_id', r.ingredient_id, 'qty', r.qty))
                         FILTER (WHERE r.ingredient_id IS NOT NULL), '[]') AS recipe
           FROM menu_items m
           LEFT JOIN recipes r ON r.menu_item_id = m.id
          WHERE m.id = $1
          GROUP BY m.id, m.name, m.batch_size`,
        [menu_item_id]
      );
      if (!itemRows[0]) throw Object.assign(new Error('Menu item not found'), { status: 404 });
      const itemName  = itemRows[0].name;
      const batchSize = Number(itemRows[0].batch_size) || 1;
      const recipe    = itemRows[0].recipe || [];
      if (!recipe.length) throw Object.assign(new Error('This item has no recipe, so there is nothing to deduct'), { status: 422 });

      // Pass 1 — lock batches and verify EVERY ingredient has enough (all-or-nothing).
      // Ingredients flagged issued_whole are handed to the kitchen via Issue Stock, so we
      // skip deducting them here (they'd be double-counted), but still note them.
      const plan = [];
      const skipped = [];
      for (const line of recipe) {
        const { rows: ingRows } = await client.query(
          `SELECT name, COALESCE(issued_whole, false) AS issued_whole FROM ingredients WHERE id = $1`,
          [line.ingredient_id]
        );
        const ingName      = ingRows[0]?.name || line.ingredient_id;
        const issuedWhole  = ingRows[0]?.issued_whole === true;
        const need = Number(line.qty) * batches;

        if (issuedWhole) {
          skipped.push({ ingredient: ingName, qty: need });
          continue;  // not deducted from store here
        }

        const { rows: bRows } = await client.query(
          `SELECT id, remaining FROM batches
            WHERE ingredient_id = $1 AND status = 'active' AND remaining > 0
            ORDER BY expiry ASC NULLS LAST, created_at ASC
            FOR UPDATE`,
          [line.ingredient_id]
        );
        const avail = bRows.reduce((s, b) => s + Number(b.remaining), 0);
        if (avail < need) {
          throw Object.assign(new Error(`Not enough ${ingName}: need ${need}, only ${avail} in stock`), { status: 422 });
        }
        plan.push({ ingredient_id: line.ingredient_id, ingName, need, bRows });
      }

      // Pass 2 — deduct FEFO and record one kitchen issue per ingredient
      const deducted = [];
      for (const p of plan) {
        let needed = p.need;
        let firstBatch = null;
        for (const b of p.bRows) {
          if (needed <= 0) break;
          const take = Math.min(Number(b.remaining), needed);
          await client.query(
            `UPDATE batches
                SET remaining  = remaining - $1,
                    status     = CASE WHEN remaining - $1 <= 0 THEN 'depleted' ELSE status END,
                    updated_at = now()
              WHERE id = $2`,
            [take, b.id]
          );
          if (!firstBatch) firstBatch = b.id;
          needed -= take;
        }
        const issue_ref = await nextIssueRef(client);
        await client.query(
          `INSERT INTO store_issues
             (issue_ref, issue_date, from_location, to_location, ingredient_id, batch_id, qty, issued_by)
           VALUES ($1, CURRENT_DATE, 'Main Store', 'Kitchen', $2, $3, $4, $5)`,
          [issue_ref, p.ingredient_id, firstBatch, p.need, req.user.sub]
        );
        deducted.push({ ingredient: p.ingName, qty: p.need });
      }

      // Add finished servings to prepared stock so the item list reflects it.
      // servings = batches × batch_size (e.g. 1 batch of tea that "makes 100" → 100 cups)
      const servings = batches * batchSize;
      await client.query(
        `INSERT INTO menu_item_stock (menu_item_id, qty_available)
         VALUES ($1, $2)
         ON CONFLICT (menu_item_id)
         DO UPDATE SET qty_available = menu_item_stock.qty_available + $2, updated_at = now()`,
        [menu_item_id, servings]
      );
      await client.query(
        `INSERT INTO production_log (menu_item_id, qty_produced, produced_by, notes)
         VALUES ($1, $2, $3, $4)`,
        [menu_item_id, servings, req.user.sub, `Produced ${batches} batch(es) via Produce Batch`]
      );

      return { item: itemName, batches, servings, deducted, skipped };
    });

    res.status(201).json({ ok: true, ...result });
  } catch (err) { next(err); }
});

// ─── GET /api/inventory/variance-production ───────────────────────────────────
// Dish-level variance from the production log — no recipes needed.
// Compares units PRODUCED (kitchen log) vs units SOLD for a day.
router.get('/variance-production', requirePermission(['variance', 'inventory_readonly']), async (req, res, next) => {
  try {
    const date = (req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date))
      ? req.query.date : new Date().toISOString().slice(0, 10);
    const { rows } = await db.query(
      `WITH prod AS (
         SELECT menu_item_id, SUM(qty_produced) AS produced
           FROM production_log WHERE created_at::date = $1::date GROUP BY menu_item_id
       ), sold AS (
         SELECT si.menu_item_id, SUM(si.qty) AS sold
           FROM sale_items si JOIN sales sa ON sa.id = si.sale_id AND sa.status = 'paid'
          WHERE sa.sale_date = $1::date GROUP BY si.menu_item_id
       )
       SELECT m.id, m.name,
              COALESCE(p.produced, 0) AS produced,
              COALESCE(s.sold, 0)     AS sold
         FROM menu_items m
         LEFT JOIN prod p ON p.menu_item_id = m.id
         LEFT JOIN sold s ON s.menu_item_id = m.id
        WHERE COALESCE(p.produced, 0) > 0 OR COALESCE(s.sold, 0) > 0
        ORDER BY m.name`,
      [date]
    );
    const items = rows.map((r) => {
      const produced = Number(r.produced), sold = Number(r.sold);
      const diff = produced - sold;
      let flag;
      if (produced > 0 && sold === 0) flag = 'unsold';   // cooked, none sold
      else if (diff > 0)              flag = 'over';      // leftover
      else if (diff < 0)              flag = 'unlogged';  // sold but production not logged
      else                            flag = 'ok';
      return { id: r.id, name: r.name, produced, sold, diff, flag };
    });
    res.json({ date, items });
  } catch (err) { next(err); }
});

// ─── GET /api/inventory/daily-log ─────────────────────────────────────────────
// Everything received, issued, and produced on a given day (default today).
router.get('/daily-log', requirePermission('inventory_readonly'), async (req, res, next) => {
  try {
    const date = (req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)) ? req.query.date : null;
    const dayExpr = date ? '$1::date' : 'CURRENT_DATE';
    const params  = date ? [date] : [];

    const received = (await db.query(
      `SELECT b.id, b.batch_no, b.qty, b.container_size, b.created_at,
              i.name AS ingredient, i.unit, u.name AS by_name
         FROM batches b
         JOIN ingredients i ON i.id = b.ingredient_id
         LEFT JOIN users u ON u.id = b.received_by
        WHERE b.created_at::date = ${dayExpr}
        ORDER BY b.created_at DESC`, params)).rows;

    const issued = (await db.query(
      `SELECT si.id, si.issue_ref, si.qty, si.to_location, si.created_at,
              i.name AS ingredient, i.unit, u.name AS by_name
         FROM store_issues si
         JOIN ingredients i ON i.id = si.ingredient_id
         LEFT JOIN users u ON u.id = si.issued_by
        WHERE si.created_at::date = ${dayExpr}
        ORDER BY si.created_at DESC`, params)).rows;

    const produced = (await db.query(
      `SELECT p.id, p.qty_produced, p.created_at,
              m.name AS item, u.name AS by_name
         FROM production_log p
         JOIN menu_items m ON m.id = p.menu_item_id
         LEFT JOIN users u ON u.id = p.produced_by
        WHERE p.created_at::date = ${dayExpr}
        ORDER BY p.created_at DESC`, params)).rows;

    res.json({
      date: date || new Date().toISOString().slice(0, 10),
      received, issued, produced,
      totals: { received: received.length, issued: issued.length, produced: produced.length },
    });
  } catch (err) { next(err); }
});

// ─── GET /api/inventory/issues ────────────────────────────────────────────────
router.get('/issues', requirePermission('inventory_readonly'), validateQuery(paginationSchema.extend({
  from: z.string().optional(),
  to:   z.string().optional(),
})), async (req, res, next) => {
  try {
    const { page, limit, from, to } = req.query;
    const offset = (page - 1) * limit;

    const params = [];
    let   idx    = 1;
    const conds  = [];
    if (from) { conds.push(`si.issue_date >= $${idx++}`); params.push(from); }
    if (to)   { conds.push(`si.issue_date <= $${idx++}`); params.push(to);   }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const { rows } = await db.query(
      `SELECT si.*, i.name AS ingredient_name, i.unit, u.name AS issued_by_name
       FROM store_issues si
       JOIN ingredients i ON i.id = si.ingredient_id
       LEFT JOIN users u ON u.id = si.issued_by
       ${where}
       ORDER BY si.issue_date DESC, si.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    );

    const { rows: cnt } = await db.query(`SELECT COUNT(*) FROM store_issues si ${where}`, params);
    res.json({ issues: rows, total: parseInt(cnt[0].count), page, limit });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// WASTAGE
// ══════════════════════════════════════════════════════════════════════════════

// ─── POST /api/inventory/wastage ──────────────────────────────────────────────
router.post('/wastage', requirePermission('wastage'), validate(wastageSchema), async (req, res, next) => {
  try {
    const { ingredient_id, menu_item_id, batch_id, qty, reason, notes } = req.body;

    const record = await db.transaction(async (client) => {
      const wastage_ref = await nextWastageRef(client);

      // ── Menu item (finished dish) wastage: log only, no money value ──
      if (menu_item_id) {
        // Remove the wasted dishes from prepared stock on hand
        await client.query(
          `UPDATE menu_item_stock
             SET qty_available = GREATEST(0, qty_available - $1), updated_at = now()
           WHERE menu_item_id = $2`,
          [qty, menu_item_id]
        );
        const { rows } = await client.query(
          `INSERT INTO wastage (wastage_ref, wastage_date, menu_item_id, qty, reason, value, recorded_by, notes)
           VALUES ($1, CURRENT_DATE, $2, $3, $4, 0, $5, $6)
           RETURNING *`,
          [wastage_ref, menu_item_id, qty, reason, req.user.sub, notes || null]
        );
        return rows[0];
      }

      // ── Ingredient (raw stock) wastage: value from cost, deduct batch ──
      const { rows: ingRows } = await client.query(
        `SELECT cost_per_unit FROM ingredients WHERE id = $1`, [ingredient_id]
      );
      const value = (ingRows[0]?.cost_per_unit || 0) * qty;

      if (batch_id) {
        await client.query(
          `UPDATE batches
           SET remaining  = GREATEST(0, remaining - $1),
               status     = CASE WHEN remaining - $1 <= 0 THEN 'depleted' ELSE status END,
               updated_at = now()
           WHERE id = $2`,
          [qty, batch_id]
        );
      }

      const { rows } = await client.query(
        `INSERT INTO wastage (wastage_ref, wastage_date, ingredient_id, batch_id, qty, reason, value, recorded_by, notes)
         VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [wastage_ref, ingredient_id, batch_id || null, qty, reason, value, req.user.sub, notes || null]
      );

      return rows[0];
    });

    res.status(201).json({ record });
  } catch (err) { next(err); }
});

// ─── GET /api/inventory/wastage ───────────────────────────────────────────────
router.get('/wastage', requirePermission('wastage'), validateQuery(paginationSchema.extend({
  from: z.string().optional(), to: z.string().optional(),
})), async (req, res, next) => {
  try {
    const { page, limit, from, to } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    let   idx    = 1;
    const conds  = [];
    if (from) { conds.push(`w.wastage_date >= $${idx++}`); params.push(from); }
    if (to)   { conds.push(`w.wastage_date <= $${idx++}`); params.push(to);   }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const { rows } = await db.query(
      `SELECT w.*,
              COALESCE(i.name, m.name) AS ingredient_name,
              COALESCE(i.unit, 'pcs')  AS unit,
              m.name AS menu_item_name,
              u.name AS recorded_by_name,
              b.batch_no AS batch_no
       FROM wastage w
       LEFT JOIN ingredients i ON i.id = w.ingredient_id
       LEFT JOIN menu_items  m ON m.id = w.menu_item_id
       LEFT JOIN users u ON u.id = w.recorded_by
       LEFT JOIN batches b ON b.id = w.batch_id
       ${where}
       ORDER BY w.wastage_date DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    );

    const { rows: cnt } = await db.query(`SELECT COUNT(*) FROM wastage w ${where}`, params);
    res.json({ records: rows, total: parseInt(cnt[0].count), page, limit });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// VARIANCE REPORT
// ══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/inventory/variance ─────────────────────────────────────────────
router.get('/variance', requirePermission('variance'), async (req, res, next) => {
  try {
    const { from, to } = req.query;

    // Theoretical usage: units sold × recipe qty
    const { rows: theoretical } = await db.query(
      `SELECT
         r.ingredient_id,
         SUM(r.qty * si.qty) AS theoretical_qty
       FROM sale_items si
       JOIN recipes r ON r.menu_item_id = si.menu_item_id
       JOIN sales sa  ON sa.id = si.sale_id AND sa.status = 'paid'
       WHERE ($1::date IS NULL OR sa.sale_date >= $1)
         AND ($2::date IS NULL OR sa.sale_date <= $2)
       GROUP BY r.ingredient_id`,
      [from || null, to || null]
    );

    // Actual issued quantity
    const { rows: issued } = await db.query(
      `SELECT ingredient_id, SUM(qty) AS issued_qty
       FROM store_issues
       WHERE ($1::date IS NULL OR issue_date >= $1)
         AND ($2::date IS NULL OR issue_date <= $2)
       GROUP BY ingredient_id`,
      [from || null, to || null]
    );

    // Current physical stock
    const { rows: physical } = await db.query(
      `SELECT ingredient_id, SUM(remaining) AS physical_qty
       FROM batches
       WHERE status = 'active'
       GROUP BY ingredient_id`
    );

    // All ingredients
    const { rows: ingredients } = await db.query(
      `SELECT id, name, unit, cost_per_unit FROM ingredients WHERE active = true`
    );

    const theoMap   = Object.fromEntries(theoretical.map(r => [r.ingredient_id, parseFloat(r.theoretical_qty)]));
    const issueMap  = Object.fromEntries(issued.map(r => [r.ingredient_id, parseFloat(r.issued_qty)]));
    const physMap   = Object.fromEntries(physical.map(r => [r.ingredient_id, parseFloat(r.physical_qty)]));

    const variance = ingredients
      .map(ing => {
        const theo    = theoMap[ing.id]  || 0;
        const iss     = issueMap[ing.id] || 0;
        const phys    = physMap[ing.id]  || 0;
        const vari    = iss - theo;
        const pct     = iss > 0 ? (vari / iss) * 100 : 0;

        return {
          ...ing,
          theoretical:     Math.round(theo * 10) / 10,
          issued:          iss,
          physical:        phys,
          variance:        Math.round(vari * 10) / 10,
          variance_pct:    Math.round(pct * 10) / 10,
          shrinkage_value: Math.round(vari * (ing.cost_per_unit || 0)),
          flag: vari > 0
            ? (pct > 20 ? 'critical' : 'warning')
            : vari < -5 ? 'under' : 'ok',
        };
      })
      .filter(r => r.theoretical > 0 || r.issued > 0);

    res.json({ variance, period: { from: from || null, to: to || null } });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// INGREDIENTS
// ══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/inventory/ingredients ──────────────────────────────────────────
router.get('/ingredients', async (req, res, next) => { // public within auth — readonly accessible
  try {
    const { rows } = await db.query(
      `SELECT i.*,
         COALESCE(SUM(b.remaining), 0) AS total_stock
       FROM ingredients i
       LEFT JOIN batches b ON b.ingredient_id = i.id AND b.status = 'active'
       WHERE i.active = true
       GROUP BY i.id
       ORDER BY i.category, i.name`
    );
    res.json({ ingredients: rows });
  } catch (err) { next(err); }
});

// ─── POST /api/inventory/ingredients ─────────────────────────────────────────
router.post('/ingredients', requirePermission('inventory'), validate(ingredientSchema), async (req, res, next) => {
  try {
    // Reject duplicate ingredient names (case-insensitive)
    const { rows: dup } = await db.query(
      `SELECT id, name FROM ingredients WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1`,
      [req.body.name]
    );
    if (dup[0]) {
      return res.status(409).json({ error: `"${dup[0].name}" already exists. Use Receive Stock to add more quantity.` });
    }

    const { id, name, unit, category, reorder_level, cost_per_unit,
              purchase_unit, purchase_qty, purchase_cost, issued_whole } = req.body;

    // Auto-calculate cost_per_unit from bulk purchase info if provided
    // e.g. bought 1kg (1000g) for KES 120 → cost_per_unit = 0.12/g
    const resolvedCostPerUnit = (purchase_cost && purchase_qty && purchase_qty > 0)
      ? parseFloat(purchase_cost) / parseFloat(purchase_qty)
      : cost_per_unit || null;

    const { rows } = await db.query(
      `INSERT INTO ingredients (id, name, unit, category, reorder_level, cost_per_unit, issued_whole)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO NOTHING
       RETURNING *`,
      [id, name, unit || null, category || null, reorder_level || null, cost_per_unit || null, issued_whole === true]
    );

    if (!rows[0]) return res.status(409).json({ error: `Ingredient '${id}' already exists` });
    res.status(201).json({ ingredient: rows[0] });
  } catch (err) { next(err); }
});


// ─── PATCH /api/inventory/ingredients/:id ─────────────────────────────────────
router.patch('/ingredients/:id', requirePermission('inventory'), async (req, res, next) => {
  try {
    const { name, unit, category, reorder_level, cost_per_unit, purchase_unit, purchase_qty, purchase_cost, issued_whole } = req.body;

    // If name is changing, check no duplicate
    if (name) {
      const { rows: dup } = await db.query(
        `SELECT id FROM ingredients WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND id != $2 LIMIT 1`,
        [name, req.params.id]
      );
      if (dup[0]) return res.status(409).json({ error: `"${name}" already exists in inventory` });
    }

    const resolvedCost = (purchase_cost && purchase_qty && parseFloat(purchase_qty) > 0)
      ? parseFloat(purchase_cost) / parseFloat(purchase_qty)
      : cost_per_unit;

    const { rows } = await db.query(
      `UPDATE ingredients SET
        name          = COALESCE($1, name),
        unit          = COALESCE($2, unit),
        category      = COALESCE($3, category),
        reorder_level = COALESCE($4, reorder_level),
        cost_per_unit = COALESCE($5, cost_per_unit),
        issued_whole  = COALESCE($7, issued_whole),
        updated_at    = now()
       WHERE id = $6 RETURNING *`,
      [name||null, unit||null, category||null,
       reorder_level!=null ? parseFloat(reorder_level) : null,
       resolvedCost||null, req.params.id,
       issued_whole === undefined ? null : (issued_whole === true)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Ingredient not found' });
    res.json({ ingredient: rows[0] });
  } catch (err) { next(err); }
});

// ─── DELETE /api/inventory/ingredients/:id ────────────────────────────────────
router.delete('/ingredients/:id', requirePermission('inventory'), async (req, res, next) => {
  const id = req.params.id;
  const force = req.query.force === 'true';
  try {
    if (!force) {
      // Real stock = remaining quantity in active batches (empty batches don't count)
      const { rows: s } = await db.query(
        `SELECT COALESCE(SUM(remaining),0) AS live FROM batches WHERE ingredient_id = $1 AND status = 'active'`,
        [id]
      );
      const live = parseFloat(s[0].live) || 0;

      const { rows: r } = await db.query(
        `SELECT COUNT(*) AS uses FROM recipes WHERE ingredient_id = $1`, [id]
      );
      const recipeUses = parseInt(r[0].uses, 10);

      if (live > 0) {
        return res.status(409).json({ error: 'Cannot delete — this ingredient still has stock in store. Issue or write off its stock first.', canForce: true });
      }
      if (recipeUses > 0) {
        return res.status(409).json({ error: `Cannot delete — this ingredient is used in ${recipeUses} recipe(s). Remove it from those recipes first.`, canForce: true });
      }
    }

    // force=true OR (no stock + no recipes) → remove it and its records
    // (old deliveries, issues, wastage, recipe links) so the delete isn't blocked.
    const deleted = await db.transaction(async (client) => {
      await client.query(`DELETE FROM store_issues WHERE ingredient_id = $1`, [id]);
      await client.query(`DELETE FROM wastage      WHERE ingredient_id = $1`, [id]);
      await client.query(`DELETE FROM batches      WHERE ingredient_id = $1`, [id]);
      await client.query(`DELETE FROM recipes      WHERE ingredient_id = $1`, [id]);
      const { rows } = await client.query(
        `DELETE FROM ingredients WHERE id = $1 RETURNING id, name`, [id]
      );
      return rows[0];
    });

    if (!deleted) return res.status(404).json({ error: 'Ingredient not found' });
    res.json({ deleted });
  } catch (err) {
    if (err && err.code === '23503') {
      return res.status(409).json({ error: 'Cannot delete — this ingredient is still linked to other records. Clear those first.' });
    }
    next(err);
  }
});

export default router;
