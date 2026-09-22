-- ══════════════════════════════════════════════════════════════════════════════
-- Butty Inventory — Purchasing rules become per machine
-- Safe to re-run.
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ══════════════════════════════════════════════════════════════════════════════
--
-- The reorder rule, the bar & tube material list and the run size were all
-- written for the SW150 and there was only ever one of each. Adding a second
-- machine needs its own SKU prefix, its own plate quantities, its own material
-- footages and its own run size.
--
-- Everything that exists today belongs to the SW150 and is attached to it, so
-- nothing changes on screen until a second machine gets its own rule.
--
-- Standard lengths stay shared: a 24 ft stick of HSS is 24 ft whatever it is
-- being cut for.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Run size belongs to the machine ───────────────────────────────────────────
ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS run_size integer NOT NULL DEFAULT 20;

-- Carry the existing global run size onto the machine that it described.
UPDATE machines
   SET run_size = COALESCE(
         (SELECT (value #>> '{}')::integer FROM app_settings WHERE key = 'bar_tube_run_size'),
         20)
 WHERE name ILIKE 'SW150%';

-- ── One rule per machine ──────────────────────────────────────────────────────
-- The text id stays as the key so the plate order rows keep pointing at it;
-- machine_id is what the app looks a rule up by, one per machine at most.
ALTER TABLE reorder_rules
  ADD COLUMN IF NOT EXISTS machine_id uuid REFERENCES machines(id) ON DELETE CASCADE;

UPDATE reorder_rules
   SET machine_id = (SELECT id FROM machines WHERE name ILIKE 'SW150%' LIMIT 1)
 WHERE machine_id IS NULL
   AND id = 'steel_plate';

CREATE UNIQUE INDEX IF NOT EXISTS reorder_rules_machine_idx
  ON reorder_rules (machine_id);

-- ── Material requirements belong to a machine ─────────────────────────────────
ALTER TABLE material_requirements
  ADD COLUMN IF NOT EXISTS machine_id uuid REFERENCES machines(id) ON DELETE CASCADE;

UPDATE material_requirements
   SET machine_id = (SELECT id FROM machines WHERE name ILIKE 'SW150%' LIMIT 1)
 WHERE machine_id IS NULL;

CREATE INDEX IF NOT EXISTS material_requirements_machine_idx
  ON material_requirements (machine_id);

-- ── Replacing a machine's material list ───────────────────────────────────────
-- Same one-transaction guarantee as before, now scoped to one machine so
-- saving the SW150's list cannot wipe another machine's.
DROP FUNCTION IF EXISTS replace_material_requirements(jsonb);

CREATE FUNCTION replace_material_requirements(p_machine_id uuid, p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  DELETE FROM material_requirements WHERE machine_id IS NOT DISTINCT FROM p_machine_id;

  INSERT INTO material_requirements (machine_id, name, total_ft, category_id, sort_order)
  SELECT p_machine_id,
         row_data->>'name',
         (row_data->>'total_ft')::numeric,
         row_data->>'category_id',
         (ordinality - 1)::integer
    FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS t(row_data, ordinality);
END;
$$;

REVOKE ALL     ON FUNCTION replace_material_requirements(uuid, jsonb) FROM public;
GRANT  EXECUTE ON FUNCTION replace_material_requirements(uuid, jsonb) TO authenticated;

-- ── Starting a rule for another machine ───────────────────────────────────────
-- Creates the rule row and returns its id, so the app does not have to invent
-- a text key of its own.
CREATE OR REPLACE FUNCTION create_reorder_rule(p_machine_id uuid, p_sku_prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id   text;
  v_name text;
BEGIN
  SELECT name INTO v_name FROM machines WHERE id = p_machine_id;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'That machine no longer exists';
  END IF;

  SELECT id INTO v_id FROM reorder_rules WHERE machine_id = p_machine_id;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  v_id := 'rule_' || replace(p_machine_id::text, '-', '');

  INSERT INTO reorder_rules (id, label, sku_prefix, machines_worth, machine_id)
  VALUES (v_id, v_name || ' — Grouped Reorder Rule', upper(p_sku_prefix), 5, p_machine_id);

  RETURN v_id;
END;
$$;

REVOKE ALL     ON FUNCTION create_reorder_rule(uuid, text) FROM public;
GRANT  EXECUTE ON FUNCTION create_reorder_rule(uuid, text) TO authenticated;
