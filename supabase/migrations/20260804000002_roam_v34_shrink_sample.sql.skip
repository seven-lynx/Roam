-- ============================================================================
-- roam v34 — PERF: shrink candidate sample to fit the 8s statement_timeout
-- ============================================================================
-- HARD CONSTRAINT (measured, not assumed)
--   SELECT rolconfig FROM pg_roles WHERE rolname='authenticated'
--     -> statement_timeout=8s
--
--   roam() measured at 15.4s / 16.6s / 17.9s for three real users. Every call
--   made by a logged-in user therefore aborts with 57014 before returning a
--   row. My Management-API probe only "passed" because that session runs with
--   statement_timeout=2min — it was measuring a path no user can take.
--
--   This is the second, independent cause of the "you've exhausted all urls"
--   reports. v32 fixed the 42P01 alias crash; this addresses the timeout.
--
-- WHY v33 DID NOT HELP
--   v33 swapped BERNOULLI(15) -> SYSTEM(10) expecting an I/O win. Latency did
--   not move (15.4-17.9s), which falsifies "heap scan I/O dominates". The cost
--   is therefore proportional to the number of CANDIDATE ROWS that survive
--   sampling and get pushed through the per-row work: the
--   user_suppressed_domains LIKE anti-join, the seen_urls anti-join, and the
--   inline scoring expression.
--
--   urls now holds 1,577,693 rows and ALL of them are approved, so
--   `approved = TRUE` provides zero selectivity. SYSTEM(10) still handed
--   ~158k rows to that per-row work.
--
-- THIS CHANGE
--   Primary pass: SYSTEM(10) -> SYSTEM(2)   (~32k candidate rows)
--   Fallback     : SYSTEM(30) unchanged — only runs if the primary finds
--                  nothing, so it is the safety net for narrow filters.
--
--   2% of 1.58M is ~32k candidates for a query that ultimately returns ONE
--   url. That is still a very generous pool.
--
-- VERIFY (must be run against the real ceiling, not a 2min admin session)
--   node scripts/verify-roam-rpc.mjs --limit 3
--   The probe now pins statement_timeout=8s to match the authenticated role.
--
-- IF THIS IS STILL TOO SLOW
--   The next lever is structural, not a knob: hoist the suppressed/paywalled
--   domain checks out of the row loop into local arrays (they are already
--   fetched into v_cooled_domains / v_paywalled_domains — the LIKE variant is
--   the outlier) and apply them after LIMIT. See docs/ROAM_EXHAUSTED_INCIDENT.md.
-- ============================================================================

DO $patch$
DECLARE
  v_rec     RECORD;
  v_src     TEXT;
  v_fixed   TEXT;
  v_patched INT := 0;
BEGIN
  FOR v_rec IN
    SELECT p.oid
    FROM   pg_proc p
    JOIN   pg_namespace n ON n.oid = p.pronamespace
    WHERE  p.proname = 'roam'
      AND  n.nspname = 'public'
  LOOP
    v_src   := pg_get_functiondef(v_rec.oid);
    v_fixed := replace(v_src, 'TABLESAMPLE SYSTEM(10)', 'TABLESAMPLE SYSTEM(2)');

    IF v_fixed <> v_src THEN
      EXECUTE v_fixed;
      v_patched := v_patched + 1;
      RAISE NOTICE 'roam v34: primary sample narrowed to SYSTEM(2) on oid=%', v_rec.oid;
    END IF;
  END LOOP;

  IF v_patched = 0 THEN
    RAISE EXCEPTION 'roam v34: found no SYSTEM(10) sample to narrow — verify v33 applied first';
  END IF;
END
$patch$;
