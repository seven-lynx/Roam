-- Re-target collections.user_id FK from auth.users to public.profiles so
-- PostgREST can resolve the collections → profiles(...) embed used by
-- /c/[slug] and /u/[username]. The previous FK to auth.users caused
-- PostgREST to throw "Could not find a relationship" and the affected
-- pages 404'd silently.
--
-- Safe because the on_auth_user_created trigger (migration 20260530000000)
-- guarantees every authenticated user has a profile row, so the new FK
-- constraint always has a valid target.

ALTER TABLE public.collections
  DROP CONSTRAINT IF EXISTS collections_user_id_fkey,
  ADD CONSTRAINT collections_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
