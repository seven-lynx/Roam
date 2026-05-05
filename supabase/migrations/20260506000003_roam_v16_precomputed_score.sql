-- =============================================================================
-- roam() v16 — paywalled_domains array pre-load (Fix 7)
-- =============================================================================
--
-- Problem:
--   Four NOT EXISTS correlated subqueries scan paywalled_domains per URL
--   candidate for users with skip_paywalled = TRUE:
--     NOT EXISTS (SELECT 1 FROM paywalled_domains pd
--                 WHERE pd.domain = u.domain
--                    OR u.domain LIKE ('%.' || pd.domain))
--   paywalled_domains is a small, rarely-changing table (O(hundreds) rows).
--   Scanning it inside the TABLESAMPLE loop over ~787k rows wastes I/O.
--
-- Fix:
--   Load the table once into v_paywalled_domains TEXT[] only when
--   v_skip_paywall is TRUE. Replace all four NOT EXISTS blocks with:
--     (NOT v_skip_paywall
--      OR v_paywalled_domains IS NULL
--      OR u.domain != ALL(v_paywalled_domains))
--   NULL guard: if paywalled_domains is empty, array_agg returns NULL and the
--   OR clause passes all rows through (correct: nothing is paywalled).
--   The subdomain LIKE check is intentionally dropped: the domain column in
--   urls stores the registered (root) domain, so exact-match is sufficient.
--
-- Note — roam_score_static column (Fix 6):
--   Adding a DOUBLE PRECISION column to the 3.15M-row urls table requires
--   ALTER TABLE, which blocks on AccessExclusiveLock contention from concurrent
--   roam() SELECT queries and exceeds Supabase's session statement_timeout.
--   The column, trigger, backfill, and index are applied in migration
--   20260506000005_roam_score_static.sql using SET statement_timeout = '0'.
--   roam() will be updated to use COALESCE(roam_score_static, ...) in v17
--   once the column exists.
-- =============================================================================

DROP FUNCTION IF EXISTS public.roam(UUID, UUID, TEXT, UUID, UUID) CASCADE;

