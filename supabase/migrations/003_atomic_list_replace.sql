-- ══════════════════════════════════════════════════════════════════════════════
-- Butty Inventory — Atomic replacement of the editable lists
-- Safe to re-run.
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Saving the plate quantities or the material list clears the table and writes
-- the new rows back. Done from the browser that is two separate calls, so a
-- failure between them would leave the list empty — the same trap that used to
-- half-deduct a build. These functions do both halves in one transaction, so a
-- failed save leaves the previous list exactly as it was.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION replace_plate_order(p_rule_id text, p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  DELETE FROM steel_plate_order WHERE rule_id = p_rule_id;

  INSERT INTO steel_plate_order (rule_id, description, qty, sort_order)
  SELECT p_rule_id,
         row_data->>'description',
         (row_data->>'qty')::integer,
         (ordinality - 1)::integer
    FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS t(row_data, ordinality);
END;
$$;

CREATE OR REPLACE FUNCTION replace_material_requirements(p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  DELETE FROM material_requirements;

  INSERT INTO material_requirements (name, total_ft, category_id, sort_order)
  SELECT row_data->>'name',
         (row_data->>'total_ft')::numeric,
         row_data->>'category_id',
         (ordinality - 1)::integer
    FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS t(row_data, ordinality);
END;
$$;

REVOKE ALL     ON FUNCTION replace_plate_order(text, jsonb)        FROM public;
REVOKE ALL     ON FUNCTION replace_material_requirements(jsonb)    FROM public;
GRANT  EXECUTE ON FUNCTION replace_plate_order(text, jsonb)        TO authenticated;
GRANT  EXECUTE ON FUNCTION replace_material_requirements(jsonb)    TO authenticated;
