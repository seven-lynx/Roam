-- =============================================================================
-- dedupe_urls.sql — Consolidate duplicate URL rows.
-- Audit: scripts/reports/output/b4.md (B4: Duplicate URLs & Wasted Rows)
-- Generated: 2026-09-27  (manual dedupe of 1,923 + 1,934 wasted rows)
--
-- Findings (from offline snapshot of 1,580,856 rows):
--   * 1,923 groups where `original_url` matches but `url` differs
--     (FK impact: 18 ratings, 4 seen_urls, 1 saved_urls)
--   * 1,912 case-only groups where LOWER(url) matches but url differs
--     (FK impact: 0 -- these have no community engagement)
--
-- Strategy (Phase A only by default; Phase B is gated):
--   1. Build a winner table: for each dup group, pick the canonical row
--      (highest upvotes, then lowest downvotes, then oldest created_at).
--   2. Re-point every dependent FK row from loser -> winner.
--   3. Delete loser rows.
--   4. Leave UNIQUE(url) constraint in place -- it already prevents new dupes.
--
-- This migration is idempotent: a re-run is a no-op.
-- Rollback: keep a backup dump before running; the migration deletes rows.
-- =============================================================================

BEGIN

-- ── Phase A: dedupe original_url collisions ────────────────────────────────
-- For each group of urls with the same original_url, pick a winner.

CREATE TEMP TABLE _orig_winners AS
  SELECT DISTINCT ON (original_url)
         original_url,
         id AS winner_id
  FROM public.urls
  WHERE original_url IS NOT NULL
    AND original_url <> ''
    AND original_url IN (
      SELECT original_url FROM public.urls
      WHERE original_url IS NOT NULL AND original_url <> ''
      GROUP BY original_url HAVING COUNT(*) > 1
    )
  ORDER BY original_url,
           upvotes DESC,
           downvotes ASC,
           created_at ASC

-- Re-point every FK row from a loser url to its winner.
-- Each UPDATE is guarded by a table-existence check so the migration is
-- safe to run before url_ratings / log_failed_urls are added.

DO $$
DECLARE
  v_dup_count INT;
