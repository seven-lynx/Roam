-- Moderator role: is_moderator() helper + expanded RLS policies
-- Applied directly via Supabase MCP on 2026-07-02

CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'moderator'),
    FALSE
  )
$$;

DROP POLICY IF EXISTS "moderation_queue: submitter and admin can read" ON public.moderation_queue;
CREATE POLICY "moderation_queue: submitter and moderator can read"
  ON public.moderation_queue FOR SELECT
  USING (auth.uid() = submitted_by OR public.is_moderator());

DROP POLICY IF EXISTS "moderation_queue: admin can update" ON public.moderation_queue;
CREATE POLICY "moderation_queue: moderator can update"
  ON public.moderation_queue FOR UPDATE
  USING (public.is_moderator());

DROP POLICY IF EXISTS "urls: admin can insert" ON public.urls;
CREATE POLICY "urls: moderator can insert"
  ON public.urls FOR INSERT
  WITH CHECK (public.is_moderator());

DROP POLICY IF EXISTS "urls: admin can update" ON public.urls;
CREATE POLICY "urls: moderator can update"
  ON public.urls FOR UPDATE
  USING (public.is_moderator());
