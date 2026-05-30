-- =============================================================================
-- roam() v22 — topic-mode adjacent serving
-- =============================================================================
--
-- New feature: users can now select specific topics (subcategories) instead of
-- whole pillars (categories). When a user picks topics within a pillar, the
-- sibling topics they did NOT pick are still served — but at a reduced weight
-- (adjacent_weight, default 0.5) to preserve serendipitous discovery without
-- flooding results with unchosen content.
--
-- Logic:
--   v_allowed_subcat_ids  = explicitly picked subcategories  (full weight)
--   v_adjacent_subcat_ids = sibling subcats from topic-mode pillars, not picked
--                           (capped at v_adjacent_weight)
--
-- A pillar is in "topic mode" if the user has at least one subcategory row for
-- it AND no pillar-level (subcategory_id IS NULL) row.
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
#variable_conflict use_column
DECLARE
  v_url_id              UUID;
  v_url_domain          TEXT;
  v_langs               TEXT[];
  v_skip_paywall        BOOLEAN;
  v_discovery_mode      TEXT;
  v_adjacent_weight     FLOAT;
  v_allowed_subcat_ids  UUID[];
  v_adjacent_subcat_ids UUID[];
  v_allowed_cat_ids     UUID[];
  v_has_categories      BOOLEAN;
  v_adjacent_subcat_id  UUID;
  v_effective_subcat_id UUID;
  v_deep_dive_subcats   UUID[];
  -- Pre-loaded exclusion arrays (replace correlated NOT EXISTS)
  v_seen_ids            UUID[];
  v_cooled_domains      TEXT[];
  v_suppressed_domains  TEXT[];
  -- Pre-loaded interest score maps (subcategory + category fallback)
  v_score_subcats       UUID[];
  v_score_weights       DOUBLE PRECISION[];
  v_cat_score_cats      UUID[];
  v_cat_score_weights   DOUBLE PRECISION[];
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
    COALESCE(s.discovery_mode, 'discovery'),
    COALESCE(s.adjacent_weight, 0.5)
  INTO v_langs, v_skip_paywall, v_discovery_mode, v_adjacent_weight
  FROM user_settings s
  WHERE s.user_id = p_user_id;

  IF v_langs           IS NULL THEN v_langs           := ARRAY['en']; END IF;
  IF v_skip_paywall    IS NULL THEN v_skip_paywall    := FALSE;        END IF;
  IF v_discovery_mode  IS NULL THEN v_discovery_mode  := 'discovery';  END IF;
  IF v_adjacent_weight IS NULL THEN v_adjacent_weight := 0.5;          END IF;

  -- ── Load exclusion sets as arrays (3 sequential reads) ───────────────────
  -- Cap seen_urls at 2000 most-recent to bound the != ALL() array scan even if
  -- the per-user cap trigger has a backlog of older rows.
  SELECT array_agg(url_id)
  INTO   v_seen_ids
  FROM (
    SELECT url_id FROM seen_urls
    WHERE  user_id = p_user_id
    ORDER  BY seen_at DESC
    LIMIT  2000
  ) t;

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

  -- ── Load interest score maps (2 reads) ────────────────────────────────────
  -- Subcategory-level weights (for segmented URLs)
  SELECT array_agg(uis.subcategory_id ORDER BY uis.subcategory_id),
         array_agg(uis.calibrated_weight ORDER BY uis.subcategory_id)
  INTO   v_score_subcats, v_score_weights
  FROM   user_interest_scores uis
  WHERE  uis.user_id = p_user_id;

  -- Category-level weights (fallback for unsegmented URLs)
  SELECT array_agg(ucs.category_id ORDER BY ucs.category_id),
         array_agg(ucs.calibrated_weight ORDER BY ucs.category_id)
  INTO   v_cat_score_cats, v_cat_score_weights
  FROM   user_category_scores ucs
  WHERE  ucs.user_id = p_user_id;

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

  -- ── Build adjacent sibling subcategories ─────────────────────────────────
  -- For pillars where the user is in topic mode (has topic rows but no
  -- pillar-level row), collect all sibling subcats the user did NOT pick.
  -- These get served at reduced weight (v_adjacent_weight) to preserve discovery.
  SELECT array_agg(DISTINCT sc.id)
  INTO   v_adjacent_subcat_ids
  FROM   subcategories sc
  WHERE  sc.category_id IN (
           -- Pillars that have at least one topic-mode subcategory row
           SELECT DISTINCT uc.category_id
           FROM   user_categories uc
           WHERE  uc.user_id = p_user_id
             AND  uc.subcategory_id IS NOT NULL
             AND  uc.category_id NOT IN (
                    -- Exclude pillars that also have a pillar-level row
                    SELECT uc2.category_id FROM user_categories uc2
                    WHERE  uc2.user_id = p_user_id AND uc2.subcategory_id IS NULL
                  )
         )
    AND  (v_allowed_subcat_ids IS NULL OR sc.id != ALL(v_allowed_subcat_ids));

  SELECT EXISTS (SELECT 1 FROM user_categories WHERE user_id = p_user_id)
  INTO v_has_categories;

  -- Flat list of the user's declared category IDs (for filtering unsegmented
  -- URLs — a superset of the category_ids implied by v_allowed_subcat_ids)
  SELECT array_agg(DISTINCT uc.category_id)
  INTO   v_allowed_cat_ids
  FROM   user_categories uc
  WHERE  uc.user_id = p_user_id;

  -- ── Deep Dive: narrow to top-3 subcategories by calibrated_weight ─────────
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

  v_effective_subcat_id := COALESCE(p_subcategory_id, v_adjacent_subcat_id);

  -- ═══════════════════════════════════════════════════════════════════════════
  --  COLLECTION MODE
  -- ═══════════════════════════════════════════════════════════════════════════
  IF p_collection_id IS NOT NULL THEN

    -- Phase 1: TABLESAMPLE BERNOULLI(1) — ~31k rows at 3.1M scale
    SELECT c.id INTO v_url_id
    FROM (
      SELECT u.id,
             (u.roam_score_static
               + CASE WHEN (u.upvotes + u.downvotes) = 0 THEN 0.15 ELSE 0 END)
               * LEAST(GREATEST(COALESCE(
                   v_score_weights[array_position(v_score_subcats, u.subcategory_id)],
                   v_cat_score_weights[array_position(v_cat_score_cats, u.category_id)],
                   1.0), 0.4), 2.0)
               * CASE
                   WHEN u.published_at IS NULL THEN 0.7
                   ELSE GREATEST(
                     EXP(-0.001 * GREATEST(
                       EXTRACT(EPOCH FROM (NOW() - u.published_at)) / 86400.0, 0
                     )), 0.2)
                 END
               AS eff_score
      FROM   urls u TABLESAMPLE BERNOULLI(1)
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
               (u.roam_score_static
                 + CASE WHEN (u.upvotes + u.downvotes) = 0 THEN 0.15 ELSE 0 END)
                 * LEAST(GREATEST(COALESCE(
                     v_score_weights[array_position(v_score_subcats, u.subcategory_id)],
                     v_cat_score_weights[array_position(v_cat_score_cats, u.category_id)],
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
        ORDER  BY u.roam_score_static DESC
        LIMIT  50
      ) c
      ORDER BY (c.eff_score + 0.1) * random() DESC
      LIMIT 1;
    END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  --  STANDARD MODE
  -- ═══════════════════════════════════════════════════════════════════════════
  ELSE

    -- Phase 1: TABLESAMPLE BERNOULLI(1) — ~31k rows at 3.1M scale
    SELECT c.id INTO v_url_id
    FROM (
      SELECT u.id,
             (u.roam_score_static
               + CASE WHEN (u.upvotes + u.downvotes) = 0 THEN 0.15 ELSE 0 END)
               * LEAST(GREATEST(
                   CASE
                     WHEN v_adjacent_subcat_ids IS NOT NULL
                          AND u.subcategory_id IS NOT NULL
                          AND u.subcategory_id = ANY(v_adjacent_subcat_ids) THEN
                       LEAST(
                         COALESCE(v_score_weights[array_position(v_score_subcats, u.subcategory_id)], 1.0),
                         v_adjacent_weight
                       )
                     ELSE
                       COALESCE(
                         v_score_weights[array_position(v_score_subcats, u.subcategory_id)],
                         v_cat_score_weights[array_position(v_cat_score_cats, u.category_id)],
                         1.0
                       )
                   END,
                   0.4), 2.0)
               * CASE
                   WHEN u.published_at IS NULL THEN 0.7
                   ELSE GREATEST(
                     EXP(-0.001 * GREATEST(
                       EXTRACT(EPOCH FROM (NOW() - u.published_at)) / 86400.0, 0
                     )), 0.2)
                 END
               AS eff_score
      FROM   urls u TABLESAMPLE BERNOULLI(1)
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
               OR (v_adjacent_subcat_ids IS NOT NULL AND u.subcategory_id = ANY(v_adjacent_subcat_ids))
               OR (u.subcategory_id IS NULL AND v_allowed_cat_ids IS NOT NULL AND u.category_id = ANY(v_allowed_cat_ids))
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
               (u.roam_score_static
                 + CASE WHEN (u.upvotes + u.downvotes) = 0 THEN 0.15 ELSE 0 END)
                 * LEAST(GREATEST(
                     CASE
                       WHEN v_adjacent_subcat_ids IS NOT NULL
                            AND u.subcategory_id IS NOT NULL
                            AND u.subcategory_id = ANY(v_adjacent_subcat_ids) THEN
                         LEAST(
                           COALESCE(v_score_weights[array_position(v_score_subcats, u.subcategory_id)], 1.0),
                           v_adjacent_weight
                         )
                       ELSE
                         COALESCE(
                           v_score_weights[array_position(v_score_subcats, u.subcategory_id)],
                           v_cat_score_weights[array_position(v_cat_score_cats, u.category_id)],
                           1.0
                         )
                     END,
                     0.4), 2.0)
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
                 OR (v_adjacent_subcat_ids IS NOT NULL AND u.subcategory_id = ANY(v_adjacent_subcat_ids))
                 OR (u.subcategory_id IS NULL AND v_allowed_cat_ids IS NOT NULL AND u.category_id = ANY(v_allowed_cat_ids))
               )
          AND  (v_seen_ids IS NULL OR u.id != ALL(v_seen_ids))
        ORDER  BY u.roam_score_static DESC
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