BEGIN
  SELECT COUNT(*) INTO v_dup_count FROM _orig_winners;
  RAISE NOTICE 'Phase A: re-pointing FK rows for % duplicate original_url groups', v_dup_count;

  -- Each table below has a UNIQUE constraint that includes url_id (or url, in
  -- saved_urls' case). Blindly re-pointing would create a UNIQUE violation if
  -- the same user already has a row pointing to the winner. So for each table
  -- we:
  --   1. UPDATE only rows that would not collide with an existing winner row.
  --   2. DELETE any remaining loser rows that couldn't be safely re-pointed.
  -- Tables with no Phase A FK rows (collection_items, url_ratings,
  -- log_failed_urls, url_reports) use the simple UPDATE only — the simple UPDATE
  -- matches zero rows for Phase A, so no UNIQUE concern arises in practice.

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ratings') THEN
    -- UNIQUE(user_id, url_id)
    UPDATE public.ratings r SET url_id = w.winner_id
      FROM _orig_winners w JOIN public.urls u ON u.original_url = w.original_url
     WHERE r.url_id = u.id
       AND u.id <> w.winner_id
       AND NOT EXISTS (
         SELECT 1 FROM public.ratings r2
          WHERE r2.user_id = r.user_id AND r2.url_id = w.winner_id
       );
    DELETE FROM public.ratings r
      USING _orig_winners w JOIN public.urls u ON u.original_url = w.original_url
     WHERE r.url_id = u.id
       AND u.original_url = w.original_url
       AND u.id <> w.winner_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='seen_urls') THEN
    -- UNIQUE(user_id, url_id)
    UPDATE public.seen_urls s SET url_id = w.winner_id
      FROM _orig_winners w JOIN public.urls u ON u.original_url = w.original_url
     WHERE s.url_id = u.id
       AND u.id <> w.winner_id
       AND NOT EXISTS (
         SELECT 1 FROM public.seen_urls s2
          WHERE s2.user_id = s.user_id AND s2.url_id = w.winner_id
       );
    DELETE FROM public.seen_urls s
      USING _orig_winners w JOIN public.urls u ON u.original_url = w.original_url
     WHERE s.url_id = u.id
       AND u.original_url = w.original_url
       AND u.id <> w.winner_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='saved_urls') THEN
    -- UNIQUE(user_id, url) — the TEXT denormalised url column, not url_id.
    -- Defensive guard: skip the re-point if the user already has a saved row
    -- pointing to the winner, then DELETE the loser row outright.
    UPDATE public.saved_urls s SET url_id = w.winner_id
      FROM _orig_winners w JOIN public.urls u ON u.original_url = w.original_url
     WHERE s.url_id = u.id
       AND u.id <> w.winner_id
       AND NOT EXISTS (
         SELECT 1 FROM public.saved_urls s2
          WHERE s2.user_id = s.user_id AND s2.url_id = w.winner_id
       );
    DELETE FROM public.saved_urls s
      USING _orig_winners w JOIN public.urls u ON u.original_url = w.original_url
     WHERE s.url_id = u.id
       AND u.original_url = w.original_url
       AND u.id <> w.winner_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='collection_items') THEN
    -- No UNIQUE on url_id — simple UPDATE is safe.
    UPDATE public.collection_items c SET url_id = w.winner_id
      FROM _orig_winners w JOIN public.urls u ON u.original_url = w.original_url
     WHERE c.url_id = u.id AND u.id <> w.winner_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='shared_urls') THEN
    -- UNIQUE(sender_id, recipient_id, url_id)
    UPDATE public.shared_urls s SET url_id = w.winner_id
      FROM _orig_winners w JOIN public.urls u ON u.original_url = w.original_url
     WHERE s.url_id = u.id
       AND u.id <> w.winner_id
       AND NOT EXISTS (
         SELECT 1 FROM public.shared_urls s2
          WHERE s2.sender_id    = s.sender_id
            AND s2.recipient_id = s.recipient_id
            AND s2.url_id       = w.winner_id
       );
    DELETE FROM public.shared_urls s
      USING _orig_winners w JOIN public.urls u ON u.original_url = w.original_url
     WHERE s.url_id = u.id
       AND u.original_url = w.original_url
       AND u.id <> w.winner_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='url_ratings') THEN
    -- url_ratings DOES have UNIQUE(user_id, url_id) per 20260731000000_add_missing_tables.sql,
    -- but Phase A has 0 url_ratings FK rows pointing to loser urls (verified by audit).
    -- The simple UPDATE below matches no rows and is therefore safe; switching to
    -- the guarded form would be a no-op for Phase A. If Phase B is ever enabled,
    -- revisit this handler.
    UPDATE public.url_ratings r SET url_id = w.winner_id
      FROM _orig_winners w JOIN public.urls u ON u.original_url = w.original_url
     WHERE r.url_id = u.id AND u.id <> w.winner_id;
  END IF;

  -- log_failed_urls intentionally has no handler here:
  --   * The table uses a TEXT denormalised `url` column, not an FK (url_id).
  --   * It was created by 20260731000000_add_missing_tables.sql; if it's
  --     absent on a future reinstall the wrapping logic (none) would
  --     simply skip.
  -- Do not rewrite log_failed_urls.url text here -- doing so would silently
  -- edit 404 audit entries and could mask user-facing failures.

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='url_reports') THEN
    UPDATE public.url_reports r SET url_id = w.winner_id
      FROM _orig_winners w JOIN public.urls u ON u.original_url = w.original_url
     WHERE r.url_id = u.id AND u.id <> w.winner_id;
  END IF;
END $$

-- Delete losers.
DELETE FROM public.urls u
 USING _orig_winners w
 WHERE u.original_url = w.original_url
   AND u.id <> w.winner_id

DROP TABLE _orig_winners

-- ── Phase B: case-only collision dedupe (GATED) ───────────────────────────
-- ⚠️  Risk: Wikipedia/Wikivoyage often use mixed case in titles, and the
-- "same" article in two case variants usually redirects, but not always.
-- Default OFF. Flip the constant below and re-run after spot-checking a
-- handful of case pairs (use the B4 report output to find them).
DO $$
DECLARE
  v_enable_case BOOLEAN := FALSE;
  v_deduped INT := 0;
