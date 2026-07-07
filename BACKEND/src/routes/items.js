/**
 * routes/items.js
 *
 * GET    /api/items                  — list all active menu items (with recipes)
 * GET    /api/items/:id              — single item
 * POST   /api/items                  — create menu item + recipe
 * PATCH  /api/items/:id              — update menu item
 * DELETE /api/items/:id              — deactivate item
 * PUT    /api/items/:id/recipe       — replace recipe for a menu item
 * GET    /api/items/categories       — distinct categories list
 */

import { Router } from 'express';
import { z }      from 'zod';
import { db }     from '../config/db.js';
import { verifyJWT, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(verifyJWT);

// ─── Schemas ──────────────────────────────────────────────────────────────────

const recipeLineSchema = z.object({
  ingredient_id: z.string().min(1).optional(),
  qty:           z.coerce.number().positive(),
});

const createItemSchema = z.object({
  id:             z.string().min(2).max(20).toUpperCase(),
  name:           z.string().min(2).max(150).trim(),
  category:       z.string().max(50).optional(),
  price:          z.coerce.number().positive(),
  cost:           z.coerce.number().min(0).optional(),
  emoji:          z.string().max(10).optional(),
  description:    z.string().max(500).optional(),
  bestseller:     z.boolean().default(false),
  on_sale:        z.boolean().default(false),
  original_price: z.coerce.number().optional(),
  brand:          z.string().max(100).optional(),
  batch_size:     z.coerce.number().int().positive().default(1),
  image:          z.string().max(600000).optional(),
  recipe:         z.array(recipeLineSchema).optional(),
});

const updateItemSchema = createItemSchema.partial().omit({ id: true });

// ─── GET /api/items ───────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { category, active = 'true' } = req.query;

    const conditions = [];
    const params     = [];
    let   idx        = 1;

    if (active !== 'all') {
      conditions.push(`m.active = $${idx++}`);
      params.push(active === 'true');
    }
    if (category) {
      conditions.push(`m.category = $${idx++}`);
      params.push(category);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await db.query(
      `SELECT
         m.*,
         COALESCE(
           json_agg(
             json_build_object('ingredient_id', r.ingredient_id, 'qty', r.qty, 'overhead_cost', r.overhead_cost, 'name', i.name, 'unit', i.unit)
             ORDER BY r.ingredient_id
           ) FILTER (WHERE r.ingredient_id IS NOT NULL),
           '[]'
         ) AS recipe
       FROM menu_items m
       LEFT JOIN recipes r     ON r.menu_item_id = m.id
       LEFT JOIN ingredients i ON i.id = r.ingredient_id
       ${where}
       GROUP BY m.id
       ORDER BY m.category, m.name`,
      params
    );

    res.json({ items: rows });
  } catch (err) { next(err); }
});

// ─── GET /api/items/categories ────────────────────────────────────────────────
router.get('/categories', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT category FROM menu_items WHERE active = true AND category IS NOT NULL ORDER BY category`
    );
    res.json({ categories: rows.map(r => r.category) });
  } catch (err) { next(err); }
});

// ─── GET /api/items/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT
         m.*,
         COALESCE(
           json_agg(json_build_object('ingredient_id', r.ingredient_id, 'qty', r.qty, 'overhead_cost', r.overhead_cost, 'name', i.name, 'unit', i.unit))
           FILTER (WHERE r.ingredient_id IS NOT NULL), '[]'
         ) AS recipe
       FROM menu_items m
       LEFT JOIN recipes r     ON r.menu_item_id = m.id
       LEFT JOIN ingredients i ON i.id = r.ingredient_id
       WHERE m.id = $1
       GROUP BY m.id`,
      [req.params.id.toUpperCase()]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Item not found' });
    res.json({ item: rows[0] });
  } catch (err) { next(err); }
});

// ─── POST /api/items ──────────────────────────────────────────────────────────
router.post('/', requirePermission('items'), validate(createItemSchema), async (req, res, next) => {
  try {
    const { recipe, ...itemData } = req.body;

    const item = await db.transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO menu_items
           (id, name, category, price, cost, emoji, description,
            bestseller, on_sale, original_price, brand, batch_size, image, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [itemData.id, itemData.name, itemData.category || null,
         itemData.price, itemData.cost || null, itemData.emoji || null,
         itemData.description || null, itemData.bestseller, itemData.on_sale,
         itemData.original_price || null, itemData.brand || null,
         itemData.batch_size || 1, itemData.image || null, req.user.sub]
      );

      // Insert recipe if provided
      if (recipe?.length) {
        for (const line of recipe) {
          await client.query(
            `INSERT INTO recipes (menu_item_id, ingredient_id, qty, overhead_cost)
             VALUES ($1,$2,$3,$4)`,
            [itemData.id, line.ingredient_id || null, line.qty || 0, line.overhead_cost || 0]
          );
        }
      }

      await client.query(
        `INSERT INTO audit_log (user_id, action, entity, entity_id, ip_address)
         VALUES ($1, 'CREATE_ITEM', 'menu_items', $2, $3)`,
        [req.user.sub, itemData.id, req.ip]
      );

      return rows[0];
    });

    res.status(201).json({ item });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: `Item ID '${req.body.id}' already exists` });
    }
    next(err);
  }
});

