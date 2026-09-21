-- ══════════════════════════════════════════════════════════════════════════════
-- Butty Inventory — Purchasing rules move into the database
-- Safe to re-run: seeds only when a table is empty.
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ══════════════════════════════════════════════════════════════════════════════
--
-- The steel plate quantities, the trigger level, the bar & tube material list
-- and the run size used to be written into the app's source code, so changing
-- any of them meant a code edit and a redeploy. They live here now and are
-- edited from the Reorder Rules screen.
--
-- Seed values are exactly what the code held, so nothing changes until they
-- are edited.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Scalar settings ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_settings (key, value)
VALUES ('bar_tube_run_size', '20'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ── The grouped reorder rule ──────────────────────────────────────────────────
-- supplier_id replaces matching the supplier by spelling its name.
CREATE TABLE IF NOT EXISTS reorder_rules (
  id             text PRIMARY KEY,
  label          text    NOT NULL,
  sku_prefix     text    NOT NULL,
  machines_worth integer NOT NULL CHECK (machines_worth > 0),
  supplier_id    uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  enabled        boolean NOT NULL DEFAULT true,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

INSERT INTO reorder_rules (id, label, sku_prefix, machines_worth, supplier_id)
SELECT 'steel_plate', 'Steel Plate — Grouped Reorder Rule', 'S15', 5,
       (SELECT id FROM suppliers WHERE lower(name) LIKE '%russel%' LIMIT 1)
ON CONFLICT (id) DO NOTHING;

-- ── Fixed steel plate order quantities ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS steel_plate_order (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id     text NOT NULL REFERENCES reorder_rules(id) ON DELETE CASCADE,
  description text NOT NULL,
  qty         integer NOT NULL CHECK (qty > 0),
  sort_order  integer NOT NULL DEFAULT 0
);

INSERT INTO steel_plate_order (rule_id, description, qty, sort_order)
SELECT * FROM (VALUES
  ('steel_plate', '14ga. (0.0747") Mild Steel, 4'' x 8''',  2,  0),
  ('steel_plate', '1/8" Mild Steel, 5'' x 10''',            11, 1),
  ('steel_plate', '3/16" Mild Steel, 4'' x 8''',            1,  2),
  ('steel_plate', '1/4" Mild Steel, 4'' x 8''',             9,  3),
  ('steel_plate', '3/8" Mild Steel, 4'' x 8''',             4,  4),
  ('steel_plate', '1/2" Mild Steel, 4'' x 8''',             1,  5)
) AS seed(rule_id, description, qty, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM steel_plate_order);

-- ── Raw material categories ───────────────────────────────────────────────────
-- std_length is the standard purchased length in feet.
-- NULL means "no standard length — round up to the nearest foot".
CREATE TABLE IF NOT EXISTS material_categories (
  id         text PRIMARY KEY,
  label      text NOT NULL,
  std_length numeric,
  color      text NOT NULL DEFAULT '#2B3FE0',
  sort_order integer NOT NULL DEFAULT 0
);

INSERT INTO material_categories (id, label, std_length, color, sort_order)
SELECT * FROM (VALUES
  ('HSS',        'HSS Structural',       24::numeric,   '#2B3FE0', 0),
  ('CRS_ROUND',  'CRS Round Bar',        20::numeric,   '#FF9500', 1),
  ('SS_ROUND',   '304 SS Round Bar',     12::numeric,   '#30D158', 2),
  ('SQUARE_BAR', 'Square Bar',           12::numeric,   '#FF9500', 3),
  ('FLAT_BAR',   'Flat Bar',             12::numeric,   '#FF9500', 4),
  ('TUBE_HR',    'Hot-Rolled Tube',      24::numeric,   '#FF6B6B', 5),
  ('DOM',        'DOM Tube',             NULL::numeric, '#AF85E0', 6),
  ('KEYSTOCK',   'Keystock',             3::numeric,    '#FFD60A', 7),
  ('ALUMINUM',   'Aluminum',             NULL::numeric, '#A0C4FF', 8),
  ('NYLATRON',   'Nylatron / Nylon Rod', 10::numeric,   '#80FFDB', 9)
) AS seed(id, label, std_length, color, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM material_categories);

-- ── Material requirements for a full run ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS material_requirements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  total_ft    numeric NOT NULL CHECK (total_ft >= 0),
  category_id text NOT NULL REFERENCES material_categories(id) ON DELETE CASCADE,
  sort_order  integer NOT NULL DEFAULT 0
);

INSERT INTO material_requirements (name, total_ft, category_id, sort_order)
SELECT * FROM (VALUES
  ('HSS 2" x 2" x 1/8"',             83.33::numeric, 'HSS',        0),
  ('HSS 2" x 3" x 3/16"',            80.00::numeric, 'HSS',        1),
  ('Round Bar Ø1/2" CRS',            63.33::numeric, 'CRS_ROUND',  2),
  ('Round Bar Ø3/4" CRS',            26.67::numeric, 'CRS_ROUND',  3),
  ('Round Bar Ø1.00" CRS',           24.33::numeric, 'CRS_ROUND',  4),
  ('Round Bar Ø1.25" 1018 CRS',      45.90::numeric, 'CRS_ROUND',  5),
  ('Round Bar Ø1.25" CRS',           2.50::numeric,  'CRS_ROUND',  6),
  ('Round Bar Ø1.75" CRS',           18.75::numeric, 'CRS_ROUND',  7),
  ('Round Bar Ø2.00" CRS',           9.19::numeric,  'CRS_ROUND',  8),
  ('Round Bar Ø7/8" CRS',            0.92::numeric,  'CRS_ROUND',  9),
  ('Round Bar Ø1.00" 304 SS',        22.92::numeric, 'SS_ROUND',   10),
  ('Bar Square 1.50" 1018 CRS',      18.75::numeric, 'SQUARE_BAR', 11),
  ('Bar Flat 1/8" x 1/2" Steel',     19.42::numeric, 'FLAT_BAR',   12),
  ('DOM Tube Ø1.50" x 0.120" CRS',   15.00::numeric, 'DOM',        13),
  ('DOM Tube Ø2.375" x 0.310" Wall', 22.08::numeric, 'DOM',        14),
  ('DOM Tube Ø3.50"/2.75" CRS',      5.10::numeric,  'DOM',        15),
  ('DOM Tube 2.00" x 0.25" CRS',     22.08::numeric, 'DOM',        16),
  ('Tube 2.50" OD Hot-Rolled',       63.33::numeric, 'TUBE_HR',    17),
  ('Tube 2.00" OD x 0.120"',         3.33::numeric,  'TUBE_HR',    18),
  ('Keystock 1/2" x 7/16"',          5.52::numeric,  'KEYSTOCK',   19),
  ('Keystock 3/8" x 3/8"',           2.50::numeric,  'KEYSTOCK',   20),
  ('Alu 1" x 2"',                    2.50::numeric,  'ALUMINUM',   21),
  ('SM Nylon Ø1.50" x 1.00"',        41.25::numeric, 'NYLATRON',   22),
  ('Nylatron Ø1.75" x 2.125"',       14.16::numeric, 'NYLATRON',   23),
  ('Nylatron Ø2.25" x 2.00"',        6.66::numeric,  'NYLATRON',   24),
  ('Nylatron Ø2.00" x 2.00"',        6.66::numeric,  'NYLATRON',   25)
) AS seed(name, total_ft, category_id, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM material_requirements);

-- ── Row-level security ────────────────────────────────────────────────────────
-- Same posture as the rest of the app: signed-in staff may read and write.
ALTER TABLE app_settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reorder_rules         ENABLE ROW LEVEL SECURITY;
ALTER TABLE steel_plate_order     ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_requirements ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['app_settings','reorder_rules','steel_plate_order','material_categories','material_requirements']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users full access" ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY "Authenticated users full access" ON %I
         FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl);
  END LOOP;
END $$;
