/**
 * src/routes/production.js
 * Production Groups & Batch Tracking API
 */
import express from 'express';
import { db } from '../config/db.js';
import { verifyJWT, requirePermission } from '../middleware/auth.js';

const router = express.Router();
router.use(verifyJWT);

// ── GET /api/production/groups ── list all groups with their menu items
router.get('/groups', async (req, res) => {
  try {
    const groups = await db.query(`
      SELECT 
        g.id, g.name, g.unit,
        json_agg(
          json_build_object(
            'menu_item_id', gi.menu_item_id,
            'menu_item_name', m.name,
            'portions', gi.portions
          ) ORDER BY m.name
        ) FILTER (WHERE gi.id IS NOT NULL) as items
      FROM production_groups g
      LEFT JOIN production_group_items gi ON gi.group_id = g.id
      LEFT JOIN menu_items m ON m.id = gi.menu_item_id
      GROUP BY g.id
      ORDER BY g.name
    `);
    res.json({ groups: groups.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/production/groups ── create a group
router.post('/groups', async (req, res) => {
  const { name, unit = 'portions', items = [] } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const g = await db.query(
      'INSERT INTO production_groups (name, unit) VALUES ($1,$2) RETURNING *',
      [name, unit]
    );
    const group = g.rows[0];
    if (items.length) {
      for (const item of items) {
        await db.query(
          'INSERT INTO production_group_items (group_id, menu_item_id, portions) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
          [group.id, item.menu_item_id, item.portions || 1]
        );
      }
    }
    res.json({ group });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/production/groups/:id ── update group
router.put('/groups/:id', async (req, res) => {
  const { name, unit, items = [] } = req.body;
  try {
    await db.query('UPDATE production_groups SET name=$1, unit=$2 WHERE id=$3', [name, unit, req.params.id]);
    await db.query('DELETE FROM production_group_items WHERE group_id=$1', [req.params.id]);
    for (const item of items) {
      await db.query(
        'INSERT INTO production_group_items (group_id, menu_item_id, portions) VALUES ($1,$2,$3)',
        [req.params.id, item.menu_item_id, item.portions || 1]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/production/groups/:id ── delete group
router.delete('/groups/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM production_groups WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/production/batches ── today's active batches
router.get('/batches', async (req, res) => {
  const { date, shift_id, status = 'active' } = req.query;
  const today = date || new Date().toISOString().split('T')[0];
  try {
    const batches = await db.query(`
      SELECT 
        b.*,
        g.name as group_name, g.unit,
        u.name as cooked_by_name
      FROM production_batches b
      JOIN production_groups g ON g.id = b.group_id
      LEFT JOIN users u ON u.id = b.cooked_by
      WHERE b.cooked_at::date = $1
        AND ($2::text IS NULL OR b.status = $2)
        AND ($3::int IS NULL OR b.shift_id = $3)
      ORDER BY b.cooked_at DESC
    `, [today, status || null, shift_id || null]);
    res.json({ batches: batches.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/production/batches ── record a new production batch
// Also updates menu_item_stock so item list reflects available quantities
router.post('/batches', async (req, res) => {
  const { group_id, qty_cooked, shift_id, notes } = req.body;
  if (!group_id || !qty_cooked) return res.status(400).json({ error: 'group_id and qty_cooked required' });
  try {
    // Create the batch
    const b = await db.query(`
      INSERT INTO production_batches (group_id, qty_cooked, shift_id, cooked_by, notes)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [group_id, qty_cooked, shift_id || null, req.user.id, notes || null]);

    const batch = b.rows[0];

    // Get all menu items linked to this group
    const items = await db.query(`
      SELECT menu_item_id, portions FROM production_group_items WHERE group_id = $1
    `, [group_id]);

    // Update menu_item_stock for each linked item
    // qty_available = qty_cooked / portions (e.g. 10-cup flask uses 10 cups from tea batch)
    for (const { menu_item_id, portions } of items.rows) {
      const itemQty = Math.floor(qty_cooked / portions);
      await db.query(`
        INSERT INTO menu_item_stock (menu_item_id, qty_available, updated_at)
        VALUES ($1, $2, now())
        ON CONFLICT (menu_item_id) DO UPDATE
        SET qty_available = menu_item_stock.qty_available + $2,
            updated_at = now()
      `, [menu_item_id, itemQty]);
    }

    // Log in production_log for compatibility
    await db.query(`
      INSERT INTO production_log (menu_item_id, qty_produced, produced_by, notes)
      SELECT menu_item_id, $1 / portions, $2, $3
      FROM production_group_items WHERE group_id = $4
    `, [qty_cooked, req.user.id, notes || null, group_id]);

    res.json({ batch });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/production/batches/:id/close ── end of shift: carry over or waste
router.post('/batches/:id/close', async (req, res) => {
  const { decision, qty, notes } = req.body;
  if (!decision) return res.status(400).json({ error: 'decision required' });
  try {
    // Get batch info
    const batchRes = await db.query('SELECT * FROM production_batches WHERE id=$1', [req.params.id]);
    const batch = batchRes.rows[0];
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    // Update batch status
    await db.query('UPDATE production_batches SET status=$1, closed_at=now() WHERE id=$2', [decision, req.params.id]);

    // Record the decision
    await db.query(
      'INSERT INTO production_carryover (batch_id, qty, decision, decided_by, notes) VALUES ($1,$2,$3,$4,$5)',
      [req.params.id, qty || batch.qty_remaining, decision, req.user.id, notes || null]
    );

    // If wasted, deduct remaining from menu_item_stock
    if (decision === 'wasted') {
      const items = await db.query(
        'SELECT menu_item_id, portions FROM production_group_items WHERE group_id = $1',
        [batch.group_id]
      );
      for (const { menu_item_id, portions } of items.rows) {
        const deductQty = Math.floor(batch.qty_remaining / portions);
        await db.query(`
          UPDATE menu_item_stock
          SET qty_available = GREATEST(0, qty_available - $1), updated_at = now()
          WHERE menu_item_id = $2
        `, [deductQty, menu_item_id]);
      }
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/production/sale-deduct ── called when sale is made
router.post('/sale-deduct', async (req, res) => {
  const { items } = req.body;
  if (!items?.length) return res.json({ ok: true });
  try {
    for (const { menu_item_id, qty } of items) {
      // Find which groups this menu item belongs to
      const groups = await db.query(`
        SELECT gi.group_id, gi.portions
        FROM production_group_items gi
        WHERE gi.menu_item_id = $1
      `, [menu_item_id]);

      for (const { group_id, portions } of groups.rows) {
        const deductQty = qty * portions;
        // Deduct from oldest active batch first (FIFO)
        await db.query(`
          UPDATE production_batches
          SET qty_sold = LEAST(qty_cooked, qty_sold + $1)
          WHERE id = (
            SELECT id FROM production_batches
            WHERE group_id = $2 AND status = 'active'
              AND qty_sold < qty_cooked
            ORDER BY cooked_at ASC
            LIMIT 1
          )
        `, [deductQty, group_id]);
      }
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/production/live ── live remainder tracker
router.get('/live', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await db.query(`
      SELECT 
        g.id as group_id, g.name, g.unit,
        COALESCE(SUM(b.qty_cooked), 0) as total_cooked,
        COALESCE(SUM(b.qty_sold), 0) as total_sold,
        COALESCE(SUM(b.qty_remaining), 0) as total_remaining,
        MAX(b.cooked_at) as last_cooked
      FROM production_groups g
      LEFT JOIN production_batches b ON b.group_id = g.id 
        AND b.cooked_at::date = $1
        AND b.status = 'active'
      GROUP BY g.id, g.name, g.unit
      ORDER BY total_cooked DESC, g.name
    `, [today]);
    res.json({ live: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
