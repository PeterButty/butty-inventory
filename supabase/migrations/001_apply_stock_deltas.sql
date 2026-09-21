-- ══════════════════════════════════════════════════════════════════════════════
-- Butty Inventory — Atomic stock movements
-- Safe to re-run.
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Why this exists
-- ---------------
-- Committing a machine build or a subassembly build used to deduct each part
-- one at a time from the browser. Two problems:
--
--   1. If it failed halfway, the earlier parts were already deducted — but the
--      app reported "no stock was changed", so retrying deducted them twice.
--   2. Stock was read on one device and written back later, so two people
--      working at once would silently overwrite each other.
--
-- This function applies every movement inside a single database transaction
-- using `stock = stock + delta`, so either all of them land or none do, and
-- concurrent changes add up instead of overwriting.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION apply_stock_deltas(p_deltas jsonb)
RETURNS TABLE (id uuid, stock integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  d           jsonb;
  v_id        uuid;
  v_delta     integer;
  v_new_stock integer;
  v_name      text;
BEGIN
  IF p_deltas IS NULL OR jsonb_typeof(p_deltas) <> 'array' THEN
    RAISE EXCEPTION 'apply_stock_deltas expects a JSON array of { product_id, delta }';
  END IF;

  FOR d IN SELECT * FROM jsonb_array_elements(p_deltas)
  LOOP
    v_id    := (d->>'product_id')::uuid;
    v_delta := (d->>'delta')::integer;

    -- Locks the row for the rest of the transaction, so simultaneous
    -- movements queue up instead of overwriting one another.
    UPDATE products
       SET stock = stock + v_delta
     WHERE products.id = v_id
    RETURNING products.stock, products.name
      INTO v_new_stock, v_name;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Part no longer exists in inventory (%)', v_id
        USING ERRCODE = 'no_data_found';
    END IF;

    IF v_new_stock < 0 THEN
      RAISE EXCEPTION 'Not enough % in stock — short by %', v_name, abs(v_new_stock)
        USING ERRCODE = 'check_violation';
    END IF;

    id    := v_id;
    stock := v_new_stock;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Signed-in staff may call it; it runs as the caller, so row-level security
-- on `products` still applies.
REVOKE ALL      ON FUNCTION apply_stock_deltas(jsonb) FROM public;
GRANT  EXECUTE  ON FUNCTION apply_stock_deltas(jsonb) TO authenticated;
