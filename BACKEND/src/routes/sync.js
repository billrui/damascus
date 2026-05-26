/**
 * routes/sync.js
 *
 * POST /api/sync          — flush a batch of offline operations to the DB
 * GET  /api/sync/status   — get sync queue status for a device
 *
 * The client sends operations it collected while offline.
 * Each operation is processed in the order it was created on the device (client_ts).
 * Idempotency is handled per-operation type.
 */

import { Router } from 'express';
import { z }      from 'zod';
import { db }     from '../config/db.js';
import { verifyJWT } from '../middleware/auth.js';
import { validate }  from '../middleware/validate.js';

const router = Router();
router.use(verifyJWT);

// ─── Schema ───────────────────────────────────────────────────────────────────

const syncOpSchema = z.object({
  operation:  z.enum([
    'CREATE_SALE',
    'CREATE_HOLD',
    'UPDATE_HOLD',
    'RECEIVE_BATCH',
    'RECORD_WASTAGE',
    'RECORD_ISSUE',
  ]),
  payload:    z.record(z.unknown()),
  client_ts:  z.string().datetime().optional(),
  client_id:  z.string().max(100).optional(),   // local ID assigned by client
});

const syncBatchSchema = z.object({
  device_id:  z.string().max(100).optional(),
  operations: z.array(syncOpSchema).min(1).max(100),
});

// ─── POST /api/sync ───────────────────────────────────────────────────────────
router.post('/', validate(syncBatchSchema), async (req, res, next) => {
  try {
    const { device_id, operations } = req.body;

    // Sort by client timestamp so they're applied in the order they happened offline
    const sorted = [...operations].sort((a, b) => {
      const ta = a.client_ts ? new Date(a.client_ts) : 0;
      const tb = b.client_ts ? new Date(b.client_ts) : 0;
      return ta - tb;
    });

    const results = [];

    for (const op of sorted) {
      // Log op in sync_queue table for traceability
      const { rows: queueRows } = await db.query(
        `INSERT INTO sync_queue (device_id, user_id, operation, payload, client_ts, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING id`,
        [device_id || null, req.user.sub, op.operation,
         JSON.stringify(op.payload), op.client_ts || null]
      );

      const queueId = queueRows[0].id;

      try {
        const result = await processOperation(op, req.user, device_id);
        await db.query(
          `UPDATE sync_queue SET status='processed', processed_at=now() WHERE id=$1`,
          [queueId]
        );
        results.push({ operation: op.operation, client_id: op.client_id, ok: true, result });
      } catch (err) {
        await db.query(
          `UPDATE sync_queue SET status='failed', error=$1, processed_at=now() WHERE id=$2`,
          [err.message, queueId]
        );
        results.push({ operation: op.operation, client_id: op.client_id, ok: false, error: err.message });
      }
    }

    const succeeded = results.filter(r => r.ok).length;
    const failed    = results.filter(r => !r.ok).length;

    res.json({
      processed: results.length,
      succeeded,
      failed,
      results,
    });
  } catch (err) { next(err); }
});

// ─── GET /api/sync/status ─────────────────────────────────────────────────────
router.get('/status', async (req, res, next) => {
  try {
    const device_id = req.query.device_id;

    const { rows } = await db.query(
      `SELECT
         status,
         COUNT(*)                    AS count,
         MAX(received_at)            AS last_received,
         MAX(processed_at)           AS last_processed
       FROM sync_queue
       WHERE ($1::text IS NULL OR device_id = $1)
         AND user_id = $2
         AND received_at > now() - interval '7 days'
       GROUP BY status`,
      [device_id || null, req.user.sub]
    );

    res.json({ status: rows });
  } catch (err) { next(err); }
});

// ─── Operation processor ──────────────────────────────────────────────────────

