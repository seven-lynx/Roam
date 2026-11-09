-- =============================================================================
-- roam() v38 - prefetch stops consuming discovery state
-- =============================================================================
--
-- Issue #122. Prefetch calls wrote a `seen_urls` row and refreshed a 24 h domain
-- cooldown exactly like a real serve; the edge function's `prefetch` flag only
-- gated XP. With the web deck ticking every 4,000 ms in batches of 5
-- (`web/src/components/Cyberdeck3D.tsx:414`, `web/src/lib/roam-buffer.ts:34`) a
-- user who reads 12 URLs in a minute has buffered enough to cool every domain in
-- a narrow scope for a day - the state #118 then had to make cheap to detect.
--
-- Three functions, and `roam()` keeps its signature:
--
--   1. `mark_url_seen(url, cool_domain)` - the one definition of "a serve
--      happened". Writes the seen row and refreshes the cooldown. Client hot
--      paths call it when a buffered URL reaches the screen, because those paths
--      never reach `roam()` (`web/src/lib/scan.ts:120-124`).
--   2. `roam()` - same 6 arguments, so `CREATE OR REPLACE` keeps the OID and the
--      existing REVOKE/GRANT and no second overload can appear. The write block
--      delegates to `mark_url_seen()` unless the prefetch flag is on.
--   3. `roam_prefetch()` - sets the flag transaction-locally, then loops
--      `roam()` accumulating the domains it already returned, so one call yields
--      up to 10 distinct URLs in one round trip and writes nothing.
--
-- Why a GUC instead of a 7th parameter: `CREATE OR REPLACE FUNCTION` cannot add
-- an argument - a 7-argument version lands as a *second overload* beside the
-- 6-argument one, which breaks PostgREST resolution. Dropping and recreating the
-- 6-argument version would work, but it also discards the function's privileges
-- (a replace keeps them), and this way the public RPC surface is untouched.
-- `scripts/verify-roam-rpc.mjs` gained two checks so the flag cannot be dropped
-- silently by a later version: exactly one `public.roam` overload, and that
-- overload still consults the flag.
--
-- The accumulated domain exclusion is not incidental. Without it a non-writing
-- `roam()` returns the same top-scored row on every iteration, `index.ts`
-- collapses the duplicates, and prefetch silently drops from 5 URLs per batch to
-- 1. Domain granularity matches the buffer, which is domain-deduped anyway
-- (`web/src/lib/roam-buffer.ts:117-124`).
--
-- Deploy migration before the edge function: `roam_prefetch` does not exist until
-- this runs, and the reverse order 503s every prefetch. The client already
-- swallows that (`roam-buffer.ts:93-94`), so the failure mode is an empty buffer.
--
-- Rollback: re-apply the v37 body (`20261109043000_roam_v37_bounded_exhaustion.sql`)
-- to `roam()`; the two new functions are additive and can be dropped.
--
-- The function body below is v37's, unchanged except for the write gate at the
-- end. Its header follows, because it still describes the algorithm:
-- =============================================================================


-- =============================================================================
-- roam() v37 - hashable exclusions, and no scan that cannot win
-- =============================================================================
--
-- Issue #118. v36 fixed the COUNT(*) in the exhaustion probe; discovery was
-- still 17-22 s for an account whose whole scope was cooled. Measured on
-- production 2026-11-09 (a559a4be-05c3-46c7-9497-23d49bbeaa5f: 1 subcategory,
-- 41,968 URLs across 198 domains, all 198 of them cooled, 2,000 seen URLs):
--
--   discovery TABLESAMPLE SYSTEM(2) branch          1,019 ms -> 0 rows
--   score-ordered fallback (ORDER BY ... LIMIT 500) 44,320 ms -> 0 rows
--     walked 846,798 index rows + 144,170 filtered = 990,968
--   bare seq scan with only the two array-exclusion
--   predicates (2,000 seen uuids + 803 domains)     22,601 ms
--
-- Three causes, all in the plan, none in the predicates:
--
--   1. 'u.id != ALL(v_seen_ids)' and 'u.domain != ALL(v_cooled_domains)' are
--      ScalarArrayOpExpr. PostgreSQL does not hash 'x <> ALL(array)' - it rescans
--      the array for every row, so 2,803 element comparisons were paid per
--      candidate (~23 us). They now read the source tables directly
--      ('NOT IN (SELECT ... FROM seen_urls ... LIMIT 3000)'), which the planner
--      turns into a hashed SubPlan: build the set once, one hash probe per row.
--      That probe measured 97 ms, down from 19 s. The shape matters:
--      'NOT EXISTS (SELECT 1 FROM unnest(arr) ...)' does NOT hash here - unnest is
--      estimated at 10 rows, so the planner picks a Nested Loop Anti Join and
--      rescans the array per outer row (measured 3.6 s, 4.7M comparisons).
--      Tables carry real statistics; unnest does not.
--   2. The fallback dropped 'ORDER BY u.roam_score_static DESC'. That ordering made
--      it an index walk over every row in the table whenever fewer than 500
--      candidates existed - the only state this branch ever runs in - and it
--      could not stop early (12,876 ms measured). Unordered LIMIT 500 stops as
--      soon as it has 500 rows: 1,381 ms worst case. The outer query still
--      weights candidates by eff_score * (0.7 + 0.3 * random()).
--   3. The fallback ran unconditionally whenever the 2 % sample came up empty,
--      including when the answer was already known to be 'nothing' (every domain
--      in scope cooled). A strict probe over the fallback's own predicate set
--      now gates it - identical, not a subset or superset - so 'probe says no'
--      provably means 'the fallback returns nothing'. The exhaustion retry
--      ('v_pool_check') is gated on the same probe.
--
-- Saturated scope (the reported case) now costs 97 ms instead of 17-22 s; the
-- near-empty path is bounded at ~1.4 s instead of 44 s.
--
-- Semantics: every filter is the same set as before, evaluated differently.
-- 'NOT IN' only differs from '<> ALL' when the right side can be NULL, so each
-- subquery filters '... IS NOT NULL' explicitly - which also lets the planner
-- prove the anti-join is safe. v_excluded stays a '<> ALL' over the caller's
-- parameter array: a handful of domains, with no table behind it.
-- =============================================================================

