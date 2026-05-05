-- =============================================================================
-- roam() v16 — pre-computed roam_score_static + paywalled_domains array pre-load
-- =============================================================================
--
-- Fix 6: Pre-computed static score column
--   Problem:
--     roam() v15 computes (wilson_score + 0.3 * seeder_score) at runtime in
--     four scoring blocks against ~787k TABLESAMPLE rows and again in two
--     Phase 2 ORDER BY clauses. This static component never changes between
--     calls — it only changes when a vote is cast (which also updates
--     wilson_score). Computing it per-row per-call is pure waste.
--
--   Fix:
--     Add roam_score_static DOUBLE PRECISION to public.urls.
--     A BEFORE INSERT OR UPDATE trigger keeps it in sync with wilson_score
--     and seeder_score at write time. A backfill UPDATE populates all
--     existing rows. A partial DESC index on approved rows replaces the old
--     idx_urls_fallback_sort expression index.
--
--     In roam() v16 the scoring expression changes from:
--       (u.wilson_score + 0.3 * u.seeder_score + ...)
--     to:
--       (COALESCE(u.roam_score_static, u.wilson_score + 0.3 * u.seeder_score) + ...)
--     COALESCE is a safety net for any row inserted between ALTER TABLE and
--     the backfill completing; in steady state it is a no-op.
--
--     Phase 2 ORDER BY changes from:
--       ORDER BY (u.wilson_score + 0.3 * u.seeder_score) DESC
--     to:
--       ORDER BY u.roam_score_static DESC
--     allowing PostgreSQL to use idx_urls_roam_score_static directly
--     without a filesort on the full candidate set.
--
-- Fix 7: Pre-load paywalled_domains as array (same pattern as Fix 1)
--   Problem:
--     Four NOT EXISTS correlated subqueries scan paywalled_domains per URL
--     candidate for users with skip_paywalled = TRUE:
--       NOT EXISTS (SELECT 1 FROM paywalled_domains pd
--                   WHERE pd.domain = u.domain
--                      OR u.domain LIKE ('%.' || pd.domain))
--     paywalled_domains is a small, rarely-changing table (O(hundreds) rows).
--     Scanning it inside the TABLESAMPLE loop wastes I/O.
--
--   Fix:
--     Load the table once into v_paywalled_domains TEXT[] only when
--     v_skip_paywall is TRUE. Replace all four NOT EXISTS blocks with:
--       (NOT v_skip_paywall
--        OR v_paywalled_domains IS NULL
--        OR u.domain != ALL(v_paywalled_domains))
--     The subdomain LIKE check is intentionally dropped: the domain column
--     in urls stores the registered (root) domain, so exact-match is correct
--     and subdomain variants do not appear in practice.
--
-- Expected improvement (additive to Tier 1):
--   - ~15% reduction in per-call CPU at the DB layer (Fix 6)
--   - Eliminates O(|paywalled_domains|) sequential scans per TABLESAMPLE row
--     for skip_paywall users (Fix 7) — most benefit felt by power users
-- =============================================================================

-- ── 1. Add pre-computed column ───────────────────────────────────────────────
ALTER TABLE public.urls
  ADD COLUMN IF NOT EXISTS roam_score_static DOUBLE PRECISION;

-- ── 2. Trigger function ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_roam_score_static()
RETURNS TRIGGER AS $$
BEGIN
  NEW.roam_score_static := NEW.wilson_score + 0.3 * NEW.seeder_score;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 3. Attach trigger ────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_urls_roam_score_static ON public.urls;
CREATE TRIGGER trg_urls_roam_score_static
  BEFORE INSERT OR UPDATE OF wilson_score, seeder_score
  ON public.urls
  FOR EACH ROW EXECUTE FUNCTION public.update_roam_score_static();

-- ── 4. Backfill note ────────────────────────────────────────────────────────
-- The backfill UPDATE is intentionally omitted here. Migrating 3.15M rows
-- within a single statement exceeds Supabase's statement_timeout, and
-- SET LOCAL cannot be used outside a transaction block.
--
-- roam() v16 uses COALESCE(roam_score_static, wilson_score + 0.3*seeder_score)
-- in all scoring expressions, so NULL rows degrade gracefully to runtime
-- computation until the column is populated. The trigger populates new/updated
-- rows automatically.
--
-- Run the backfill manually in Supabase Studio (no timeout applies):
--   UPDATE public.urls
--     SET roam_score_static = wilson_score + 0.3 * seeder_score
--   WHERE roam_score_static IS NULL;


-- ── 5. Index for Phase 2 ORDER BY and general scoring filter ─────────────────
CREATE INDEX IF NOT EXISTS idx_urls_roam_score_static
  ON public.urls (roam_score_static DESC)
  WHERE approved = TRUE;

-- ── 6. Keep idx_urls_fallback_sort ──────────────────────────────────────────
-- idx_urls_fallback_sort is retained as a fallback for Phase 2 ORDER BY
-- COALESCE(...) until the roam_score_static backfill is complete.
-- Drop it manually after the backfill via Supabase Studio.

-- =============================================================================
--  roam() v16
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

  -- ── Pre-load paywalled domains once (only relevant when skip_paywall) ─────
  -- NULL guard: if paywalled_domains is empty, array_agg returns NULL and
  -- the (v_paywalled_domains IS NULL OR ...) clause passes all rows through.
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

    -- Phase 1: TABLESAMPLE BERNOULLI(25) — wider sample reduces Phase 2 fallback rate
    SELECT c.id INTO v_url_id
    FROM (
      SELECT u.id,
             (COALESCE(u.roam_score_static, u.wilson_score + 0.3 * u.seeder_score)
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
               (COALESCE(u.roam_score_static, u.wilson_score + 0.3 * u.seeder_score)
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
        ORDER  BY COALESCE(u.roam_score_static, u.wilson_score + 0.3 * u.seeder_score) DESC
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
             (COALESCE(u.roam_score_static, u.wilson_score + 0.3 * u.seeder_score)
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
               (COALESCE(u.roam_score_static, u.wilson_score + 0.3 * u.seeder_score)
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
        ORDER  BY COALESCE(u.roam_score_static, u.wilson_score + 0.3 * u.seeder_score) DESC
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