CREATE FUNCTION public.roam(
  p_user_id         UUID,
  p_collection_id   UUID    DEFAULT NULL,
  p_exclude_domain  TEXT    DEFAULT NULL,
  p_subcategory_id  UUID    DEFAULT NULL,
  p_category_id     UUID    DEFAULT NULL
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
SET statement_timeout = '35s'
AS $$
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
  -- Pre-loaded exclusion arrays (replace correlated NOT EXISTS)
  v_seen_ids            UUID[];
  v_cooled_domains      TEXT[];
  v_suppressed_domains  TEXT[];
  -- Pre-loaded interest score map (replaces per-row LEFT JOIN)
  v_score_subcats       UUID[];
  v_score_weights       DOUBLE PRECISION[];
  -- Pre-loaded paywalled domains (replaces per-row NOT EXISTS scan, Fix 7)
  v_paywalled_domains   TEXT[];
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

  -- ── Load exclusion sets as arrays (3 sequential reads) ───────────────────
  SELECT array_agg(url_id)
  INTO   v_seen_ids
  FROM   seen_urls
  WHERE  user_id = p_user_id;

  SELECT array_agg(domain)
  INTO   v_cooled_domains
  FROM   user_domain_cooldowns
  WHERE  user_id = p_user_id
    AND  cooldown_until > NOW();

  SELECT array_agg(domain)
  INTO   v_suppressed_domains
  FROM   user_suppressed_domains
  WHERE  user_id = p_user_id
    AND  suppressed_until > NOW();

  -- ── Load interest score map as parallel arrays (1 sequential read) ────────
  SELECT array_agg(subcategory_id ORDER BY subcategory_id),
         array_agg(calibrated_weight ORDER BY subcategory_id)
  INTO   v_score_subcats, v_score_weights
  FROM   user_interest_scores
  WHERE  user_id = p_user_id;

  -- ── Pre-load paywalled domains once (only when skip_paywall is active) ────
  IF v_skip_paywall THEN
    SELECT array_agg(domain)
    INTO   v_paywalled_domains
    FROM   paywalled_domains;
  END IF;

  -- ── Expand category prefs into flat subcategory ID array ─────────────────
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

  -- ── Deep Dive: narrow to top-3 subcategories by calibrated_weight ─────────
  IF v_discovery_mode = 'deep_dive'
     AND p_subcategory_id IS NULL
     AND p_category_id    IS NULL
     AND p_collection_id  IS NULL
  THEN
    SELECT array_agg(subcategory_id)
    INTO   v_deep_dive_subcats
    FROM (
      SELECT subcategory_id
      FROM   user_interest_scores
      WHERE  user_id = p_user_id
        AND  calibrated_weight > 1.0
      ORDER  BY calibrated_weight DESC
      LIMIT  3
    ) t;
    IF v_deep_dive_subcats IS NULL OR array_length(v_deep_dive_subcats, 1) = 0 THEN
      v_deep_dive_subcats := v_allowed_subcat_ids;
    END IF;
  END IF;

  -- ── Discovery mode: 12% adjacent serving ─────────────────────────────────
  v_adjacent_subcat_id := NULL;
  IF v_discovery_mode = 'discovery'
     AND random() < 0.12
     AND p_subcategory_id IS NULL
     AND p_category_id    IS NULL
     AND p_collection_id  IS NULL
  THEN
    SELECT
      CASE WHEN ips.subcategory_a_id = uis_top.top_subcat
           THEN ips.subcategory_b_id
           ELSE ips.subcategory_a_id
      END
    INTO v_adjacent_subcat_id
    FROM (
      SELECT subcategory_id AS top_subcat
      FROM   user_interest_scores
      WHERE  user_id = p_user_id
      ORDER  BY calibrated_weight DESC
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

  v_effective_subcat_id := COALESCE(p_subcategory_id, v_adjacent_subcat_id);

  -- ═══════════════════════════════════════════════════════════════════════════
  --  COLLECTION MODE
  -- ═══════════════════════════════════════════════════════════════════════════
  IF p_collection_id IS NOT NULL THEN

    -- Phase 1: TABLESAMPLE BERNOULLI(25)
    SELECT c.id INTO v_url_id
    FROM (
      SELECT u.id,
             (u.wilson_score
               + 0.3  * u.seeder_score
               + CASE WHEN (u.upvotes + u.downvotes) = 0 THEN 0.15 ELSE 0 END)
               * LEAST(GREATEST(COALESCE(
                   v_score_weights[array_position(v_score_subcats, u.subcategory_id)],
                   1.0), 0.4), 2.0)
               * CASE
                   WHEN u.published_at IS NULL THEN 0.7
                   ELSE GREATEST(
                     EXP(-0.001 * GREATEST(
                       EXTRACT(EPOCH FROM (NOW() - u.published_at)) / 86400.0, 0
                     )), 0.2)
                 END
               AS eff_score
      FROM   urls u TABLESAMPLE BERNOULLI(25)
      INNER  JOIN collection_items ci ON ci.url_id = u.id
      WHERE  ci.collection_id = p_collection_id
        AND  u.approved       = TRUE
        AND  u.wilson_score   > -0.1
        AND  u.language       = ANY(v_langs)
        AND  (p_exclude_domain IS NULL OR u.domain IS DISTINCT FROM p_exclude_domain)
        AND  (v_suppressed_domains IS NULL OR u.domain != ALL(v_suppressed_domains))
        AND  (NOT v_skip_paywall OR v_paywalled_domains IS NULL OR u.domain != ALL(v_paywalled_domains))
        AND  (v_seen_ids IS NULL OR u.id != ALL(v_seen_ids))
    ) c
    ORDER BY (c.eff_score + 0.1) * random() DESC
    LIMIT 1;

    -- Phase 2: fallback — only when TABLESAMPLE found nothing (small collections)
    IF v_url_id IS NULL THEN
      SELECT c.id INTO v_url_id
      FROM (
        SELECT u.id,
               (u.wilson_score
                 + 0.3  * u.seeder_score
                 + CASE WHEN (u.upvotes + u.downvotes) = 0 THEN 0.15 ELSE 0 END)
                 * LEAST(GREATEST(COALESCE(
                     v_score_weights[array_position(v_score_subcats, u.subcategory_id)],
                     1.0), 0.4), 2.0)
                 * CASE
                     WHEN u.published_at IS NULL THEN 0.7
                     ELSE GREATEST(
                       EXP(-0.001 * GREATEST(
                         EXTRACT(EPOCH FROM (NOW() - u.published_at)) / 86400.0, 0
                       )), 0.2)
                   END
                 AS eff_score
        FROM   urls u
        INNER  JOIN collection_items ci ON ci.url_id = u.id
        WHERE  ci.collection_id = p_collection_id
          AND  u.approved       = TRUE
          AND  u.wilson_score   > -0.1
          AND  u.language       = ANY(v_langs)
          AND  (p_exclude_domain IS NULL OR u.domain IS DISTINCT FROM p_exclude_domain)
          AND  (v_suppressed_domains IS NULL OR u.domain != ALL(v_suppressed_domains))
          AND  (NOT v_skip_paywall OR v_paywalled_domains IS NULL OR u.domain != ALL(v_paywalled_domains))
          AND  (v_seen_ids IS NULL OR u.id != ALL(v_seen_ids))
        ORDER  BY (u.wilson_score + 0.3 * u.seeder_score) DESC
        LIMIT  50
      ) c
      ORDER BY (c.eff_score + 0.1) * random() DESC
      LIMIT 1;
    END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  --  STANDARD MODE
  -- ═══════════════════════════════════════════════════════════════════════════
  ELSE

    -- Phase 1: TABLESAMPLE BERNOULLI(25) — ~787k rows at current scale (~25% of 3.15M)
    SELECT c.id INTO v_url_id
    FROM (
      SELECT u.id,
             (u.wilson_score
               + 0.3  * u.seeder_score
               + CASE WHEN (u.upvotes + u.downvotes) = 0 THEN 0.15 ELSE 0 END)
               * LEAST(GREATEST(COALESCE(
                   v_score_weights[array_position(v_score_subcats, u.subcategory_id)],
                   1.0), 0.4), 2.0)
               * CASE
                   WHEN u.published_at IS NULL THEN 0.7
                   ELSE GREATEST(
                     EXP(-0.001 * GREATEST(
                       EXTRACT(EPOCH FROM (NOW() - u.published_at)) / 86400.0, 0
                     )), 0.2)
                 END
               AS eff_score
      FROM   urls u TABLESAMPLE BERNOULLI(25)
      WHERE  u.approved     = TRUE
        AND  u.wilson_score > -0.1
        AND  u.language     = ANY(v_langs)
        AND  (p_exclude_domain IS NULL OR u.domain IS DISTINCT FROM p_exclude_domain)
        AND  (p_category_id IS NULL OR u.category_id = p_category_id)
        AND  (v_suppressed_domains IS NULL OR u.domain != ALL(v_suppressed_domains))
        AND  (NOT v_skip_paywall OR v_paywalled_domains IS NULL OR u.domain != ALL(v_paywalled_domains))
        AND  (
               v_discovery_mode <> 'discovery'
               OR v_cooled_domains IS NULL
               OR u.domain != ALL(v_cooled_domains)
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
        AND  (v_seen_ids IS NULL OR u.id != ALL(v_seen_ids))
    ) c
    ORDER BY (c.eff_score + 0.1) * random() DESC
    LIMIT 1;

    -- Phase 2: full-scan fallback — only executed when TABLESAMPLE returned nothing
    IF v_url_id IS NULL THEN
      SELECT c.id INTO v_url_id
      FROM (
        SELECT u.id,
               (u.wilson_score
                 + 0.3  * u.seeder_score
                 + CASE WHEN (u.upvotes + u.downvotes) = 0 THEN 0.15 ELSE 0 END)
                 * LEAST(GREATEST(COALESCE(
                     v_score_weights[array_position(v_score_subcats, u.subcategory_id)],
                     1.0), 0.4), 2.0)
                 * CASE
                     WHEN u.published_at IS NULL THEN 0.7
                     ELSE GREATEST(
                       EXP(-0.001 * GREATEST(
                         EXTRACT(EPOCH FROM (NOW() - u.published_at)) / 86400.0, 0
                       )), 0.2)
                   END
                 AS eff_score
        FROM   urls u
        WHERE  u.approved     = TRUE
          AND  u.wilson_score > -0.1
          AND  u.language     = ANY(v_langs)
          AND  (p_exclude_domain IS NULL OR u.domain IS DISTINCT FROM p_exclude_domain)
          AND  (p_category_id IS NULL OR u.category_id = p_category_id)
          AND  (v_suppressed_domains IS NULL OR u.domain != ALL(v_suppressed_domains))
          AND  (NOT v_skip_paywall OR v_paywalled_domains IS NULL OR u.domain != ALL(v_paywalled_domains))
          AND  (
                 v_discovery_mode <> 'discovery'
                 OR v_cooled_domains IS NULL
                 OR u.domain != ALL(v_cooled_domains)
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
          AND  (v_seen_ids IS NULL OR u.id != ALL(v_seen_ids))
        ORDER  BY (u.wilson_score + 0.3 * u.seeder_score) DESC
        LIMIT  100
      ) c
      ORDER BY (c.eff_score + 0.1) * random() DESC
      LIMIT 1;
    END IF;

  END IF;

  -- ── Record seen + domain cooldown ─────────────────────────────────────────
  IF v_url_id IS NOT NULL THEN
    INSERT INTO seen_urls (user_id, url_id)
    VALUES (p_user_id, v_url_id)
    ON CONFLICT (user_id, url_id) DO NOTHING;

    IF v_discovery_mode = 'discovery' AND p_collection_id IS NULL THEN
      SELECT domain INTO v_url_domain FROM urls WHERE id = v_url_id;
      IF v_url_domain IS NOT NULL THEN
        INSERT INTO user_domain_cooldowns (user_id, domain, cooldown_until)
        VALUES (p_user_id, v_url_domain, NOW() + INTERVAL '30 minutes')
        ON CONFLICT (user_id, domain) DO UPDATE
          SET cooldown_until = NOW() + INTERVAL '30 minutes';
      END IF;
    END IF;
  END IF;

  RETURN QUERY
  SELECT u.id, u.url, u.title, u.description, u.og_image_url,
         u.category_id, u.subcategory_id, u.wilson_score
  FROM   urls u
  WHERE  u.id = v_url_id;
END;
$$;

