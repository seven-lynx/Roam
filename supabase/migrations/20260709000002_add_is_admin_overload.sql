-- Add is_admin(uuid) overload so evaluate_badges works when called
-- by service_role (auth.uid() returns NULL) or any authenticated user.
-- The original is_admin() (no args) checks auth.jwt() directly.
-- This overload exists only for call compatibility and delegates to the original.
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin();
$$;