import { Router } from 'express';
import { z } from 'zod';
import { db } from '../config/db.js';
import { verifyJWT, requireRole, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  hashPin,
  sanitizeUser,
  revokeAllUserSessions,
} from '../services/authService.js';

const router = Router();

// All user routes require authentication
router.use(verifyJWT);

// ─── Validation schemas ───────────────────────────────────────────────────────

const VALID_ROLES = ['admin','manager','cashier','storekeeper','waiter','kitchen'];

const createUserSchema = z.object({
  name:        z.string().min(2).max(100).trim(),
  role:        z.enum(VALID_ROLES),
  pin:         z.string().min(4).max(8),
  permissions: z.array(z.string()).optional(),
  avatar:      z.string().max(200000).optional(), // base64 image
});

const updateUserSchema = z.object({
  name:        z.string().min(2).max(100).trim().optional(),
  role:        z.enum(VALID_ROLES).optional(),
  pin:         z.string().min(4).max(8).optional(),
  permissions: z.array(z.string()).optional(),
  active:      z.boolean().optional(),
  avatar:      z.string().max(200000).optional(), // base64 image
});

// Role hierarchy — who can manage whom
const ROLE_HIERARCHY = {
  admin:   ['manager','cashier','storekeeper','waiter','kitchen'],
  manager: ['cashier','waiter','kitchen'],
};

function canManage(actorRole, targetRole) {
  return (ROLE_HIERARCHY[actorRole] || []).includes(targetRole);
}

// ─── GET /api/users ───────────────────────────────────────────────────────────
router.get('/', requirePermission('settings'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, role, avatar, active, permissions, created_by, created_at
       FROM users
       ORDER BY created_at ASC`
    );
    res.json({ users: rows });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/users/:id ───────────────────────────────────────────────────────
router.get('/:id', requirePermission('settings'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, role, avatar, active, permissions, created_by, created_at
       FROM users WHERE id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/users ──────────────────────────────────────────────────────────
router.post('/', requirePermission('settings'), validate(createUserSchema), async (req, res, next) => {
  try {
    const actor = req.user;
    const { name, role, pin, permissions, avatar } = req.body;

    // Enforce role hierarchy
    if (!canManage(actor.role, role)) {
      return res.status(403).json({
        error:   'Forbidden',
        message: `A ${actor.role} cannot create a ${role} account`,
      });
    }

    const pin_hash = await hashPin(pin);

    // Default permissions from role if not specified
    const DEFAULT_PERMISSIONS = {
      admin:       ['dashboard','pos','shift','inventory','reports','expiry','variance','settings','wastage','items','kds'],
      manager:     ['dashboard','pos','shift','inventory','reports','expiry','variance','wastage','settings','items','kds'],
      cashier:     ['dashboard','pos','shift'],
      storekeeper: ['dashboard','inventory','expiry','wastage','items'],
      waiter:      ['pos','inventory_readonly'],
      kitchen:     ['kds'],
    };

    const finalPerms = permissions || DEFAULT_PERMISSIONS[role] || [];

    const { rows } = await db.query(
      `INSERT INTO users (name, role, pin_hash, permissions, avatar, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, role, avatar, active, permissions, created_by, created_at`,
      [name, role, pin_hash, finalPerms, avatar || null, actor.sub]
    );

    await db.query(
      `INSERT INTO audit_log (user_id, action, entity, entity_id, ip_address)
       VALUES ($1, 'CREATE_USER', 'users', $2, $3)`,
      [actor.sub, String(rows[0].id), req.ip]
    );

    res.status(201).json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/users/:id ─────────────────────────────────────────────────────
router.patch('/:id', requirePermission('settings'), validate(updateUserSchema), async (req, res, next) => {
  try {
    const actor    = req.user;
    const targetId = parseInt(req.params.id, 10);

    // Fetch current target
    const { rows: current } = await db.query(
      'SELECT id, role, active FROM users WHERE id = $1',
      [targetId]
    );
    if (!current[0]) return res.status(404).json({ error: 'User not found' });

    const target = current[0];

    // Can't edit someone above you — except admin can edit self
    if (targetId !== actor.sub && !canManage(actor.role, target.role)) {
      return res.status(403).json({
        error:   'Forbidden',
        message: `A ${actor.role} cannot edit a ${target.role} account`,
      });
    }

    const updates = req.body;
    const fields  = [];
    const values  = [];
    let   idx     = 1;

    if (updates.name        !== undefined) { fields.push(`name = $${idx++}`);        values.push(updates.name); }
    if (updates.role        !== undefined) { fields.push(`role = $${idx++}`);        values.push(updates.role); }
    if (updates.permissions !== undefined) { fields.push(`permissions = $${idx++}`); values.push(updates.permissions); }
    if (updates.avatar      !== undefined) { fields.push(`avatar = $${idx++}`);      values.push(updates.avatar); }
    if (updates.active      !== undefined) { fields.push(`active = $${idx++}`);      values.push(updates.active); }

    if (updates.pin) {
      const pin_hash = await hashPin(updates.pin);
      fields.push(`pin_hash = $${idx++}`);
      values.push(pin_hash);
    }

    if (!fields.length) {
      return res.status(422).json({ error: 'No fields to update' });
    }

    values.push(targetId);
    const { rows } = await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}
       RETURNING id, name, role, avatar, active, permissions, created_at`,
      values
    );

    // If deactivated, revoke all their sessions
    if (updates.active === false) {
      await revokeAllUserSessions(targetId);
    }

    await db.query(
      `INSERT INTO audit_log (user_id, action, entity, entity_id, payload, ip_address)
       VALUES ($1, 'UPDATE_USER', 'users', $2, $3, $4)`,
      [actor.sub, String(targetId), JSON.stringify(updates), req.ip]
    );

    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/users/:id — soft delete (deactivate) ────────────────────────
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id, 10);

    // Prevent self-deletion
    if (targetId === req.user.sub) {
      return res.status(400).json({
        error:   'Bad request',
        message: 'You cannot deactivate your own account',
      });
    }

    await db.query('UPDATE users SET active = false WHERE id = $1', [targetId]);
    await revokeAllUserSessions(targetId);

    await db.query(
      `INSERT INTO audit_log (user_id, action, entity, entity_id, ip_address)
       VALUES ($1, 'DEACTIVATE_USER', 'users', $2, $3)`,
      [req.user.sub, String(targetId), req.ip]
    );

    res.json({ ok: true, message: 'User deactivated' });
  } catch (err) {
    next(err);
  }
});

export default router;
