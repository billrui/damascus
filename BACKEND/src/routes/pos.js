/**
 * routes/pos.js
 *
 * POST   /api/pos/sales              — create a sale (FEFO deduction + receipt)
 * GET    /api/pos/sales              — list sales (paginated + filtered)
 * GET    /api/pos/sales/:id          — single sale with items
 * POST   /api/pos/sales/:id/void     — void a sale (manager+)
 * GET    /api/pos/receipts/:id       — stream receipt PDF
 * GET    /api/pos/receipts/:id/escpos — raw ESC/POS bytes for thermal printer
 *
 * POST   /api/pos/holds              — create a hold order (waiter → KDS)
 * GET    /api/pos/holds              — list holds
 * PATCH  /api/pos/holds/:id          — update hold status
 * DELETE /api/pos/holds/:id          — remove hold
 *
 * POST   /api/pos/invoices           — create open invoice (waiter → cashier)
 * GET    /api/pos/invoices           — list open invoices
 * PATCH  /api/pos/invoices/:id       — update invoice (add items, set discount)
 */

import { Router }   from 'express';
import { z }        from 'zod';
import path         from 'path';
import { db }       from '../config/db.js';
import { env }      from '../config/env.js';
import { verifyJWT, requirePermission, requireRole } from '../middleware/auth.js';
import { validate, validateQuery, paginationSchema, dateRangeSchema } from '../middleware/validate.js';
import { strictLimiter } from '../middleware/rateLimit.js';
import { deductStockFEFO, nextInvoiceId, nextHoldRef } from '../services/stockService.js';
import { generateReceiptPDF, streamReceiptPDF, generateEscPos } from '../services/receiptService.js';
import { printRaw, buildPrebillEscPos } from '../services/printerService.js';
import {
  emitSaleCompleted,
  emitHoldCreated,
  emitHoldUpdated,
  emitHoldDeleted,
  emitInvoiceCreated,
  emitInvoiceUpdated,
  emitLowStock,
} from '../realtime/socketServer.js';

const router = Router();
router.use(verifyJWT);

const business = {
  name:    env.BUSINESS_NAME,
  address: env.BUSINESS_ADDRESS,
  tel:     env.BUSINESS_TEL,
  vat:     env.BUSINESS_VAT,
};

// ─── Schemas ──────────────────────────────────────────────────────────────────

const saleItemSchema = z.object({
  menu_item_id: z.string().min(1),
  qty:          z.coerce.number().int().min(1),
  unit_price:   z.coerce.number().min(0),          // price at time of sale
  name:         z.string().optional(),             // snapshot
});

const createSaleSchema = z.object({
  items:        z.array(saleItemSchema).min(1),
  customer:     z.string().max(100).default('Walk-in'),
  table_no:     z.string().max(20).optional(),
  payment:      z.enum(['cash','card','mpesa','credit','split']),
  payment_ref:  z.string().max(100).optional(),
  tendered:     z.coerce.number().optional(),
  discount_pct: z.coerce.number().min(0).max(100).default(0),
  waiter_id:    z.coerce.number().int().optional(),
  shift_id:     z.coerce.number().int().optional(),
  offline_id:   z.string().max(100).optional(),    // for idempotency when syncing offline
});

const voidSaleSchema = z.object({
  reason: z.string().min(3).max(500),
});

const holdSchema = z.object({
  table_no:  z.string().max(20).optional(),
  items:     z.array(z.object({
    menu_item_id: z.string(),
    name:         z.string(),
    qty:          z.coerce.number().int().min(1),
    price:        z.coerce.number(),
    note:         z.string().max(500).optional(),
  })).min(1),
  total:     z.coerce.number(),
  notes:     z.string().max(500).optional(),
});

const updateHoldSchema = z.object({
  status: z.enum(['pending','billed','bumped','cancelled']),
  notes:  z.string().max(500).optional(),
});

// ══════════════════════════════════════════════════════════════════════════════
// SALES
// ══════════════════════════════════════════════════════════════════════════════

