/**
 * routes/shifts.js
 *
 * POST /api/shifts/open      — open a new shift (cashier/manager/admin)
 * GET  /api/shifts           — list shifts with filters
 * GET  /api/shifts/active    — get the currently open shift
 * GET  /api/shifts/:id       — shift detail + all its sales
 * POST /api/shifts/:id/close — close a shift with actual cash count
 * GET  /api/shifts/:id/zreport — generate Z-report PDF (stream)
 */

import { Router }     from 'express';
import { z }          from 'zod';
import { db }         from '../config/db.js';
import { verifyJWT, requirePermission } from '../middleware/auth.js';
import { validate, validateQuery, paginationSchema } from '../middleware/validate.js';
import { nextShiftRef } from '../services/stockService.js';
import { generateZReportPDF } from '../services/receiptService.js';
import { sendWhatsAppText, sendWhatsAppPDF } from '../services/whatsappService.js';
import { env } from '../config/env.js';

const router = Router();
router.use(verifyJWT);

// ─── Schemas ──────────────────────────────────────────────────────────────────

const openShiftSchema = z.object({
  opening_float: z.coerce.number().min(0).default(0),
  notes:         z.string().max(500).optional(),
});

const closeShiftSchema = z.object({
  closing_cash:  z.coerce.number().min(0),
  closing_mpesa: z.coerce.number().min(0).default(0),
  notes:        z.string().max(500).optional(),
});

