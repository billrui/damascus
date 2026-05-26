import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { isTokenBlocked } from '../config/redis.js';

/**
 * verifyJWT
 * Validates the Bearer token, checks Redis blocklist, attaches req.user.
 * req.user = { sub, name, role, permissions, device_id, iat, exp }
 */
export async function verifyJWT(req, res, next) {
  // Allow token from request body or query string as fallback
  if (!req.headers.authorization) {
    const bodyToken = req.body?.token || req.query?.token;
    if (bodyToken) req.headers.authorization = 'Bearer ' + bodyToken;
  }

  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'No token provided',
    });
  }

  const token = header.slice(7);

  // Check Redis blocklist first (O(1) — no DB hit)
  try {
    if (await isTokenBlocked(token)) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token has been revoked',
      });
    }
  } catch (redisErr) {
    // If Redis is down, fall through — don't block all requests
    console.warn('Redis blocklist check failed:', redisErr.message);
  }

  // Verify JWT signature and expiry
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user  = payload;
    req.token = token;         // keep raw token for logout revocation
    next();
  } catch (err) {
    const status = err.name === 'TokenExpiredError' ? 401 : 403;
    return res.status(status).json({
      error: status === 401 ? 'Unauthorized' : 'Forbidden',
      message: err.message,
    });
  }
}

/**
 * requireRole(...roles)
 * Must come AFTER verifyJWT.
 * Usage: router.delete('/users/:id', verifyJWT, requireRole('admin'), handler)
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This action requires role: ${roles.join(' or ')}`,
      });
    }
    next();
  };
}

/**
 * requirePermission(permId)
 * Mirrors the UI permission system exactly.
 * Must come AFTER verifyJWT.
 * Usage: router.get('/inventory', verifyJWT, requirePermission('inventory'), handler)
 */
export function requirePermission(permId) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const perms = req.user.permissions || [];
    if (!perms.includes(permId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Missing permission: ${permId}`,
      });
    }
    next();
  };
}

/**
 * optionalJWT
 * Attaches req.user if a valid token is present, but doesn't block if absent.
 * Useful for endpoints that behave differently for authenticated users.
 */
export async function optionalJWT(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();

  try {
    const token = header.slice(7);
    if (await isTokenBlocked(token)) return next();
    req.user  = jwt.verify(token, env.JWT_SECRET);
    req.token = token;
  } catch (_) {}

  next();
}
