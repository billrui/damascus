-- Migration 010: Production Groups & Batch Tracking

-- Groups menu item variants together under one production batch
-- e.g. "Tea" group includes: TEA, WHITE TEA, BLACK TEA, TEA EX, LEMON TEA etc.
CREATE TABLE IF NOT EXISTS production_groups (
  id          SERIAL        PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,  -- e.g. "Tea", "Managu", "Ugali"
  unit        VARCHAR(20)   NOT NULL DEFAULT 'portions', -- cups, portions, kg, pieces
  created_at  TIMESTAMPTZ   DEFAULT now()
);

-- Links menu items to their production group
-- e.g. "MANAGU MIX UGALI" → managu group (1 portion) + ugali group (1 portion)
CREATE TABLE IF NOT EXISTS production_group_items (
  id           SERIAL      PRIMARY KEY,
  group_id     INT         NOT NULL REFERENCES production_groups(id) ON DELETE CASCADE,
  menu_item_id VARCHAR(20) NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  portions     NUMERIC(10,2) NOT NULL DEFAULT 1, -- how many portions of this group per sale
  UNIQUE(group_id, menu_item_id)
);

-- Daily production batches recorded by manager
CREATE TABLE IF NOT EXISTS production_batches (
  id            SERIAL        PRIMARY KEY,
  group_id      INT           NOT NULL REFERENCES production_groups(id) ON DELETE CASCADE,
  shift_id      INT           REFERENCES shifts(id) ON DELETE SET NULL,
  qty_cooked    NUMERIC(10,2) NOT NULL,  -- e.g. 100 cups of tea
  qty_sold      NUMERIC(10,2) NOT NULL DEFAULT 0, -- auto-updated as sales happen
  qty_remaining NUMERIC(10,2) GENERATED ALWAYS AS (qty_cooked - qty_sold) STORED,
  cooked_by     INT           REFERENCES users(id) ON DELETE SET NULL,
  notes         TEXT,
  status        VARCHAR(20)   NOT NULL DEFAULT 'active', -- active, carried_over, wasted
  cooked_at     TIMESTAMPTZ   DEFAULT now(),
  closed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_prod_batches_group   ON production_batches(group_id);
CREATE INDEX IF NOT EXISTS idx_prod_batches_shift   ON production_batches(shift_id);
CREATE INDEX IF NOT EXISTS idx_prod_batches_status  ON production_batches(status);
CREATE INDEX IF NOT EXISTS idx_prod_batches_date    ON production_batches(cooked_at DESC);

-- Carry-over log — when manager decides to carry food to next shift
CREATE TABLE IF NOT EXISTS production_carryover (
  id          SERIAL        PRIMARY KEY,
  batch_id    INT           NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  qty         NUMERIC(10,2) NOT NULL,
  decision    VARCHAR(20)   NOT NULL, -- 'carryover' or 'wasted'
  decided_by  INT           REFERENCES users(id) ON DELETE SET NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carryover_batch ON production_carryover(batch_id);
