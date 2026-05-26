/**
 * routes/reports.js
 *
 * GET /api/reports/kpis       — today's headline KPIs (dashboard cards)
 * GET /api/reports/hourly     — hourly revenue for area chart
 * GET /api/reports/top-items  — top selling menu items
 * GET /api/reports/payments   — payment method breakdown
 * GET /api/reports/analytics  — full analytics (date range)
 * GET /api/reports/audit-log  — audit trail (admin)
 */

import { Router }  from 'express';
import { db }      from '../config/db.js';
import { verifyJWT, requirePermission, requireRole } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import { z } from 'zod';

const router = Router();
router.use(verifyJWT);

const dateRangeQ = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ─── GET /api/reports/kpis ────────────────────────────────────────────────────
router.get('/kpis', requirePermission('dashboard'), async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const dateFrom = from || new Date().toISOString().split('T')[0];
    const dateTo   = to   || dateFrom;

    const { rows } = await db.query(
      `SELECT
         COALESCE(SUM(total), 0)                                    AS revenue,
         COUNT(*)                                                    AS transactions,
         COALESCE(AVG(total), 0)                                    AS avg_ticket,
         COALESCE(SUM(CASE WHEN payment='cash'  THEN total END), 0) AS cash,
         COALESCE(SUM(CASE WHEN payment='card'  THEN total END), 0) AS card,
         COALESCE(SUM(CASE WHEN payment='mpesa' THEN total END), 0) AS mpesa
       FROM sales
       WHERE status = 'paid'
         AND sale_date BETWEEN $1 AND $2`,
      [dateFrom, dateTo]
    );

    // Expiry alerts count
    const { rows: expiryRows } = await db.query(
      `SELECT COUNT(*) FROM batches
       WHERE status = 'active'
         AND expiry IS NOT NULL
         AND expiry <= CURRENT_DATE + 7`
    );

    // Low stock count
    const { rows: lowRows } = await db.query(
      `SELECT COUNT(*) FROM (
         SELECT i.id
         FROM ingredients i
         LEFT JOIN batches b ON b.ingredient_id = i.id AND b.status = 'active'
         WHERE i.active = true
         GROUP BY i.id, i.reorder_level
         HAVING COALESCE(SUM(b.remaining), 0) <= i.reorder_level
       ) t`
    );

    // Yesterday comparison
    const yesterday = new Date(dateFrom);
    yesterday.setDate(yesterday.getDate() - 1);
    const yd = yesterday.toISOString().split('T')[0];

    const { rows: prevRows } = await db.query(
      `SELECT COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS transactions
       FROM sales WHERE status = 'paid' AND sale_date = $1`,
      [yd]
    );

    const today = rows[0];
    const prev  = prevRows[0];
    const revChange = prev.revenue > 0
      ? ((today.revenue - prev.revenue) / prev.revenue * 100).toFixed(1)
      : null;

    res.json({
      kpis: {
        revenue:       parseFloat(today.revenue),
        transactions:  parseInt(today.transactions),
        avg_ticket:    parseFloat(today.avg_ticket),
        cash:          parseFloat(today.cash),
        card:          parseFloat(today.card),
        mpesa:         parseFloat(today.mpesa),
        expiry_alerts: parseInt(expiryRows[0].count),
        low_stock:     parseInt(lowRows[0].count),
        vs_yesterday: {
          revenue:      parseFloat(prev.revenue),
          transactions: parseInt(prev.transactions),
          revenue_change_pct: revChange ? parseFloat(revChange) : null,
        },
      },
      period: { from: dateFrom, to: dateTo },
    });
  } catch (err) { next(err); }
});

// ─── GET /api/reports/hourly ──────────────────────────────────────────────────
router.get('/hourly', requirePermission('dashboard'), async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const { rows } = await db.query(
      `SELECT
         EXTRACT(HOUR FROM sale_time::time) AS hour,
         COALESCE(SUM(total), 0)            AS sales,
         COUNT(*)                           AS transactions
       FROM sales
       WHERE status = 'paid' AND sale_date = $1
       GROUP BY hour
       ORDER BY hour`,
      [date]
    );

    // Fill in missing hours (0–23) with zeros
    const hourly = Array.from({ length: 24 }, (_, h) => {
      const found = rows.find(r => parseInt(r.hour) === h);
      return {
        hour:         `${String(h).padStart(2,'0')}:00`,
        sales:        found ? parseFloat(found.sales) : 0,
        transactions: found ? parseInt(found.transactions) : 0,
      };
    });

    res.json({ hourly, date });
  } catch (err) { next(err); }
});