-- ── mark_url_seen: the one definition of "a serve happened" ──────────────────
-- Written by roam() for a real serve, and by the clients when a *prefetched* URL
-- actually reaches the screen (the web hot path and the Android hot queue never
-- call roam(), so without this a buffered URL would never be recorded at all and
-- report-engagement's UPDATE would match 0 rows).
--
-- p_cool_domain is FALSE only for collection browsing inside roam(), which never
-- cooled domains before this migration either.
CREATE OR REPLACE FUNCTION public.mark_url_seen(
  p_url_id      UUID,
  p_cool_domain BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID := auth.uid();
  v_discovery_mode TEXT;
  v_domain         TEXT;
BEGIN
  -- The caller is always the authenticated user: there is no p_user_id to spoof.
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Same upsert roam() performed inline before v38: a re-seen URL moves to the
  -- top of the 3,000-row exclusion window and its engagement fields reset.
  INSERT INTO seen_urls (user_id, url_id)
  VALUES (v_user_id, p_url_id)
  ON CONFLICT (user_id, url_id) DO UPDATE
    SET seen_at = NOW(), dwell_ms = NULL, skipped = NULL;

  IF NOT COALESCE(p_cool_domain, TRUE) THEN
    RETURN;
  END IF;

  SELECT COALESCE(s.discovery_mode, 'discovery')
  INTO   v_discovery_mode
  FROM   user_settings s
  WHERE  s.user_id = v_user_id;

  IF COALESCE(v_discovery_mode, 'discovery') <> 'discovery' THEN
    RETURN;
  END IF;

  SELECT u.domain INTO v_domain FROM urls u WHERE u.id = p_url_id;
  IF v_domain IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO user_domain_cooldowns (user_id, domain, cooldown_until)
  VALUES (v_user_id, v_domain, NOW() + INTERVAL '24 hours')
  ON CONFLICT (user_id, domain) DO UPDATE
    SET cooldown_until = NOW() + INTERVAL '24 hours';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_url_seen(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.mark_url_seen(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.roam(
  p_user_id          UUID,
  p_collection_id    UUID     DEFAULT NULL,
  p_exclude_domain   TEXT     DEFAULT NULL,
  p_category_id      UUID     DEFAULT NULL,
  p_subcategory_id   UUID     DEFAULT NULL,
  p_exclude_domains  TEXT[]   DEFAULT NULL
)
RETURNS TABLE (
  id             UUID,
  url            TEXT,
  title          TEXT,
  description    TEXT,
  og_image_url   TEXT,
  category_id    UUID,
  subcategory_id UUID,
  wilson_score   DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
#variable_conflict use_column
DECLARE
  v_url_id              UUID;
  v_url_domain          TEXT;
  v_langs               TEXT[];
  v_skip_paywall        BOOLEAN;
  v_discovery_mode      TEXT;
  v_allowed_subcat_ids  UUID[];
  v_has_categories      BOOLEAN;
  v_adjacent_subcat_id  UUID;
  v_effective_subcat_id UUID;
  v_deep_dive_subcats   UUID[];
  v_seen_ids            UUID[];
  v_cooled_domains      TEXT[];
  v_paywalled_domains   TEXT[];
  v_suppressed_domains  TEXT[];
  v_excluded            TEXT[];
  v_skip_penalty_ids    UUID[];
  v_serendipity_subcat  UUID;
  v_recent_subcats      UUID[];
  v_pool_check          BOOLEAN;
  v_strict_pool         BOOLEAN;
  v_score_subcats       UUID[];
  v_score_weights       DOUBLE PRECISION[];
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- ── Load user settings ────────────────────────────────────────────────────
  SELECT
    COALESCE(s.preferred_languages, ARRAY['en']),
    COALESCE(s.skip_paywalled, FALSE),
    COALESCE(s.discovery_mode, 'discovery')
  INTO v_langs, v_skip_paywall, v_discovery_mode
  FROM user_settings s
  WHERE s.user_id = p_user_id;

  IF v_langs           IS NULL THEN v_langs           := ARRAY['en']; END IF;
  IF v_skip_paywall    IS NULL THEN v_skip_paywall    := FALSE;        END IF;
  IF v_discovery_mode  IS NULL THEN v_discovery_mode  := 'discovery';  END IF;

  -- ── Merge exclude domains ─────────────────────────────────────────────────
  IF p_exclude_domains IS NOT NULL AND array_length(p_exclude_domains, 1) > 0 THEN
    v_excluded := p_exclude_domains;
    IF p_exclude_domain IS NOT NULL AND NOT p_exclude_domain = ANY(v_excluded) THEN
      v_excluded := array_append(v_excluded, p_exclude_domain);
    END IF;
  ELSIF p_exclude_domain IS NOT NULL THEN
    v_excluded := ARRAY[p_exclude_domain];
  END IF;

  -- ── Load exclusion sets as arrays ─────────────────────────────────────────
  SELECT array_agg(url_id)
  INTO   v_seen_ids
  FROM (
    SELECT url_id FROM seen_urls
    WHERE  user_id = p_user_id
    ORDER  BY seen_at DESC
    LIMIT  3000
  ) t;

  SELECT array_agg(url_id)
  INTO   v_skip_penalty_ids
  FROM   seen_urls
  WHERE  user_id = p_user_id
    AND  skipped = TRUE
    AND  seen_at > NOW() - INTERVAL '90 days';

  -- Last 3 subcategories served (for rotation/penalty)
  SELECT array_agg(t.subcategory_id)
  INTO   v_recent_subcats
  FROM (
    SELECT u.subcategory_id
    FROM   seen_urls su
    JOIN   urls u ON u.id = su.url_id
    WHERE  su.user_id = p_user_id
      AND  u.subcategory_id IS NOT NULL
    ORDER  BY su.seen_at DESC
    LIMIT  3
  ) t;

  SELECT array_agg(domain)
  INTO   v_cooled_domains
  FROM   user_domain_cooldowns
  WHERE  user_id = p_user_id
    AND  cooldown_until > NOW();

  SELECT array_agg(usd.domain)
  INTO   v_suppressed_domains
  FROM   user_suppressed_domains usd
  WHERE  usd.user_id = p_user_id
    AND  usd.suppressed_until > NOW();

  SELECT array_agg(uis.subcategory_id ORDER BY uis.subcategory_id),
         array_agg(uis.calibrated_weight ORDER BY uis.subcategory_id)
  INTO   v_score_subcats, v_score_weights
  FROM   user_interest_scores uis
  WHERE  uis.user_id = p_user_id;

  IF v_skip_paywall THEN
    SELECT array_agg(domain)
    INTO   v_paywalled_domains
    FROM   paywalled_domains;
  END IF;

  SELECT array_agg(DISTINCT sc.id)
  INTO   v_allowed_subcat_ids
  FROM   subcategories sc
  WHERE  sc.id IN (
           SELECT uc.subcategory_id FROM user_categories uc
           WHERE  uc.user_id = p_user_id AND uc.subcategory_id IS NOT NULL
         )
     OR  sc.category_id IN (
           SELECT uc.category_id FROM user_categories uc
           WHERE  uc.user_id        = p_user_id
             AND  uc.subcategory_id IS NULL
             AND  uc.category_id NOT IN (
                    SELECT uc2.category_id FROM user_categories uc2
                    WHERE  uc2.user_id = p_user_id AND uc2.subcategory_id IS NOT NULL
                  )
         );

  SELECT EXISTS (SELECT 1 FROM user_categories WHERE user_id = p_user_id)
  INTO v_has_categories;

  v_serendipity_subcat := NULL;
  IF v_discovery_mode = 'discovery'
     AND random() < 0.05
     AND p_subcategory_id IS NULL
     AND p_category_id    IS NULL
     AND p_collection_id  IS NULL
     AND v_allowed_subcat_ids IS NOT NULL
  THEN
    SELECT sc.id INTO v_serendipity_subcat
    FROM subcategories sc
    WHERE sc.id = ANY(v_allowed_subcat_ids)
      AND NOT EXISTS (
        SELECT 1 FROM seen_urls su
        JOIN urls u ON u.id = su.url_id
        WHERE su.user_id = p_user_id
          AND u.subcategory_id = sc.id
      )
    ORDER BY random()
    LIMIT 1;
  END IF;

  IF v_discovery_mode = 'deep_dive'
     AND p_subcategory_id IS NULL
     AND p_category_id    IS NULL
     AND p_collection_id  IS NULL
  THEN
    SELECT array_agg(uis.subcategory_id)
    INTO   v_deep_dive_subcats
    FROM (
      SELECT uis.subcategory_id
      FROM   user_interest_scores uis
      WHERE  uis.user_id = p_user_id
        AND  uis.calibrated_weight > 1.0
      ORDER  BY uis.calibrated_weight DESC
      LIMIT  3
    ) uis;
    IF v_deep_dive_subcats IS NULL OR array_length(v_deep_dive_subcats, 1) = 0 THEN
      v_deep_dive_subcats := v_allowed_subcat_ids;
    END IF;
  END IF;

  v_adjacent_subcat_id := NULL;
  IF v_discovery_mode = 'discovery'
     AND random() < 0.25
     AND p_subcategory_id IS NULL
     AND p_category_id    IS NULL
     AND p_collection_id  IS NULL
     AND v_serendipity_subcat IS NULL
  THEN
    SELECT
      CASE WHEN ips.subcategory_a_id = uis_top.top_subcat
           THEN ips.subcategory_b_id
           ELSE ips.subcategory_a_id
      END
    INTO v_adjacent_subcat_id
    FROM (
      SELECT uis.subcategory_id AS top_subcat
      FROM   user_interest_scores uis
      WHERE  uis.user_id = p_user_id
      ORDER  BY uis.calibrated_weight DESC
      LIMIT  1
    ) uis_top
    JOIN interest_pair_scores ips
      ON  ips.user_id = p_user_id
      AND (   ips.subcategory_a_id = uis_top.top_subcat
           OR ips.subcategory_b_id = uis_top.top_subcat)
      AND ips.pair_weight > 1.0
    ORDER BY ips.pair_weight DESC
    LIMIT 1;
  END IF;

  v_effective_subcat_id := COALESCE(p_subcategory_id, v_adjacent_subcat_id, v_serendipity_subcat);

  -- ═══════════════════════════════════════════════════════════════════════════
  --  COLLECTION MODE
  -- ═══════════════════════════════════════════════════════════════════════════
  IF p_collection_id IS NOT NULL THEN

    SELECT c.id INTO v_url_id
    FROM (
      SELECT u.id,
             (u.roam_score_static
               + CASE WHEN (COALESCE(u.upvotes,0) + COALESCE(u.downvotes,0)) = 0 THEN 0.15 ELSE 0 END
               + CASE WHEN COALESCE(u.serve_count, 0) = 0 THEN 0.25
                      ELSE 1.0 / (1 + COALESCE(u.serve_count, 0) * 0.1) END)
               * LEAST(GREATEST(COALESCE(
                   v_score_weights[array_position(v_score_subcats, u.subcategory_id)],
                   1.0), 0.4), 2.0)
               * CASE
                   WHEN u.published_at IS NULL THEN 0.7
                   ELSE GREATEST(
                     EXP(-0.0003 * GREATEST(
                       EXTRACT(EPOCH FROM (NOW() - u.published_at)) / 86400.0, 0
                     )), 0.2)
                 END
               * CASE
                   WHEN v_recent_subcats IS NOT NULL AND u.subcategory_id = ANY(v_recent_subcats) THEN 0.3
                   ELSE 1.0
                 END
               AS eff_score
      FROM   urls u TABLESAMPLE SYSTEM(2)
      INNER  JOIN collection_items ci ON ci.url_id = u.id
      WHERE  ci.collection_id = p_collection_id
        AND  u.approved       = TRUE
        AND  u.wilson_score   > -0.1
        AND  u.language       = ANY(v_langs)
        AND  (v_excluded IS NULL OR u.domain != ALL(v_excluded))
        AND  (v_suppressed_domains IS NULL OR u.domain NOT IN (SELECT sd.domain FROM user_suppressed_domains sd
                                            WHERE sd.user_id = p_user_id
                                              AND sd.suppressed_until > NOW()
                                              AND sd.domain IS NOT NULL))
        AND  (NOT v_skip_paywall OR v_paywalled_domains IS NULL OR u.domain NOT IN (SELECT pd.domain FROM paywalled_domains pd
                                            WHERE pd.domain IS NOT NULL))
        AND  (v_seen_ids IS NULL OR u.id NOT IN (SELECT su.url_id FROM seen_urls su
                                       WHERE su.user_id = p_user_id AND su.url_id IS NOT NULL
                                       ORDER BY su.seen_at DESC LIMIT 3000))
        AND  (v_skip_penalty_ids IS NULL OR u.id NOT IN (SELECT sp.url_id FROM seen_urls sp
                                       WHERE sp.user_id = p_user_id AND sp.skipped = TRUE
                                         AND sp.seen_at > NOW() - INTERVAL '90 days'
                                         AND sp.url_id IS NOT NULL))
    ) c
    ORDER BY c.eff_score * (0.7 + 0.3 * random()) DESC
    LIMIT 1;

    IF v_url_id IS NULL THEN
      -- Issue #118: the fallback below is a scan. If nothing in scope can be
      -- served, say so with one probe instead of proving it row by row.
      SELECT EXISTS (
        SELECT 1
        FROM   urls u
        INNER  JOIN collection_items ci ON ci.url_id = u.id
        WHERE  ci.collection_id = p_collection_id
          AND  u.approved       = TRUE
          AND  u.wilson_score   > -0.1
          AND  u.language       = ANY(v_langs)
          AND  (v_excluded IS NULL OR u.domain != ALL(v_excluded))
          AND  (v_suppressed_domains IS NULL OR u.domain NOT IN (SELECT sd.domain FROM user_suppressed_domains sd
                                            WHERE sd.user_id = p_user_id
                                              AND sd.suppressed_until > NOW()
                                              AND sd.domain IS NOT NULL))
          AND  (NOT v_skip_paywall OR v_paywalled_domains IS NULL OR u.domain NOT IN (SELECT pd.domain FROM paywalled_domains pd
                                            WHERE pd.domain IS NOT NULL))
          AND  (v_seen_ids IS NULL OR u.id NOT IN (SELECT su.url_id FROM seen_urls su
                                       WHERE su.user_id = p_user_id AND su.url_id IS NOT NULL
                                       ORDER BY su.seen_at DESC LIMIT 3000))
          AND  (v_skip_penalty_ids IS NULL OR u.id NOT IN (SELECT sp.url_id FROM seen_urls sp
                                       WHERE sp.user_id = p_user_id AND sp.skipped = TRUE
                                         AND sp.seen_at > NOW() - INTERVAL '90 days'
                                         AND sp.url_id IS NOT NULL))
      )
      INTO v_strict_pool;
    END IF;

    IF v_url_id IS NULL AND v_strict_pool THEN
      SELECT c.id INTO v_url_id
      FROM (
        SELECT u.id,
               (u.roam_score_static
                 + CASE WHEN (COALESCE(u.upvotes,0) + COALESCE(u.downvotes,0)) = 0 THEN 0.15 ELSE 0 END
                 + CASE WHEN COALESCE(u.serve_count, 0) = 0 THEN 0.25
                        ELSE 1.0 / (1 + COALESCE(u.serve_count, 0) * 0.1) END)
                 * LEAST(GREATEST(COALESCE(
                     v_score_weights[array_position(v_score_subcats, u.subcategory_id)],
                     1.0), 0.4), 2.0)
                 * CASE
                     WHEN u.published_at IS NULL THEN 0.7
                     ELSE GREATEST(
                       EXP(-0.0003 * GREATEST(
                         EXTRACT(EPOCH FROM (NOW() - u.published_at)) / 86400.0, 0
                       )), 0.2)
                   END
                 * CASE
                     WHEN v_recent_subcats IS NOT NULL AND u.subcategory_id = ANY(v_recent_subcats) THEN 0.3
                     ELSE 1.0
                   END
                 AS eff_score
        FROM   urls u
        INNER  JOIN collection_items ci ON ci.url_id = u.id
        WHERE  ci.collection_id = p_collection_id
          AND  u.approved       = TRUE
          AND  u.wilson_score   > -0.1
          AND  u.language       = ANY(v_langs)
          AND  (v_excluded IS NULL OR u.domain != ALL(v_excluded))
          AND  (v_suppressed_domains IS NULL OR u.domain NOT IN (SELECT sd.domain FROM user_suppressed_domains sd
                                            WHERE sd.user_id = p_user_id
                                              AND sd.suppressed_until > NOW()
                                              AND sd.domain IS NOT NULL))
          AND  (NOT v_skip_paywall OR v_paywalled_domains IS NULL OR u.domain NOT IN (SELECT pd.domain FROM paywalled_domains pd
                                            WHERE pd.domain IS NOT NULL))
          AND  (v_seen_ids IS NULL OR u.id NOT IN (SELECT su.url_id FROM seen_urls su
                                       WHERE su.user_id = p_user_id AND su.url_id IS NOT NULL
                                       ORDER BY su.seen_at DESC LIMIT 3000))
          AND  (v_skip_penalty_ids IS NULL OR u.id NOT IN (SELECT sp.url_id FROM seen_urls sp
                                       WHERE sp.user_id = p_user_id AND sp.skipped = TRUE
                                         AND sp.seen_at > NOW() - INTERVAL '90 days'
                                         AND sp.url_id IS NOT NULL))
        -- Issue #118: no ORDER BY on purpose. Sorting by roam_score_static turned
        -- this into an index walk over every row in the table (990,968 rows,
        -- 12,876 ms measured) whenever fewer than 500 candidates existed - the
        -- only state this branch runs in. Unordered LIMIT 500 stops as soon as
        -- it has 500 rows; the outer query still weights by eff_score + random().
        LIMIT  500
      ) c
      ORDER BY c.eff_score * (0.7 + 0.3 * random()) DESC
      LIMIT 1;
    END IF;

  ELSE

    SELECT c.id INTO v_url_id
    FROM (
      SELECT u.id,
             (u.roam_score_static
               + CASE WHEN (COALESCE(u.upvotes,0) + COALESCE(u.downvotes,0)) = 0 THEN 0.15 ELSE 0 END
               + CASE WHEN COALESCE(u.serve_count, 0) = 0 THEN 0.25
                      ELSE 1.0 / (1 + COALESCE(u.serve_count, 0) * 0.1) END)
               * LEAST(GREATEST(COALESCE(
                   v_score_weights[array_position(v_score_subcats, u.subcategory_id)],
                   1.0), 0.4), 2.0)
               * CASE
                   WHEN u.published_at IS NULL THEN 0.7
                   ELSE GREATEST(
                     EXP(-0.0003 * GREATEST(
                       EXTRACT(EPOCH FROM (NOW() - u.published_at)) / 86400.0, 0
                     )), 0.2)
                 END
               * CASE
                   WHEN v_recent_subcats IS NOT NULL AND u.subcategory_id = ANY(v_recent_subcats) THEN 0.3
                   ELSE 1.0
                 END
               AS eff_score
      FROM   urls u TABLESAMPLE SYSTEM(2)
      WHERE  u.approved     = TRUE
        AND  u.wilson_score > -0.1
        AND  u.language     = ANY(v_langs)
        AND  (v_excluded IS NULL OR u.domain != ALL(v_excluded))
        AND  (p_category_id IS NULL OR u.category_id = p_category_id)
        AND  (v_suppressed_domains IS NULL OR u.domain NOT IN (SELECT sd.domain FROM user_suppressed_domains sd
                                            WHERE sd.user_id = p_user_id
                                              AND sd.suppressed_until > NOW()
                                              AND sd.domain IS NOT NULL))
        AND  (NOT v_skip_paywall OR v_paywalled_domains IS NULL OR u.domain NOT IN (SELECT pd.domain FROM paywalled_domains pd
                                            WHERE pd.domain IS NOT NULL))
        AND  (
               v_discovery_mode <> 'discovery'
               OR v_cooled_domains IS NULL
               OR u.domain NOT IN (SELECT cd.domain FROM user_domain_cooldowns cd
                                            WHERE cd.user_id = p_user_id
                                              AND cd.cooldown_until > NOW()
                                              AND cd.domain IS NOT NULL)
             )
        AND  (v_effective_subcat_id IS NULL OR u.subcategory_id = v_effective_subcat_id)
        AND  (
               v_deep_dive_subcats IS NULL
               OR u.subcategory_id = ANY(v_deep_dive_subcats)
             )
        AND  (
               p_category_id IS NOT NULL
               OR v_effective_subcat_id IS NOT NULL
               OR v_deep_dive_subcats IS NOT NULL
               OR NOT v_has_categories
               OR (v_allowed_subcat_ids IS NOT NULL AND u.subcategory_id = ANY(v_allowed_subcat_ids))
               OR (u.subcategory_id IS NULL AND v_has_categories)
             )
        AND  (v_seen_ids IS NULL OR u.id NOT IN (SELECT su.url_id FROM seen_urls su
                                       WHERE su.user_id = p_user_id AND su.url_id IS NOT NULL
                                       ORDER BY su.seen_at DESC LIMIT 3000))
        AND  (v_skip_penalty_ids IS NULL OR u.id NOT IN (SELECT sp.url_id FROM seen_urls sp
                                       WHERE sp.user_id = p_user_id AND sp.skipped = TRUE
                                         AND sp.seen_at > NOW() - INTERVAL '90 days'
                                         AND sp.url_id IS NOT NULL))
    ) c
    ORDER BY c.eff_score * (0.7 + 0.3 * random()) DESC
    LIMIT 1;

    IF v_url_id IS NULL THEN
      -- Issue #118: the fallback below is a scan. If nothing in scope can be
      -- served, say so with one probe instead of proving it row by row.
      SELECT EXISTS (
        SELECT 1
        FROM   urls u
        WHERE  u.approved     = TRUE
          AND  u.wilson_score > -0.1
          AND  u.language     = ANY(v_langs)
          AND  (v_excluded IS NULL OR u.domain != ALL(v_excluded))
          AND  (p_category_id IS NULL OR u.category_id = p_category_id)
          AND  (v_suppressed_domains IS NULL OR u.domain NOT IN (SELECT sd.domain FROM user_suppressed_domains sd
                                            WHERE sd.user_id = p_user_id
                                              AND sd.suppressed_until > NOW()
                                              AND sd.domain IS NOT NULL))
          AND  (NOT v_skip_paywall OR v_paywalled_domains IS NULL OR u.domain NOT IN (SELECT pd.domain FROM paywalled_domains pd
                                            WHERE pd.domain IS NOT NULL))
          AND  (
                 v_discovery_mode <> 'discovery'
                 OR v_cooled_domains IS NULL
                 OR u.domain NOT IN (SELECT cd.domain FROM user_domain_cooldowns cd
                                            WHERE cd.user_id = p_user_id
                                              AND cd.cooldown_until > NOW()
                                              AND cd.domain IS NOT NULL)
               )
          AND  (v_effective_subcat_id IS NULL OR u.subcategory_id = v_effective_subcat_id)
          AND  (
                 v_deep_dive_subcats IS NULL
                 OR u.subcategory_id = ANY(v_deep_dive_subcats)
               )
          AND  (
                 p_category_id IS NOT NULL
                 OR v_effective_subcat_id IS NOT NULL
                 OR v_deep_dive_subcats IS NOT NULL
                 OR NOT v_has_categories
                 OR (v_allowed_subcat_ids IS NOT NULL AND u.subcategory_id = ANY(v_allowed_subcat_ids))
                 OR (u.subcategory_id IS NULL AND v_has_categories)
               )
          AND  (v_seen_ids IS NULL OR u.id NOT IN (SELECT su.url_id FROM seen_urls su
                                       WHERE su.user_id = p_user_id AND su.url_id IS NOT NULL
                                       ORDER BY su.seen_at DESC LIMIT 3000))
          AND  (v_skip_penalty_ids IS NULL OR u.id NOT IN (SELECT sp.url_id FROM seen_urls sp
                                       WHERE sp.user_id = p_user_id AND sp.skipped = TRUE
                                         AND sp.seen_at > NOW() - INTERVAL '90 days'
                                         AND sp.url_id IS NOT NULL))
      )
      INTO v_strict_pool;
    END IF;

    IF v_url_id IS NULL AND v_strict_pool THEN
      SELECT c.id INTO v_url_id
      FROM (
        SELECT u.id,
               (u.roam_score_static
                 + CASE WHEN (COALESCE(u.upvotes,0) + COALESCE(u.downvotes,0)) = 0 THEN 0.15 ELSE 0 END
                 + CASE WHEN COALESCE(u.serve_count, 0) = 0 THEN 0.25
                        ELSE 1.0 / (1 + COALESCE(u.serve_count, 0) * 0.1) END)
                 * LEAST(GREATEST(COALESCE(
                     v_score_weights[array_position(v_score_subcats, u.subcategory_id)],
                     1.0), 0.4), 2.0)
                 * CASE
                     WHEN u.published_at IS NULL THEN 0.7
                     ELSE GREATEST(
                       EXP(-0.0003 * GREATEST(
                         EXTRACT(EPOCH FROM (NOW() - u.published_at)) / 86400.0, 0
                       )), 0.2)
                   END
                 * CASE
                     WHEN v_recent_subcats IS NOT NULL AND u.subcategory_id = ANY(v_recent_subcats) THEN 0.3
                     ELSE 1.0
                   END
                 AS eff_score
        FROM   urls u
        WHERE  u.approved     = TRUE
          AND  u.wilson_score > -0.1
          AND  u.language     = ANY(v_langs)
          AND  (v_excluded IS NULL OR u.domain != ALL(v_excluded))
          AND  (p_category_id IS NULL OR u.category_id = p_category_id)
          AND  (v_suppressed_domains IS NULL OR u.domain NOT IN (SELECT sd.domain FROM user_suppressed_domains sd
                                            WHERE sd.user_id = p_user_id
                                              AND sd.suppressed_until > NOW()
                                              AND sd.domain IS NOT NULL))
          AND  (NOT v_skip_paywall OR v_paywalled_domains IS NULL OR u.domain NOT IN (SELECT pd.domain FROM paywalled_domains pd
                                            WHERE pd.domain IS NOT NULL))
          AND  (
                 v_discovery_mode <> 'discovery'
                 OR v_cooled_domains IS NULL
                 OR u.domain NOT IN (SELECT cd.domain FROM user_domain_cooldowns cd
                                            WHERE cd.user_id = p_user_id
                                              AND cd.cooldown_until > NOW()
                                              AND cd.domain IS NOT NULL)
               )
          AND  (v_effective_subcat_id IS NULL OR u.subcategory_id = v_effective_subcat_id)
          AND  (
                 v_deep_dive_subcats IS NULL
                 OR u.subcategory_id = ANY(v_deep_dive_subcats)
               )
          AND  (
                 p_category_id IS NOT NULL
                 OR v_effective_subcat_id IS NOT NULL
                 OR v_deep_dive_subcats IS NOT NULL
                 OR NOT v_has_categories
                 OR (v_allowed_subcat_ids IS NOT NULL AND u.subcategory_id = ANY(v_allowed_subcat_ids))
                 OR (u.subcategory_id IS NULL AND v_has_categories)
               )
          AND  (v_seen_ids IS NULL OR u.id NOT IN (SELECT su.url_id FROM seen_urls su
                                       WHERE su.user_id = p_user_id AND su.url_id IS NOT NULL
                                       ORDER BY su.seen_at DESC LIMIT 3000))
          AND  (v_skip_penalty_ids IS NULL OR u.id NOT IN (SELECT sp.url_id FROM seen_urls sp
                                       WHERE sp.user_id = p_user_id AND sp.skipped = TRUE
                                         AND sp.seen_at > NOW() - INTERVAL '90 days'
                                         AND sp.url_id IS NOT NULL))
        -- Issue #118: no ORDER BY on purpose. Sorting by roam_score_static turned
        -- this into an index walk over every row in the table (990,968 rows,
        -- 12,876 ms measured) whenever fewer than 500 candidates existed - the
        -- only state this branch runs in. Unordered LIMIT 500 stops as soon as
        -- it has 500 rows; the outer query still weights by eff_score + random().
        LIMIT  500
      ) c
      ORDER BY c.eff_score * (0.7 + 0.3 * random()) DESC
      LIMIT 1;
    END IF;

  END IF;

  IF v_url_id IS NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM   urls u
      WHERE  u.approved     = TRUE
        AND  u.wilson_score > -0.1
        AND  u.language     = ANY(v_langs)
        AND  (p_category_id IS NULL OR u.category_id = p_category_id)
        AND  (
               p_category_id IS NOT NULL
               OR v_effective_subcat_id IS NOT NULL
               OR v_deep_dive_subcats IS NOT NULL
               OR NOT v_has_categories
               OR (v_allowed_subcat_ids IS NOT NULL AND u.subcategory_id = ANY(v_allowed_subcat_ids))
               OR (u.subcategory_id IS NULL AND v_has_categories)
             )
        AND  (v_seen_ids IS NULL OR u.id NOT IN (SELECT su.url_id FROM seen_urls su
                                       WHERE su.user_id = p_user_id AND su.url_id IS NOT NULL
                                       ORDER BY su.seen_at DESC LIMIT 3000))
    )
    INTO v_pool_check;

    -- v_strict_pool is the strict set (cooldowns and every other filter
    -- included); when it is empty this retry cannot succeed, so skip it.
    IF v_pool_check AND v_strict_pool THEN
      IF p_collection_id IS NOT NULL THEN
        SELECT c.id INTO v_url_id
        FROM (
          SELECT u.id,
                 (u.roam_score_static
                   + CASE WHEN (COALESCE(u.upvotes,0) + COALESCE(u.downvotes,0)) = 0 THEN 0.15 ELSE 0 END
                   + CASE WHEN COALESCE(u.serve_count, 0) = 0 THEN 0.25
                          ELSE 1.0 / (1 + COALESCE(u.serve_count, 0) * 0.1) END)
                   * LEAST(GREATEST(COALESCE(
                       v_score_weights[array_position(v_score_subcats, u.subcategory_id)],
                       1.0), 0.4), 2.0)
                   * CASE
                       WHEN u.published_at IS NULL THEN 0.7
                       ELSE GREATEST(
                         EXP(-0.0003 * GREATEST(
                           EXTRACT(EPOCH FROM (NOW() - u.published_at)) / 86400.0, 0
                         )), 0.2)
                     END
                   * CASE
                       WHEN v_recent_subcats IS NOT NULL AND u.subcategory_id = ANY(v_recent_subcats) THEN 0.3
                       ELSE 1.0
                     END
                   AS eff_score
          FROM   urls u TABLESAMPLE SYSTEM(5)
          INNER  JOIN collection_items ci ON ci.url_id = u.id
          WHERE  ci.collection_id = p_collection_id
            AND  u.approved       = TRUE
            AND  u.wilson_score   > -0.1
            AND  u.language       = ANY(v_langs)
            AND  (NOT v_skip_paywall OR v_paywalled_domains IS NULL OR u.domain NOT IN (SELECT pd.domain FROM paywalled_domains pd
                                            WHERE pd.domain IS NOT NULL))
            AND  (v_seen_ids IS NULL OR u.id NOT IN (SELECT su.url_id FROM seen_urls su
                                       WHERE su.user_id = p_user_id AND su.url_id IS NOT NULL
                                       ORDER BY su.seen_at DESC LIMIT 3000))
        ) c
        ORDER BY c.eff_score * (0.7 + 0.3 * random()) DESC
        LIMIT 1;
      ELSE
        SELECT c.id INTO v_url_id
        FROM (
          SELECT u.id,
                 (u.roam_score_static
                   + CASE WHEN (COALESCE(u.upvotes,0) + COALESCE(u.downvotes,0)) = 0 THEN 0.15 ELSE 0 END
                   + CASE WHEN COALESCE(u.serve_count, 0) = 0 THEN 0.25
                          ELSE 1.0 / (1 + COALESCE(u.serve_count, 0) * 0.1) END)
                   * LEAST(GREATEST(COALESCE(
                       v_score_weights[array_position(v_score_subcats, u.subcategory_id)],
                       1.0), 0.4), 2.0)
                   * CASE
                       WHEN u.published_at IS NULL THEN 0.7
                       ELSE GREATEST(
                         EXP(-0.0003 * GREATEST(
                           EXTRACT(EPOCH FROM (NOW() - u.published_at)) / 86400.0, 0
                         )), 0.2)
                     END
                   * CASE
                       WHEN v_recent_subcats IS NOT NULL AND u.subcategory_id = ANY(v_recent_subcats) THEN 0.3
                       ELSE 1.0
                     END
                   AS eff_score
          FROM   urls u TABLESAMPLE SYSTEM(5)
          WHERE  u.approved     = TRUE
            AND  u.wilson_score > -0.1
            AND  u.language     = ANY(v_langs)
            AND  (p_category_id IS NULL OR u.category_id = p_category_id)
            AND  (NOT v_skip_paywall OR v_paywalled_domains IS NULL OR u.domain NOT IN (SELECT pd.domain FROM paywalled_domains pd
                                            WHERE pd.domain IS NOT NULL))
            AND  (
                   p_category_id IS NOT NULL
                   OR NOT v_has_categories
                   OR (v_allowed_subcat_ids IS NOT NULL AND u.subcategory_id = ANY(v_allowed_subcat_ids))
                   OR (u.subcategory_id IS NULL AND v_has_categories)
                 )
            AND  (v_seen_ids IS NULL OR u.id NOT IN (SELECT su.url_id FROM seen_urls su
                                       WHERE su.user_id = p_user_id AND su.url_id IS NOT NULL
                                       ORDER BY su.seen_at DESC LIMIT 3000))
        ) c
        ORDER BY c.eff_score * (0.7 + 0.3 * random()) DESC
        LIMIT 1;
      END IF;
    END IF;
  END IF;

  IF v_url_id IS NOT NULL THEN
    SELECT domain INTO v_url_domain FROM urls WHERE id = v_url_id;
    IF v_url_domain IS NOT NULL THEN
      IF (v_suppressed_domains IS NOT NULL AND EXISTS (
            SELECT 1 FROM unnest(v_suppressed_domains) AS sd(d)
            WHERE v_url_domain = sd.d OR v_url_domain LIKE ('%.' || sd.d)
          ))
         OR (v_excluded IS NOT NULL AND EXISTS (
            SELECT 1 FROM unnest(v_excluded) AS ex(d)
            WHERE v_url_domain = ex.d OR v_url_domain LIKE ('%.' || ex.d)
          ))
      THEN
        v_url_id := NULL;
        v_url_domain := NULL;
      END IF;
    END IF;
  END IF;

  IF v_url_id IS NOT NULL THEN
    -- Issue #122. A real serve records state; a prefetch call returns the row and
    -- records nothing. The flag arrives as a transaction-local GUC because adding
    -- an argument would create a second overload (see the header). Clients that
    -- serve a *buffered* URL call mark_url_seen() themselves, so the row is
    -- written exactly once, when the URL reaches the screen.
    IF COALESCE(current_setting('roam.prefetch', TRUE), 'off') <> 'on' THEN
      PERFORM public.mark_url_seen(v_url_id, p_collection_id IS NULL);
    END IF;
  END IF;

  RETURN QUERY
  SELECT u.id, u.url, u.title, u.description, u.og_image_url,
         u.category_id, u.subcategory_id, u.wilson_score
  FROM   urls u
  WHERE  u.id = v_url_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.roam(UUID, UUID, TEXT, UUID, UUID, TEXT[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.roam(UUID, UUID, TEXT, UUID, UUID, TEXT[]) TO authenticated;

-- ── roam_prefetch: batch discovery that records nothing ──────────────────────
-- Replaces the edge function's sequential loop of `roam()` calls for the
-- `prefetch: true` path. Three things change at once, all of them wanted:
--
--   * no write - the flag is on for the whole transaction, so every nested
--     roam() returns its row and skips mark_url_seen();
--   * N distinct URLs in one round trip - the domains already returned are
--     accumulated and passed as the exclusion array, which is what keeps a
--     non-writing roam() from returning the same top-scored row N times. Domain
--     granularity matches the client buffer, which is domain-deduped anyway.
--   * fewer RPC calls - the web deck ticked 5 calls every 4,000 ms before this.
--
-- The domain is read from `urls` rather than parsed out of `url`, so the
-- exclusion array uses exactly the same normalization as the cooldown table.
CREATE OR REPLACE FUNCTION public.roam_prefetch(
  p_user_id         UUID,
  p_count           INTEGER DEFAULT 5,
  p_exclude_domains TEXT[]  DEFAULT NULL,
  p_category_id     UUID    DEFAULT NULL,
  p_subcategory_id  UUID    DEFAULT NULL
)
RETURNS TABLE (
  id             UUID,
  url            TEXT,
  title          TEXT,
  description    TEXT,
  og_image_url   TEXT,
  category_id    UUID,
  subcategory_id UUID,
  wilson_score   DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '45s'
AS $$
#variable_conflict use_column
DECLARE
  v_target   INTEGER;
  v_excluded TEXT[];
  v_row      RECORD;
  v_domain   TEXT;
  i          INTEGER;
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Bounded to what the edge function accepts anyway (`count` is capped at 10).
  v_target := LEAST(GREATEST(COALESCE(p_count, 5), 1), 10);

  IF p_exclude_domains IS NOT NULL AND array_length(p_exclude_domains, 1) > 0 THEN
    v_excluded := p_exclude_domains;
  END IF;

  -- Transaction-local: PostgREST runs this call in one transaction, so the flag
  -- is visible to the nested roam() calls below and gone when it commits.
  PERFORM set_config('roam.prefetch', 'on', TRUE);

  FOR i IN 1..v_target LOOP
    SELECT * INTO v_row
    FROM   public.roam(
             p_user_id,
             NULL,               -- p_collection_id: a collection is not discovery
             NULL,               -- p_exclude_domain: the array below carries it
             p_category_id,
             p_subcategory_id,
             v_excluded
           );

    -- FOUND is set by the SELECT INTO and reset by the next statement, so the
    -- exhaustion check has to happen before the domain lookup.
    EXIT WHEN NOT FOUND;

    id             := v_row.id;
    url            := v_row.url;
    title          := v_row.title;
    description    := v_row.description;
    og_image_url   := v_row.og_image_url;
    category_id    := v_row.category_id;
    subcategory_id := v_row.subcategory_id;
    wilson_score   := v_row.wilson_score;
    RETURN NEXT;

    SELECT u.domain INTO v_domain FROM urls u WHERE u.id = v_row.id;
    IF v_domain IS NOT NULL THEN
      v_excluded := COALESCE(v_excluded, ARRAY[]::TEXT[]) || v_domain;
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.roam_prefetch(UUID, INTEGER, TEXT[], UUID, UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.roam_prefetch(UUID, INTEGER, TEXT[], UUID, UUID) TO authenticated;
