-- 012_issued_whole.sql
-- Mark ingredients that are issued to the kitchen as a whole unit (e.g. a 5L can of
-- cooking oil, a sack of flour). These leave the store via Issue Stock, so Produce
-- Batch must NOT deduct them again per recipe — that would double-count.
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS issued_whole BOOLEAN DEFAULT false;

COMMENT ON COLUMN ingredients.issued_whole IS
  'If true, the item is handed to the kitchen as a whole unit via Issue Stock; Produce Batch skips deducting it (still counts for costing).';
