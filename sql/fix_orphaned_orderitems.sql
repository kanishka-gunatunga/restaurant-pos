-- ============================================================
-- Fix: Orphaned orderitems rows causing phantom order items
-- 
-- Problem: The orders table was truncated/reset at the DB level
-- (e.g., via phpMyAdmin TRUNCATE or DELETE), but orderitems was
-- not. New orders got the same auto-increment IDs as old ones,
-- so they incorrectly inherited old items.
--
-- Step 1: Remove all orderitems whose orderId no longer exists
-- in the orders table (orphaned rows).
-- ============================================================

DELETE FROM orderitems
WHERE orderId NOT IN (SELECT id FROM orders);

-- ============================================================
-- Step 2: Add a database-level FK constraint with ON DELETE CASCADE.
-- This ensures that if an order is ever deleted directly at the
-- DB level (bypassing Sequelize hooks), its items are also removed.
--
-- NOTE: Run this only AFTER Step 1, otherwise it will fail if
-- orphaned rows still exist.
-- ============================================================

ALTER TABLE orderitems
ADD CONSTRAINT fk_orderitems_order
FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE;