async function processOperation(op, user, device_id) {
  const { operation, payload } = op;

  switch (operation) {

    case 'CREATE_SALE': {
      // Check idempotency via offline_id
      if (payload.offline_id) {
        const { rows: existing } = await db.query(
          `SELECT id FROM sales WHERE offline_id = $1`, [payload.offline_id]
        );
        if (existing[0]) return { sale_id: existing[0].id, duplicate: true };
      }

      // Minimal sale insert for offline sync
      // (full FEFO deduction was already handled locally; stock will reconcile on next audit)
      const items = payload.items || [];
      const total = payload.total || 0;

      const { rows: seqRows } = await db.query(`SELECT nextval('invoice_seq') AS n`);
      const invoice_id = `INV-${String(seqRows[0].n).padStart(6, '0')}`;

      await db.transaction(async (client) => {
        await client.query(
          `INSERT INTO sales
             (id, sale_date, sale_time, customer, table_no, total, payment, payment_ref,
              cashier_id, waiter_id, offline_id, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'paid')`,
          [invoice_id,
           payload.sale_date || new Date().toISOString().split('T')[0],
           payload.sale_time || null,
           payload.customer  || 'Walk-in',
           payload.table_no  || null,
           total,
           payload.payment   || 'cash',
           payload.payment_ref || null,
           user.sub,
           payload.waiter_id || null,
           payload.offline_id || null]
        );

        for (const item of items) {
          await client.query(
            `INSERT INTO sale_items (sale_id, menu_item_id, name, qty, unit_price, line_total)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [invoice_id, item.menu_item_id, item.name || item.menu_item_id,
             item.qty, item.unit_price || 0, (item.unit_price || 0) * item.qty]
          );
        }
      });

      return { sale_id: invoice_id };
    }

    case 'CREATE_HOLD': {
      const { rows: seqRows } = await db.query(`SELECT nextval('hold_seq') AS n`);
      const hold_ref = `HOLD-${String(seqRows[0].n).padStart(5, '0')}`;

      const { rows } = await db.query(
        `INSERT INTO hold_orders (hold_ref, table_no, waiter_id, items, total, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [hold_ref, payload.table_no || null, user.sub,
         JSON.stringify(payload.items || []), payload.total || 0]
      );

      return { hold_id: rows[0]?.id };
    }

    case 'RECEIVE_BATCH': {
      const { rows: maxId } = await db.query(
        `SELECT id FROM batches ORDER BY created_at DESC LIMIT 1`
      );
      const lastNum = maxId[0] ? parseInt(maxId[0].id.replace(/\D/g, ''), 10) : 0;
      const newId   = `B${String(lastNum + 1).padStart(3, '0')}`;

      const { rows } = await db.query(
        `INSERT INTO batches
           (id, ingredient_id, batch_no, qty, remaining, expiry, location, cost_per_unit, received_by, status)
         VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,'active')
         RETURNING id`,
        [newId, payload.ingredient_id, payload.batch_no || null,
         payload.qty, payload.expiry || null, payload.location || 'Main Store',
         payload.cost_per_unit || null, user.sub]
      );

      return { batch_id: rows[0].id };
    }

    case 'RECORD_WASTAGE': {
      const { rows: seqRows } = await db.query(`SELECT nextval('wastage_seq') AS n`);
      const wastage_ref = `W-${String(seqRows[0].n).padStart(6, '0')}`;

      const { rows: ingRows } = await db.query(
        `SELECT cost_per_unit FROM ingredients WHERE id = $1`, [payload.ingredient_id]
      );
      const value = (ingRows[0]?.cost_per_unit || 0) * (payload.qty || 0);

      await db.query(
        `INSERT INTO wastage (wastage_ref, wastage_date, ingredient_id, qty, reason, value, recorded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [wastage_ref,
         payload.wastage_date || new Date().toISOString().split('T')[0],
         payload.ingredient_id, payload.qty, payload.reason || 'other',
         value, user.sub]
      );

      return { ok: true };
    }

    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

export default router;
