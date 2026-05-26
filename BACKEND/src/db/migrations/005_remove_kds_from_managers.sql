-- Migration 005: Remove kds permission from admin and manager roles
-- Kitchen Display is accessed via the Kitchen Monitor tab inside ManagerPOS.
-- Only kitchen staff need the kds nav item.

UPDATE users
SET permissions = array_remove(permissions, 'kds')
WHERE role IN ('admin', 'manager')
  AND 'kds' = ANY(permissions);