// ─── POST /api/pos/sales ──────────────────────────────────────────────────────
router.post('/sales', requirePermission('pos'), strictLimiter, validate(createSaleSchema), async (req, res, next) => {
  try {
    const {
      items, customer, table_no, payment, payment_ref,
      tendered, discount_pct, waiter_id, shift_id, offline_id,
    } = req.body;

    // Idempotency: if this offline_id was already processed, return the existing sale
    if (offline_id) {
      const { rows: existing } = await db.query(
        `SELECT id FROM sales WHERE offline_id = $1`, [offline_id]
      );
      if (existing[0]) {
        const { rows } = await db.query(
          `SELECT sa.*, json_agg(si.*) AS items
           FROM sales sa
           LEFT JOIN sale_items si ON si.sale_id = sa.id
           WHERE sa.id = $1 GROUP BY sa.id`,
          [existing[0].id]
        );
        return res.status(200).json({ sale: rows[0], duplicate: true });
      }
    }

    // Fetch menu item prices/names to build snapshot + compute total
    const menuIds = [...new Set(items.map(i => i.menu_item_id))];
    const { rows: menuRows } = await db.query(
      `SELECT id, name, price, cost FROM menu_items WHERE id = ANY($1)`,
      [menuIds]
    );
    const menuMap = Object.fromEntries(menuRows.map(m => [m.id, m]));

    // Calculate totals
    const subtotal     = items.reduce((s, i) => {
      const price = i.unit_price || menuMap[i.menu_item_id]?.price || 0;
      return s + price * i.qty;
    }, 0);
    const discount_amt = Math.round(subtotal * discount_pct / 100);
    const total        = subtotal - discount_amt;
    const change_due   = tendered ? Math.max(0, tendered - total) : 0;

    // Run everything in a single transaction
    const { sale, lowStockAlerts } = await db.transaction(async (client) => {

      const invoice_id = await nextInvoiceId(client);

      // Insert sale header
      const { rows: saleRows } = await client.query(
        `INSERT INTO sales
           (id, sale_date, sale_time, customer, table_no, shift_id,
            subtotal, discount_pct, discount_amt, total,
            payment, payment_ref, cashier_id, waiter_id, offline_id, status)
         VALUES
           ($1, CURRENT_DATE, CURRENT_TIME, $2, $3, $4,
            $5, $6, $7, $8,
            $9, $10, $11, $12, $13, 'paid')
         RETURNING *`,
        [invoice_id, customer, table_no || null, shift_id || null,
         subtotal, discount_pct, discount_amt, total,
         payment, payment_ref || null, req.user.sub, waiter_id || null, offline_id || null]
      );

      const sale = saleRows[0];

      // Insert sale items (snapshot names + prices)
      for (const item of items) {
        const menu     = menuMap[item.menu_item_id];
        const price    = item.unit_price || menu?.price || 0;
        const itemName = item.name       || menu?.name  || item.menu_item_id;
        const cost     = menu?.cost || 0;

        await client.query(
          `INSERT INTO sale_items
             (sale_id, menu_item_id, name, qty, unit_price, unit_cost, line_total)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [invoice_id, item.menu_item_id, itemName, item.qty, price, cost, price * item.qty]
        );
      }

      // FEFO stock deduction is now handled at production time.
      // On sale: just deduct from menu_item_stock (prepared units).
      const lowStockAlerts = [];
      for (const item of items) {
        await client.query(
          `UPDATE menu_item_stock
           SET qty_available = GREATEST(0, qty_available - $1), updated_at = now()
           WHERE menu_item_id = $2`,
          [item.qty, item.menu_item_id]
        );
      }

      // Update shift totals if shift is specified
      if (shift_id) {
        await client.query(
          `UPDATE shifts
           SET total_sales  = total_sales  + $1,
               total_covers = total_covers + 1
           WHERE id = $2`,
          [total, shift_id]
        );
      }

      // Audit log
      await client.query(
        `INSERT INTO audit_log (user_id, action, entity, entity_id, payload, ip_address)
         VALUES ($1, 'CREATE_SALE', 'sales', $2, $3, $4)`,
        [req.user.sub, invoice_id, JSON.stringify({ total, payment, items: items.length }), req.ip]
      );

      return { sale, lowStockAlerts };
    });

    // Fetch complete sale with items for receipt
    const { rows: fullSale } = await db.query(
      `SELECT
         sa.*,
         u1.name AS cashier_name,
         u2.name AS waiter_name,
         json_agg(json_build_object(
           'menu_item_id', si.menu_item_id,
           'name',         si.name,
           'qty',          si.qty,
           'unit_price',   si.unit_price,
           'unit_cost',    si.unit_cost,
           'line_total',   si.line_total
         )) AS items
       FROM sales sa
       LEFT JOIN users u1 ON u1.id = sa.cashier_id
       LEFT JOIN users u2 ON u2.id = sa.waiter_id
       LEFT JOIN sale_items si ON si.sale_id = sa.id
       WHERE sa.id = $1
       GROUP BY sa.id, u1.name, u2.name`,
      [sale.id]
    );

    const completeSale = { ...fullSale[0], change_due, tendered };

    // Generate receipt PDF (async — don't await, client gets sale immediately)
    generateReceiptPDF(completeSale, business)
      .then(filepath => {
        const relPath = path.relative(process.cwd(), filepath);
        db.query(`UPDATE sales SET receipt_path = $1 WHERE id = $2`, [relPath, sale.id]);
      })
      .catch(err => console.error('Receipt PDF generation failed:', err.message));

    // Emit realtime events
    emitSaleCompleted({
      id:       completeSale.id,
      total:    completeSale.total,
      payment:  completeSale.payment,
      table_no: completeSale.table_no,
      ts:       new Date().toISOString(),
    });

    if (lowStockAlerts.length > 0) {
      emitLowStock(lowStockAlerts);
    }

    res.status(201).json({ sale: completeSale });
  } catch (err) { next(err); }
});

// ─── GET /api/pos/sales ───────────────────────────────────────────────────────
router.get('/sales', requirePermission('pos'), validateQuery(dateRangeSchema), async (req, res, next) => {
  try {
    const { page, limit, from, to } = req.query;
    const offset = (page - 1) * limit;

    const conditions = ["sa.status != 'void'"];
    const params     = [];
    let   idx        = 1;

    if (from) { conditions.push(`sa.sale_date >= $${idx++}`); params.push(from); }
    if (to)   { conditions.push(`sa.sale_date <= $${idx++}`); params.push(to); }

    // Non-admins only see their own sales
    if (!['admin','manager'].includes(req.user.role)) {
      conditions.push(`sa.cashier_id = $${idx++}`);
      params.push(req.user.sub);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const { rows } = await db.query(
      `SELECT
         sa.id, sa.sale_date, sa.sale_time, sa.customer, sa.table_no,
         sa.subtotal, sa.discount_amt, sa.total, sa.payment, sa.status,
         u.name AS cashier_name
       FROM sales sa
       LEFT JOIN users u ON u.id = sa.cashier_id
       ${where}
       ORDER BY sa.sale_date DESC, sa.sale_time DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    );

    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) FROM sales sa ${where}`, params
    );

    res.json({ sales: rows, total: parseInt(countRows[0].count), page, limit });
  } catch (err) { next(err); }
});

// ─── GET /api/pos/sales/:id ───────────────────────────────────────────────────
router.get('/sales/:id', requirePermission('pos'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT
         sa.*,
         u1.name AS cashier_name,
         u2.name AS waiter_name,
         json_agg(json_build_object(
           'id', si.id, 'menu_item_id', si.menu_item_id,
           'name', si.name, 'qty', si.qty,
           'unit_price', si.unit_price, 'line_total', si.line_total
         )) AS items
       FROM sales sa
       LEFT JOIN users u1 ON u1.id = sa.cashier_id
       LEFT JOIN users u2 ON u2.id = sa.waiter_id
       LEFT JOIN sale_items si ON si.sale_id = sa.id
       WHERE sa.id = $1
       GROUP BY sa.id, u1.name, u2.name`,
      [req.params.id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Sale not found' });
    res.json({ sale: rows[0] });
  } catch (err) { next(err); }
});

// ─── POST /api/pos/sales/:id/void ─────────────────────────────────────────────
router.post('/sales/:id/void', requireRole('admin','manager'), validate(voidSaleSchema), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM sales WHERE id = $1`, [req.params.id]
    );
    if (!rows[0])                    return res.status(404).json({ error: 'Sale not found' });
    if (rows[0].status !== 'paid')   return res.status(409).json({ error: 'Sale is not in paid status' });

    await db.query(
      `UPDATE sales
       SET status = 'void', void_reason = $1, voided_by = $2, voided_at = now()
       WHERE id = $3`,
      [req.body.reason, req.user.sub, req.params.id]
    );

    await db.query(
      `INSERT INTO audit_log (user_id, action, entity, entity_id, payload, ip_address)
       VALUES ($1, 'VOID_SALE', 'sales', $2, $3, $4)`,
      [req.user.sub, req.params.id, JSON.stringify({ reason: req.body.reason }), req.ip]
    );

    res.json({ ok: true, message: 'Sale voided' });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// RECEIPTS
// ══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/pos/receipts/:id ────────────────────────────────────────────────
router.get('/receipts/:id', requirePermission('pos'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT sa.*,
         u1.name AS cashier_name, u2.name AS waiter_name,
         json_agg(json_build_object(
           'name', si.name, 'qty', si.qty,
           'unit_price', si.unit_price, 'line_total', si.line_total
         )) AS items
       FROM sales sa
       LEFT JOIN users u1 ON u1.id = sa.cashier_id
       LEFT JOIN users u2 ON u2.id = sa.waiter_id
       LEFT JOIN sale_items si ON si.sale_id = sa.id
       WHERE sa.id = $1
       GROUP BY sa.id, u1.name, u2.name`,
      [req.params.id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Sale not found' });

    const sale = rows[0];

    // If receipt already exists on disk, stream it
    if (sale.receipt_path) {
      const abs = path.resolve(sale.receipt_path);
      streamReceiptPDF(abs, res);
      return;
    }

    // Otherwise generate on-demand
    const filepath = await generateReceiptPDF(sale, business);
    const relPath  = path.relative(process.cwd(), filepath);
    await db.query(`UPDATE sales SET receipt_path = $1 WHERE id = $2`, [relPath, sale.id]);
    streamReceiptPDF(filepath, res);
  } catch (err) { next(err); }
});

// ─── GET /api/pos/receipts/:id/escpos ─────────────────────────────────────────
router.get('/receipts/:id/escpos', requirePermission('pos'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT sa.*,
         u1.name AS cashier_name,
         json_agg(json_build_object(
           'name', si.name, 'qty', si.qty, 'unit_price', si.unit_price
         )) AS items
       FROM sales sa
       LEFT JOIN users u1 ON u1.id = sa.cashier_id
       LEFT JOIN sale_items si ON si.sale_id = sa.id
       WHERE sa.id = $1
       GROUP BY sa.id, u1.name`,
      [req.params.id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Sale not found' });

    const buffer = generateEscPos(rows[0], business);
    res.setHeader('Content-Type',   'application/octet-stream');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// HOLD ORDERS  (waiter → KDS → cashier)
// ══════════════════════════════════════════════════════════════════════════════

// ─── POST /api/pos/holds ──────────────────────────────────────────────────────
router.post('/holds', requirePermission('pos'), validate(holdSchema), async (req, res, next) => {
  try {
    console.log('🔍 HOLD ITEMS RECEIVED:', JSON.stringify(req.body.items?.slice(0,2)));
    const { table_no, items, total, notes } = req.body;

    const hold = await db.transaction(async (client) => {
      const hold_ref = await nextHoldRef(client);

      const { rows } = await client.query(
        `INSERT INTO hold_orders (hold_ref, table_no, waiter_id, items, total, notes, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING *`,
        [hold_ref, table_no || null, req.user.sub, JSON.stringify(items), total, notes || null]
      );
      return rows[0];
    });

    // Realtime: notify KDS and managers
    emitHoldCreated({
      ...hold,
      waiter_name: req.user.name,
    });

    res.status(201).json({ hold });
  } catch (err) { next(err); }
});

// ─── GET /api/pos/holds ───────────────────────────────────────────────────────
router.get('/holds', requirePermission('pos'), async (req, res, next) => {
  try {
    const { status } = req.query;

    let query = `
      SELECT h.*, u.name AS waiter_name
      FROM hold_orders h
      LEFT JOIN users u ON u.id = h.waiter_id
      WHERE h.status != 'cancelled'
    `;
    const params = [];

    if (status) {
      query += ` AND h.status = $1`;
      params.push(status);
    }

    query += ` ORDER BY h.created_at DESC`;

    // Waiters only see their own holds
    if (req.user.role === 'waiter') {
      query = query.replace('WHERE h.status', `WHERE h.waiter_id = ${req.user.sub} AND h.status`);
    }

    const { rows } = await db.query(query, params);
    res.json({ holds: rows });
  } catch (err) { next(err); }
});

// ─── PATCH /api/pos/holds/:id ────────────────────────────────────────────────
router.patch('/holds/:id', requirePermission(['pos','kds']), validate(updateHoldSchema), async (req, res, next) => {
  try {
    const { status, notes } = req.body;

    const { rows } = await db.query(
      `UPDATE hold_orders
       SET status = $1, notes = COALESCE($2, notes), updated_at = now()
       WHERE id = $3
       RETURNING *`,
      [status, notes || null, req.params.id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Hold not found' });

    emitHoldUpdated({ ...rows[0], status });
    res.json({ hold: rows[0] });
  } catch (err) { next(err); }
});

// ─── PATCH /api/pos/holds/:id/items — append items to existing hold ─────────
router.patch('/holds/:id/items', requirePermission('pos'), async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!items || !items.length) return res.status(400).json({ error: 'No items provided' });

    // Get existing hold
    const { rows: existing } = await db.query(
      'SELECT * FROM hold_orders WHERE id = $1', [req.params.id]
    );
    if (!existing[0]) return res.status(404).json({ error: 'Hold not found' });

    // Merge items
    const existingItems = typeof existing[0].items === 'string'
      ? JSON.parse(existing[0].items)
      : existing[0].items;
    const merged = [...existingItems, ...items];
    const newTotal = merged.reduce((s, i) => s + i.price * i.qty, 0);

    const { rows } = await db.query(
      `UPDATE hold_orders
       SET items = $1, total = $2, status = 'pending', updated_at = now()
       WHERE id = $3
       RETURNING *`,
      [JSON.stringify(merged), newTotal, req.params.id]
    );

    emitHoldUpdated({ ...rows[0], waiter_name: req.user.name });
    res.json({ hold: rows[0] });
  } catch (err) { next(err); }
});

// ─── GET /api/pos/holds/:id/prebill — generate customer pre-bill PDF ──────────
router.get('/holds/:id/prebill', async (req, res, next) => {
  // Allow token via query string for PDF browser tab opening
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = 'Bearer ' + req.query.token;
  }
  return requirePermission('pos')(req, res, next);
}, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM hold_orders WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Hold not found' });

    const hold  = rows[0];
    const items = typeof hold.items === 'string' ? JSON.parse(hold.items) : hold.items;
    const person = req.query.person || null;

    // Filter to specific person if requested
    const filtered = person
      ? items.filter(i => { const m=(i.note||'').match(/^\[([^\]]+)\]/); return m?m[1]===person:true; })
      : items;

    const sub   = filtered.reduce((s,i) => s + i.price * i.qty, 0);
    const TAX   = parseFloat(env.TAX_RATE  || '0.16');
    const SVC   = parseFloat(env.SVC_RATE  || '0.02');
    const tax   = sub * TAX;
    const svc   = sub * SVC;
    const total = sub + tax + svc;

    // Get business info from env
    const business = { name: env.BUSINESS_NAME || 'Damascus Hotel', address: env.BUSINESS_ADDRESS || '', tel: env.BUSINESS_TEL || '', vat: env.BUSINESS_VAT || '' };

    // Build simple PDF
    const PDFDocument = (await import('pdfkit')).default;
    const PAGE_WIDTH  = 226;
    const MARGIN      = 12;
    const CONTENT_W   = PAGE_WIDTH - MARGIN * 2;

    const doc = new PDFDocument({ size: [PAGE_WIDTH, 800], margin: MARGIN, autoFirstPage: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="prebill-${hold.id}${person?'-'+person:''}.pdf"`);
    doc.pipe(res);

    const fmt = n => 'KES ' + Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2 });

    // Header
    doc.font('Helvetica-Bold').fontSize(12)
       .text(business.name, MARGIN, MARGIN, { width: CONTENT_W, align: 'center' });
    if (business.address) doc.font('Helvetica').fontSize(8).text(business.address, { width: CONTENT_W, align: 'center' });
    if (business.tel)     doc.fontSize(8).text('Tel: ' + business.tel, { width: CONTENT_W, align: 'center' });

    doc.moveDown(0.3).moveTo(MARGIN, doc.y).lineTo(PAGE_WIDTH - MARGIN, doc.y).stroke();
    doc.moveDown(0.3);

    // Bill info
    doc.font('Helvetica-Bold').fontSize(9).text('PRE-BILL', { width: CONTENT_W, align: 'center' });
    doc.font('Helvetica').fontSize(8)
       .text('Table: ' + (hold.table_no || 'Walk-in') + (person ? '   Person: ' + person : ''), { width: CONTENT_W, align: 'center' })
       .text('Date: ' + new Date().toLocaleString('en-KE'), { width: CONTENT_W, align: 'center' });

    doc.moveDown(0.3).moveTo(MARGIN, doc.y).lineTo(PAGE_WIDTH - MARGIN, doc.y).stroke();
    doc.moveDown(0.3);

    // Items
    doc.font('Helvetica-Bold').fontSize(8);
    doc.text('Item', MARGIN, doc.y, { width: CONTENT_W * 0.55, continued: true });
    doc.text('Qty', { width: CONTENT_W * 0.15, align: 'center', continued: true });
    doc.text('Amount', { width: CONTENT_W * 0.30, align: 'right' });
    doc.moveDown(0.2).moveTo(MARGIN, doc.y).lineTo(PAGE_WIDTH - MARGIN, doc.y).stroke().moveDown(0.2);

    doc.font('Helvetica').fontSize(8);
    filtered.forEach(item => {
      const cleanNote = (item.note||'').replace(/^\[[^\]]+\]\s*/, '').trim();
      const name = item.name + (cleanNote ? ' (' + cleanNote + ')' : '');
      doc.text(name, MARGIN, doc.y, { width: CONTENT_W * 0.55, continued: true });
      doc.text(String(item.qty), { width: CONTENT_W * 0.15, align: 'center', continued: true });
      doc.text(fmt(item.price * item.qty), { width: CONTENT_W * 0.30, align: 'right' });
    });

    doc.moveDown(0.3).moveTo(MARGIN, doc.y).lineTo(PAGE_WIDTH - MARGIN, doc.y).stroke().moveDown(0.3);

    // Totals
    doc.font('Helvetica').fontSize(8);
    doc.text('Subtotal', MARGIN, doc.y, { width: CONTENT_W * 0.7, continued: true });
    doc.text(fmt(sub), { width: CONTENT_W * 0.30, align: 'right' });
    doc.text('Tax (' + Math.round(TAX*100) + '%)', MARGIN, doc.y, { width: CONTENT_W * 0.7, continued: true });
    doc.text(fmt(tax), { width: CONTENT_W * 0.30, align: 'right' });
    doc.text('Service (' + Math.round(SVC*100) + '%)', MARGIN, doc.y, { width: CONTENT_W * 0.7, continued: true });
    doc.text(fmt(svc), { width: CONTENT_W * 0.30, align: 'right' });

    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('TOTAL', MARGIN, doc.y, { width: CONTENT_W * 0.7, continued: true });
    doc.text(fmt(total), { width: CONTENT_W * 0.30, align: 'right' });

    doc.moveDown(0.5).moveTo(MARGIN, doc.y).lineTo(PAGE_WIDTH - MARGIN, doc.y).stroke().moveDown(0.3);
    doc.font('Helvetica').fontSize(7).text('Thank you for dining with us!', { width: CONTENT_W, align: 'center' });

    doc.end();
  } catch(err) { next(err); }
});

