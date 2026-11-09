-- ============================================================================
-- roam() v39: record why a serve found nothing (issue #120)
-- ============================================================================
-- Supersedes the v38 body (20261109060000_roam_v38_prefetch_skips_state.sql)
-- with one addition: immediately before the single RETURN QUERY, a zero-row
-- serve records its reason in user_exhaustion_state. The edge function reads it
-- back and explains the 404. Nothing else about roam() changes.
--
-- Why a full copy rather than an in-place patch: v32 patched a deployed body by
-- string replacement and therefore gave each environment a different function,
-- depending on which base version it happened to be running. A copy is one
-- unambiguous definition everywhere.
--
-- The signature is byte-identical to v38 on purpose. A new argument would create
-- a second overload, and PostgREST resolves roam() by argument names, so two
-- overloads make every call ambiguous (verify-roam-rpc.mjs guards this). For the
-- same reason the reason is a stored row and not a return column:
-- CREATE OR REPLACE cannot change a return type.
--
-- Deploy order: after 20261109130000_user_exhaustion_state.sql (this calls
-- record_exhaustion()), and before the edge function that reads the reason back.
-- ============================================================================

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

  -- Issue #120 (roam v39). A serve that finds nothing records *why*, so the edge
  -- function can explain the 404 instead of leaving the user at a dead end. The
  -- reason reuses probes this function already ran: v_pool_check is the loose pool
  -- (seen-filter only, no cooldowns), v_strict_pool also applies cooldowns,
  -- suppression, paywall and exclusions, and v_cooled_domains IS NULL means the
  -- user has no live cooldown at all.
  --
  -- Prefetch is excluded for exactly the reason mark_url_seen() is above: a
  -- prefetch is not a serve, so it must not claim the user is exhausted (#122).
  --
  -- Keep the two CASEs in lockstep. record_exhaustion() rejects a non-NULL
  -- available_later when the reason is not cooldown (CHECK constraint in
  -- 20261109130000_user_exhaustion_state.sql), and a raise here would turn every
  -- empty serve into an error rather than an explanation.
  IF v_url_id IS NULL
     AND COALESCE(current_setting('roam.prefetch', TRUE), 'off') <> 'on' THEN
    PERFORM public.record_exhaustion(
      p_user_id,
      CASE
        WHEN p_collection_id  IS NOT NULL THEN 'collection:'  || p_collection_id::text
        WHEN p_subcategory_id IS NOT NULL THEN 'subcategory:' || p_subcategory_id::text
        WHEN p_category_id    IS NOT NULL THEN 'category:'    || p_category_id::text
        ELSE 'global'
      END,
      CASE
        WHEN NOT COALESCE(v_pool_check, TRUE) THEN 'pool_empty'
        WHEN NOT COALESCE(v_strict_pool, FALSE) AND v_cooled_domains IS NOT NULL
          THEN 'cooldown'
        ELSE 'filters'
      END,
      CASE
        WHEN NOT COALESCE(v_pool_check, TRUE) THEN NULL
        WHEN NOT COALESCE(v_strict_pool, FALSE) AND v_cooled_domains IS NOT NULL THEN
          (SELECT MIN(c.cooldown_until)
             FROM public.user_domain_cooldowns c
            WHERE c.user_id = p_user_id AND c.cooldown_until > now())
        ELSE NULL
      END
    );
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
