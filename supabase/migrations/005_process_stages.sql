-- ══════════════════════════════════════════════════════════════════════════════
-- Butty Inventory — Process stages and work in progress
-- Safe to re-run: seeds only when a table is empty.
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ══════════════════════════════════════════════════════════════════════════════
--
-- A part used to have one number, and the Machine Builder treated it as
-- "ready to build with". That is wrong for anything still being made: of the
-- 56 plasma-cut parts in the SW150, only 31 are finished once they come off
-- the table. The other 25 still need bending, machining or paint.
--
-- Each part now has a route — the processes its drawing calls for — and
-- quantities sit at a stage meaning "finished that step, waiting for the
-- next". products.stock keeps its existing meaning: finished and usable. The
-- Machine Builder still counts only that, so buildable stays honest.
--
-- Routes are seeded from the PROCESSES REQUIRED block on the drawings, which
-- was captured when the parts were first imported.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── The processes the shop runs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS process_stages (
  id         text PRIMARY KEY,
  label      text NOT NULL,
  sort_order integer NOT NULL
);

INSERT INTO process_stages (id, label, sort_order)
SELECT * FROM (VALUES
  ('PLASMA', 'Cut',     1),
  ('BEND',   'Bent',    2),
  ('LATHE',  'Turned',  3),
  ('MILL',   'Milled',  4),
  ('PAINT',  'Painted', 5)
) AS seed(id, label, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM process_stages);

-- ── Which processes each part needs ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS part_routes (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  stage_id   text NOT NULL REFERENCES process_stages(id) ON DELETE CASCADE,
  sort_order integer NOT NULL,
  PRIMARY KEY (product_id, stage_id)
);

CREATE INDEX IF NOT EXISTS part_routes_product_idx ON part_routes (product_id);

