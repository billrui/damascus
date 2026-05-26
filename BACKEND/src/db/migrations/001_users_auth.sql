-- Migration 001: Users & Authentication
-- Run order: 1

-- ─── USERS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  role          VARCHAR(20)  NOT NULL
                  CHECK (role IN ('admin','manager','cashier','storekeeper','waiter','kitchen')),
  pin_hash      VARCHAR(255) NOT NULL,
  avatar        VARCHAR(10),
  active        BOOLEAN      DEFAULT true,
  permissions   TEXT[]       DEFAULT '{}',
  created_by    INT          REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ  DEFAULT now(),
  updated_at    TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role   ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── REFRESH TOKENS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL UNIQUE,   -- SHA-256 of raw refresh token
  device_id   VARCHAR(100),                   -- optional terminal/tablet identifier
  issued_at   TIMESTAMPTZ  DEFAULT now(),
  expires_at  TIMESTAMPTZ  NOT NULL,
  revoked_at  TIMESTAMPTZ                     -- NULL = still valid
);

CREATE INDEX IF NOT EXISTS idx_rt_user_id    ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_rt_token_hash ON refresh_tokens(token_hash);

-- ─── AUDIT LOG ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  user_id     INT         REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(80) NOT NULL,            -- e.g. 'LOGIN', 'CREATE_SALE', 'DELETE_USER'
  entity      VARCHAR(50),                     -- e.g. 'users', 'sales'
  entity_id   VARCHAR(50),
  payload     JSONB,                           -- before/after snapshot
  ip_address  INET,
  device_id   VARCHAR(100),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_ts   ON audit_log(created_at DESC);
