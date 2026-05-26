import { Router } from 'express';
import { db } from '../config/db.js';
import { verifyJWT, requirePermission } from '../middleware/auth.js';

const router = Router();
router.use(verifyJWT);

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT key, value FROM settings ORDER BY key');
    const obj = {};
    rows.forEach(r => { obj[r.key] = r.value; });
    res.json({ settings: obj });
  } catch(err) { next(err); }
});

router.patch('/', requirePermission('settings'), async (req, res, next) => {
  try {
    const entries = Object.entries(req.body);
    if (!entries.length) return res.status(422).json({ error: 'No settings provided' });
    for (const [key, value] of entries) {
      await db.query(
        `INSERT INTO settings (key, value, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
        [key, String(value)]
      );
    }
    const { rows } = await db.query('SELECT key, value FROM settings ORDER BY key');
    const obj = {};
    rows.forEach(r => { obj[r.key] = r.value; });
    res.json({ settings: obj });
  } catch(err) { next(err); }
});

export default router;
