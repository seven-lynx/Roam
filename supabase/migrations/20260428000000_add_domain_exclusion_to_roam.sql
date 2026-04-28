-- Add domain exclusion to roam() function to prevent same-domain repetition
DROP FUNCTION IF EXISTS public.roam(UUID, UUID) CASCADE;

CREATE FUNCTION public.roam(
  p_user_id UUID,
  p_collection_id UUID DEFAULT NULL,
  p_exclude_domain TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  url TEXT,
  title TEXT,
  description TEXT,
  og_image_url TEXT,
  subcategory_id UUID,
  wilson_score DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Simple auth check
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: % vs %', auth.uid()::text, p_user_id::text;
  END IF;

  -- Return approved URL, excluding the specified domain if provided
  RETURN QUERY
  SELECT u.id, u.url, u.title, u.description, u.og_image_url, u.subcategory_id, u.wilson_score
  FROM urls u
  WHERE u.approved = TRUE
    AND (
      p_exclude_domain IS NULL
      OR (u.url !~ ('^https?://([^/]*\.)?(' || regexp_replace(p_exclude_domain, '\.', '\.', 'g') || ')(/|$)')::text)
    )
  ORDER BY random()
  LIMIT 1;
END;
$$;
