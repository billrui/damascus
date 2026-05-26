-- Migration 007: Remove standalone receive/issue nav permissions
-- Receive Stock and Issue Stock are now accessed as tabs inside Inventory,
-- not as separate sidebar nav items. The inventory permission covers access.

UPDATE users
SET permissions = array_remove(array_remove(permissions, 'receive'), 'issue')
WHERE 'receive' = ANY(permissions) OR 'issue' = ANY(permissions);
