-- Migration 008: Menu Item Production Stock
-- Kitchen logs how many units they prepared → ingredients deduct immediately

CREATE TABLE IF NOT EXISTS menu_item_stock (
  id           SERIAL        PRIMARY KEY,
  menu_item_id VARCHAR(20)   NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  qty_available NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ   DEFAULT now(),
  UNIQUE(menu_item_id)
);

CREATE INDEX IF NOT EXISTS idx_menu_item_stock_item ON menu_item_stock(menu_item_id);

CREATE TABLE IF NOT EXISTS production_log (
  id           SERIAL        PRIMARY KEY,
  menu_item_id VARCHAR(20)   NOT NULL REFERENCES menu_items(id),
  qty_produced NUMERIC(10,2) NOT NULL,
  produced_by  INT           REFERENCES users(id) ON DELETE SET NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_production_log_item ON production_log(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_production_log_date ON production_log(created_at DESC);
