-- ============================================================================
-- roam v33 — PERF: switch candidate sampling from BERNOULLI to SYSTEM
-- ============================================================================
-- CONTEXT
--   v32 fixed the 42P01 alias bug that made roam() fail for every user. With
--   the function executing again, measured latency was 15.6s / 15.7s / 15.9s
--   for three real users (scripts/verify-roam-rpc.mjs).
--
--   That is still an outage: the authenticated statement timeout is well under
--   15s, so roam() raises 57014, the edge function catches it, and — in
--   batch/prefetch mode — returns the same 404 that Android renders as
--   "You've seen everything". Users would stay stuck, just for a new reason.
--
-- ROOT CAUSE OF THE LATENCY
--   `urls TABLESAMPLE BERNOULLI(n)` must scan the ENTIRE heap and roll a dice
--   per row — the sample percentage changes how many rows are *emitted*, not
--   how many pages are *read*. EXPLAIN ANALYZE showed 13s and ~280k buffers on
--   a ~1.24M-row table.
--
--   v31's header records the trigger: "Increase TABLESAMPLE BERNOULLI from
--   5% -> 15% (3x more candidates)". That tripled downstream row volume on top
--   of an already-full heap scan.
--
-- FIX
--   `TABLESAMPLE SYSTEM(n)` samples n% of *pages* via block sampling, so I/O
--   drops roughly proportionally instead of always reading everything.
--
--   Primary pass:  BERNOULLI(15) -> SYSTEM(10)
--     ~10% of pages read (vs 100%), yielding ~124k candidate rows — comparable
--     candidate volume to BERNOULLI(15)'s ~185k, at a fraction of the I/O.
--   Fallback pass: BERNOULLI(30) -> SYSTEM(30)
--     Only runs when the primary pass finds nothing; widened sample retained.
--
-- TRADEOFF (accepted deliberately)
--   SYSTEM sampling is page-correlated, so rows co-located on a page are
--   selected together — slightly "clumpier" randomness than per-row BERNOULLI.
--   Downstream scoring already applies its own randomised ordering, and the
--   fallback pass covers thin result sets. A marginally less uniform sample is
--   vastly preferable to a query that times out and tells every user the pool
--   is empty.
--
-- FOLLOW-UP (not addressed here — see docs/ROAM_EXHAUSTED_INCIDENT.md)
--   The `user_suppressed_domains` anti-join uses
--   `u.domain LIKE '%.' || usd.domain`, which forces a nested loop that
--   re-materialised 26 rows 185,778 times and discarded 4.5M join rows. That
--   filter should be hoisted into a local array and applied after the LIMIT.
-- ============================================================================

DO $patch$
DECLARE
  v_rec     RECORD;
  v_src     TEXT;
  v_fixed   TEXT;
  v_patched INT := 0;
  v_found   INT := 0;
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
    v_fixed := v_src;

    v_fixed := replace(v_fixed, 'TABLESAMPLE BERNOULLI(15)', 'TABLESAMPLE SYSTEM(10)');
    v_fixed := replace(v_fixed, 'TABLESAMPLE BERNOULLI(30)', 'TABLESAMPLE SYSTEM(30)');

    IF v_fixed <> v_src THEN
      EXECUTE v_fixed;
      v_patched := v_patched + 1;
      RAISE NOTICE 'roam v33: switched sampling to SYSTEM in roam() oid=%', v_rec.oid;
    END IF;
  END LOOP;

  IF v_found = 0 THEN
    RAISE EXCEPTION 'roam v33: no public.roam() function found — refusing to continue';
  END IF;

  IF v_patched = 0 THEN
    RAISE EXCEPTION
      'roam v33: no BERNOULLI sampling found in any of % roam() overload(s) — '
      'already applied, or the function body changed. Verify manually.', v_found;
  END IF;
END
$patch$;

-- ── Post-patch assertion ────────────────────────────────────────────────────
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
    AND  pg_get_functiondef(p.oid) LIKE '%TABLESAMPLE BERNOULLI%';

  IF v_bad > 0 THEN
    RAISE EXCEPTION 'roam v33: % roam() overload(s) still use BERNOULLI sampling', v_bad;
  END IF;

  RAISE NOTICE 'roam v33: verified — all roam() sampling is now SYSTEM';
END
$verify$;
