-- ══════════════════════════════════════════════════════════════════════════════
-- Butty Inventory — Enable Row-Level Security
-- Safe to re-run: drops existing policies before recreating them.
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Enable RLS on all tables ──────────────────────────────────────────────────
ALTER TABLE products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines           ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_products  ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_components ENABLE ROW LEVEL SECURITY;

-- ── Drop existing policies (safe to run even if they don't exist yet) ─────────
DROP POLICY IF EXISTS "Authenticated users can read products"    ON products;
DROP POLICY IF EXISTS "Authenticated users can insert products"  ON products;
DROP POLICY IF EXISTS "Authenticated users can update products"  ON products;
DROP POLICY IF EXISTS "Authenticated users can delete products"  ON products;

DROP POLICY IF EXISTS "Authenticated users can read machines"    ON machines;
DROP POLICY IF EXISTS "Authenticated users can insert machines"  ON machines;
DROP POLICY IF EXISTS "Authenticated users can update machines"  ON machines;
DROP POLICY IF EXISTS "Authenticated users can delete machines"  ON machines;

DROP POLICY IF EXISTS "Authenticated users can read suppliers"   ON suppliers;
DROP POLICY IF EXISTS "Authenticated users can insert suppliers" ON suppliers;
DROP POLICY IF EXISTS "Authenticated users can update suppliers" ON suppliers;
DROP POLICY IF EXISTS "Authenticated users can delete suppliers" ON suppliers;

DROP POLICY IF EXISTS "Authenticated users can read supplier_products"   ON supplier_products;
DROP POLICY IF EXISTS "Authenticated users can insert supplier_products" ON supplier_products;
DROP POLICY IF EXISTS "Authenticated users can update supplier_products" ON supplier_products;
DROP POLICY IF EXISTS "Authenticated users can delete supplier_products" ON supplier_products;

DROP POLICY IF EXISTS "Authenticated users can read machine_components"   ON machine_components;
DROP POLICY IF EXISTS "Authenticated users can insert machine_components" ON machine_components;
DROP POLICY IF EXISTS "Authenticated users can update machine_components" ON machine_components;
DROP POLICY IF EXISTS "Authenticated users can delete machine_components" ON machine_components;

-- ── Products ──────────────────────────────────────────────────────────────────
CREATE POLICY "Authenticated users can read products"
  ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert products"
  ON products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update products"
  ON products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete products"
  ON products FOR DELETE TO authenticated USING (true);

-- ── Machines ──────────────────────────────────────────────────────────────────
CREATE POLICY "Authenticated users can read machines"
  ON machines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert machines"
  ON machines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update machines"
  ON machines FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete machines"
  ON machines FOR DELETE TO authenticated USING (true);

-- ── Suppliers ─────────────────────────────────────────────────────────────────
CREATE POLICY "Authenticated users can read suppliers"
  ON suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert suppliers"
  ON suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update suppliers"
  ON suppliers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete suppliers"
  ON suppliers FOR DELETE TO authenticated USING (true);

-- ── Supplier Products ─────────────────────────────────────────────────────────
CREATE POLICY "Authenticated users can read supplier_products"
  ON supplier_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert supplier_products"
  ON supplier_products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update supplier_products"
  ON supplier_products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete supplier_products"
  ON supplier_products FOR DELETE TO authenticated USING (true);

-- ── Machine Components ────────────────────────────────────────────────────────
CREATE POLICY "Authenticated users can read machine_components"
  ON machine_components FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert machine_components"
  ON machine_components FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update machine_components"
  ON machine_components FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete machine_components"
  ON machine_components FOR DELETE TO authenticated USING (true);
