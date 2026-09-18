-- Auto-create a public.profiles row for every new auth.users insert.
--
-- Background: profile rows were previously created only when a user finished
-- /join onboarding on the web. Android and extension users who skipped /join
-- had no profile row, which caused FK violations on moderation_queue.submitted_by
-- (which references profiles.id). This trigger guarantees every authenticated
-- user has a profile so submissions, collections, follows, etc. always satisfy
-- their FK constraints. Users can still customize their username/display_name
-- via the /join flow or profile settings.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Derive a guaranteed-unique placeholder username from the user's UUID.
  -- 'user_' + first 12 hex chars of the uuid (collisions are astronomically unlikely).
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    'user_' || substr(replace(NEW.id::text, '-', ''), 1, 12),
    ''
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill any existing auth.users rows that lack a profile.
INSERT INTO public.profiles (id, username, display_name)
SELECT u.id,
       'user_' || substr(replace(u.id::text, '-', ''), 1, 12),
       ''
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;
