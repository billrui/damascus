-- Migration 004: POS — Shifts, Sales, Hold Orders & Offline Sync Queue

-- ─── SHIFTS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shifts (
  id             SERIAL        PRIMARY KEY,
  shift_ref      VARCHAR(30)   UNIQUE,          -- e.g. SH-000001
  opened_by      INT           REFERENCES users(id) ON DELETE SET NULL,
  opened_at      TIMESTAMPTZ   NOT NULL,
  closed_by      INT           REFERENCES users(id) ON DELETE SET NULL,
  closed_at      TIMESTAMPTZ,
  opening_float  NUMERIC(10,2) DEFAULT 0,
  closing_cash   NUMERIC(10,2),
  total_sales    NUMERIC(10,2) DEFAULT 0,       -- denormalised for Z-report speed
  total_covers   INT           DEFAULT 0,
  status         VARCHAR(20)   DEFAULT 'open'
                   CHECK (status IN ('open','closed')),
  notes          TEXT,
  created_at     TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_shifts_opened ON shifts(opened_at DESC);

-- ─── SALES ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id            VARCHAR(30)   PRIMARY KEY,      -- INV-000001
  sale_date     DATE          NOT NULL,
  sale_time     TIME,
  customer      VARCHAR(100)  DEFAULT 'Walk-in',
  table_no      VARCHAR(20),
  shift_id      INT           REFERENCES shifts(id) ON DELETE SET NULL,
  subtotal      NUMERIC(10,2),
  discount_pct  NUMERIC(5,2)  DEFAULT 0,
  discount_amt  NUMERIC(10,2) DEFAULT 0,
  total         NUMERIC(10,2) NOT NULL,
  payment       VARCHAR(30)
                  CHECK (payment IN ('cash','card','mpesa','credit','split')),
  payment_ref   VARCHAR(100),                   -- M-Pesa code, card auth number
  cashier_id    INT           REFERENCES users(id) ON DELETE SET NULL,
  waiter_id     INT           REFERENCES users(id) ON DELETE SET NULL,
  status        VARCHAR(20)   DEFAULT 'paid'
                  CHECK (status IN ('paid','void','refund')),
  void_reason   TEXT,
  voided_by     INT           REFERENCES users(id) ON DELETE SET NULL,
  voided_at     TIMESTAMPTZ,
  receipt_path  VARCHAR(255),                   -- path to generated PDF
  offline_id    VARCHAR(100),                   -- client-side id when created offline
  created_at    TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_date     ON sales(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_shift    ON sales(shift_id);
CREATE INDEX IF NOT EXISTS idx_sales_cashier  ON sales(cashier_id);
CREATE INDEX IF NOT EXISTS idx_sales_status   ON sales(status);

-- ─── SALE ITEMS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale_items (
  id           SERIAL        PRIMARY KEY,
  sale_id      VARCHAR(30)   NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  menu_item_id VARCHAR(20)   REFERENCES menu_items(id) ON DELETE SET NULL,
  name         VARCHAR(150),                   -- snapshot at time of sale
  qty          INT           NOT NULL CHECK (qty > 0),
  unit_price   NUMERIC(10,2),
  unit_cost    NUMERIC(10,2),
  line_total   NUMERIC(10,2)
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_menu ON sale_items(menu_item_id);

-- ─── HOLD ORDERS (KDS) ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hold_orders (
  id         SERIAL        PRIMARY KEY,
  hold_ref   VARCHAR(30)   UNIQUE,
  table_no   VARCHAR(20),
  waiter_id  INT           REFERENCES users(id) ON DELETE SET NULL,
  items      JSONB         NOT NULL,            -- [{menuId, qty, name, price}]
  total      NUMERIC(10,2),
  status     VARCHAR(20)   DEFAULT 'pending'
               CHECK (status IN ('pending','billed','bumped','cancelled')),
  notes      TEXT,
  created_at TIMESTAMPTZ   DEFAULT now(),
  updated_at TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_holds_status ON hold_orders(status);
CREATE INDEX IF NOT EXISTS idx_holds_waiter ON hold_orders(waiter_id);

CREATE TRIGGER hold_orders_updated_at
  BEFORE UPDATE ON hold_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── SEQUENCE COUNTERS ────────────────────────────────────────────────────────
-- Central sequence for invoice numbers so they're gap-free across devices
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;
CREATE SEQUENCE IF NOT EXISTS shift_seq   START 1;
CREATE SEQUENCE IF NOT EXISTS issue_seq   START 1;
CREATE SEQUENCE IF NOT EXISTS wastage_seq START 1;
CREATE SEQUENCE IF NOT EXISTS hold_seq    START 1;

-- ─── OFFLINE SYNC QUEUE ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_queue (
  id           SERIAL      PRIMARY KEY,
  device_id    VARCHAR(100),
  user_id      INT         REFERENCES users(id) ON DELETE SET NULL,
  operation    VARCHAR(60) NOT NULL,            -- 'CREATE_SALE', 'UPDATE_BATCH', etc.
  payload      JSONB       NOT NULL,
  client_ts    TIMESTAMPTZ,                     -- when the event happened on device
  received_at  TIMESTAMPTZ DEFAULT now(),
  status       VARCHAR(20) DEFAULT 'pending'
                 CHECK (status IN ('pending','processed','failed')),
  error        TEXT,
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_status  ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_device  ON sync_queue(device_id);
CREATE INDEX IF NOT EXISTS idx_sync_user    ON sync_queue(user_id);

-- ─── DASHBOARD MATERIALIZED VIEW ─────────────────────────────────────────────
-- Refreshed every 5 minutes by the API; reports read from here, not sales
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_kpis AS
SELECT
  sale_date,
  COUNT(*)                                       AS total_transactions,
  SUM(total)                                     AS total_revenue,
  SUM(CASE WHEN payment='cash'  THEN total END)  AS cash_revenue,
  SUM(CASE WHEN payment='card'  THEN total END)  AS card_revenue,
  SUM(CASE WHEN payment='mpesa' THEN total END)  AS mpesa_revenue,
  COUNT(DISTINCT cashier_id)                     AS cashiers_active
FROM sales
WHERE status = 'paid'
GROUP BY sale_date;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_kpis_date ON mv_daily_kpis(sale_date);
