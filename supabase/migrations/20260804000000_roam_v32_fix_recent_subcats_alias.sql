-- ============================================================================
-- roam v32 — HOTFIX: repair broken subquery alias in roam()
-- ============================================================================
-- INCIDENT
--   Every call to roam() failed at runtime with:
--     ERROR 42P01: missing FROM-clause entry for table "u"
--
--   Introduced by the "recent subcategories" rotation block added in
--   20260729131443_roam_v30_subcategory_rotation_score_fn.sql and carried
--   forward into 20260803000000_roam_v31_inline_score_faster.sql:
--
--     SELECT array_agg(u.subcategory_id)   -- <- "u" is NOT in scope here
--     INTO   v_recent_subcats
--     FROM (
--       SELECT u.subcategory_id
--       FROM   seen_urls su
--       JOIN   urls u ON u.id = su.url_id
--       ...
--       LIMIT  3
--     ) t;                                 -- <- subquery is aliased "t"
--
--   The outer array_agg() references the inner table alias "u", which is not
--   visible outside the subquery. Only "t" is. PL/pgSQL does not plan embedded
--   SQL at CREATE FUNCTION time, so this deployed cleanly and then failed on
--   *every* invocation for *every* user.
--
-- USER-VISIBLE IMPACT
--   supabase/functions/roam/index.ts swallows RPC errors in batch/prefetch
--   mode (`if (count > 1) continue`), ends the loop with results.length === 0,
--   and returns 404 "No more URLs to discover". The Android client maps 404 ->
--   RoamState.Exhausted -> "You've seen everything — adjust categories in
--   Settings". So a hard database fault was rendered as a benign UX state and
--   every user was told the ~1.2M-URL pool was exhausted.
--
-- APPROACH
--   This migration patches the deployed function body in place instead of
--   restating all ~600 lines of v31. That keeps the diff provably minimal
--   (one identifier), and makes the fix correct regardless of whether v30 or
--   v31 is the version actually live in a given environment.
--
--   It is strict on purpose: if the expected broken text is not found in any
--   roam() overload, it RAISEs and the migration fails loudly rather than
--   silently leaving discovery broken.
-- ============================================================================

DO $patch$
DECLARE
  v_rec      RECORD;
  v_src      TEXT;
  v_fixed    TEXT;
  v_patched  INT := 0;
  v_found    INT := 0;
BEGIN
  FOR v_rec IN
    SELECT p.oid
    FROM   pg_proc p
    JOIN   pg_namespace n ON n.oid = p.pronamespace
    WHERE  p.proname = 'roam'
      AND  n.nspname = 'public'
  LOOP
    v_found := v_found + 1;
    v_src   := pg_get_functiondef(v_rec.oid);

    -- The only change: qualify the aggregate with the subquery alias "t".
    v_fixed := replace(
      v_src,
      'SELECT array_agg(u.subcategory_id)',
      'SELECT array_agg(t.subcategory_id)'
    );

    IF v_fixed <> v_src THEN
      EXECUTE v_fixed;
      v_patched := v_patched + 1;
      RAISE NOTICE 'roam v32: patched recent-subcategory alias in roam() oid=%', v_rec.oid;
    END IF;
  END LOOP;

  IF v_found = 0 THEN
    RAISE EXCEPTION 'roam v32: no public.roam() function found — refusing to continue';
  END IF;

  IF v_patched = 0 THEN
    RAISE EXCEPTION
      'roam v32: expected broken text "SELECT array_agg(u.subcategory_id)" not found in any of % roam() overload(s). '
      'Either the fix is already applied or the function body changed — verify manually before shipping.',
      v_found;
  END IF;
END
$patch$;

-- ── Post-patch assertion ────────────────────────────────────────────────────
-- Guarantee the bad reference is gone from every overload, so this migration
-- cannot "succeed" while leaving discovery broken.
DO $verify$
DECLARE
  v_bad INT;
BEGIN
  SELECT count(*)
  INTO   v_bad
  FROM   pg_proc p
  JOIN   pg_namespace n ON n.oid = p.pronamespace
  WHERE  p.proname = 'roam'
    AND  n.nspname = 'public'
    AND  pg_get_functiondef(p.oid) LIKE '%array_agg(u.subcategory_id)%';

  IF v_bad > 0 THEN
    RAISE EXCEPTION 'roam v32: % roam() overload(s) still reference array_agg(u.subcategory_id)', v_bad;
  END IF;

  RAISE NOTICE 'roam v32: verified — no roam() overload references the out-of-scope alias';
END
$verify$;
