-- Allow admins to read any profile (including private ones) so that the
-- moderation queue can display submitter names regardless of privacy setting.
DROP POLICY "profiles: public profiles readable by everyone" ON profiles;
CREATE POLICY "profiles: public profiles readable by everyone"
  ON profiles FOR SELECT
  USING (is_public = TRUE OR auth.uid() = id OR public.is_admin());
