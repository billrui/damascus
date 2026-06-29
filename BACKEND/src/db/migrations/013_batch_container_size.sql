-- 013_batch_container_size.sql
-- For items received as whole containers (e.g. cooking oil in 1L/2L/5L bottles),
-- record the size of ONE container on the batch. This lets the store count whole
-- bottles per size instead of showing a merged litres total.
-- NULL = continuous item (received/used by weight or volume, not whole containers).
ALTER TABLE batches ADD COLUMN IF NOT EXISTS container_size NUMERIC(10,4);

COMMENT ON COLUMN batches.container_size IS
  'Base-unit size of one whole container in this batch (e.g. 5 for a 5 L can). NULL for continuous items.';
