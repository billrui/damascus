import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';
import { db } from '../config/db.js';
import { redis, blockToken } from '../config/redis.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function parseExpiry(str) {
  // Converts '15m' → seconds, '30d' → seconds
  const unit = str.slice(-1);
  const val  = parseInt(str, 10);
  const map  = { s: 1, m: 60, h: 3600, d: 86400 };
  return val * (map[unit] || 60);
}

// ─── Issue tokens ─────────────────────────────────────────────────────────────

export async function issueTokens(user, deviceId = null) {
  // Access token — short-lived, carries full permission set
  const accessPayload = {
    sub:         user.id,
    name:        user.name,
    role:        user.role,
    permissions: user.permissions || [],
    device_id:   deviceId,
  };

  const access_token = jwt.sign(accessPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES,
  });

  // Refresh token — long-lived, minimal payload, keyed by jti for revocation
  const jti = uuidv4();
  const refreshPayload = { sub: user.id, jti, device_id: deviceId };

  const refresh_token = jwt.sign(refreshPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES,
  });

  // Store hash of refresh token in DB (never the raw token)
  const expiresAt = new Date(
    Date.now() + parseExpiry(env.JWT_REFRESH_EXPIRES) * 1000
  );

  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, device_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [user.id, sha256(refresh_token), deviceId, expiresAt]
  );

  return { access_token, refresh_token };
}

// ─── Rotate refresh token ─────────────────────────────────────────────────────

export async function rotateRefreshToken(rawRefreshToken) {
  // 1. Verify the JWT signature and expiry
  let payload;
  try {
    payload = jwt.verify(rawRefreshToken, env.JWT_SECRET);
  } catch (err) {
    throw Object.assign(new Error('Invalid or expired refresh token'), { status: 401 });
  }

  // 2. Check it exists and isn't revoked in DB
  const hash = sha256(rawRefreshToken);
  const { rows } = await db.query(
    `SELECT rt.*, u.name, u.role, u.permissions, u.active
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL`,
    [hash]
  );

  if (!rows[0]) {
    throw Object.assign(new Error('Refresh token not found or revoked'), { status: 401 });
  }

  const tokenRow = rows[0];

  if (!tokenRow.active) {
    throw Object.assign(new Error('User account is deactivated'), { status: 401 });
  }

  // 3. Revoke the old refresh token (token rotation — prevents replay)
  await db.query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1',
    [hash]
  );

  // 4. Issue a fresh pair
  const user = {
    id:          tokenRow.user_id,
    name:        tokenRow.name,
    role:        tokenRow.role,
    permissions: tokenRow.permissions,
  };

  const { access_token, refresh_token } = await issueTokens(user, tokenRow.device_id);

  return { access_token, refresh_token, user };
}

// ─── Revoke tokens on logout ──────────────────────────────────────────────────

export async function revokeTokens(userId, rawAccessToken, rawRefreshToken) {
  const ops = [];

  // Block access token in Redis until it naturally expires
  if (rawAccessToken) {
    try {
      const decoded = jwt.decode(rawAccessToken);
      const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 900;
      if (ttl > 0) ops.push(blockToken(rawAccessToken, ttl));
    } catch (_) {}
  }

  // Mark refresh token as revoked in DB
  if (rawRefreshToken) {
    ops.push(
      db.query(
        'UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1',
        [sha256(rawRefreshToken)]
      )
    );
  }

  await Promise.all(ops);
}

// ─── Revoke ALL sessions for a user (e.g. admin deactivates account) ─────────

export async function revokeAllUserSessions(userId) {
  await db.query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
    [userId]
  );
}

// ─── Hash a PIN (bcrypt, cost 10) ─────────────────────────────────────────────

export async function hashPin(pin) {
  return bcrypt.hash(String(pin), 10);
}

export async function verifyPin(pin, hash) {
  return bcrypt.compare(String(pin), hash);
}

// ─── Sanitise user for API response (never expose pin_hash) ──────────────────

export function sanitizeUser(user) {
  const { pin_hash, ...safe } = user;
  return safe;
}