// ─── POST /api/pos/holds/:id/print — print pre-bill to thermal printer ─────────
router.post('/holds/:id/print', async (req, res, next) => {
  // Accept token from body if header missing (dynamic import quirk)
  if (req.body?.token && !req.headers.authorization) {
    req.headers.authorization = 'Bearer ' + req.body.token;
  }
  requirePermission('pos')(req, res, async (err) => {
    if (err) return next(err);
    try {
    const { person } = req.body;
    const { rows } = await db.query('SELECT * FROM hold_orders WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Hold not found' });

    const hold  = rows[0];
    // Parse items — could be array, JSON string, or object with nested items
    let rawItems = hold.items;
    if (typeof rawItems === 'string') rawItems = JSON.parse(rawItems);
    // If items is an object with an items property (invoice format)
    if (!Array.isArray(rawItems) && rawItems?.items) rawItems = rawItems.items;
    if (!Array.isArray(rawItems)) rawItems = [];

    // Filter to specific person if provided
    const filtered = person
      ? rawItems.filter(i => { const m=(i.note||'').match(/^\[([^\]]+)\]/); return m?m[1]===person:true; })
      : rawItems;

    // Get business info from env
    const business = { name: env.BUSINESS_NAME || 'Damascus Hotel', address: env.BUSINESS_ADDRESS || '', tel: env.BUSINESS_TEL || '', vat: env.BUSINESS_VAT || '' };

    const TAX = parseFloat(env.TAX_RATE || '0.16');
    const SVC = parseFloat(env.SVC_RATE || '0.02');

    // Receipt #1 — fire-and-forget to waiter thermal printer (never 500 on printer failure)
    const escData = buildPrebillEscPos({ hold, items: filtered, person, business, TAX, SVC });
    printRaw(escData).catch(err =>
      console.warn('⚠️  Waiter printer unreachable:', err.message)
    );

    res.json({ ok: true, message: 'Pre-bill sent' });
  } catch(err) {
    console.error('Print error:', err.message);
    res.status(500).json({ error: err.message });
    }
  });
});

