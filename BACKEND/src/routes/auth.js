import { Router } from 'express';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import {
  issueTokens,
  rotateRefreshToken,
  revokeTokens,
  verifyPin,
  sanitizeUser,
} from '../services/authService.js';
import { verifyJWT } from '../middleware/auth.js';
import { validate, loginSchema } from '../middleware/validate.js';
import { loginLimiter, authorizeLimiter } from '../middleware/rateLimit.js';

const router = Router();

// ─── GET /api/auth/users — public endpoint for login screen dropdown ──────────
// Returns only name, role, avatar — never PIN or permissions
router.get('/users', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, role, avatar, active
       FROM users
       WHERE active = true
       ORDER BY role, name`
    );
    res.json({ users: rows });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
/**
 * Body: { user_id: number, pin: string, device_id?: string }
 *
 * Returns:
 *   { access_token, user }
 *   Sets HttpOnly cookie: refresh_token
 */
router.post('/login', loginLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { user_id, pin, device_id } = req.body;

    // Fetch user (only active accounts)
    const { rows } = await db.query(
      `SELECT id, name, role, pin_hash, avatar, active, permissions, created_at
       FROM users WHERE id = $1`,
      [user_id]
    );

    const user = rows[0];

    // Generic error — don't reveal whether the user exists
    if (!user || !user.active) {
      return res.status(401).json({
        error:   'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    const pinValid = await verifyPin(pin, user.pin_hash);
    if (!pinValid) {
      return res.status(401).json({
        error:   'Unauthorized',
        message: 'Invalid credentials',
      });
    }

    const { access_token, refresh_token } = await issueTokens(user, device_id);

    // Refresh token in HttpOnly cookie — JS can't access it
    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      sameSite: 'Strict',
      secure:   env.NODE_ENV === 'production',
      maxAge:   30 * 24 * 60 * 60 * 1000,   // 30 days in ms
      path:     '/api/auth',                  // only sent to /api/auth/* routes
    });

    // Audit log
    await db.query(
      `INSERT INTO audit_log (user_id, action, entity, entity_id, ip_address, device_id)
       VALUES ($1, 'LOGIN', 'users', $2, $3, $4)`,
      [user.id, String(user.id), req.ip, device_id || null]
    );

    res.json({
      access_token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
/**
 * Uses the HttpOnly refresh_token cookie to issue a new access_token.
 * Also rotates the refresh token (old one is revoked).
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const rawRefresh = req.cookies?.refresh_token;

    if (!rawRefresh) {
      return res.status(401).json({
        error:   'Unauthorized',
        message: 'No refresh token',
      });
    }

    const { access_token, refresh_token, user } = await rotateRefreshToken(rawRefresh);

    // Set the new refresh token cookie
    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      sameSite: 'Strict',
      secure:   env.NODE_ENV === 'production',
      maxAge:   30 * 24 * 60 * 60 * 1000,
      path:     '/api/auth',
    });

    res.json({ access_token, user: sanitizeUser(user) });
  } catch (err) {
    if (err.status === 401) {
      return res.status(401).json({ error: 'Unauthorized', message: err.message });
    }
    next(err);
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
/**
 * Revokes both access token (Redis blocklist) and refresh token (DB).
 * Clears the cookie.
 */
router.post('/logout', verifyJWT, async (req, res, next) => {
  try {
    const rawAccess  = req.token;
    const rawRefresh = req.cookies?.refresh_token;

    await revokeTokens(req.user.sub, rawAccess, rawRefresh);

    res.clearCookie('refresh_token', { path: '/api/auth' });

    await db.query(
      `INSERT INTO audit_log (user_id, action, entity, entity_id, ip_address, device_id)
       VALUES ($1, 'LOGOUT', 'users', $2, $3, $4)`,
      [req.user.sub, String(req.user.sub), req.ip, req.user.device_id || null]
    );

    res.json({ ok: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
/**
 * Returns the current authenticated user's profile.
 * Useful on app reload to validate the stored access token.
 */
router.get('/me', verifyJWT, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, role, avatar, active, permissions, created_at
       FROM users WHERE id = $1 AND active = true`,
      [req.user.sub]
    );

    if (!rows[0]) {
      return res.status(401).json({
        error:   'Unauthorized',
        message: 'User not found or deactivated',
      });
    }

    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/authorize — supervisor override ───────────────────────────
/**
 * Body: { pin: string, action?: string }
 *
 * Verifies that the supplied PIN belongs to an active admin or manager.
 * Used for floor overrides (e.g. a waiter cancelling a sent order) where a
 * supervisor must physically authorize the action at the terminal.
 *
 * The requester must already be authenticated (verifyJWT). The endpoint never
 * issues tokens or a session — it only confirms authorization and records who
 * approved it.
 *
 * Returns:
 *   200 { ok: true, authorizedBy: { id, name, role } }
 *   401 { ok: false } on no match
 */
router.post('/authorize', verifyJWT, authorizeLimiter, async (req, res, next) => {
  try {
    const { pin, action } = req.body || {};
    if (!pin || typeof pin !== 'string') {
      return res.status(422).json({ ok: false, error: 'PIN required' });
    }

    // Only active supervisors can authorize
    const { rows } = await db.query(
      `SELECT id, name, role, pin_hash
       FROM users
       WHERE active = true AND role IN ('admin','manager')`
    );

    let approver = null;
    for (const u of rows) {
      // eslint-disable-next-line no-await-in-loop
      if (await verifyPin(pin, u.pin_hash)) { approver = u; break; }
    }

    if (!approver) {
      return res.status(401).json({ ok: false, message: 'Not authorized' });
    }

    await db.query(
      `INSERT INTO audit_log (user_id, action, entity, entity_id, payload, ip_address)
       VALUES ($1, 'OVERRIDE_AUTHORIZE', 'auth', $2, $3, $4)`,
      [approver.id, String(action || 'override'),
       JSON.stringify({ requestedBy: req.user.sub, action: action || null }), req.ip]
    );

    res.json({ ok: true, authorizedBy: { id: approver.id, name: approver.name, role: approver.role } });
  } catch (err) {
    next(err);
  }
});

export default router;
