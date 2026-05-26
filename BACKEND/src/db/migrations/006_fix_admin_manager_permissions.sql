-- Migration 006: Ensure admin and manager have inventory_readonly permission
-- GET /api/inventory/batches requires inventory_readonly.
-- Admin and manager must have it to load the stock view.

UPDATE users
SET permissions = array_append(permissions, 'inventory_readonly')
WHERE role IN ('admin', 'manager')
  AND NOT ('inventory_readonly' = ANY(permissions));

-- Also ensure inventory is present (needed for POST/PATCH)
UPDATE users
SET permissions = array_append(permissions, 'inventory')
WHERE role IN ('admin', 'manager')
  AND NOT ('inventory' = ANY(permissions));

-- Ensure issues permission exists (GET /api/inventory/issues)
UPDATE users
SET permissions = array_append(permissions, 'receive')
WHERE role IN ('admin', 'manager')
  AND NOT ('receive' = ANY(permissions));
