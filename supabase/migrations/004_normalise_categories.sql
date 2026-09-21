-- ══════════════════════════════════════════════════════════════════════════════
-- Butty Inventory — Merge the SW150 category spellings
-- Safe to re-run: rows already spelled correctly are left alone.
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ══════════════════════════════════════════════════════════════════════════════
--
-- The category column held three spellings of one machine — 'SW150', 'SW 150'
-- and 'Sw150' — which split the category filter on the Inventory tab into
-- three separate buttons. 149 rows were already correct; two were not.
--
-- Matching ignores case and spaces so it catches any other stray spelling of
-- the same thing.
--
-- New parts will not drift again: the Add/Edit Product form already sets the
-- category to SW150 automatically when the SKU starts with S15.
-- ══════════════════════════════════════════════════════════════════════════════

-- What is about to change, before changing it.
SELECT category, count(*) AS rows
  FROM products
 WHERE category IS NOT NULL
 GROUP BY category
 ORDER BY rows DESC;

UPDATE products
   SET category = 'SW150'
 WHERE category IS NOT NULL
   AND category <> 'SW150'
   AND regexp_replace(lower(category), '\s+', '', 'g') = 'sw150';

-- And what it looks like afterwards.
SELECT category, count(*) AS rows
  FROM products
 WHERE category IS NOT NULL
 GROUP BY category
 ORDER BY rows DESC;
