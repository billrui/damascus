import Redis from 'ioredis';
import { env } from './env.js';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('connect', () => {
  if (env.NODE_ENV === 'development') {
    console.log('🔴  Redis connected');
  }
});

redis.on('error', (err) => {
  console.error('❌  Redis error:', err.message);
});

/**
 * Blocklist a JWT access token until it expires.
 * ttlSeconds: remaining lifetime of the token so Redis auto-cleans it.
 */
export async function blockToken(token, ttlSeconds) {
  await redis.set(`blocklist:${token}`, '1', 'EX', ttlSeconds);
}

/**
 * Check if a token has been revoked.
 */
export async function isTokenBlocked(token) {
  const val = await redis.get(`blocklist:${token}`);
  return val !== null;
}
