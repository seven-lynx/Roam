-- roam() v25 — add p_exclude_domains TEXT[] parameter
-- Applied manually because the original .skip file was intentionally skipped.
-- The edge function sends p_exclude_domains as TEXT[] but the DB function only
-- had 5 parameters, causing a 500 error on every roam() call.

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
AS $$
DECLARE
  v_langs        TEXT[];
  v_discovery    TEXT;
  v_skip_paywall BOOLEAN;
  v_seen_ids     UUID[];
  v_cap          INT;
  v_excluded     TEXT[];
  v_result       RECORD;
BEGIN
  -- Callers may only roam as themselves.
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'You can only roam as yourself.';
  END IF;

  -- Pre-load user settings
  SELECT us.preferred_languages, us.discovery_mode, us.skip_paywalled
    INTO v_langs, v_discovery, v_skip_paywall
    FROM public.user_settings us
   WHERE us.user_id = p_user_id;

  IF v_langs IS NULL THEN v_langs := ARRAY['en']; END IF;
  IF v_discovery IS NULL THEN v_discovery := 'discovery'; END IF;
  IF v_skip_paywall IS NULL THEN v_skip_paywall := FALSE; END IF;

  -- Merge exclude_domain and exclude_domains into a single array
  IF p_exclude_domains IS NOT NULL AND array_length(p_exclude_domains, 1) > 0 THEN
    v_excluded := p_exclude_domains;
    IF p_exclude_domain IS NOT NULL THEN
      IF NOT p_exclude_domain = ANY(v_excluded) THEN
        v_excluded := array_append(v_excluded, p_exclude_domain);
      END IF;
    END IF;
  ELSIF p_exclude_domain IS NOT NULL THEN
    v_excluded := ARRAY[p_exclude_domain];
  END IF;

  -- Pre-load seen URLs (capped)
  SELECT rc.value::INT INTO v_cap FROM public.roam_config rc WHERE rc.key = 'seen_url_cap';

  SELECT ARRAY(
    SELECT su.url_id
      FROM public.seen_urls su
     WHERE su.user_id = p_user_id
     ORDER BY su.seen_at DESC
     LIMIT COALESCE(v_cap, 2000)
  ) INTO v_seen_ids;

  -- Collection mode
  IF p_collection_id IS NOT NULL THEN
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

    -- Fallback without domain exclusion
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

  -- Standard mode — Phase 1
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
     AND (v_skip_paywall = FALSE OR u.domain NOT IN (SELECT pd.domain FROM public.paywalled_domains pd))
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

  -- Phase 2: wider fallback
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
     AND (v_skip_paywall = FALSE OR u.domain NOT IN (SELECT pd.domain FROM public.paywalled_domains pd))
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

REVOKE EXECUTE ON FUNCTION public.roam(UUID, UUID, TEXT, UUID, UUID, TEXT[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.roam(UUID, UUID, TEXT, UUID, UUID, TEXT[]) TO authenticated;