const listShiftsSchema = paginationSchema.extend({
  status:   z.enum(['open','closed','all']).default('all'),
  cashier:  z.coerce.number().int().optional(),
  from:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ─── GET /api/shifts ──────────────────────────────────────────────────────────
router.get('/', requirePermission('shift'), validateQuery(listShiftsSchema), async (req, res, next) => {
  try {
    const { page, limit, status, cashier, from, to } = req.query;
    const offset = (page - 1) * limit;

    const conditions = [];
    const params     = [];
    let   idx        = 1;

    if (status !== 'all') { conditions.push(`s.status = $${idx++}`); params.push(status); }
    if (cashier)          { conditions.push(`s.opened_by = $${idx++}`); params.push(cashier); }
    if (from)             { conditions.push(`s.opened_at::date >= $${idx++}`); params.push(from); }
    if (to)               { conditions.push(`s.opened_at::date <= $${idx++}`); params.push(to); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await db.query(
      `SELECT
         s.id, s.shift_ref, s.status, s.opening_float, s.closing_cash, s.closing_mpesa,
         s.opened_at, s.closed_at, s.total_sales, s.total_covers, s.notes,
         u1.name AS opened_by_name,
         u2.name AS closed_by_name
       FROM shifts s
       LEFT JOIN users u1 ON u1.id = s.opened_by
       LEFT JOIN users u2 ON u2.id = s.closed_by
       ${where}
       ORDER BY s.opened_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    );

    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) FROM shifts s ${where}`,
      params
    );

    res.json({
      shifts: rows,
      total:  parseInt(countRows[0].count),
      page,
      limit,
    });
  } catch (err) { next(err); }
});

// ─── GET /api/shifts/active ───────────────────────────────────────────────────
router.get('/active', requirePermission('shift'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT s.*, u.name AS opened_by_name
       FROM shifts s
       LEFT JOIN users u ON u.id = s.opened_by
       WHERE s.status = 'open'
       ORDER BY s.opened_at DESC
       LIMIT 1`
    );
    res.json({ shift: rows[0] || null });
  } catch (err) { next(err); }
});

// ─── GET /api/shifts/:id ──────────────────────────────────────────────────────
router.get('/:id', requirePermission('shift'), async (req, res, next) => {
  try {
    const { rows: shiftRows } = await db.query(
      `SELECT s.*,
         u1.name AS opened_by_name,
         u2.name AS closed_by_name
       FROM shifts s
       LEFT JOIN users u1 ON u1.id = s.opened_by
       LEFT JOIN users u2 ON u2.id = s.closed_by
       WHERE s.id = $1`,
      [req.params.id]
    );

    if (!shiftRows[0]) return res.status(404).json({ error: 'Shift not found' });

    // All sales in this shift
    const { rows: salesRows } = await db.query(
      `SELECT
         sa.id, sa.sale_date, sa.sale_time, sa.customer, sa.table_no,
         sa.total, sa.payment, sa.status,
         u.name AS cashier_name,
         json_agg(json_build_object(
           'name', si.name, 'qty', si.qty, 'unit_price', si.unit_price, 'line_total', si.line_total
         )) AS items
       FROM sales sa
       LEFT JOIN users u ON u.id = sa.cashier_id
       LEFT JOIN sale_items si ON si.sale_id = sa.id
       WHERE sa.shift_id = $1
       GROUP BY sa.id, u.name
       ORDER BY sa.sale_date, sa.sale_time`,
      [req.params.id]
    );

    res.json({ shift: shiftRows[0], sales: salesRows });
  } catch (err) { next(err); }
});

// ─── POST /api/shifts/open ────────────────────────────────────────────────────
router.post('/open', requirePermission('shift'), validate(openShiftSchema), async (req, res, next) => {
  try {
    // Prevent opening a second shift if one is already open
    const { rows: existing } = await db.query(
      `SELECT id FROM shifts WHERE status = 'open' LIMIT 1`
    );
    if (existing[0]) {
      return res.status(409).json({
        error:   'Conflict',
        message: 'A shift is already open. Close it before opening a new one.',
        shift_id: existing[0].id,
      });
    }

    const { opening_float, notes } = req.body;

    const shift = await db.transaction(async (client) => {
      const shift_ref = await nextShiftRef(client);

      const { rows } = await client.query(
        `INSERT INTO shifts (shift_ref, opened_by, opened_at, opening_float, status, notes)
         VALUES ($1, $2, now(), $3, 'open', $4)
         RETURNING *`,
        [shift_ref, req.user.sub, opening_float, notes || null]
      );

      await client.query(
        `INSERT INTO audit_log (user_id, action, entity, entity_id, ip_address)
         VALUES ($1, 'OPEN_SHIFT', 'shifts', $2, $3)`,
        [req.user.sub, String(rows[0].id), req.ip]
      );

      return rows[0];
    });

    res.status(201).json({ shift });
  } catch (err) { next(err); }
});

// ─── POST /api/shifts/:id/close ───────────────────────────────────────────────
router.post('/:id/close', requirePermission('shift'), validate(closeShiftSchema), async (req, res, next) => {
  try {
    const shiftId = req.params.id;

    const { rows: shiftRows } = await db.query(
      `SELECT * FROM shifts WHERE id = $1`, [shiftId]
    );
    if (!shiftRows[0])           return res.status(404).json({ error: 'Shift not found' });
    if (shiftRows[0].status !== 'open') {
      return res.status(409).json({ error: 'Shift is already closed' });
    }

    // Aggregate sales totals for the shift
    const { rows: totals } = await db.query(
      `SELECT
         COALESCE(SUM(total), 0)  AS total_sales,
         COUNT(*)                 AS total_covers
       FROM sales
       WHERE shift_id = $1 AND status = 'paid'`,
      [shiftId]
    );

    const { closing_cash, closing_mpesa = 0, notes } = req.body;

    const shift = await db.transaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE shifts
         SET status        = 'closed',
             closed_by     = $1,
             closed_at     = now(),
             closing_cash  = $2,
             closing_mpesa = $3,
             total_sales   = $4,
             total_covers  = $5,
             notes         = COALESCE($6, notes)
         WHERE id = $7
         RETURNING *`,
        [req.user.sub, closing_cash, closing_mpesa, totals[0].total_sales,
         totals[0].total_covers, notes || null, shiftId]
      );

      await client.query(
        `INSERT INTO audit_log (user_id, action, entity, entity_id, ip_address)
         VALUES ($1, 'CLOSE_SHIFT', 'shifts', $2, $3)`,
        [req.user.sub, shiftId, req.ip]
      );

      return rows[0];
    });

    // Summary for Z-report display
    const { rows: breakdown } = await db.query(
      `SELECT payment, SUM(total) AS amount, COUNT(*) AS transactions
       FROM sales
       WHERE shift_id = $1 AND status = 'paid'
       GROUP BY payment`,
      [shiftId]
    );

    const cashSales  = breakdown.filter(b => b.payment === 'cash')
                                .reduce((s, b) => s + parseFloat(b.amount), 0);
    const mpesaSales = breakdown.filter(b => /mpesa|m-pesa/i.test(b.payment))
                                .reduce((s, b) => s + parseFloat(b.amount), 0);
    const expected_cash  = parseFloat(shiftRows[0].opening_float) + cashSales;
    const expected_mpesa = mpesaSales;   // M-Pesa has no float — expected = M-Pesa sales

    const summary = {
      total_sales:       parseFloat(totals[0].total_sales),
      total_covers:      parseInt(totals[0].total_covers),
      opening_float:     parseFloat(shiftRows[0].opening_float),
      closing_cash,
      closing_mpesa,
      expected_cash,
      expected_mpesa,
      cash_variance:     closing_cash  - expected_cash,
      mpesa_variance:    closing_mpesa - expected_mpesa,
      payment_breakdown: breakdown,
    };

    res.json({ shift, summary });

    // ── Fire-and-forget: generate Z-Report PDF and send via WhatsApp ──────────
    if (env.ADMIN_WHATSAPP && env.WHATSAPP_TOKEN) {
      setImmediate(async () => {
        try {
          const business = {
            name:    env.BUSINESS_NAME,
            address: env.BUSINESS_ADDRESS,
            tel:     env.BUSINESS_TEL,
            vat:     env.BUSINESS_VAT,
          };

          const pdfPath = await generateZReportPDF({
            shift:   { ...shift, opened_by_name: shift.opened_by_name || 'Staff' },
            summary,
            business,
          });

          const variance  = closing_cash - summary.expected_cash;
          const varText   = variance === 0 ? 'Balanced' : variance > 0 ? `Over KES ${variance}` : `Short KES ${Math.abs(variance)}`;
          const caption   = [
            `*Damascus Hotel — Z Report*`,
            `Shift: ${shift.shift_ref}`,
            `Cashier: ${shift.opened_by_name || 'Staff'}`,
            `Date: ${new Date(shift.opened_at).toLocaleDateString('en-KE')}`,
            `Revenue: KES ${summary.total_sales.toLocaleString()}`,
            `Cash: ${varText}`,
          ].join('\n');

          await sendWhatsAppPDF(env.ADMIN_WHATSAPP, pdfPath, caption);
          console.log(`📲  Z-Report sent to ${env.ADMIN_WHATSAPP}`);
        } catch (e) {
          console.error('WhatsApp Z-Report send failed:', e.message);
        }
      });
    }
  } catch (err) { next(err); }
});

export default router;
