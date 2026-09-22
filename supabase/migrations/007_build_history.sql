-- ══════════════════════════════════════════════════════════════════════════════
-- Butty Inventory — Build history
-- Safe to re-run.
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Committing a build deducted the parts and left no trace of it. Nothing in
-- the app could answer how many SW150s were finished last quarter, or when.
--
-- A build is written in the same transaction as the stock it consumes, so the
-- log can never disagree with the shelves — either both happened or neither
-- did. What each build consumed is kept as well, which is what makes it
-- possible to void one later and put the parts back exactly.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS machine_builds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id      uuid NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  qty             integer NOT NULL CHECK (qty > 0),
  note            text,
  built_at        timestamptz NOT NULL DEFAULT now(),
  built_by        uuid,
  built_by_email  text,
  voided_at       timestamptz,
  voided_by_email text
);

CREATE INDEX IF NOT EXISTS machine_builds_machine_idx ON machine_builds (machine_id, built_at DESC);

-- What the build took off the shelves, so it can be put back exactly.
CREATE TABLE IF NOT EXISTS machine_build_lines (
  build_id   uuid NOT NULL REFERENCES machine_builds(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty        integer NOT NULL,
  PRIMARY KEY (build_id, product_id)
);

CREATE INDEX IF NOT EXISTS machine_build_lines_build_idx ON machine_build_lines (build_id);

-- ── Committing a build ────────────────────────────────────────────────────────
-- Deducts the parts and writes the record together. apply_stock_deltas raises
-- if anything would go short, which rolls the whole thing back — no stock
-- moved, no build logged.
CREATE OR REPLACE FUNCTION commit_machine_build(
  p_machine_id uuid,
  p_qty        integer,
  p_deltas     jsonb,
  p_note       text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_build_id uuid;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'Build quantity must be more than zero';
  END IF;

  PERFORM apply_stock_deltas(p_deltas);

  INSERT INTO machine_builds (machine_id, qty, note, built_by, built_by_email)
  VALUES (p_machine_id, p_qty, nullif(btrim(coalesce(p_note, '')), ''),
          auth.uid(), auth.jwt() ->> 'email')
  RETURNING id INTO v_build_id;

  INSERT INTO machine_build_lines (build_id, product_id, qty)
  SELECT v_build_id,
         (row_data->>'product_id')::uuid,
         abs((row_data->>'delta')::integer)
    FROM jsonb_array_elements(p_deltas) AS t(row_data)
  ON CONFLICT (build_id, product_id) DO NOTHING;

  RETURN v_build_id;
END;
$$;

-- ── Undoing one ───────────────────────────────────────────────────────────────
-- Puts back exactly what that build took and marks it voided. The record stays
-- — a log that quietly loses entries is not worth keeping.
CREATE OR REPLACE FUNCTION void_machine_build(p_build_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_voided timestamptz;
  v_deltas jsonb;
BEGIN
  SELECT voided_at INTO v_voided FROM machine_builds WHERE id = p_build_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That build is no longer in the log';
  END IF;

  IF v_voided IS NOT NULL THEN
    RAISE EXCEPTION 'That build was already voided';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object('product_id', product_id, 'delta', qty)), '[]'::jsonb)
    INTO v_deltas
    FROM machine_build_lines
   WHERE build_id = p_build_id;

  PERFORM apply_stock_deltas(v_deltas);

  UPDATE machine_builds
     SET voided_at = now(), voided_by_email = auth.jwt() ->> 'email'
   WHERE id = p_build_id;
END;
$$;

-- ── Row-level security ────────────────────────────────────────────────────────
ALTER TABLE machine_builds      ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_build_lines ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['machine_builds','machine_build_lines']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users full access" ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY "Authenticated users full access" ON %I
         FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl);
  END LOOP;
END $$;

REVOKE ALL     ON FUNCTION commit_machine_build(uuid, integer, jsonb, text) FROM public;
REVOKE ALL     ON FUNCTION void_machine_build(uuid)                          FROM public;
GRANT  EXECUTE ON FUNCTION commit_machine_build(uuid, integer, jsonb, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION void_machine_build(uuid)                          TO authenticated;