-- Joined on SKU so it does not depend on ids captured at import time.
-- Parts with no drawing get no route: they are bought in and arrive ready.
INSERT INTO part_routes (product_id, stage_id, sort_order)
SELECT p.id, v.stage_id, v.sort_order
  FROM (VALUES
  ('S15-03-001', 'LATHE', 3),
  ('S15-03-001', 'MILL', 4),
  ('S15-03-002', 'PLASMA', 1),
  ('S15-03-002', 'BEND', 2),
  ('S15-03-002', 'PAINT', 5),
  ('S15-03-003', 'PLASMA', 1),
  ('S15-03-003', 'BEND', 2),
  ('S15-03-003', 'PAINT', 5),
  ('S15-03-004', 'PLASMA', 1),
  ('S15-03-004', 'BEND', 2),
  ('S15-03-004', 'PAINT', 5),
  ('S15-03-005', 'PLASMA', 1),
  ('S15-03-005', 'BEND', 2),
  ('S15-03-005', 'PAINT', 5),
  ('S15-03-006', 'PLASMA', 1),
  ('S15-03-006', 'BEND', 2),
  ('S15-03-006', 'PAINT', 5),
  ('S15-03-007', 'PLASMA', 1),
  ('S15-03-007', 'BEND', 2),
  ('S15-03-007', 'PAINT', 5),
  ('S15-03-008', 'LATHE', 3),
  ('S15-03-010', 'PLASMA', 1),
  ('S15-03-010', 'BEND', 2),
  ('S15-03-011', 'PLASMA', 1),
  ('S15-03-011', 'BEND', 2),
  ('S15-03-012', 'LATHE', 3),
  ('S15-03-013', 'BEND', 2),
  ('S15-03-014', 'PLASMA', 1),
  ('S15-03-016', 'PLASMA', 1),
  ('S15-03-016', 'BEND', 2),
  ('S15-03-017', 'PLASMA', 1),
  ('S15-03-018', 'PLASMA', 1),
  ('S15-03-019', 'PLASMA', 1),
  ('S15-03-020', 'PLASMA', 1),
  ('S15-03-021', 'PLASMA', 1),
  ('S15-03-021', 'BEND', 2),
  ('S15-03-022', 'PLASMA', 1),
  ('S15-03-022', 'BEND', 2),
  ('S15-03-023', 'PLASMA', 1),
  ('S15-03-024', 'PLASMA', 1),
  ('S15-03-024', 'BEND', 2),
  ('S15-03-025', 'PLASMA', 1),
  ('S15-03-025', 'BEND', 2),
  ('S15-03-026', 'PLASMA', 1),
  ('S15-03-026', 'BEND', 2),
  ('S15-03-027', 'PLASMA', 1),
  ('S15-03-027', 'BEND', 2),
  ('S15-03-029', 'PLASMA', 1),
  ('S15-03-029', 'BEND', 2),
  ('S15-03-030', 'LATHE', 3),
  ('S15-03-031', 'LATHE', 3),
  ('S15-03-032', 'LATHE', 3),
  ('S15-03-033', 'PLASMA', 1),
  ('S15-03-034', 'LATHE', 3),
  ('S15-03-035', 'LATHE', 3),
  ('S15-03-037', 'LATHE', 3),
  ('S15-03-038', 'LATHE', 3),
  ('S15-03-039', 'PLASMA', 1),
  ('S15-03-041', 'LATHE', 3),
  ('S15-03-041', 'MILL', 4),
  ('S15-03-042', 'PLASMA', 1),
  ('S15-03-043', 'PLASMA', 1),
  ('S15-03-044', 'LATHE', 3),
  ('S15-03-045', 'PLASMA', 1),
  ('S15-03-046', 'PLASMA', 1),
  ('S15-03-047', 'LATHE', 3),
  ('S15-03-048', 'PLASMA', 1),
  ('S15-03-048', 'BEND', 2),
  ('S15-03-049', 'LATHE', 3),
  ('S15-03-050', 'PLASMA', 1),
  ('S15-03-051', 'PLASMA', 1),
  ('S15-03-052', 'LATHE', 3),
  ('S15-03-053', 'LATHE', 3),
  ('S15-03-053', 'MILL', 4),
  ('S15-03-054', 'LATHE', 3),
  ('S15-03-054', 'MILL', 4),
  ('S15-03-055', 'PLASMA', 1),
  ('S15-03-055', 'LATHE', 3),
  ('S15-03-055', 'MILL', 4),
  ('S15-03-056', 'LATHE', 3),
  ('S15-03-056', 'MILL', 4),
  ('S15-03-057', 'LATHE', 3),
  ('S15-03-057', 'MILL', 4),
  ('S15-03-058', 'PLASMA', 1),
  ('S15-03-058', 'BEND', 2),
  ('S15-03-059', 'PLASMA', 1),
  ('S15-03-059', 'BEND', 2),
  ('S15-03-060', 'PLASMA', 1),
  ('S15-03-062', 'PLASMA', 1),
  ('S15-03-063', 'PLASMA', 1),
  ('S15-03-063', 'BEND', 2),
  ('S15-03-063', 'MILL', 4),
  ('S15-03-064', 'PLASMA', 1),
  ('S15-03-065', 'PLASMA', 1),
  ('S15-03-067', 'LATHE', 3),
  ('S15-03-068', 'LATHE', 3),
  ('S15-03-069', 'PLASMA', 1),
  ('S15-03-070', 'PLASMA', 1),
  ('S15-03-071', 'PLASMA', 1),
  ('S15-03-072', 'PLASMA', 1),
  ('S15-03-073', 'PLASMA', 1),
  ('S15-03-074', 'LATHE', 3),
  ('S15-03-075', 'LATHE', 3),
  ('S15-03-076', 'PLASMA', 1),
  ('S15-03-076', 'BEND', 2),
  ('S15-03-077', 'PLASMA', 1),
  ('S15-03-079', 'LATHE', 3),
  ('S15-03-081', 'PLASMA', 1),
  ('S15-03-083', 'PLASMA', 1),
  ('S15-03-084', 'PLASMA', 1),
  ('S15-03-085', 'PLASMA', 1),
  ('S15-03-088', 'LATHE', 3),
  ('S15-03-093', 'PLASMA', 1),
  ('S15-03-096', 'LATHE', 3),
  ('S15-03-097', 'LATHE', 3),
  ('S15-03-098', 'LATHE', 3),
  ('S15-03-101', 'LATHE', 3),
  ('S15-03-102', 'LATHE', 3),
  ('S15-03-103', 'LATHE', 3),
  ('S15-03-104', 'PLASMA', 1),
  ('S15-03-104', 'BEND', 2),
  ('S15-03-104', 'PAINT', 5),
  ('S15-03-105', 'PLASMA', 1),
  ('S15-03-106', 'PLASMA', 1),
  ('S15-03-106', 'PAINT', 5),
  ('S15-03-107', 'BEND', 2),
  ('S15-03-108', 'PLASMA', 1),
  ('S15-03-108', 'MILL', 4),
  ('S15-03-113', 'BEND', 2),
  ('S15-03-114', 'BEND', 2),
  ('S15-03-117', 'PLASMA', 1),
  ('S15-03-119', 'LATHE', 3),
  ('S15-03-120', 'MILL', 4)
  ) AS v(sku, stage_id, sort_order)
  JOIN products p ON p.sku = v.sku
 WHERE NOT EXISTS (SELECT 1 FROM part_routes)
