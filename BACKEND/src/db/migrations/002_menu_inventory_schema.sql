-- Migration 002: Menu Items, Ingredients & Recipes

-- ─── SUPPLIERS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id         VARCHAR(20)  PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  contact    VARCHAR(80),
  email      VARCHAR(150),
  address    TEXT,
  active     BOOLEAN      DEFAULT true,
  created_at TIMESTAMPTZ  DEFAULT now()
);

-- ─── INGREDIENTS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingredients (
  id             VARCHAR(20)  PRIMARY KEY,
  name           VARCHAR(150) NOT NULL,
  unit           VARCHAR(20),
  category       VARCHAR(50),
  reorder_level  NUMERIC(10,4),
  cost_per_unit  NUMERIC(10,4),
  active         BOOLEAN     DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category);

CREATE TRIGGER ingredients_updated_at
  BEFORE UPDATE ON ingredients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── MENU ITEMS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_items (
  id             VARCHAR(20)   PRIMARY KEY,
  name           VARCHAR(150)  NOT NULL,
  category       VARCHAR(50),
  price          NUMERIC(10,2) NOT NULL,
  cost           NUMERIC(10,2),
  emoji          VARCHAR(10),
  description    TEXT,
  bestseller     BOOLEAN       DEFAULT false,
  on_sale        BOOLEAN       DEFAULT false,
  original_price NUMERIC(10,2),
  brand          VARCHAR(100),
  active         BOOLEAN       DEFAULT true,
  created_by     INT           REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ   DEFAULT now(),
  updated_at     TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_category ON menu_items(category);
CREATE INDEX IF NOT EXISTS idx_menu_active   ON menu_items(active);

CREATE TRIGGER menu_items_updated_at
  BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── RECIPES ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipes (
  menu_item_id  VARCHAR(20)   NOT NULL REFERENCES menu_items(id)   ON DELETE CASCADE,
  ingredient_id VARCHAR(20)   NOT NULL REFERENCES ingredients(id)  ON DELETE CASCADE,
  qty           NUMERIC(10,4) NOT NULL,
  PRIMARY KEY (menu_item_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_recipes_ingredient ON recipes(ingredient_id);