// ─── PATCH /api/items/:id ─────────────────────────────────────────────────────
router.patch('/:id', requirePermission('items'), validate(updateItemSchema), async (req, res, next) => {
  try {
    const id      = req.params.id.toUpperCase();
    const updates = req.body;

    const fields = [];
    const values = [];
    let   idx    = 1;

    const cols = ['name','category','price','cost','emoji','description',
                  'bestseller','on_sale','original_price','brand','batch_size','image','active'];

    for (const col of cols) {
      if (updates[col] !== undefined) {
        fields.push(`${col} = $${idx++}`);
        values.push(updates[col]);
      }
    }

    if (!fields.length) return res.status(422).json({ error: 'No fields to update' });

    values.push(id);
    const { rows } = await db.query(
      `UPDATE menu_items SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (!rows[0]) return res.status(404).json({ error: 'Item not found' });
    res.json({ item: rows[0] });
  } catch (err) { next(err); }
});

// ─── DELETE /api/items/:id — soft delete ─────────────────────────────────────
router.delete('/:id', requirePermission('items'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `UPDATE menu_items SET active = false WHERE id = $1 RETURNING id`,
      [req.params.id.toUpperCase()]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Item not found' });
    res.json({ ok: true, message: 'Item deactivated' });
  } catch (err) { next(err); }
});

// ─── PUT /api/items/:id/recipe — replace full recipe ─────────────────────────
router.put('/:id/recipe', requirePermission('items'), async (req, res, next) => {
  try {
    const id     = req.params.id.toUpperCase();
    const schema = z.array(recipeLineSchema).min(1);
    const result = schema.safeParse(req.body.recipe);

    if (!result.success) {
      return res.status(422).json({ error: 'Invalid recipe', errors: result.error.issues });
    }

    const recipe = await db.transaction(async (client) => {
      // Delete existing recipe
      await client.query(`DELETE FROM recipes WHERE menu_item_id = $1`, [id]);

      // Insert new recipe lines
      for (const line of result.data) {
        await client.query(
          `INSERT INTO recipes (menu_item_id, ingredient_id, qty) VALUES ($1,$2,$3)`,
          [id, line.ingredient_id, line.qty]
        );
      }

      const { rows } = await client.query(
        `SELECT r.*, i.name, i.unit FROM recipes r
         JOIN ingredients i ON i.id = r.ingredient_id
         WHERE r.menu_item_id = $1`,
        [id]
      );
      return rows;
    });

    res.json({ recipe });
  } catch (err) { next(err); }
});


// ─── POST /api/items/:id/produce — log production, deduct ingredients ─────────
router.post('/:id/produce', requirePermission('items'), async (req, res, next) => {
  try {
    const id  = req.params.id.toUpperCase();
    const qty = parseFloat(req.body.qty);
    if (!qty || qty <= 0) return res.status(422).json({ error: 'qty must be a positive number' });

    const notes = req.body.notes || null;

    // Fetch recipe
    const { rows: recipe } = await db.query(
      `SELECT r.ingredient_id, r.qty, i.name
       FROM recipes r
       JOIN ingredients i ON i.id = r.ingredient_id
       WHERE r.menu_item_id = $1`,
      [id]
    );

    if (recipe.length === 0) {
      return res.status(422).json({ error: 'This item has no recipe — add ingredients first' });
    }

    const result = await db.transaction(async (client) => {
      // 1. Deduct ingredients using FEFO — same logic as a sale
      const { deductStockFEFO } = await import('../services/stockService.js');
      const fakeItems = [{ menu_item_id: id, qty }];
      const lowStockAlerts = await deductStockFEFO(client, fakeItems);

      // 2. Add to menu_item_stock (upsert)
      await client.query(
        `INSERT INTO menu_item_stock (menu_item_id, qty_available)
         VALUES ($1, $2)
         ON CONFLICT (menu_item_id)
         DO UPDATE SET qty_available = menu_item_stock.qty_available + $2, updated_at = now()`,
        [id, qty]
      );

      // 3. Log production
      await client.query(
        `INSERT INTO production_log (menu_item_id, qty_produced, produced_by, notes)
         VALUES ($1, $2, $3, $4)`,
        [id, qty, req.user.sub, notes]
      );

      // 4. Audit
      await client.query(
        `INSERT INTO audit_log (user_id, action, entity, entity_id, payload, ip_address)
         VALUES ($1, 'PRODUCE', 'menu_items', $2, $3, $4)`,
        [req.user.sub, id, JSON.stringify({ qty, recipe: recipe.map(r => ({ ingredient_id: r.ingredient_id, deducted: r.qty * qty })) }), req.ip]
      );

      return { lowStockAlerts };
    });

    res.status(201).json({
      ok: true,
      message: `${qty} unit(s) logged. Ingredients deducted from stock.`,
      low_stock_alerts: result.lowStockAlerts,
    });
  } catch (err) { next(err); }
});

// ─── GET /api/items/stock — get available stock for all menu items ────────────
router.get('/stock/available', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT m.id, m.name, m.price, m.category, m.emoji, m.active,
              COALESCE(s.qty_available, 0) AS qty_available
       FROM menu_items m
       LEFT JOIN menu_item_stock s ON s.menu_item_id = m.id
       WHERE m.active = true
       ORDER BY m.category, m.name`
    );
    res.json({ items: rows });
  } catch (err) { next(err); }
});

// ─── GET /api/items/:id/production-log ───────────────────────────────────────
router.get('/:id/production-log', requirePermission('items'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT p.*, u.name AS produced_by_name
       FROM production_log p
       LEFT JOIN users u ON u.id = p.produced_by
       WHERE p.menu_item_id = $1
       ORDER BY p.created_at DESC
       LIMIT 50`,
      [req.params.id.toUpperCase()]
    );
    res.json({ log: rows });
  } catch (err) { next(err); }
});

export default router;
