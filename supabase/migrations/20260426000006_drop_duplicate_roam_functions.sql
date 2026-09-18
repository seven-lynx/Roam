-- Drop all overloaded roam() functions to resolve PostgreSQL function overloading conflict
-- Error: "Could not choose the best candidate function between: public.roam(...), public.roam(...)"
-- This happens when CREATE OR REPLACE FUNCTION changes signatures without dropping the old one first

DROP FUNCTION IF EXISTS public.roam(UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.roam(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.roam(UUID) CASCADE;

-- Now create the single clean version
CREATE FUNCTION public.roam(
  p_user_id UUID,
  p_collection_id UUID DEFAULT NULL
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

  -- Return any approved URL as a test
  RETURN QUERY
  SELECT u.id, u.url, u.title, u.description, u.og_image_url, u.subcategory_id, u.wilson_score
  FROM urls u
  WHERE u.approved = TRUE
  ORDER BY random()
  LIMIT 1;
END;
$$;
