-- roam() v25 — accept p_exclude_domains TEXT[] for multi-domain exclusion
-- =============================================================================
-- The extension now buffers up to 5 recent domains and passes them as an array
-- instead of a single exclude_domain string. This migration:
--   1. Adds p_exclude_domains TEXT[] parameter (optional, DEFAULT NULL)
--   2. Merges it with the existing p_exclude_domain singleton
--   3. Replaces the single-domain exclusion with array-based exclusion via ANY()
-- Backward compatible: p_exclude_domain (TEXT) is kept and merged into the array.

DROP FUNCTION IF EXISTS public.roam(UUID, UUID, TEXT, UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.roam(UUID, UUID, TEXT, UUID, UUID, TEXT[]) CASCADE;

CREATE FUNCTION public.roam(
  p_user_id          UUID,
  p_collection_id    UUID,
  p_exclude_domain   TEXT,
  p_category_id      UUID,
  p_subcategory_id   UUID,
  p_exclude_domains  TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id              UUID,
  url             TEXT,
  title           TEXT,
  description     TEXT,
  og_image_url    TEXT,
  category_id     UUID,
  subcategory_id  UUID,
  wilson_score    DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '35s'
#variable_conflict use_column
AS $$
DECLARE
  v_langs        TEXT[];
  v_discovery    TEXT;
  v_skip_paywall BOOLEAN;
  v_seen_ids     UUID[];
  v_cap          INT;
  v_excluded     TEXT[]; -- merged exclusion list
  v_result       RECORD;
BEGIN
  -- Callers may only roam as themselves.
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'You can only roam as yourself.';
  END IF;

  -- Pre-load user settings
  SELECT preferred_languages, discovery_mode, skip_paywalled
    INTO v_langs, v_discovery, v_skip_paywall
    FROM public.user_settings
   WHERE user_id = p_user_id;

  IF v_langs IS NULL THEN v_langs := ARRAY['en']; END IF;
  IF v_discovery IS NULL THEN v_discovery := 'discovery'; END IF;
  IF v_skip_paywall IS NULL THEN v_skip_paywall := FALSE; END IF;

  -- Merge exclude_domain and exclude_domains into a single array
  IF p_exclude_domains IS NOT NULL AND array_length(p_exclude_domains, 1) > 0 THEN
    v_excluded := p_exclude_domains;
    IF p_exclude_domain IS NOT NULL THEN
      -- Append the singleton domain if not already present
      IF NOT p_exclude_domain = ANY(v_excluded) THEN
        v_excluded := array_append(v_excluded, p_exclude_domain);
      END IF;
    END IF;
  ELSIF p_exclude_domain IS NOT NULL THEN
    v_excluded := ARRAY[p_exclude_domain];
  END IF;

  -- Pre-load seen URLs (capped)
  SELECT value::INT INTO v_cap FROM public.roam_config WHERE key = 'seen_url_cap';

  SELECT ARRAY(
    SELECT seen_url_id
      FROM public.seen_urls
     WHERE user_id = p_user_id
     ORDER BY seen_at DESC
     LIMIT COALESCE(v_cap, 2000)
  ) INTO v_seen_ids;

  -- ── Collection mode ───────────────────────────────────────────────────────
  IF p_collection_id IS NOT NULL THEN
    -- Phase 1: TABLESAMPLE
    SELECT u.id, u.url, u.title, u.description, u.og_image_url,
           u.category_id, u.subcategory_id,
           (u.roam_score_static
             + CASE WHEN (u.upvotes + u.downvotes) = 0 THEN 0.15 ELSE 0 END)
           AS wilson_score
      INTO v_result
      FROM public.collection_items ci
      JOIN public.urls u ON u.id = ci.url_id
     WHERE ci.collection_id = p_collection_id
       AND u.approved = TRUE
       AND u.inactive = FALSE
       AND u.language = ANY(v_langs)
       AND (v_excluded IS NULL OR u.domain != ALL(v_excluded))
       AND (v_seen_ids IS NULL OR u.id != ALL(v_seen_ids))
     ORDER BY u.roam_score_static DESC
     LIMIT 1;

    IF v_result.id IS NOT NULL THEN
      RETURN QUERY SELECT v_result.id, v_result.url, v_result.title,
                          v_result.description, v_result.og_image_url,
                          v_result.category_id, v_result.subcategory_id,
                          v_result.wilson_score;
      RETURN;
    END IF;

    -- Phase 2: fallback
    SELECT u.id, u.url, u.title, u.description, u.og_image_url,
           u.category_id, u.subcategory_id,
           (u.roam_score_static
             + CASE WHEN (u.upvotes + u.downvotes) = 0 THEN 0.15 ELSE 0 END)
           AS wilson_score
      INTO v_result
      FROM public.collection_items ci
      JOIN public.urls u ON u.id = ci.url_id
     WHERE ci.collection_id = p_collection_id
       AND u.approved = TRUE
       AND u.inactive = FALSE
       AND u.language = ANY(v_langs)
       AND (v_seen_ids IS NULL OR u.id != ALL(v_seen_ids))
     ORDER BY u.roam_score_static DESC
     LIMIT 1;

    IF v_result.id IS NOT NULL THEN
      RETURN QUERY SELECT v_result.id, v_result.url, v_result.title,
                          v_result.description, v_result.og_image_url,
                          v_result.category_id, v_result.subcategory_id,
                          v_result.wilson_score;
      RETURN;
    END IF;

    RETURN;
  END IF;

  -- ── Standard mode ─────────────────────────────────────────────────────────
  -- Phase 1: TABLESAMPLE
  SELECT u.id, u.url, u.title, u.description, u.og_image_url,
         u.category_id, u.subcategory_id,
         (u.roam_score_static
           + CASE WHEN (u.upvotes + u.downvotes) = 0 THEN 0.15 ELSE 0 END)
         AS wilson_score
    INTO v_result
    FROM public.urls u
   WHERE u.approved = TRUE
     AND u.inactive = FALSE
     AND u.language = ANY(v_langs)
     AND (p_category_id IS NULL OR u.category_id = p_category_id)
     AND (p_subcategory_id IS NULL OR u.subcategory_id = p_subcategory_id)
     AND (v_excluded IS NULL OR u.domain != ALL(v_excluded))
     AND (v_skip_paywall = FALSE OR u.domain NOT IN (SELECT domain FROM public.paywalled_domains))
     AND (v_seen_ids IS NULL OR u.id != ALL(v_seen_ids))
     AND u.wilson_score > -0.1
   ORDER BY u.roam_score_static DESC
   LIMIT 100;

  IF v_result.id IS NOT NULL THEN
    RETURN QUERY SELECT v_result.id, v_result.url, v_result.title,
                        v_result.description, v_result.og_image_url,
                        v_result.category_id, v_result.subcategory_id,
                        v_result.wilson_score;
    RETURN;
  END IF;

  -- Phase 2: wider fallback scan
  SELECT u.id, u.url, u.title, u.description, u.og_image_url,
         u.category_id, u.subcategory_id,
         (u.roam_score_static
           + CASE WHEN (u.upvotes + u.downvotes) = 0 THEN 0.15 ELSE 0 END)
         AS wilson_score
    INTO v_result
    FROM public.urls u
   WHERE u.approved = TRUE
     AND u.inactive = FALSE
     AND u.language = ANY(v_langs)
     AND (p_category_id IS NULL OR u.category_id = p_category_id)
     AND (p_subcategory_id IS NULL OR u.subcategory_id = p_subcategory_id)
     AND (v_skip_paywall = FALSE OR u.domain NOT IN (SELECT domain FROM public.paywalled_domains))
     AND (v_seen_ids IS NULL OR u.id != ALL(v_seen_ids))
     AND u.wilson_score > -0.1
   ORDER BY u.roam_score_static DESC
   LIMIT 100;

  IF v_result.id IS NOT NULL THEN
    RETURN QUERY SELECT v_result.id, v_result.url, v_result.title,
                        v_result.description, v_result.og_image_url,
                        v_result.category_id, v_result.subcategory_id,
                        v_result.wilson_score;
    RETURN;
  END IF;
END;
$$;

-- Grant execute to authenticated users
REVOKE EXECUTE ON FUNCTION public.roam(UUID, UUID, TEXT, UUID, UUID, TEXT[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.roam(UUID, UUID, TEXT, UUID, UUID, TEXT[]) TO authenticated;