ON CONFLICT (product_id, stage_id) DO NOTHING;

-- ── How many pieces are sitting at each stage ─────────────────────────────────
CREATE TABLE IF NOT EXISTS part_stage_qty (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  stage_id   text NOT NULL REFERENCES process_stages(id) ON DELETE CASCADE,
  qty        integer NOT NULL DEFAULT 0 CHECK (qty >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, stage_id)
);

CREATE INDEX IF NOT EXISTS part_stage_qty_product_idx ON part_stage_qty (product_id);

-- ── Moving work along ─────────────────────────────────────────────────────────
-- One call, one transaction, however many parts. Each move is
--   { product_id, from_stage, to_stage, qty }
-- from_stage null  → work just started, the pieces come into existence
-- to_stage   null  → the last step is done, the pieces become finished stock
CREATE OR REPLACE FUNCTION move_stage_qty(p_moves jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  m          jsonb;
  v_id       uuid;
  v_from     text;
  v_to       text;
  v_qty      integer;
  v_have     integer;
  v_name     text;
  v_label    text;
BEGIN
  IF p_moves IS NULL OR jsonb_typeof(p_moves) <> 'array' THEN
    RAISE EXCEPTION 'move_stage_qty expects a JSON array of moves';
  END IF;

  FOR m IN SELECT * FROM jsonb_array_elements(p_moves)
  LOOP
    v_id   := (m->>'product_id')::uuid;
    v_from := m->>'from_stage';
    v_to   := m->>'to_stage';
    v_qty  := (m->>'qty')::integer;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantity must be more than zero';
    END IF;

    SELECT name INTO v_name FROM products WHERE id = v_id;
    IF v_name IS NULL THEN
      RAISE EXCEPTION 'Part no longer exists in inventory (%)', v_id
        USING ERRCODE = 'no_data_found';
    END IF;

    -- Take them off the stage they were waiting at.
    IF v_from IS NOT NULL THEN
      SELECT qty INTO v_have
        FROM part_stage_qty
       WHERE product_id = v_id AND stage_id = v_from;

      SELECT label INTO v_label FROM process_stages WHERE id = v_from;

      IF v_have IS NULL OR v_have < v_qty THEN
        RAISE EXCEPTION 'Only % of % waiting at %, cannot move %',
          coalesce(v_have, 0), v_name, coalesce(v_label, v_from), v_qty
          USING ERRCODE = 'check_violation';
      END IF;

      UPDATE part_stage_qty
         SET qty = part_stage_qty.qty - v_qty, updated_at = now()
       WHERE product_id = v_id AND stage_id = v_from;
    END IF;

    -- Put them on the next one, or into finished stock if the route is done.
    IF v_to IS NOT NULL THEN
      INSERT INTO part_stage_qty (product_id, stage_id, qty)
      VALUES (v_id, v_to, v_qty)
      ON CONFLICT (product_id, stage_id)
      DO UPDATE SET qty = part_stage_qty.qty + v_qty, updated_at = now();
    ELSE
      UPDATE products
         SET stock = products.stock + v_qty
       WHERE products.id = v_id;
    END IF;
  END LOOP;
END;
$$;

-- ── Row-level security ────────────────────────────────────────────────────────
ALTER TABLE process_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE part_routes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE part_stage_qty ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['process_stages','part_routes','part_stage_qty']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users full access" ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY "Authenticated users full access" ON %I
         FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl);
  END LOOP;
END $$;

REVOKE ALL     ON FUNCTION move_stage_qty(jsonb) FROM public;
GRANT  EXECUTE ON FUNCTION move_stage_qty(jsonb) TO authenticated;
