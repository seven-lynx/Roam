-- Re-target submitted_by FK from auth.users to public.profiles so PostgREST
-- can navigate the profiles!submitted_by join in the admin queue query.
ALTER TABLE public.moderation_queue
  DROP CONSTRAINT moderation_queue_submitted_by_fkey,
  ADD CONSTRAINT moderation_queue_submitted_by_fkey
    FOREIGN KEY (submitted_by) REFERENCES public.profiles(id) ON DELETE CASCADE;
