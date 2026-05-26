import { redis } from '../config/redis.js';

/**
 * Simple Redis-backed rate limiter.
 * More reliable than in-memory limiters when running multiple Node processes.
 *
 * @param {object} opts
 * @param {number} opts.max       - max requests allowed in window
 * @param {number} opts.windowSec - window size in seconds
 * @param {string} opts.keyPrefix - e.g. 'login', 'api'
 * @param {string} [opts.message] - error message to return
 */
export function rateLimiter({ max, windowSec, keyPrefix, message }) {
  return async (req, res, next) => {
    // Key by IP + prefix (add user id when available)
    const ip  = req.ip || req.socket.remoteAddress;
    const key = `rl:${keyPrefix}:${ip}`;

    try {
      const current = await redis.incr(key);
      if (current === 1) {
        // First hit — set expiry
        await redis.expire(key, windowSec);
      }

      // Expose rate limit headers
      res.set({
        'X-RateLimit-Limit':     max,
        'X-RateLimit-Remaining': Math.max(0, max - current),
      });

      if (current > max) {
        return res.status(429).json({
          error:   'Too many requests',
          message: message || `Rate limit exceeded. Try again in ${windowSec}s.`,
        });
      }
    } catch (redisErr) {
      // If Redis is down, don't block all requests — just log and pass through
      console.warn('Rate limiter Redis error:', redisErr.message);
    }

    next();
  };
}

// ─── Pre-configured limiters ──────────────────────────────────────────────────

// Login: 10 attempts per 15 minutes per IP
export const loginLimiter = rateLimiter({
  max:       10,
  windowSec: 900,
  keyPrefix: 'login',
  message:   'Too many login attempts. Please wait 15 minutes.',
});

// General API: 300 requests per minute per IP
export const apiLimiter = rateLimiter({
  max:       300,
  windowSec: 60,
  keyPrefix: 'api',
});

// Strict: 30 per minute — for write-heavy endpoints like sales creation
export const strictLimiter = rateLimiter({
  max:       30,
  windowSec: 60,
  keyPrefix: 'strict',
});
