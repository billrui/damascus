-- Migration 003: Inventory — Batches, Store Issues & Wastage

-- ─── BATCHES ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS batches (
  id            VARCHAR(20)   PRIMARY KEY,
  ingredient_id VARCHAR(20)   NOT NULL REFERENCES ingredients(id),
  batch_no      VARCHAR(50),
  qty           NUMERIC(10,4) NOT NULL,
  remaining     NUMERIC(10,4) NOT NULL,
  expiry        DATE,
  supplier_id   VARCHAR(20)   REFERENCES suppliers(id),
  location      VARCHAR(100),
  received_date DATE,
  cost_per_unit NUMERIC(10,4),
  status        VARCHAR(20)   DEFAULT 'active'
                  CHECK (status IN ('active','depleted','expired','written_off')),
  received_by   INT           REFERENCES users(id) ON DELETE SET NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ   DEFAULT now(),
  updated_at    TIMESTAMPTZ   DEFAULT now()
);

-- Critical index: FEFO queries filter on ingredient + status + expiry constantly
CREATE INDEX IF NOT EXISTS idx_batches_fefo
  ON batches(ingredient_id, status, expiry ASC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_batches_expiry  ON batches(expiry);
CREATE INDEX IF NOT EXISTS idx_batches_status  ON batches(status);

CREATE TRIGGER batches_updated_at
  BEFORE UPDATE ON batches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── STORE ISSUES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_issues (
  id            SERIAL        PRIMARY KEY,
  issue_ref     VARCHAR(30)   UNIQUE,           -- e.g. SI-000001
  issue_date    DATE          NOT NULL,
  from_location VARCHAR(100),
  to_location   VARCHAR(100),
  ingredient_id VARCHAR(20)   NOT NULL REFERENCES ingredients(id),
  batch_id      VARCHAR(20)   REFERENCES batches(id),
  qty           NUMERIC(10,4) NOT NULL,
  issued_by     INT           REFERENCES users(id) ON DELETE SET NULL,
  approved_by   INT           REFERENCES users(id) ON DELETE SET NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issues_ingredient ON store_issues(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_issues_date       ON store_issues(issue_date DESC);

-- ─── WASTAGE ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wastage (
  id            SERIAL        PRIMARY KEY,
  wastage_ref   VARCHAR(30)   UNIQUE,           -- e.g. W-000001
  wastage_date  DATE          NOT NULL,
  ingredient_id VARCHAR(20)   NOT NULL REFERENCES ingredients(id),
  batch_id      VARCHAR(20)   REFERENCES batches(id),
  qty           NUMERIC(10,4) NOT NULL,
  reason        VARCHAR(50)
                  CHECK (reason IN ('expired','spoilage','trimming','breakage','theft','other')),
  value         NUMERIC(10,2),
  recorded_by   INT           REFERENCES users(id) ON DELETE SET NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wastage_ingredient ON wastage(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_wastage_date       ON wastage(wastage_date DESC);