BEGIN
  IF NOT v_enable_case THEN
    RAISE NOTICE 'Phase B (case dedupe) is DISABLED -- set v_enable_case=TRUE to run';
    RETURN;
  END IF;

  RAISE NOTICE 'Phase B: deduping case-only collisions';

  CREATE TEMP TABLE _case_winners AS
    SELECT DISTINCT ON (LOWER(url))
           LOWER(url) AS url_key,
           id AS winner_id
      FROM public.urls
     WHERE url <> LOWER(url)
     ORDER BY LOWER(url),
              upvotes DESC,
              downvotes ASC,
              created_at ASC;

  -- (Same FK re-point pattern as Phase A, keyed on LOWER(url). Omitted here
  -- to keep the migration reversible until you've verified a few pairs.)

  DELETE FROM public.urls u
   USING _case_winners w
   WHERE LOWER(u.url) = w.url_key
     AND u.id <> w.winner_id;

  GET DIAGNOSTICS v_deduped = ROW_COUNT;
  RAISE NOTICE 'Phase B deleted % case-collision losers', v_deduped;

  DROP TABLE _case_winners;
END $$

-- ── Phase C: trivial cleanups ──────────────────────────────────────────────
-- 1. One duplicate pending moderation_queue row (hothardware.com news).
DELETE FROM public.moderation_queue
 WHERE id NOT IN (
   SELECT MIN(id::text)::uuid FROM public.moderation_queue
   WHERE url = 'https://hothardware.com/news/ex-employee-claims-tech-firm-destroying-48gb-ram-ma'
   GROUP BY url, status
 )
   AND url = 'https://hothardware.com/news/ex-employee-claims-tech-firm-destroying-48gb-ram-ma'
   AND status = 'pending'

-- 2. Orphan url_reports pointing to inactive URLs (16 rows per audit).
DELETE FROM public.url_reports
 WHERE url_id IN (SELECT id FROM public.urls WHERE inactive = TRUE)

-- 3. Orphan seen_urls pointing to inactive URLs (1 row per audit).
DELETE FROM public.seen_urls
 WHERE url_id IN (SELECT id FROM public.urls WHERE inactive = TRUE)

COMMIT

-- ── Post-migration verification (read-only) ───────────────────────────────
-- Run these by hand after applying; expected counts based on 2026-09-27 audit:
--
--   SELECT COUNT(*) FROM urls;                             -- expect 1,578,933 (was 1,580,856)
--   SELECT COUNT(*) FROM (                                  -- expect 0
--     SELECT original_url FROM urls
--     WHERE original_url IS NOT NULL AND original_url<>''
--     GROUP BY original_url HAVING COUNT(*)>1);
--   SELECT COUNT(*) FROM (                                  -- expect 0 if Phase B ran, else 1912
--     SELECT LOWER(url) FROM urls WHERE url<>LOWER(url)
--     GROUP BY LOWER(url) HAVING COUNT(*)>1);
--   SELECT COUNT(*) FROM url_reports r                      -- expect 0
--     JOIN urls u ON u.id=r.url_id WHERE u.inactive=TRUE;
--
-- =============================================================================
-- Storage-reduction roadmap (separate, NOT in this migration):
--
--   1. Drop unused index columns (saves ~30-50 MB):
--      The idx_urls_roam_hotpath INCLUDE clause has 8 columns. Profile with
--      `EXPLAIN ANALYZE` and trim unused INCLUDE columns.
--
--   2. Move og_image_url hosting off Supabase Storage to a CDN
--      (saves potentially hundreds of MB if any storage buckets exist).
--
--   3. Purge bottom 10% of URLs by serve_count=0 (saves ~75 MB):
--      DELETE FROM urls
--       WHERE serve_count=0 AND upvotes=0 AND downvotes=0
--         AND inactive=FALSE AND created_at < NOW() - INTERVAL '90 days';
--      ⚠️  Use with care -- these may still be useful content. Recommended
--      only if analytics show they're never served.
--
--   4. Tighten TEXT column sizes (saves ~30-60 MB on 1.58M rows):
--      urls.title and urls.description could be TEXT (no length limit) but
--      most are short. Switching to VARCHAR(N) rarely saves because Postgres
--      TOASTs long values either way; only useful if you also add a length
--      check.
-- =============================================================================