// ─── DELETE /api/pos/holds/:id ────────────────────────────────────────────────
router.delete('/holds/:id', requirePermission('pos'), async (req, res, next) => {
  try {
    await db.query(
      `UPDATE hold_orders SET status = 'cancelled' WHERE id = $1`, [req.params.id]
    );
    emitHoldDeleted(parseInt(req.params.id));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// OPEN INVOICES  (waiter creates, cashier bills)
// ══════════════════════════════════════════════════════════════════════════════

// ─── POST /api/pos/invoices ───────────────────────────────────────────────────
router.post('/invoices', requirePermission('pos'), async (req, res, next) => {
  try {
    const { table_no, items, total, discount_pct = 0, customer } = req.body;

    const { rows: inv } = await db.query(
      `INSERT INTO hold_orders
         (hold_ref, table_no, waiter_id, items, total, status, notes)
       VALUES ($1, $2, $3, $4, $5, 'pending', 'open-invoice')
       RETURNING *`,
      [`INV-OPEN-${Date.now()}`, table_no, req.user.sub,
       JSON.stringify({ items, discount_pct, customer }), total]
    );

    // Parse items out of the nested storage format
    let parsedItems = [];
    try {
      const raw    = inv[0].items;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      parsedItems  = Array.isArray(parsed) ? parsed : (parsed?.items || []);
    } catch (_) {}

    const sub = parsedItems.reduce((s, i) => s + (i.price ?? i.unit_price ?? 0) * i.qty, 0);
    const TAX = parseFloat(env.TAX_RATE || '0.16');
    const SVC = parseFloat(env.SVC_RATE || '0.02');

    emitInvoiceCreated({
      id:        inv[0].id,
      holdId:    inv[0].hold_ref,
      table:     inv[0].table_no,
      waiter:    req.user.name,
      items:     parsedItems,
      subtotal:  sub,
      tax:       sub * TAX,
      service:   sub * SVC,
      total:     inv[0].total,
      status:    'open',
      createdAt: inv[0].created_at,
    });
    res.status(201).json({ invoice: inv[0] });
  } catch (err) { next(err); }
});

// ─── GET /api/pos/invoices ────────────────────────────────────────────────────
router.get('/invoices', requirePermission('pos'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT h.*, u.name AS waiter_name
       FROM hold_orders h
       LEFT JOIN users u ON u.id = h.waiter_id
       WHERE h.notes = 'open-invoice'
       ORDER BY h.created_at DESC`
    );

    const TAX = parseFloat(env.TAX_RATE || '0.16');
    const SVC = parseFloat(env.SVC_RATE || '0.02');

    // Normalize each row to the same shape the socket emits
    const invoices = rows.map(row => {
      let parsedItems = [];
      try {
        const raw    = row.items;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        parsedItems  = Array.isArray(parsed) ? parsed : (parsed?.items || []);
      } catch (_) {}

      const sub = parsedItems.reduce((s, i) => s + (i.price ?? i.unit_price ?? 0) * i.qty, 0);

      return {
        id:        row.id,
        holdId:    row.hold_ref,
        table:     row.table_no,
        waiter:    row.waiter_name,
        items:     parsedItems,
        subtotal:  sub,
        tax:       sub * TAX,
        service:   sub * SVC,
        total:     row.total,
        status:    row.status === 'pending' ? 'open' : row.status,
        createdAt: row.created_at,
      };
    });

    res.json({ invoices });
  } catch (err) { next(err); }
});

export default router;