// ─── GET /api/reports/top-items ───────────────────────────────────────────────
router.get('/top-items', requirePermission('dashboard'), validateQuery(dateRangeQ.extend({
  limit: z.coerce.number().int().min(1).max(50).default(10),
})), async (req, res, next) => {
  try {
    const { from, to, limit } = req.query;
    const dateFrom = from || new Date().toISOString().split('T')[0];
    const dateTo   = to   || dateFrom;

    const { rows } = await db.query(
      `SELECT
         si.menu_item_id,
         si.name,
         SUM(si.qty)        AS qty,
         SUM(si.line_total) AS revenue,
         m.price,
         m.cost,
         m.emoji,
         m.category
       FROM sale_items si
       JOIN sales sa        ON sa.id = si.sale_id AND sa.status = 'paid'
                           AND sa.sale_date BETWEEN $1 AND $2
       LEFT JOIN menu_items m ON m.id = si.menu_item_id
       GROUP BY si.menu_item_id, si.name, m.price, m.cost, m.emoji, m.category
       ORDER BY qty DESC
       LIMIT $3`,
      [dateFrom, dateTo, limit]
    );

    res.json({ items: rows, period: { from: dateFrom, to: dateTo } });
  } catch (err) { next(err); }
});

// ─── GET /api/reports/payments ────────────────────────────────────────────────
router.get('/payments', requirePermission('dashboard'), validateQuery(dateRangeQ), async (req, res, next) => {
  try {
    const dateFrom = req.query.from || new Date().toISOString().split('T')[0];
    const dateTo   = req.query.to   || dateFrom;

    const { rows } = await db.query(
      `SELECT
         payment,
         COUNT(*)       AS transactions,
         SUM(total)     AS amount
       FROM sales
       WHERE status = 'paid'
         AND sale_date BETWEEN $1 AND $2
       GROUP BY payment
       ORDER BY amount DESC`,
      [dateFrom, dateTo]
    );

    res.json({ breakdown: rows, period: { from: dateFrom, to: dateTo } });
  } catch (err) { next(err); }
});

// ─── GET /api/reports/analytics ───────────────────────────────────────────────
router.get('/analytics', requirePermission('reports'), validateQuery(dateRangeQ), async (req, res, next) => {
  try {
    const today    = new Date().toISOString().split('T')[0];
    const dateFrom = req.query.from || today;
    const dateTo   = req.query.to   || today;

    // Daily totals
    const { rows: daily } = await db.query(
      `SELECT
         sale_date,
         SUM(total)          AS revenue,
         COUNT(*)            AS transactions,
         AVG(total)          AS avg_ticket,
         SUM(CASE WHEN payment='cash'  THEN total ELSE 0 END) AS cash,
         SUM(CASE WHEN payment='card'  THEN total ELSE 0 END) AS card,
         SUM(CASE WHEN payment='mpesa' THEN total ELSE 0 END) AS mpesa
       FROM sales
       WHERE status = 'paid'
         AND sale_date BETWEEN $1 AND $2
       GROUP BY sale_date
       ORDER BY sale_date`,
      [dateFrom, dateTo]
    );

    // Totals for period
    const { rows: totals } = await db.query(
      `SELECT
         COALESCE(SUM(total), 0)      AS revenue,
         COUNT(*)                     AS transactions,
         COALESCE(AVG(total), 0)      AS avg_ticket,
         COALESCE(SUM(CASE WHEN payment='cash'  THEN total END), 0) AS cash,
         COALESCE(SUM(CASE WHEN payment='card'  THEN total END), 0) AS card,
         COALESCE(SUM(CASE WHEN payment='mpesa' THEN total END), 0) AS mpesa
       FROM sales
       WHERE status = 'paid'
         AND sale_date BETWEEN $1 AND $2`,
      [dateFrom, dateTo]
    );

    res.json({
      daily,
      totals: totals[0],
      period: { from: dateFrom, to: dateTo },
    });
  } catch (err) { next(err); }
});

// ─── GET /api/reports/audit-log ───────────────────────────────────────────────
router.get('/audit-log', requireRole('admin'), async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit) || 100, 500);
    const offset = (parseInt(req.query.page) - 1 || 0) * limit;

    const { rows } = await db.query(
      `SELECT a.*, u.name AS user_name
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const { rows: cnt } = await db.query(`SELECT COUNT(*) FROM audit_log`);

    res.json({ logs: rows, total: parseInt(cnt[0].count) });
  } catch (err) { next(err); }
});

export default router;
