-- Migration 009: Overheads & Miscellaneous Costs

-- Settings table (key-value store for daily overheads etc.)
CREATE TABLE IF NOT EXISTS settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT         NOT NULL,
  updated_at TIMESTAMPTZ  DEFAULT now()
);

-- Seed daily overhead defaults (edit these in the app)
INSERT INTO settings (key, value) VALUES
  ('daily_overhead_rent',       '0'),
  ('daily_overhead_wages',      '0'),
  ('daily_overhead_electricity','0'),
  ('daily_overhead_other',      '0')
ON CONFLICT (key) DO NOTHING;

-- Add overhead_cost column to recipes
-- This is a fixed KES amount per serving for things like water, gas, charcoal
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS overhead_cost NUMERIC(10,4) DEFAULT 0;

-- Add purchase_unit and purchase_qty to ingredients for bulk buying
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS purchase_unit    VARCHAR(20);
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS purchase_qty     NUMERIC(10,4);
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS purchase_cost    NUMERIC(10,4);

-- Mark utilities as a special category so UI can group them
-- (water, gas, charcoal, firewood are just ingredients with category='utilities')
-- No schema change needed — category column already exists

-- Add batch_size to recipes table (how many servings this recipe makes)
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS batch_size INT DEFAULT 1;

COMMENT ON COLUMN recipes.overhead_cost IS 'Fixed KES cost per serving for water, gas, charcoal etc.';
COMMENT ON COLUMN ingredients.purchase_unit IS 'Unit you buy in (kg, litre, packet, bundle)';
COMMENT ON COLUMN ingredients.purchase_qty  IS 'How many cooking units per purchase unit (e.g. 1kg=1000g)';
COMMENT ON COLUMN ingredients.purchase_cost IS 'Cost of one purchase unit in KES';
COMMENT ON COLUMN menu_items.batch_size     IS 'How many servings one recipe batch produces';
